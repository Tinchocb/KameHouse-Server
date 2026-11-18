import { createFileRoute } from "@tanstack/react-router"
import { fetchAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import type { SagaDetailSearchParams } from "@/api/types/series.types"
import { AppErrorBoundary } from "@/components/shared/app-error-boundary"
import { whenCacheRestored } from "@/lib/query-persister"
import { prefetchSeriesDetailData } from "./-prefetch"

export const Route = createFileRoute("/series/$seriesId/")({
    validateSearch: (search: Record<string, unknown>): SagaDetailSearchParams => ({
        saga: (search.saga as string) ?? "",
        subSaga: (search.subSaga as string) ?? "",
        autoplay: (search.autoplay as string) || undefined,
        t: typeof search.t === "number" || typeof search.t === "string" ? String(search.t) : undefined,
        moment: (search.moment as string) || undefined,
        momentTitle: (search.momentTitle as string) || undefined,
        chrono: (search.chrono as string) || undefined,
    }),
    loader: async ({ params: { seriesId }, context }) => {
        const qc = context.queryClient
        // La caché de IndexedDB llega unos ms después del primer render: esperarla evita pedir a red lo que ya está guardado.
        await whenCacheRestored()
        // En paralelo con el entry (no se esperan): evita la cascada entry → montar → 4 pedidos.
        prefetchSeriesDetailData(qc, seriesId)
        const entryKey = [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, seriesId]
        const entryPrefetch = qc.prefetchQuery({
            queryKey: entryKey,
            queryFn: () => fetchAnimeEntry(seriesId),
            staleTime: 60000,
        })
        // Con ficha en caché (aunque vencida) no se bloquea la navegación: el
        // prefetch la revalida en segundo plano y el cliente se monta ya.
        if (!qc.getQueryData(entryKey)) await entryPrefetch
    },
    errorComponent: AppErrorBoundary,
    // Anti-flash: sin skeleton propio de router (solo el RoutePending neutro por
    // defecto, pasados 800ms). El loader hace prefetch y el componente lazy ya
    // muestra BentoDetailsSkeleton solo si no hay caché (isLoading && !entry).
    // Evita doble skeleton router->lazy.
})
