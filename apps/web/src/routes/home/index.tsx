import { useGetLibraryCollection, fetchLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import * as React from "react"
import { Skeleton } from "@/components/ui/skeleton"

import {
    mapLibraryEntryToMediaCard
} from "./home.mappers"
import { ErrorBanner, EmptyState } from "./home.components"
import { MediaSpotlight } from "@/components/ui/media-spotlight"
import { SectionBar } from "@/components/ui/sectionbar"
import { MoviesGrid } from "./-home-catalog-grids"
import { IconNavigationFilm } from "@/components/ui/icons";
import { isTmdbId } from "@/lib/helpers/type-guards"
import { AppErrorBoundary } from "@/components/shared/app-error-boundary"

export const Route = createFileRoute("/home/")({
    loader: async ({ context }) => {
        const qc = context.queryClient
        await qc.ensureQueryData({
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

    const allEntriesRef = React.useRef(allEntries)
    React.useEffect(() => {
        allEntriesRef.current = allEntries
    }, [allEntries])

    const handleNavigate = React.useCallback(
        (mediaId: number) => {
            const entry = allEntriesRef.current.find(e =>
                e.mediaId === mediaId ||
                e.media?.id === mediaId ||
                e.media?.tmdbId === mediaId
            )
            const resolvedId = entry?.mediaId || entry?.media?.tmdbId || entry?.media?.id || mediaId
            const format = entry?.media?.format
            const isMovie = format === "MOVIE" || format === "SPECIAL" || format === "OVA" || isTmdbId(resolvedId) || isTmdbId(entry?.mediaId)
            if (isMovie) {
                navigate({ to: "/movies/$movieId", params: { movieId: String(resolvedId) } })
            } else {
                navigate({ to: "/series/$seriesId", params: { seriesId: String(resolvedId) } })
            }
        },
        [navigate],
    )

    const handleSpotlightNavigate = React.useCallback(
        (item: { id: string }) => {
            const numericId = Number(item.id.replace("media-", ""))
            handleNavigate(numericId)
        },
        [handleNavigate],
    )

    const noop = React.useCallback(() => {}, [])

    // Un solo useMemo para deduplicar allEntries y derivar spotlightItems y moviesItems
    const { spotlightItems, moviesItems } = React.useMemo(() => {
        if (!allEntries.length) return { spotlightItems: [], moviesItems: [] }

        const seen = new Set<number>()
        const uniqueEntries = allEntries.filter(entry => {
            if (!entry || !entry.media) return false
            const resolvedId = entry.mediaId || entry.media.tmdbId || entry.media.id
            if (!resolvedId || seen.has(resolvedId)) return false
            seen.add(resolvedId)
            return true
        })

        const spotlight = uniqueEntries.map(entry => mapLibraryEntryToMediaCard(entry, handleNavigate))
        const movies = uniqueEntries
            .filter(entry => {
                const format = entry.media?.format
                return format === "MOVIE" || format === "SPECIAL" || format === "OVA"
            })
            .map(entry => mapLibraryEntryToMediaCard(entry, handleNavigate))

        return { spotlightItems: spotlight, moviesItems: movies }
    }, [allEntries, handleNavigate])

    if (error && !collection) return <ErrorBanner message="Hubo un problema al cargar tu biblioteca." />
    if (isLoading && !collection) return <HomeSkeleton />
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

                {/* Catalog Section */}
                <div className="page-container space-y-4 pt-4 pb-8">
                    <SectionBar
                        label="Películas"
                        description="Largometrajes, OVAs y Especiales"
                        icon={IconNavigationFilm}
                        badge={
                            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-white/10 text-on-surface-variant">
                                {moviesItems.length}
                            </span>
                        }
                        variant="default"
                    >
                        <MoviesGrid
                            items={moviesItems}
                            onNavigate={handleSpotlightNavigate}
                            onHover={noop}
                        />
                    </SectionBar>
                </div>
            </div>
        </div>
    )
}

const SKELETON_ITEMS = [1, 2, 3, 4, 5, 6] as const

/**
 * Espeja el layout real del Home: MediaSpotlight + SectionBar catálogos.
 */
function HomeSkeleton() {
    return (
        <div className="min-h-[100dvh] pt-2 pb-12 overflow-hidden animate-pulse page-container space-y-4">
            {/* MediaSpotlight: barra de eras + hero + hub inferior */}
            <div className="space-y-4">
                {/* Barra de eras */}
                <div className="flex items-center gap-2 bg-surface-container-high/75 border border-outline-variant/30 rounded-2xl p-2 overflow-hidden">
                    {SKELETON_ITEMS.map((i) => (
                        <Skeleton key={i} className="h-9 w-24 sm:w-32 bg-surface-container rounded-xl shrink-0" />
                    ))}
                </div>

                {/* Hero cinematográfico */}
                <Skeleton className="w-full aspect-[16/9] sm:aspect-[2.2/1] lg:aspect-[2.5/1] max-h-[440px] rounded-3xl bg-surface-container border border-outline-variant/30" />

                {/* Hub inferior (solo Sagas) */}
                <div className="space-y-3 pt-1">
                    <Skeleton className="h-5 w-52 bg-surface-container rounded" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-1">
                        {SKELETON_ITEMS.map((i) => (
                            <Skeleton key={i} className="w-full aspect-[16/9] bg-surface-container rounded-2xl" />
                        ))}
                    </div>
                </div>
            </div>

            {/* Catalog SectionBar */}
            <div className="space-y-4 pt-4">
                {/* Películas SectionBar */}
                <div className="sectionbar space-y-3.5 p-5 md:p-6">
                    <div className="sectionbar-header">
                        <div className="flex items-center gap-3">
                            <div className="sectionbar-header-icon">
                                <IconNavigationFilm className="w-4 h-4" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="sectionbar-header-title">Películas</h3>
                                    <span className="sectionbar-header-badge">
                                        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-white/10 text-on-surface-variant">12</span>
                                    </span>
                                </div>
                                <p className="sectionbar-header-desc">Largometrajes, OVAs y Especiales</p>
                            </div>
                        </div>
                    </div>
                    <div className="sectionbar-divide">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
                            {SKELETON_ITEMS.map((i) => (
                                <Skeleton key={"movie-" + i} className="w-full aspect-[2/3] bg-surface-container rounded-2xl" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
