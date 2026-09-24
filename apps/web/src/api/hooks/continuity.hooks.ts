import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ApiError, isTransientStatus, useServerMutation, useServerQuery } from "@/api/client/requests"
import { UpdateContinuityWatchHistoryItem_Variables } from "@/api/generated/endpoint.types"
import { Continuity_WatchHistory, Continuity_WatchHistoryItemResponse } from "@/api/generated/types"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import {
    clearPendingContinuity,
    flushPendingContinuity,
    isRecoverableSaveError,
    queuePendingContinuity,
} from "./continuity-pending"

const continuityQueryKeys = {
    all: ["continuity"] as const,
    history: () => [API_ENDPOINTS.CONTINUITY.GetContinuityWatchHistory.key] as const,
    item: (id?: number | string | null) => [API_ENDPOINTS.CONTINUITY.GetContinuityWatchHistoryItem.key, Number(id)] as const,
}

interface UpdateContinuityOptions {
    /**
     * Writer automático (sync periódico, mpv, tracking): reintenta 5xx con
     * backoff, no toastea en cada fallo y, sin red, encola el último progreso
     * para reenviarlo al reconectar.
     */
    background?: boolean
}

export function useUpdateContinuityWatchHistoryItem({ background = false }: UpdateContinuityOptions = {}) {
    const queryClient = useQueryClient()
    const mutation = useServerMutation<boolean, UpdateContinuityWatchHistoryItem_Variables>({
        endpoint: API_ENDPOINTS.CONTINUITY.UpdateContinuityWatchHistoryItem.endpoint,
        method: API_ENDPOINTS.CONTINUITY.UpdateContinuityWatchHistoryItem.methods[0],
        mutationKey: [API_ENDPOINTS.CONTINUITY.UpdateContinuityWatchHistoryItem.key],
        onSuccess: async (_data, variables) => {
            if (background) clearPendingContinuity(variables?.options?.mediaId)
            await queryClient.invalidateQueries({ queryKey: continuityQueryKeys.history() })
            if (variables?.options?.mediaId != null) {
                await queryClient.invalidateQueries({
                    queryKey: continuityQueryKeys.item(variables.options.mediaId)
                })
            }
        },
        ...(background && {
            retry: (failureCount: number, error: ApiError) =>
                error instanceof ApiError && isTransientStatus(error.status) && failureCount < 3,
            retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 8000),
            // Reemplaza el onError de useServerMutation (que toastea cada fallo):
            // con sync cada 15 s, irse offline sería un toast cada 15 s.
            onError: (error: ApiError, variables: UpdateContinuityWatchHistoryItem_Variables) => {
                if (isRecoverableSaveError(error)) {
                    queuePendingContinuity(variables)
                    toast.info("Sin conexión: el progreso se guardará al reconectar.", { id: "continuity-offline" })
                    return
                }
                toast.error("No se pudo guardar el progreso.", { id: "continuity-save-error" })
            },
        }),
    })

    const { mutateAsync } = mutation
    useEffect(() => {
        if (!background || typeof window === "undefined") return
        const flush = () => {
            void flushPendingContinuity(mutateAsync)
        }
        flush()
        window.addEventListener("online", flush)
        return () => window.removeEventListener("online", flush)
    }, [background, mutateAsync])

    return mutation
}

export function useGetContinuityWatchHistoryItem(id: number | string) {
    const numericId = Number(id)
    return useServerQuery<Continuity_WatchHistoryItemResponse>({
        endpoint: API_ENDPOINTS.CONTINUITY.GetContinuityWatchHistoryItem.endpoint.replace("{id}", String(numericId)),
        method: API_ENDPOINTS.CONTINUITY.GetContinuityWatchHistoryItem.methods[0],
        queryKey: continuityQueryKeys.item(numericId),
        enabled: Number.isFinite(numericId) && numericId > 0,
        staleTime: 30_000, // 30s: reduce refetch storms, still fresh enough for watch history
        refetchOnReconnect: true, // el global está en false; aquí sí importa revalidar al volver la red
    })
}

export function useGetContinuityWatchHistory() {
    return useServerQuery<Continuity_WatchHistory>({
        endpoint: API_ENDPOINTS.CONTINUITY.GetContinuityWatchHistory.endpoint,
        method: API_ENDPOINTS.CONTINUITY.GetContinuityWatchHistory.methods[0],
        queryKey: continuityQueryKeys.history(),
        enabled: true,
        staleTime: 30_000, // 30s: reduce refetch storms
        refetchOnReconnect: true,
    })
}

