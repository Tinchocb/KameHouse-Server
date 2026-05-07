import { useServerQuery } from "@/api/client/requests"

export interface MediaCollection {
    id: number
    tmdbCollectionId: number
    name: string
    overview: string
    posterPath: string
    backdropPath: string
    memberIds: number[]
}

export interface CollectionPart {
    id: number
    title: string
    overview?: string
    posterPath?: string
    backdropPath?: string
    releaseDate?: string
    format?: string
}

export interface CollectionResponse {
    id: number
    name: string
    overview?: string
    posterPath?: string
    backdropPath?: string
    parts: CollectionPart[]
}

export function useGetMediaCollections() {
    return useServerQuery<MediaCollection[]>({
        endpoint: "/api/v1/collections",
        method: "GET",
        queryKey: ["collections-list"],
        enabled: true,
    })
}

export function useGetMediaCollection(id: number | undefined) {
    return useServerQuery<CollectionResponse>({
        endpoint: `/api/v1/collections/${id}`,
        method: "GET",
        queryKey: ["collection-detail", id],
        enabled: !!id,
    })
}
