import { createFileRoute } from "@tanstack/react-router"
import { fetchLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import type { Anime_LibraryCollectionEntry } from "@/api/generated/types"
import { ERAS, type EraId } from "@/lib/config/eras"
import type { EraTab } from "./-MovieCard"
import { AppErrorBoundary } from "@/components/shared/app-error-boundary"
import { prewarmImages } from "@/lib/helpers/images"
import { moviePosterUrls } from "@/lib/helpers/series-images"
import { getSafeCollectionEntries } from "@/lib/helpers/collection"

export type MovieEntry = Anime_LibraryCollectionEntry & { era: EraTab; eraId: EraId; startedAtTimestamp: number }

const MOVIE_SORTS = ["year_asc", "year_desc", "alpha_asc", "alpha_desc", "rating_desc"] as const

/**
 * Filtros de /movies en la URL: sobreviven a recargar, al volver desde una
 * película y se pueden compartir. Ausente = default (todas / orden de Ajustes).
 */
export type MoviesSearch = {
    era?: EraId
    sort?: (typeof MOVIE_SORTS)[number]
    q?: string
}

function pick<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
    return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined
}

const ERA_IDS = ERAS.map((e) => e.id)

export const Route = createFileRoute("/movies/")({
    validateSearch: (search: Record<string, unknown>): MoviesSearch => ({
        era: pick(search.era, ERA_IDS),
        sort: pick(search.sort, MOVIE_SORTS),
        q: typeof search.q === "string" && search.q.trim() !== "" ? search.q.slice(0, 100) : undefined,
    }),
    // prefetch (no ensureQueryData): nunca lanza; ver home/index.tsx.
    loader: ({ context }) => {
        void context.queryClient
            .fetchQuery({
                queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key],
                queryFn: fetchLibraryCollection,
            })
            // Pósters de la grilla: se bajan en idle cuando la ruta se precarga
            // (al arrancar la app o al apuntar el link), no al entrar.
            .then((collection) => prewarmImages(moviePosterUrls(getSafeCollectionEntries(collection))))
            .catch(() => {})
    },
    errorComponent: AppErrorBoundary,
})
