import { useServerMutation, useServerQuery } from "@/api/client/requests"
import { ScanLocalFiles_Variables } from "@/api/generated/endpoint.types"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { useRefreshLibraryExplorerFileTree } from "@/api/generated/library_explorer.hooks"
import { Anime_LocalFile, Summary_ScanSummary } from "@/api/generated/types"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

export const scanQueryKeys = {
    all: ['scan'] as const,
    summaries: () => [...scanQueryKeys.all, 'summaries'] as const,
}

export function useScanLocalFiles(onSuccess?: () => void) {
    const queryClient = useQueryClient()
    const { mutate: refreshLibraryExplorerTree } = useRefreshLibraryExplorerFileTree()

    return useServerMutation<Array<Anime_LocalFile>, ScanLocalFiles_Variables>({
        endpoint: API_ENDPOINTS.SCAN.ScanLocalFiles.endpoint,
        method: API_ENDPOINTS.SCAN.ScanLocalFiles.methods[0],
        mutationKey: [API_ENDPOINTS.SCAN.ScanLocalFiles.key],
        onSuccess: async (data) => {
            await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key] })
            toast.success("Library scanned")
            refreshLibraryExplorerTree()
            await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetMissingEpisodes.key] })
            await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.AUTO_DOWNLOADER.GetAutoDownloaderItems.key] })
            if (data && data.length > 0) {
                const mediaIds = [...new Set(data.map(f => f.mediaId).filter(id => !!id))]
                for (const id of mediaIds) {
                    await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, String(id)] })
                }
            } else {
                await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key] })
            }
            onSuccess?.()
        },
    })
}

export function useGetScanSummaries() {
    return useServerQuery<Array<Summary_ScanSummary>>({
        endpoint: API_ENDPOINTS.SCAN_SUMMARY.GetScanSummaries.endpoint,
        method: API_ENDPOINTS.SCAN_SUMMARY.GetScanSummaries.methods[0],
        queryKey: scanQueryKeys.summaries(),
    })
}



