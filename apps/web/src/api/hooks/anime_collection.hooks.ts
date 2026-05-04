import { useServerMutation, useServerQuery, buildSeaQuery } from "@/api/client/requests"
import { AddUnknownMedia_Variables } from "@/api/generated/endpoint.types"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { Platform_UnifiedCollection, Anime_LibraryCollection, Anime_ScheduleItem, Anime_LibraryCollectionEntry } from "@/api/generated/types"
import { useRefreshCollection } from "@/api/hooks/platform.hooks"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { useMemo } from "react"

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

export function useAddUnknownMedia() {
    const queryClient = useQueryClient()
    const { mutate } = useRefreshCollection()

    return useServerMutation<Platform_UnifiedCollection, AddUnknownMedia_Variables>({
        endpoint: API_ENDPOINTS.ANIME_COLLECTION.AddUnknownMedia.endpoint,
        method: API_ENDPOINTS.ANIME_COLLECTION.AddUnknownMedia.methods[0],
        mutationKey: [API_ENDPOINTS.ANIME_COLLECTION.AddUnknownMedia.key],
        onSuccess: async () => {
            toast.success("Media added successfully")
            mutate(undefined, {
                onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.LIBRARY_EXPLORER.GetLibraryExplorerFileTree.key] })
                },
            })
        },
    })
}


