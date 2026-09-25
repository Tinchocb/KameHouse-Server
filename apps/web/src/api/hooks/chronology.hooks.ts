import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useServerQuery, useServerMutation, buildSeaQuery } from "../client/requests"
import { API_ENDPOINTS } from "../generated/endpoints"
import type { ChronologyProgressResponse } from "../generated/types"

export interface SaveChronologyMomentTimeVariables {
    momentKey: string
    seconds?: number | null
}

/** spanId -> visto; null borra la marca y el lapso vuelve a seguir el historial. */
export interface SaveChronologySpanOverridesVariables {
    overrides: Record<string, boolean | null>
}

const PROGRESS_QUERY_KEY = [API_ENDPOINTS.CHRONOLOGY_PROGRESS.GetChronologyProgress.key]

export const fetchChronologyProgress = async () => {
    return buildSeaQuery<ChronologyProgressResponse>({
        endpoint: API_ENDPOINTS.CHRONOLOGY_PROGRESS.GetChronologyProgress.endpoint,
        method: API_ENDPOINTS.CHRONOLOGY_PROGRESS.GetChronologyProgress.methods[0],
    })
}

export const fetchChronologyMomentTimes = async () => {
    return buildSeaQuery<Record<string, number>>({
        endpoint: API_ENDPOINTS.CHRONOLOGY_MOMENTS.GetChronologyMomentTimes.endpoint,
        method: API_ENDPOINTS.CHRONOLOGY_MOMENTS.GetChronologyMomentTimes.methods[0],
    })
}

/**
 * Avance de la cronología de la cuenta actual: episodios vistos por serie de
 * Dragon Ball y marcas manuales por lapso. Vive en el servidor para que todos
 * los clientes (desktop, TV, celular) vean lo mismo.
 */
export function useGetChronologyProgress(options?: { enabled?: boolean }) {
    return useServerQuery<ChronologyProgressResponse>({
        endpoint: API_ENDPOINTS.CHRONOLOGY_PROGRESS.GetChronologyProgress.endpoint,
        method: API_ENDPOINTS.CHRONOLOGY_PROGRESS.GetChronologyProgress.methods[0],
        queryKey: PROGRESS_QUERY_KEY,
        enabled: options?.enabled ?? true,
        staleTime: 60 * 1000,
    })
}

/** Guarda marcas manuales por lapso con actualización optimista. */
export function useSaveChronologySpanOverrides() {
    const queryClient = useQueryClient()
    return useServerMutation<boolean, SaveChronologySpanOverridesVariables, { previous?: ChronologyProgressResponse }>({
        endpoint: API_ENDPOINTS.CHRONOLOGY_PROGRESS.SaveChronologySpanOverrides.endpoint,
        method: API_ENDPOINTS.CHRONOLOGY_PROGRESS.SaveChronologySpanOverrides.methods[0],
        onMutate: async ({ overrides }) => {
            await queryClient.cancelQueries({ queryKey: PROGRESS_QUERY_KEY })
            const previous = queryClient.getQueryData<ChronologyProgressResponse>(PROGRESS_QUERY_KEY)
            queryClient.setQueryData<ChronologyProgressResponse>(PROGRESS_QUERY_KEY, (old) => {
                const next = { ...(old?.overrides ?? {}) }
                for (const [spanId, watched] of Object.entries(overrides)) {
                    if (watched === null) delete next[spanId]
                    else next[spanId] = watched
                }
                return { series: old?.series ?? [], overrides: next }
            })
            return { previous }
        },
        // Reemplaza el onError por defecto de useServerMutation: hay que avisar y revertir.
        onError: (_error, _variables, context) => {
            if (context?.previous) queryClient.setQueryData(PROGRESS_QUERY_KEY, context.previous)
            toast.error("No se pudo guardar el progreso de la cronología")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: PROGRESS_QUERY_KEY })
        },
    })
}

/**
 * Hook to retrieve all custom calibrated chronology moment times ({ [momentKey]: seconds }).
 */
export function useGetChronologyMomentTimes(options?: { enabled?: boolean }) {
    return useServerQuery<Record<string, number>>({
        endpoint: API_ENDPOINTS.CHRONOLOGY_MOMENTS.GetChronologyMomentTimes.endpoint,
        method: API_ENDPOINTS.CHRONOLOGY_MOMENTS.GetChronologyMomentTimes.methods[0],
        queryKey: [API_ENDPOINTS.CHRONOLOGY_MOMENTS.GetChronologyMomentTimes.key],
        enabled: options?.enabled ?? true,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    })
}

/**
 * Hook to save or delete a custom calibrated moment start time.
 */
export function useSaveChronologyMomentTime() {
    const queryClient = useQueryClient()
    return useServerMutation<boolean, SaveChronologyMomentTimeVariables>({
        endpoint: API_ENDPOINTS.CHRONOLOGY_MOMENTS.SaveChronologyMomentTime.endpoint,
        method: API_ENDPOINTS.CHRONOLOGY_MOMENTS.SaveChronologyMomentTime.methods[0],
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [API_ENDPOINTS.CHRONOLOGY_MOMENTS.GetChronologyMomentTimes.key],
            })
        },
    })
}
