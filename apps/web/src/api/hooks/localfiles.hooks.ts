import { useServerMutation, useServerQuery } from "@/api/client/requests"
import {
    DeleteLocalFiles_Variables,
    ImportLocalFiles_Variables,
    LocalFileBulkAction_Variables,
    UpdateLocalFileData_Variables,
    UpdateLocalFiles_Variables,
} from "@/api/generated/endpoint.types"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { Anime_LocalFile } from "@/api/generated/types"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

export function useGetLocalFiles() {
    return useServerQuery<Array<Anime_LocalFile>>({
        endpoint: API_ENDPOINTS.LOCALFILES.GetLocalFiles.endpoint,
        method: API_ENDPOINTS.LOCALFILES.GetLocalFiles.methods[0],
        queryKey: [API_ENDPOINTS.LOCALFILES.GetLocalFiles.key],
        enabled: true,
    })
}

import { useInfiniteQuery } from "@tanstack/react-query"
import { getServerBaseUrl } from "@/api/client/server-url"

export type PaginatedLocalFiles = {
    items: Anime_LocalFile[]
    hasMore: boolean
    nextPage: number
}

export function useGetLocalFilesInfinite() {
    return useInfiniteQuery({
        queryKey: [API_ENDPOINTS.LOCALFILES.GetLocalFiles.key, "infinite"],
        queryFn: async ({ pageParam = 1 }) => {
            const res = await fetch(`${getServerBaseUrl()}${API_ENDPOINTS.LOCALFILES.GetLocalFiles.endpoint}?page=${pageParam}&perPage=50`, {
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                }
            })
            if (!res.ok) throw new Error("Failed to fetch local files")
            const json = await res.json() as { data: PaginatedLocalFiles }
            return json.data
        },
        getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextPage : undefined,
        initialPageParam: 1,
        // Performance optimizations for 1000+ files
        structuralSharing: true,
        staleTime: Infinity, // WebSocket will handle all invalidations explicitly
    })
}

export function useLocalFileBulkAction() {
    const qc = useQueryClient()

    return useServerMutation<Array<Anime_LocalFile>, LocalFileBulkAction_Variables>({
        endpoint: API_ENDPOINTS.LOCALFILES.LocalFileBulkAction.endpoint,
        method: API_ENDPOINTS.LOCALFILES.LocalFileBulkAction.methods[0],
        mutationKey: [API_ENDPOINTS.LOCALFILES.LocalFileBulkAction.key],
        onSuccess: async () => {
            qc.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key] })
            qc.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key] })
            qc.invalidateQueries({ queryKey: [API_ENDPOINTS.LIBRARY_EXPLORER.GetLibraryExplorerFileTree.key] })
        },
    })
}

export function useUpdateLocalFiles() {
    const qc = useQueryClient()

    return useServerMutation<boolean, UpdateLocalFiles_Variables>({
        endpoint: API_ENDPOINTS.LOCALFILES.UpdateLocalFiles.endpoint,
        method: API_ENDPOINTS.LOCALFILES.UpdateLocalFiles.methods[0],
        mutationKey: [API_ENDPOINTS.LOCALFILES.UpdateLocalFiles.key],
        onSuccess: async () => {
            qc.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key] })
            qc.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key] })
            qc.invalidateQueries({ queryKey: [API_ENDPOINTS.LIBRARY_EXPLORER.GetLibraryExplorerFileTree.key] })
        },
    })
}

export function useUpdateLocalFileData() {
    const qc = useQueryClient()

    const opts = useServerMutation<Array<Anime_LocalFile>, UpdateLocalFileData_Variables>({
        endpoint: API_ENDPOINTS.LOCALFILES.UpdateLocalFileData.endpoint,
        method: API_ENDPOINTS.LOCALFILES.UpdateLocalFileData.methods[0],
        mutationKey: [API_ENDPOINTS.LOCALFILES.UpdateLocalFileData.key],
        onSuccess: async () => {
            toast.success("File metadata updated")
            qc.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key] })
            qc.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key] })
            qc.invalidateQueries({ queryKey: [API_ENDPOINTS.LIBRARY_EXPLORER.GetLibraryExplorerFileTree.key] })
        },
    })

    return {
        updateLocalFile: (lf: Anime_LocalFile, variables: Partial<UpdateLocalFileData_Variables>, onSuccess?: () => void) => {
            opts.mutate({
                path: lf.path,
                metadata: lf.metadata,
                locked: lf.locked,
                ignored: lf.ignored,
                mediaId: lf.mediaId,
                ...variables,
            }, {
                onSuccess: () => onSuccess?.(),
            })
        },
        ...opts,
    }
}

export function useDeleteLocalFiles() {
    const qc = useQueryClient()

    return useServerMutation<Array<Anime_LocalFile>, DeleteLocalFiles_Variables>({
        endpoint: API_ENDPOINTS.LOCALFILES.DeleteLocalFiles.endpoint,
        method: API_ENDPOINTS.LOCALFILES.DeleteLocalFiles.methods[0],
        mutationKey: [API_ENDPOINTS.LOCALFILES.DeleteLocalFiles.key],
        onSuccess: async () => {
            toast.success("Files deleted")
            qc.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key] })
            qc.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key] })
            qc.invalidateQueries({ queryKey: [API_ENDPOINTS.LIBRARY_EXPLORER.GetLibraryExplorerFileTree.key] })
        },
    })
}

export function useRemoveEmptyDirectories() {
    return useServerMutation<boolean>({
        endpoint: API_ENDPOINTS.LOCALFILES.RemoveEmptyDirectories.endpoint,
        method: API_ENDPOINTS.LOCALFILES.RemoveEmptyDirectories.methods[0],
        mutationKey: [API_ENDPOINTS.LOCALFILES.RemoveEmptyDirectories.key],
        onSuccess: async () => {
            toast.success("Empty directories removed")
        },
    })
}

export function useImportLocalFiles() {
    const qc = useQueryClient()

    return useServerMutation<boolean, ImportLocalFiles_Variables>({
        endpoint: API_ENDPOINTS.LOCALFILES.ImportLocalFiles.endpoint,
        method: API_ENDPOINTS.LOCALFILES.ImportLocalFiles.methods[0],
        mutationKey: [API_ENDPOINTS.LOCALFILES.ImportLocalFiles.key],
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key] })
            await qc.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key] })
            qc.invalidateQueries({ queryKey: [API_ENDPOINTS.LIBRARY_EXPLORER.GetLibraryExplorerFileTree.key] })
            toast.success("Local files imported")
        },
    })
}
