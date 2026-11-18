import { useServerMutation, useServerQuery, buildApiQuery } from "@/api/client/requests"
import {
    UpdateAnimeEntryProgress_Variables,
} from "@/api/generated/endpoint.types"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { Anime_Entry, Anime_LocalFile, MediaSourceInfo, Nullish } from "@/api/generated/types"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

export const fetchAnimeEntry = async (id: string | number) => {
    return buildApiQuery<Anime_Entry>({
        endpoint: API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.endpoint.replace("{id}", String(id)),
        method: API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.methods[0],
        cache: "no-store",
    })
}

export const fetchAnimeEntryLocalFiles = async (id: string | number) => {
    // Avoids generating endpoint types and uses the base path directly.
    const endpoint = API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.endpoint.replace("{id}", String(id)) + "/local-files"
    return buildApiQuery<Anime_LocalFile[]>({
        endpoint,
        method: "GET",
    })
}

export function useGetAnimeEntry(id: Nullish<string | number>) {
    return useServerQuery<Anime_Entry>({
        endpoint: API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.endpoint.replace("{id}", String(id)),
        method: API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.methods[0],
        queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, String(id)],
        enabled: !!id,
        staleTime: 30000, // 30 seconds
        // A cold response precedes background episode enrichment. Poll briefly
        // while summaries/stills are missing, then stop even if the provider
        // cannot supply them. Bypass the legacy ETag that ignores enrichment.
        cache: "no-store",
        refetchInterval: (query) => {
            const episodes = query.state.data?.episodes
            if (query.state.dataUpdateCount >= 20 || !episodes?.length) return false
            if (query.state.data?.episodeEnrichmentPending !== undefined) return query.state.data.episodeEnrichmentPending ? 2000 : false
            return episodes.some(ep => !ep.episodeMetadata?.image || !(ep.episodeMetadata?.overview || ep.episodeMetadata?.summary)) ? 2000 : false
        },
    })
}

export function useUpdateAnimeEntryProgress(id: Nullish<string | number>, showToast: boolean = true) {
    const queryClient = useQueryClient()

    return useServerMutation<boolean, UpdateAnimeEntryProgress_Variables, { previousEntry?: Anime_Entry }>({
        endpoint: API_ENDPOINTS.ANIME_ENTRIES.UpdateAnimeEntryProgress.endpoint,
        method: API_ENDPOINTS.ANIME_ENTRIES.UpdateAnimeEntryProgress.methods[0],
        mutationKey: [API_ENDPOINTS.ANIME_ENTRIES.UpdateAnimeEntryProgress.key, id],
        onMutate: async (variables) => {
            if (!id) return { previousEntry: undefined }

            await queryClient.cancelQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, String(id)] })
            await queryClient.cancelQueries({ queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key] })

            const previousEntry = queryClient.getQueryData<Anime_Entry>([API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, String(id)])

            if (previousEntry && previousEntry.listData) {
                queryClient.setQueryData<Anime_Entry>([API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, String(id)], {
                    ...previousEntry,
                    listData: {
                        ...previousEntry.listData,
                        progress: variables.progress,
                    }
                })
            }

            return { previousEntry }
        },
        onError: (_err, _newProgress, context) => {
            if (context?.previousEntry && id) {
                queryClient.setQueryData<Anime_Entry>([API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, String(id)], context.previousEntry)
            }
        },
        onSettled: async () => {
            await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key] })
            if (id) {
                await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, String(id)] })
            }
        },
        onSuccess: async () => {
            if (showToast) {
                toast.success("Progress updated successfully")
            }
        },
    })
}


// ── Origen de reproducción por serie ─────────────────────────────────────────

export function useGetAnimeEntrySource(id: Nullish<string | number>) {
    return useServerQuery<MediaSourceInfo>({
        endpoint: API_ENDPOINTS.MEDIA_SOURCE.GetAnimeEntrySource.endpoint.replace("{id}", String(id)),
        method: API_ENDPOINTS.MEDIA_SOURCE.GetAnimeEntrySource.methods[0],
        queryKey: [API_ENDPOINTS.MEDIA_SOURCE.GetAnimeEntrySource.key, String(id)],
        enabled: !!id,
        staleTime: 30000,
    })
}
