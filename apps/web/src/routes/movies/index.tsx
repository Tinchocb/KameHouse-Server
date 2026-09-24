import { createFileRoute } from "@tanstack/react-router"
import { fetchLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import type { Anime_LibraryCollectionEntry } from "@/api/generated/types"
import type { EraId } from "@/lib/config/eras"
import type { EraTab } from "./-MovieCard"
import { AppErrorBoundary } from "@/components/shared/app-error-boundary"

export type MovieEntry = Anime_LibraryCollectionEntry & { era: EraTab; eraId: EraId; startedAtTimestamp: number }

export const Route = createFileRoute("/movies/")({
    // prefetch (no ensureQueryData): nunca lanza; ver home/index.tsx.
    loader: ({ context }) => {
        void context.queryClient.prefetchQuery({
            queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key],
            queryFn: fetchLibraryCollection,
        })
    },
    errorComponent: AppErrorBoundary,
})
