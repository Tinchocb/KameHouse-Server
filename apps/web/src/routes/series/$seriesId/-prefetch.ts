import type { QueryClient } from "@tanstack/react-query"
import { buildApiQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { continuityQueryKeys } from "@/api/hooks/continuity.hooks"
import { queryKeys } from "@/lib/query-keys"

/**
 * Pide en paralelo, junto con el entry, los datos que la ficha de serie antes pedía recién al
 * montarse: sagas, lore, continuidad y origen de reproducción. Sin esto había una cascada
 * (entry → montar página → 4 pedidos), y los episodios no aparecían hasta ~165 ms después de
 * que el entry ya había llegado (medido en producción).
 *
 * Misma clave, misma función y mismo `staleTime` que los hooks de `index.lazy.tsx` /
 * `useGetContinuityWatchHistoryItem` / `useGetAnimeEntrySource`: la página encuentra el dato
 * en caché y no vuelve a pedirlo. No se espera (sin `await`) ni se propagan errores: es solo
 * adelantar trabajo, la página sigue manejando sus propios estados de carga y error.
 */
export function prefetchSeriesDetailData(qc: QueryClient, seriesId: string): void {
    const sagas = API_ENDPOINTS.SERIES_DETAILS.GetSeriesSagas
    void qc.prefetchQuery({
        queryKey: queryKeys.series.sagas(seriesId),
        queryFn: ({ signal }) => buildApiQuery({ endpoint: sagas.endpoint.replace("{id}", seriesId), method: sagas.methods[0], signal }),
        staleTime: 600_000,
    })

    // Lore estático de Dragon Ball: la ficha lo pide solo para series de DB, pero es el mismo
    // para todas y pesa ~13 KB; adelantarlo no necesita esperar al entry.
    const lore = API_ENDPOINTS.LORE.GetDragonballLore
    void qc.prefetchQuery({
        queryKey: [lore.key],
        queryFn: ({ signal }) => buildApiQuery({ endpoint: lore.endpoint, method: lore.methods[0], signal }),
        staleTime: 300_000,
    })

    const numericId = Number(seriesId)
    if (Number.isFinite(numericId) && numericId > 0) {
        const continuity = API_ENDPOINTS.CONTINUITY.GetContinuityWatchHistoryItem
        void qc.prefetchQuery({
            queryKey: continuityQueryKeys.item(numericId),
            queryFn: ({ signal }) => buildApiQuery({ endpoint: continuity.endpoint.replace("{id}", String(numericId)), method: continuity.methods[0], signal }),
            staleTime: 30_000,
        })
    }

    const source = API_ENDPOINTS.MEDIA_SOURCE.GetAnimeEntrySource
    void qc.prefetchQuery({
        queryKey: [source.key, String(seriesId)],
        queryFn: ({ signal }) => buildApiQuery({ endpoint: source.endpoint.replace("{id}", String(seriesId)), method: source.methods[0], signal }),
        staleTime: 30_000,
    })
}
