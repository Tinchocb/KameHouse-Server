import { useSeaQuery, useServerMutation } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { useQuery } from "@tanstack/react-query"

export const JELLYFIN_ENDPOINTS = {
    GetVirtualFolders: {
        key: "jellyfin-get-virtual-folders",
        methods: ["GET"],
        endpoint: "/api/v1/jellyfin/libraries",
    },
    AddVirtualFolder: {
        key: "jellyfin-add-virtual-folder",
        methods: ["POST"],
        endpoint: "/api/v1/jellyfin/libraries",
    },
    RemoveVirtualFolder: {
        key: "jellyfin-remove-virtual-folder",
        methods: ["DELETE"],
        endpoint: "/api/v1/jellyfin/libraries/{name}",
    },
    RefreshLibrary: {
        key: "jellyfin-refresh-library",
        methods: ["POST"],
        endpoint: "/api/v1/jellyfin/refresh",
    },
    SearchItems: {
        key: "jellyfin-search-items",
        methods: ["POST"],
        endpoint: "/api/v1/jellyfin/search",
    },
    GetItem: {
        key: "jellyfin-get-item",
        methods: ["GET"],
        endpoint: "/api/v1/jellyfin/items/{id}",
    },
    Authenticate: {
        key: "jellyfin-authenticate",
        methods: ["POST"],
        endpoint: "/api/v1/jellyfin/auth",
    },
    CreateAPIKey: {
        key: "jellyfin-create-api-key",
        methods: ["POST"],
        endpoint: "/api/v1/jellyfin/api-key",
    },
}

export interface VirtualFolder {
    name: string
    collectionType: string
    locations?: string[]
    itemId?: string
    refreshStatus?: string
}

export interface AddLibraryRequest {
    name: string
    collectionType: string
    paths: string[]
    refreshLibrary: boolean
}

export interface SearchRequest {
    query: string
    limit?: number
}

export interface ItemSearchResult {
    name: string
    id: string
    type: string
    imageTags?: Record<string, string>
    providerIds?: Record<string, string>
}

export interface AuthResponse {
    accessToken: string
    userId: string
    username: string
}

export function useGetJellyfinLibraries() {
    const { seaFetch } = useSeaQuery()

    return useQuery<VirtualFolder[]>({
        queryKey: ["jellyfin-libraries"],
        queryFn: async () => {
            const data = await seaFetch<VirtualFolder[]>(
                JELLYFIN_ENDPOINTS.GetVirtualFolders.endpoint,
                "GET"
            )
            return data ?? []
        },
    })
}

export function useAddJellyfinLibrary() {
    return useServerMutation<{ message: string; name: string }, AddLibraryRequest>({
        endpoint: JELLYFIN_ENDPOINTS.AddVirtualFolder.endpoint,
        method: "POST",
    })
}

export function useRemoveJellyfinLibrary() {
    return useServerMutation<{ message: string; name: string }, string>({
        endpoint: JELLYFIN_ENDPOINTS.RemoveVirtualFolder.endpoint,
        method: "DELETE",
    })
}

export function useRefreshJellyfinLibrary() {
    return useServerMutation<{ message: string }, void>({
        endpoint: JELLYFIN_ENDPOINTS.RefreshLibrary.endpoint,
        method: "POST",
    })
}

export function useSearchJellyfinItems() {
    return useServerMutation<ItemSearchResult[], SearchRequest>({
        endpoint: JELLYFIN_ENDPOINTS.SearchItems.endpoint,
        method: "POST",
    })
}

export function useGetJellyfinItem() {
    return useServerMutation<ItemSearchResult, string>({
        endpoint: JELLYFIN_ENDPOINTS.GetItem.endpoint,
        method: "GET",
    })
}

export function useJellyfinAuthenticate() {
    return useServerMutation<AuthResponse, { username: string; password: string }>({
        endpoint: JELLYFIN_ENDPOINTS.Authenticate.endpoint,
        method: "POST",
    })
}

export function useCreateJellyfinAPIKey() {
    return useServerMutation<{ apiKey: string }, string>({
        endpoint: JELLYFIN_ENDPOINTS.CreateAPIKey.endpoint,
        method: "POST",
    })
}
