import { useServerQuery, buildSeaQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { Anime_LibraryCollection, Anime_LibraryCollectionEntry } from "@/api/generated/types"

export interface ExtendedMediaEntry extends Anime_LibraryCollectionEntry {
    customReleaseGroup?: string
    customVersion?: string
    isCustomOverride?: boolean
}

export interface ExtendedLibraryCollection extends Omit<Anime_LibraryCollection, "lists"> {
    lists?: Array<{
        type: string
        status: string
        entries?: Array<ExtendedMediaEntry>
    }>
}

export const fetchLibraryCollection = async () => {
    return buildSeaQuery<Anime_LibraryCollection>({
        endpoint: API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.endpoint,
        method: API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.methods[0],
    })
}

export function useGetLibraryCollection({ enabled }: { enabled?: boolean } = { enabled: true }) {
    return useServerQuery<Anime_LibraryCollection, void, ExtendedLibraryCollection>({
        endpoint: API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.endpoint,
        method: API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.methods[0],
        queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key],
        enabled: enabled,
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 5,
        select: (data: Anime_LibraryCollection | undefined): ExtendedLibraryCollection => {
            if (!data) return {} as ExtendedLibraryCollection;
            return {
                ...data,
                lists: data.lists?.map(list => ({
                    ...list,
                    entries: list.entries?.map(entry => {
                        return {
                            ...entry,
                            customReleaseGroup: entry.mediaId === 6033 ? "Seldion Fan-Edit" : undefined,
                            isCustomOverride: entry.mediaId === 6033 || entry.mediaId === 534
                        }
                    }).sort((a, b) => (a.media?.titleRomaji || "").localeCompare(b.media?.titleRomaji || ""))
                }))
            }
        }
    })
}



