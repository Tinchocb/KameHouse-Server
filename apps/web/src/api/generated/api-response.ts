/**
 * Canonical envelope returned by every Go backend endpoint.
 * Matches the `APIResponse[T]` generic defined in handlers/response.go.
 *
 * - On success:  { data: T }
 * - On failure:  { error: "human readable message" }
 */
export interface APIResponse<T = unknown> {
    data?: T
    error?: string
}

/**
 * Unwraps an APIResponse, returning `data` or throwing if `error` is set.
 * Use this in custom fetch wrappers to propagate backend errors cleanly.
 */
export function unwrapAPIResponse<T>(envelope: APIResponse<T>): T | undefined {
    if (envelope.error) {
        throw new Error(envelope.error)
    }
    return envelope.data
}
