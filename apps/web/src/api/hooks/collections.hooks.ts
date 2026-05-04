import { useServerQuery } from "@/api/client/requests"

export interface MediaCollectionPart {
    id: number
    title: string
    overview?: string
    posterPath?: string
    backdropPath?: string
    releaseDate?: string
    format?: string
}

export interface MediaCollectionData {
    id: number
    name: string
    overview?: string
    posterPath?: string
    backdropPath?: string
    parts: MediaCollectionPart[]
}

/** Fetches a MediaCollection from the backend by its TMDB collection ID. */
export function useGetMediaCollection(collectionId: number) {
    return useServerQuery<MediaCollectionData>({
        endpoint: `/api/v1/collections/${collectionId}`,
        method: "GET",
        queryKey: ["media-collection", collectionId],
        enabled: Boolean(collectionId),
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 10,
    })
}
