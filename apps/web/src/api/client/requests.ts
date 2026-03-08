
import { getServerBaseUrl } from "@/api/client/server-url"
import { useMutation, UseMutationOptions, useQuery, UseQueryOptions } from "@tanstack/react-query"
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios"
import { useAtomValue } from "jotai"
import { useAtom } from "jotai/react"
import { atom } from "jotai"
import { useLocation } from "@tanstack/react-router"
import { useEffect } from "react"
import { toast } from "sonner"

// Stub atom – auth is not in use for the standalone UI
const serverAuthTokenAtom = atom<string | undefined>(undefined)

type SeaError = AxiosError<{ error: string }>

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
        seaFetch: <T, D extends any = any>(endpoint: string, method: "POST" | "GET" | "PATCH" | "DELETE" | "PUT", data?: D, params?: D) => {
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

/**
 * Create axios query to the server
 * - First generic: Return type
 * - Second generic: Params/Data type
 */
export async function buildSeaQuery<T, D extends any = any>(
    {
        endpoint,
        method,
        data,
        params,
        password,
    }: SeaQuery<D>): Promise<T | undefined> {

    axios.interceptors.request.use((request: InternalAxiosRequestConfig) => {
        if (password) {
            request.headers.set("X-KameHouse-Token", password)
        }
        return request
    },
    )

    const res = await axios<T>({
        url: getServerBaseUrl() + endpoint,
        method,
        data,
        params,
    })
    const response = _handleSeaResponse<T>(res.data)
    return response.data
}

type ServerMutationProps<R, V = void, C = unknown> = UseMutationOptions<R | undefined, SeaError, V, C> & {
    endpoint: string
    method: "POST" | "GET" | "PATCH" | "DELETE" | "PUT"
}

/**
 * Create mutation hook to the server
 * - First generic: Return type
 * - Second generic: Params/Data type
 * - Third generic: Context type
 */
export function useServerMutation<R = void, V = void, C = unknown>(
    {
        endpoint,
        method,
        ...options
    }: ServerMutationProps<R, V, C>) {

    const password = useAtomValue(serverAuthTokenAtom)

    return useMutation<R | undefined, SeaError, V, C>({
        onError: error => {
            console.log("Mutation error", error)
            const errorMsg = _handleSeaError(error.response?.data)
            if (errorMsg.includes("feature disabled")) {
                toast.warning("This feature is disabled")
                return
            }
            toast.error(errorMsg)
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


type ServerQueryProps<R, V> = UseQueryOptions<R | undefined, SeaError, R | undefined> & {
    endpoint: string
    method: "POST" | "GET" | "PATCH" | "DELETE" | "PUT"
    params?: V
    data?: V
    muteError?: boolean
}

/**
 * Create query hook to the server
 * - First generic: Return type
 * - Second generic: Params/Data type
 */
export function useServerQuery<R, V = any>(
    {
        endpoint,
        method,
        params,
        data,
        muteError,
        ...options
    }: ServerQueryProps<R | undefined, V>) {

    const pathname = useLocation().pathname
    const [password, setPassword] = useAtom(serverAuthTokenAtom)

    const props = useQuery<R | undefined, SeaError>({
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
            if (props.error?.response?.data?.error === "UNAUTHENTICATED" && pathname !== "/public/auth") {
                setPassword(undefined)
                window.location.href = "/public/auth"
                return
            }
            console.log("Server error", props.error)
            const errorMsg = _handleSeaError(props.error?.response?.data)
            if (errorMsg.includes("feature disabled")) {
                return
            }
            if (!!errorMsg) {
                toast.error(errorMsg)
            }
        }
    }, [props.error, props.isError, muteError])

    return props
}

//----------------------------------------------------------------------------------------------------------------------

function _handleSeaError(data: any): string {
    if (typeof data === "string") return "Server Error: " + data

    const err = data?.error as string

    if (!err) return "Unknown error"

    if (err.includes("Too many requests"))
        return "AniList: Too many requests, please wait a moment and try again."

    try {
        const graphqlErr = JSON.parse(err) as any
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

function _handleSeaResponse<T>(res: unknown): { data: T | undefined, error: string | undefined } {

    if (typeof res === "object" && !!res && "error" in res && typeof res.error === "string") {
        return { data: undefined, error: res.error }
    }
    if (typeof res === "object" && !!res && "data" in res) {
        return { data: res.data as T, error: undefined }
    }

    return { data: undefined, error: "No response from the server" }

}
