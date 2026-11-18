import { API_ENDPOINTS } from "@/api/generated/endpoints"

/**
 * Centralized query key factory for the series domain.
 *
 * Usage:
 *   queryClient.invalidateQueries({ queryKey: queryKeys.series.entry(seriesId) })
 *   useServerQuery({ queryKey: queryKeys.series.sagas(seriesId), ... })
 */
export const queryKeys = {
    series: {
        /** Main anime entry: media, episodes, localFiles, relations, characters */
        entry: (seriesId: string | number) =>
            [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, String(seriesId)] as const,

        /** Enriched SagaDTO[] from scanner.GetDragonBallSagaInfo */
        sagas: (seriesId: string | number) =>
            [`series-sagas-${String(seriesId)}`] as const,
    },
} as const

export const continuityQueryKeys = {
    all: ["continuity"] as const,
    history: () => [API_ENDPOINTS.CONTINUITY.GetContinuityWatchHistory.key] as const,
    item: (id?: number | string | null) => [API_ENDPOINTS.CONTINUITY.GetContinuityWatchHistoryItem.key, Number(id)] as const,
}
