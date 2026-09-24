import { getServerBaseUrl } from "@/api/client/server-url"
import { useMutation, UseMutationOptions, useQuery, UseQueryOptions } from "@tanstack/react-query"
import { useEffect } from "react"
import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"

const baseUrlCache = new Map<string, string>()

export class ApiError extends Error {
    constructor(
        public readonly message: string,
        public readonly status: number,
        public readonly data?: unknown
    ) {
        super(message);
        this.name = "ApiError";
    }
}

/** 502/503/504: backend arrancando o gateway caído. Transitorio, vale reintentar. */
export function isTransientStatus(status: number): boolean {
    return status === 502 || status === 503 || status === 504
}

/** true si el error indica que el backend todavía no está disponible. */
export function isBackendUnavailableError(error: unknown): boolean {
    return error instanceof ApiError && isTransientStatus(error.status)
}

type SeaQuery<D> = {
    endpoint: string
    method: "POST" | "GET" | "PATCH" | "DELETE" | "PUT"
    data?: D
    params?: D
    password?: string
    signal?: AbortSignal
    /** Deja que la petición sobreviva al cierre de la pestaña (pagehide). */
    keepalive?: boolean
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function buildSeaQuery<T, D = void>(
    {
        endpoint,
        method,
        data,
        params,
        password,
        signal,
        keepalive,
    }: SeaQuery<D>): Promise<T | undefined> {

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
    }

    if (data !== undefined) {
        headers["Content-Type"] = "application/json"
    }

    if (password) {
        headers["Authorization"] = `Bearer ${password}`
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
            });

            if (res.status === 204) {
                return undefined
            }

            if (!res.ok) {
                let errorData: unknown;
                const text = await res.text();
                try {
                    errorData = JSON.parse(text);
                } catch {
                    errorData = text;
                }

                // If 502, 503, 504, 429 -> retry silenciosamente solo si es idempotente
                if (isIdempotent && (res.status === 429 || isTransientStatus(res.status)) && attempt < maxRetries) {
                    attempt++
                    const delay = 300 * attempt
                    await sleep(delay)
                    continue
                }

                const errorMessage = typeof errorData === "object" && errorData !== null && "error" in errorData && typeof (errorData as Record<string, unknown>).error === "string"
                    ? (errorData as Record<string, unknown>).error as string
                    : `HTTP Error ${res.status}`;
                throw new ApiError(errorMessage, res.status, errorData);
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
    throwOnError?: boolean
}

export function useServerMutation<R = void, V = void, C = unknown>(
    {
        endpoint,
        method,
        ...options
    }: ServerMutationProps<R, V, C>) {

    const navigate = useNavigate()

    const password = undefined

    return useMutation<R | undefined, ApiError, V, C>({
        onError: (...args) => {
            const [error] = args;
            const isUnauth = error.status === 401 ||
                error.data === "UNAUTHENTICATED" ||
                (typeof error.data === "object" && error.data !== null && (error.data as Record<string, unknown>).error === "UNAUTHENTICATED")
            if (isUnauth) {
                toast.error("Sesión no autorizada o expirada", { id: "mutation-err-unauth" })
                navigate({ to: "/settings", search: { tab: "system" }, replace: true }).catch(() => {})
            } else {
                const errorMsg = _handleSeaError(error.data)
                if (errorMsg.includes("feature disabled")) {
                    toast.warning("This feature is disabled")
                } else {
                    toast.error(errorMsg)
                }
            }
            if (options.onError) {
                options.onError(...args)
            }
        },
        mutationFn: async (variables) => {
            return buildSeaQuery<R, V>({
                endpoint: endpoint,
                method: method,
                data: variables,
                password: password,
            })
        },
        ...options,
    })
}

type ServerQueryProps<R, V, TData = R | undefined> = Omit<UseQueryOptions<R | undefined, ApiError, TData>, "queryFn"> & {
    endpoint: string
    method: "POST" | "GET" | "PATCH" | "DELETE" | "PUT"
    params?: V
    data?: V
    muteError?: boolean
    throwOnError?: boolean
}

export function useServerQuery<R, V = void, TData = R | undefined>(
    {
        endpoint,
        method,
        params,
        data,
        muteError,
        ...options
    }: ServerQueryProps<R, V, TData>) {

    const navigate = useNavigate()

    const props = useQuery<R | undefined, ApiError, TData>({
        queryFn: async ({ signal }) => {
            return buildSeaQuery<R, V>({
                endpoint: endpoint,
                method: method,
                params: params,
                data: data,
                signal,
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
                // Redirect to settings so user can reconfigure if needed
                navigate({ to: "/settings", search: { tab: "system" }, replace: true }).catch(() => {})
                return
            }
            const errorMsg = _handleSeaError(props.error.data || props.error.message)
            if (errorMsg.includes("feature disabled")) {
                return
            }
            if (!!errorMsg) {
                toast.error(errorMsg, { id: `query-err-${props.error.message}` })
            }
        }
    }, [props.error, props.isError, muteError, navigate])

    return props
}

//----------------------------------------------------------------------------------------------------------------------

function _handleSeaError(data: unknown): string {
    if (typeof data === "string") return "Server Error: " + data

    if (typeof data !== "object" || data === null) return "Unknown error"

    const err = "error" in data && typeof (data as Record<string, unknown>).error === "string"
        ? (data as Record<string, unknown>).error as string
        : undefined

    if (!err) return "Unknown error"

    if (err.includes("Too many requests"))
        return "Platform: Too many requests, please wait a moment and try again."

    try {
        const graphqlErr = JSON.parse(err) as { graphqlErrors?: Array<{ message?: string }> }
        if (graphqlErr.graphqlErrors && graphqlErr.graphqlErrors.length > 0 && !!graphqlErr.graphqlErrors[0]?.message) {
            return "Platform error: " + graphqlErr.graphqlErrors[0]?.message
        }
        return "Platform error"
    }
    catch {
        if (err.includes("no cached data") || err.includes("cache lookup failed")) {
            return ""
        }
        return "Error: " + err
    }
}


