import { createFileRoute, redirect } from "@tanstack/react-router"
import { fetchAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { fetchLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { AppErrorBoundary } from "@/components/shared/app-error-boundary"
import { getSeriesIdFromMedia } from "@/lib/helpers/series"
import { getSafeCollectionEntries } from "@/lib/helpers/collection"

const SLUG_TO_SERIES_ID: Record<string, string> = {
    daima: "dragon_ball_daima",
    dbdaima: "dragon_ball_daima",
    dragon_ball_daima: "dragon_ball_daima",
    super: "dragon_ball_super",
    dbs: "dragon_ball_super",
    dragon_ball_super: "dragon_ball_super",
    gt: "dragon_ball_gt",
    dbgt: "dragon_ball_gt",
    dragon_ball_gt: "dragon_ball_gt",
    z: "dragon_ball_z",
    dbz: "dragon_ball_z",
    dragon_ball_z: "dragon_ball_z",
    kai: "dragon_ball_kai",
    dbkai: "dragon_ball_kai",
    dragon_ball_kai: "dragon_ball_kai",
    classic: "dragon_ball",
    db: "dragon_ball",
    dragon_ball: "dragon_ball",
}

export const Route = createFileRoute("/movies/$movieId")({
    loader: async ({ params: { movieId }, context }) => {
        const lowerSlug = (movieId || "").toLowerCase().trim()
        const seriesTarget = SLUG_TO_SERIES_ID[lowerSlug]
        if (seriesTarget) {
            // El backend solo acepta IDs numéricos: resolver el slug al mediaId
            // real de la biblioteca en vez de navegar con el slug crudo (400).
            let resolvedId: number | null = null
            try {
                const qc = context.queryClient
                const collection = await qc.ensureQueryData({
                    queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key],
                    queryFn: fetchLibraryCollection,
                })
                const match = getSafeCollectionEntries(collection).find(entry => {
                    const media = entry?.media
                    if (!media) return false
                    const format = media.format?.toUpperCase()
                    if (format === "MOVIE" || format === "OVA" || format === "SPECIAL") return false
                    const title = media.titleSpanish || media.titleEnglish || media.titleRomaji || media.titleOriginal || ""
                    return getSeriesIdFromMedia(media, title) === seriesTarget
                })
                const numericId = Number(match?.mediaId || match?.media?.id || 0)
                if (Number.isFinite(numericId) && numericId > 0) resolvedId = numericId
            } catch {
                resolvedId = null
            }
            if (resolvedId) {
                throw redirect({
                    to: "/series/$seriesId",
                    params: { seriesId: String(resolvedId) },
                })
            }
            // Sin match en la biblioteca: al listado, nunca a una ficha rota.
            throw redirect({ to: "/series" })
        }

        const numericMovieId = Number(movieId)
        if (!Number.isFinite(numericMovieId) || numericMovieId <= 0) {
            throw redirect({
                to: "/movies",
            })
        }

        // prefetch (no ensureQueryData): nunca lanza; el componente lazy muestra
        // BentoDetailsSkeleton mientras carga.
        void context.queryClient.prefetchQuery({
            queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, movieId],
            queryFn: () => fetchAnimeEntry(movieId),
        })
    },
    errorComponent: AppErrorBoundary,
    // Anti-flash: sin pendingComponent (ver series/$seriesId/index.tsx).
})
