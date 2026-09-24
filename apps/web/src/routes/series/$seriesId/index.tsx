import { createFileRoute } from "@tanstack/react-router"
import { dehydrate } from "@tanstack/react-query"
import { fetchAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import type { SagaDetailSearchParams } from "@/api/types/series.types"
import { AppErrorBoundary } from "@/components/shared/app-error-boundary"

export const Route = createFileRoute("/series/$seriesId/")({
    validateSearch: (search: Record<string, unknown>): SagaDetailSearchParams => ({
        saga: (search.saga as string) ?? "",
        subSaga: (search.subSaga as string) ?? "",
        autoplay: (search.autoplay as string) || undefined,
    }),
    loader: async ({ params: { seriesId }, context }) => {
        const qc = context.queryClient
        await qc.prefetchQuery({
            queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, seriesId],
            queryFn: () => fetchAnimeEntry(seriesId),
            staleTime: 60000,
        })
        return { dehydrateState: dehydrate(qc) }
    },
    errorComponent: AppErrorBoundary,
    // Anti-flash: sin pendingComponent de router. El loader hace prefetch y el
    // componente lazy ya muestra BentoDetailsSkeleton solo si no hay caché
    // (isLoading && !entry). Evita doble skeleton router->lazy.
})
