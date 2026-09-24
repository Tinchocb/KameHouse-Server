import { useGetLibraryCollection, fetchLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import * as React from "react"
import { HomeSkeleton } from "@/components/ui/shimmer-skeleton"

import {
    mapLibraryEntryToMediaCard
} from "./home.mappers"
import { ErrorBanner, EmptyState } from "./home.components"
import { MediaSpotlight } from "@/components/ui/media-spotlight"
import type { SwimlaneItem } from "@/components/ui/swimlane"
import { AppErrorBoundary } from "@/components/shared/app-error-boundary"

export const Route = createFileRoute("/home/")({
    // prefetch (no ensureQueryData): nunca lanza, así un backend que aún arranca
    // no tumba la ruta; el componente muestra HomeSkeleton hasta tener datos.
    loader: ({ context }) => {
        void context.queryClient.prefetchQuery({
            queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key],
            queryFn: fetchLibraryCollection,
        })
    },
    component: HomeClient,
    errorComponent: AppErrorBoundary,
})

function HomeClient() {
    const navigate = useNavigate()
    const { data: collection, isLoading, error } = useGetLibraryCollection()

    const allEntries = React.useMemo(() => {
        if (!collection?.lists) return []
        return collection.lists.flatMap(list => list.entries ?? [])
    }, [collection])

    const handleNavigate = React.useCallback(
        (mediaId: number) => {
            const entry = allEntries.find(e =>
                e.mediaId === mediaId ||
                e.media?.id === mediaId ||
                e.media?.tmdbId === mediaId
            )
            const resolvedId = entry?.mediaId || entry?.media?.tmdbId || entry?.media?.id || mediaId
            const format = entry?.media?.format?.toUpperCase()
            const type = entry?.media?.type?.toUpperCase()
            // El offset TMDB (+1M) NO indica película: las series también lo usan
            // (ej. Super 1062715). Solo formato/tipo deciden la plantilla.
            const isMovie = format === "MOVIE" || format === "SPECIAL" || format === "OVA" || type === "MOVIE"
            if (isMovie) {
                navigate({ to: "/movies/$movieId", params: { movieId: String(resolvedId) } })
            } else {
                navigate({ to: "/series/$seriesId", params: { seriesId: String(resolvedId) } })
            }
        },
        [allEntries, navigate],
    )

    const handleSpotlightNavigate = React.useCallback(
        (item: { id: string }) => {
            const numericId = Number(item.id.replace("media-", ""))
            handleNavigate(numericId)
        },
        [handleNavigate],
    )

    // Un solo useMemo para deduplicar allEntries y derivar spotlightItems
    const { spotlightItems } = React.useMemo(() => {
        if (!allEntries.length) return { spotlightItems: [] }

        const seen = new Set<number>()
        const uniqueEntries = allEntries.filter(entry => {
            if (!entry || !entry.media) return false
            const resolvedId = entry.mediaId || entry.media.tmdbId || entry.media.id
            if (!resolvedId || seen.has(resolvedId)) return false
            seen.add(resolvedId)
            return true
        })

        const spotlight = uniqueEntries
            .map(entry => mapLibraryEntryToMediaCard(entry, handleNavigate))
            .filter((item): item is SwimlaneItem => item !== null)

        return { spotlightItems: spotlight }
    }, [allEntries, handleNavigate])

    if (error && !collection) return <ErrorBanner message="Hubo un problema al cargar tu biblioteca." />
    // Anti-flash: skeleton mientras no haya colección (cubre isLoading y
    // restauración IDB). Nunca EmptyState transitorio: solo si ya hay colección.
    if (!collection) return <HomeSkeleton />
    if (isLoading && allEntries.length === 0) return <HomeSkeleton />
    if (allEntries.length === 0) return <EmptyState />

    return (
        <div className="relative min-h-screen text-on-surface overflow-x-hidden">
            <div className="relative z-10 flex flex-col">
                {spotlightItems.length > 0 && (
                    <MediaSpotlight
                        items={spotlightItems}
                        onNavigate={handleSpotlightNavigate}
                    />
                )}
            </div>
        </div>
    )
}
