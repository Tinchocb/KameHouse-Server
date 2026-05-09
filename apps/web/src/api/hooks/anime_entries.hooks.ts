import { useServerMutation, useServerQuery } from "@/api/client/requests"
import {
    AnimeEntryManualMatch_Variables,
    AnimeEntryUnmatch_Variables,
    UpdateAnimeEntryProgress_Variables,
} from "@/api/generated/endpoint.types"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { Anime_Entry, Anime_LocalFile, Nullish } from "@/api/generated/types"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

export const fetchAnimeEntry = async (id: string | number) => {
    const { buildSeaQuery } = await import("@/api/client/requests")
    return buildSeaQuery<Anime_Entry>({
        endpoint: API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.endpoint.replace("{id}", String(id)),
        method: API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.methods[0],
    })
}

export function useGetAnimeEntry(id: Nullish<string | number>) {
    return useServerQuery<Anime_Entry>({
        endpoint: API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.endpoint.replace("{id}", String(id)),
        method: API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.methods[0],
        queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, String(id)],
        enabled: !!id,
    })
}

export function useAnimeEntryManualMatch() {
    const queryClient = useQueryClient()

    return useServerMutation<Array<Anime_LocalFile>, AnimeEntryManualMatch_Variables>({
        endpoint: API_ENDPOINTS.ANIME_ENTRIES.AnimeEntryManualMatch.endpoint,
        method: API_ENDPOINTS.ANIME_ENTRIES.AnimeEntryManualMatch.methods[0],
        mutationKey: [API_ENDPOINTS.ANIME_ENTRIES.AnimeEntryManualMatch.key],
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key] })
            await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key] })
            queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.LIBRARY_EXPLORER.GetLibraryExplorerFileTree.key] })
            toast.success("Files matched")
        },
    })
}

export function useAnimeEntryUnmatch() {
    const queryClient = useQueryClient()

    return useServerMutation<Array<Anime_LocalFile>, AnimeEntryUnmatch_Variables>({
        endpoint: API_ENDPOINTS.ANIME_ENTRIES.AnimeEntryUnmatch.endpoint,
        method: API_ENDPOINTS.ANIME_ENTRIES.AnimeEntryUnmatch.methods[0],
        mutationKey: [API_ENDPOINTS.ANIME_ENTRIES.AnimeEntryUnmatch.key],
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key] })
            await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key] })
            toast.success("Files unmatched")
        },
    })
}

export function useGetAnimeEntrySilenceStatus(id: Nullish<string | number>) {
    const { data, ...rest } = useServerQuery({
        endpoint: API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntrySilenceStatus.endpoint.replace("{id}", String(id)),
        method: API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntrySilenceStatus.methods[0],
        queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntrySilenceStatus.key, String(id)],
        enabled: !!id,
    })

    return { isSilenced: !!data, ...rest }
}

export function useUpdateAnimeEntryProgress(id: Nullish<string | number>, episodeNumber: number, showToast: boolean = true) {
    const queryClient = useQueryClient()

    return useServerMutation<boolean, UpdateAnimeEntryProgress_Variables, { previousEntry?: Anime_Entry }>({
        endpoint: API_ENDPOINTS.ANIME_ENTRIES.UpdateAnimeEntryProgress.endpoint,
        method: API_ENDPOINTS.ANIME_ENTRIES.UpdateAnimeEntryProgress.methods[0],
        mutationKey: [API_ENDPOINTS.ANIME_ENTRIES.UpdateAnimeEntryProgress.key, id, episodeNumber],
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
                        progress: variables.episodeNumber,
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
            await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.PLATFORM.GetCollection.key] })
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

