import { getServerBaseUrl } from "@/api/client/server-url"
import { useMutation, UseMutationOptions, useQuery, UseQueryOptions } from "@tanstack/react-query"
import { useAtomValue, atom, useAtom } from "jotai"
import { useLocation } from "@tanstack/react-router"
import { useEffect } from "react"
import { toast } from "sonner"

// Stub atom – auth is not in use for the standalone UI
const serverAuthTokenAtom = atom<string | undefined>(undefined)

export class APIError extends Error {
    status: number;
    data: any;

    constructor(message: string, status: number, data: any) {
        super(message);
        this.name = "APIError";
        this.status = status;
        this.data = data;
    }
}

type SeaQuery<D> = {
    endpoint: string
    method: "POST" | "GET" | "PATCH" | "DELETE" | "PUT"
    data?: D
    params?: D
    password?: string
}

export function useSeaQuery() {
    const password = useAtomValue(serverAuthTokenAtom)

    return {
        seaFetch: <T, D = void>(endpoint: string, method: "POST" | "GET" | "PATCH" | "DELETE" | "PUT", data?: D, params?: D) => {
            return buildSeaQuery<T, D>({
                endpoint,
                method,
                data,
                params,
                password,
            })
        },
    }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function buildSeaQuery<T, D = void>(
    {
        endpoint,
        method,
        data,
        params,
        password,
    }: SeaQuery<D>): Promise<T | undefined> {

    const url = new URL(getServerBaseUrl() + endpoint)
    if (params) {
        // Append query parameters
        Object.keys(params as Record<string, unknown>).forEach((key) => {
            const value = (params as Record<string, unknown>)[key];
            if (value !== undefined) {
                if (Array.isArray(value)) {
                    value.forEach(v => url.searchParams.append(key, String(v)));
                } else {
                    url.searchParams.append(key, String(value));
                }
            }
        });
    }

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    if (password) {
        headers["Authorization"] = `Bearer ${password}`
    }

    const maxRetries = 3;
    let attempt = 0;

    while (attempt <= maxRetries) {
        try {
            const res = await fetch(url.toString(), {
                method,
                headers,
                body: data !== undefined ? JSON.stringify(data) : undefined,
            });

            if (!res.ok) {
                let errorData: any;
                try {
                    errorData = await res.json();
                } catch {
                    errorData = await res.text();
                }

                // If 502, 503, 504, 429 -> retry
                if ((res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) && attempt < maxRetries) {
                    attempt++;
                    const delay = 1000 * Math.pow(2, attempt - 1);
                    console.warn(`[API] Request failed with ${res.status}. Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`);
                    await sleep(delay);
                    continue;
                }

                throw new APIError(errorData?.error || `HTTP Error ${res.status}`, res.status, errorData);
            }

            // Expected response format: { data: T, error?: string } or similar
            const json = await res.json();
            const response = _handleSeaResponse<T>(json);

            if (response.error) {
                throw new APIError(response.error, res.status, json);
            }
            return response.data;

        } catch (error) {
            // Network errors or already thrown APIError
            if (error instanceof TypeError && attempt < maxRetries) { // fetch throws TypeError on network failure
                attempt++;
                const delay = 1000 * Math.pow(2, attempt - 1);
                console.warn(`[API] Network error. Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`);
                await sleep(delay);
                continue;
            }
            throw error;
        }
    }

    return undefined; // Should not reach here
}

type ServerMutationProps<R, V = void, C = unknown> = Omit<UseMutationOptions<R | undefined, APIError, V, C>, "mutationFn"> & {
    endpoint: string
    method: "POST" | "GET" | "PATCH" | "DELETE" | "PUT"
}

export function useServerMutation<R = void, V = void, C = unknown>(
    {
        endpoint,
        method,
        ...options
    }: ServerMutationProps<R, V, C>) {

    const password = useAtomValue(serverAuthTokenAtom)

    return useMutation<R | undefined, APIError, V, C>({
        onError: (...args) => {
            const [error, variables, context] = args;
            console.log("Mutation error", error)
            const errorMsg = _handleSeaError(error.data)
            if (errorMsg.includes("feature disabled")) {
                toast.warning("This feature is disabled")
            } else {
                toast.error(errorMsg)
            }
            if (options.onError) {
                // @ts-ignore
                options.onError(...args);
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

type ServerQueryProps<R, V> = Omit<UseQueryOptions<R | undefined, APIError, R | undefined>, "queryFn"> & {
    endpoint: string
    method: "POST" | "GET" | "PATCH" | "DELETE" | "PUT"
    params?: V
    data?: V
    muteError?: boolean
}

export function useServerQuery<R, V = void>(
    {
        endpoint,
        method,
        params,
        data,
        muteError,
        ...options
    }: ServerQueryProps<R, V>) {

    const pathname = useLocation().pathname
    const [password, setPassword] = useAtom(serverAuthTokenAtom)

    const props = useQuery<R | undefined, APIError>({
        queryFn: async () => {
            return buildSeaQuery<R, V>({
                endpoint: endpoint,
                method: method,
                params: params,
                data: data,
                password: password,
            })
        },
        ...options,
    })

    useEffect(() => {
        if (!muteError && props.isError) {
            if (props.error?.data?.error === "UNAUTHENTICATED" && pathname !== "/public/auth") {
                setPassword(undefined)
                window.location.href = "/public/auth"
                return
            }
            console.log("Server error", props.error)
            const errorMsg = _handleSeaError(props.error?.data)
            if (errorMsg.includes("feature disabled")) {
                return
            }
            if (!!errorMsg) {
                toast.error(errorMsg)
            }
        }
    }, [props.error, props.isError, muteError, pathname, setPassword])

    return props
}

//----------------------------------------------------------------------------------------------------------------------

function _handleSeaError(data: unknown): string {
    if (typeof data === "string") return "Server Error: " + data

    const dataObj = data as Record<string, unknown>
    const err = dataObj?.error as string

    if (!err) return "Unknown error"

    if (err.includes("Too many requests"))
        return "AniList: Too many requests, please wait a moment and try again."

    try {
        const graphqlErr = JSON.parse(err) as { graphqlErrors?: Array<{ message?: string }> }
        console.log("AniList error", graphqlErr)
        if (graphqlErr.graphqlErrors && graphqlErr.graphqlErrors.length > 0 && !!graphqlErr.graphqlErrors[0]?.message) {
            return "AniList error: " + graphqlErr.graphqlErrors[0]?.message
        }
        return "AniList error"
    }
    catch (e) {
        if (err.includes("no cached data") || err.includes("cache lookup failed")) {
            return ""
        }
        return "Error: " + err
    }
}

function _handleSeaResponse<T>(res: unknown): { data?: T; error?: string } {
    if (typeof res === "object" && res !== null) {
        const obj = res as Record<string, unknown>
        if ("error" in obj && typeof obj.error === "string") {
            return { error: obj.error }
        }
        if ("data" in obj) {
            return { data: obj.data as T }
        }
    }
    return { error: "No response from the server" }
}
