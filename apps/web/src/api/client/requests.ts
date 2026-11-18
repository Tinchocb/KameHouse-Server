import { getServerBaseUrl } from "@/api/client/server-url"
import { getAuthorizationHeaders, setServerSession } from "@/api/client/auth"
import { isFeatureDisabledError, translateServerError } from "@/api/client/error-messages"
import { useMutation, UseMutationOptions, useQuery, UseQueryOptions } from "@tanstack/react-query"
import { useEffect } from "react"
import { toast } from "sonner"

const baseUrlCache = new Map<string, string>()

export class ApiError extends Error {
    constructor(
        public readonly message: string,
        public readonly status: number,
        public readonly data?: unknown,
        /** Milisegundos que pide esperar el servidor (cabecera Retry-After), si la envió. */
        public readonly retryAfterMs?: number
    ) {
        super(message);
        this.name = "ApiError";
    }
}

/** 502/503/504: backend arrancando o gateway caído. Transitorio, vale reintentar. */
export function isTransientStatus(status: number): boolean {
    return status === 502 || status === 503 || status === 504
}

const MAX_RETRY_AFTER_MS = 10_000

/** Retry-After en segundos o como fecha HTTP, acotado a 10 s. Undefined si no hay cabecera válida. */
export function parseRetryAfterMs(value: string | null): number | undefined {
    if (!value) return undefined
    const seconds = Number(value)
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS)
    const at = Date.parse(value)
    if (Number.isNaN(at)) return undefined
    return Math.min(Math.max(at - Date.now(), 0), MAX_RETRY_AFTER_MS)
}

/** true si el error indica que el backend todavía no está disponible. */
export function isBackendUnavailableError(error: unknown): boolean {
    return error instanceof ApiError && isTransientStatus(error.status)
}

/** true si el servidor respondió 404: el recurso no existe (distinto de un servidor caído). */
export function isNotFoundError(error: unknown): boolean {
    return error instanceof ApiError && error.status === 404
}

type ApiQuery<D> = {
    endpoint: string
    method: "POST" | "GET" | "PATCH" | "DELETE" | "PUT"
    data?: D
    params?: D
    signal?: AbortSignal
    /** Deja que la petición sobreviva al cierre de la pestaña (pagehide). */
    keepalive?: boolean
    cache?: RequestCache
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function buildApiQuery<T, D = void>(
    {
        endpoint,
        method,
        data,
        params,
        signal,
        keepalive,
        cache,
    }: ApiQuery<D>): Promise<T | undefined> {

    const base = getServerBaseUrl() || (typeof window !== "undefined" ? window.location.origin : "http://localhost")
    let url: URL
    try {
        let baseToUse = baseUrlCache.get(base)
        if (!baseToUse) {
            if (baseUrlCache.size >= 20) {
                baseUrlCache.clear()
            }
            baseUrlCache.set(base, base)
            baseToUse = base
        }
        url = new URL(endpoint, baseToUse)
    } catch (e) {
        console.error("FAILED URL:", endpoint, base)
        throw e
    }
    if (params) {
        // Append query parameters
        Object.keys(params as Record<string, unknown>).forEach((key) => {
            const value = (params as Record<string, unknown>)[key];
            if (value !== undefined && value !== null) {
                if (Array.isArray(value)) {
                    value.forEach(v => url.searchParams.append(key, String(v)));
                } else {
                    url.searchParams.append(key, String(value));
                }
            }
        });
    }

    const headers: Record<string, string> = {
        "Accept": "application/json",
        ...getAuthorizationHeaders(),
    }

    if (data !== undefined) {
        headers["Content-Type"] = "application/json"
    }

    // Solo reintentar automáticamente métodos idempotentes seguros (GET)
    const isIdempotent = method === "GET"
    const maxRetries = isIdempotent ? 2 : 0
    let attempt = 0

    while (attempt <= maxRetries) {
        try {
            const res = await fetch(url.toString(), {
                method,
                headers,
                body: data !== undefined ? JSON.stringify(data) : undefined,
                signal,
                keepalive,
                cache,
            });

            if (res.status === 204) {
                return undefined
            }

            if (!res.ok) {
                if (res.status === 401) setServerSession(null)
                let errorData: unknown;
                const text = await res.text();
                try {
                    errorData = JSON.parse(text);
                } catch {
                    errorData = text;
                }

                // 429 se reintenta con backoff. 502/503/504 solo si el servidor indica cuándo volver (Retry-After):
                // un 503 sin cabecera es permanente (p. ej. TMDB sin clave) y reintentarlo generaba tormentas.
                const retryAfterMs = parseRetryAfterMs(res.headers.get("Retry-After"))
                const retryable = res.status === 429 || (isTransientStatus(res.status) && retryAfterMs !== undefined)
                if (isIdempotent && retryable && attempt < maxRetries) {
                    attempt++
                    const delay = retryAfterMs ?? 300 * attempt
                    await sleep(delay)
                    continue
                }

                const errorMessage = typeof errorData === "object" && errorData !== null && "error" in errorData && typeof (errorData as Record<string, unknown>).error === "string"
                    ? (errorData as Record<string, unknown>).error as string
                    : `HTTP Error ${res.status}`;
                throw new ApiError(errorMessage, res.status, errorData, retryAfterMs);
            }

            const text = await res.text()
            if (!text) return undefined as T

            let json: unknown
            try {
                json = JSON.parse(text)
            } catch {
                throw new ApiError("Respuesta no JSON del servidor", res.status, text.slice(0, 2000))
            }
            
            // Soporta tanto envoltorio { data: T } como respuestas directas T o arrays [...]
            if (json && typeof json === "object" && !Array.isArray(json) && "error" in json && json.error) {
                throw new ApiError(String(json.error), res.status, json)
            }

            if (json && typeof json === "object" && !Array.isArray(json) && "data" in json) {
                return json.data as T
            }

            return json as T

        } catch (error) {
            if (signal?.aborted) {
                throw error
            }
            if (isIdempotent && error instanceof TypeError && attempt < maxRetries) {
                attempt++
                const delay = 200 * attempt
                await sleep(delay)
                continue
            }
            throw error
        }
    }

    return undefined;
}

type ServerMutationProps<R, V = void, C = unknown> = Omit<UseMutationOptions<R | undefined, ApiError, V, C>, "mutationFn"> & {
    endpoint: string
    method: "POST" | "GET" | "PATCH" | "DELETE" | "PUT"
}

export function useServerMutation<R = void, V = void, C = unknown>(
    {
        endpoint,
        method,
        ...options
    }: ServerMutationProps<R, V, C>) {

    return useMutation<R | undefined, ApiError, V, C>({
        ...options,
        // Un onError propio reemplaza el toast genérico (continuity/chronology lo
        // necesitan), pero el 401 se maneja siempre aquí.
        onError: (...args) => {
            const [error] = args;
            const isUnauth = error.status === 401 ||
                error.data === "UNAUTHENTICATED" ||
                (typeof error.data === "object" && error.data !== null && (error.data as Record<string, unknown>).error === "UNAUTHENTICATED")
            if (isUnauth) {
                toast.error("Sesión no autorizada o expirada", { id: "mutation-err-unauth" })
                setServerSession(null)
            } else if (!options.onError) {
                const errorMsg = _handleApiError(error.data)
                if (errorMsg === FEATURE_DISABLED_MESSAGE) {
                    toast.warning(errorMsg)
                } else {
                    toast.error(errorMsg)
                }
            }
            return options.onError?.(...args)
        },
        mutationFn: async (variables) => {
            return buildApiQuery<R, V>({
                endpoint: endpoint,
                method: method,
                data: variables,
            })
        },
    })
}

type ServerQueryProps<R, V, TData = R | undefined> = Omit<UseQueryOptions<R | undefined, ApiError, TData>, "queryFn"> & {
    cache?: RequestCache
    endpoint: string
    method: "POST" | "GET" | "PATCH" | "DELETE" | "PUT"
    params?: V
    data?: V
    muteError?: boolean
}

export function useServerQuery<R, V = void, TData = R | undefined>(
    {
        endpoint,
        method,
        params,
        data,
        muteError,
        cache,
        ...options
    }: ServerQueryProps<R, V, TData>) {

    const props = useQuery<R | undefined, ApiError, TData>({
        queryFn: async ({ signal }) => {
            return buildApiQuery<R, V>({
                endpoint: endpoint,
                method: method,
                params: params,
                data: data,
                signal,
                cache,
            })
        },
        ...options,
    })

    useEffect(() => {
        if (!muteError && props.isError && props.error) {
            const isUnauth = props.error.status === 401 ||
                props.error.data === "UNAUTHENTICATED" ||
                (typeof props.error.data === "object" && props.error.data !== null && (props.error.data as Record<string, unknown>).error === "UNAUTHENTICATED")

            if (isUnauth) {
                toast.error("Sesión no autorizada o expirada", { id: "query-err-unauth" })
                setServerSession(null)
                return
            }
            const errorMsg = _handleApiError(props.error.data || props.error.message)
            if (errorMsg === FEATURE_DISABLED_MESSAGE) {
                return
            }
            if (errorMsg) {
                toast.error(errorMsg, { id: `query-err-${props.error.message}` })
            }
        }
    }, [props.error, props.isError, muteError])

    return props
}

//----------------------------------------------------------------------------------------------------------------------

const FEATURE_DISABLED_MESSAGE = "Esta función está desactivada en la configuración."

function _handleApiError(data: unknown): string {
    if (typeof data === "string") {
        return isFeatureDisabledError(data) ? FEATURE_DISABLED_MESSAGE : translateServerError(data)
    }

    if (typeof data !== "object" || data === null) return "Error desconocido"

    const err = "error" in data && typeof (data as Record<string, unknown>).error === "string"
        ? (data as Record<string, unknown>).error as string
        : undefined

    if (!err) return "Error desconocido"

    if (err === "ENDPOINT_RESTRICTED_TO_LOCALHOST")
        return "Esta acción solo se puede hacer desde el equipo donde corre KameHouse (o configurá una contraseña del servidor)."

    if (isFeatureDisabledError(err)) return FEATURE_DISABLED_MESSAGE

    if (err.includes("Too many requests"))
        return translateServerError(err)

    try {
        const graphqlErr = JSON.parse(err) as { graphqlErrors?: Array<{ message?: string }> }
        if (graphqlErr.graphqlErrors && graphqlErr.graphqlErrors.length > 0 && !!graphqlErr.graphqlErrors[0]?.message) {
            return "Error de la plataforma: " + graphqlErr.graphqlErrors[0]?.message
        }
        return "Error de la plataforma"
    }
    catch {
        if (err.includes("no cached data") || err.includes("cache lookup failed")) {
            return ""
        }
        return translateServerError(err)
    }
}


