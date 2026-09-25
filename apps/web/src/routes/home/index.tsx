import { useGetLibraryCollection, fetchLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import * as React from "react"
import { HomeSkeleton } from "@/components/ui/shimmer-skeleton"

import {
    dedupeAndMapToSpotlight,
    isMovieLike,
    resolveTargetId,
    type MappableEntry,
} from "./home.mappers"
import { ErrorBanner, EmptyState } from "./home.components"
import { MediaSpotlight } from "@/components/ui/media-spotlight"
import { AppErrorBoundary } from "@/components/shared/app-error-boundary"

import { m, AnimatePresence } from "framer-motion"

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
        return collection.lists.flatMap(list => list?.entries ?? [])
    }, [collection])

    // Índice id → entry (mediaId, tmdbId o id, como el antiguo `.find`): O(1)
    // por navegación. Gana la primera entry que declara cada id.
    const entriesById = React.useMemo(() => {
        const byId = new Map<number, MappableEntry>()
        for (const entry of allEntries) {
            if (!entry) continue
            for (const id of [entry.mediaId, entry.media?.id, entry.media?.tmdbId]) {
                if (typeof id === "number" && id > 0 && !byId.has(id)) byId.set(id, entry)
            }
        }
        return byId
    }, [allEntries])

    const handleNavigate = React.useCallback(
        (mediaId: number) => {
            // El spotlight también navega con items sintéticos (era por defecto)
            // que no están en la colección: sin entry, se abre como serie.
            const entry = entriesById.get(mediaId)
            const resolvedId = (entry?.media ? resolveTargetId(entry, entry.media) : null) ?? mediaId
            if (isMovieLike(entry?.media)) {
                navigate({ to: "/movies/$movieId", params: { movieId: String(resolvedId) } })
            } else {
                navigate({ to: "/series/$seriesId", params: { seriesId: String(resolvedId) } })
            }
        },
        [entriesById, navigate],
    )

    const handleSpotlightNavigate = React.useCallback(
        (item: { id: string }) => {
            const numericId = Number(item.id.replace("media-", ""))
            handleNavigate(numericId)
        },
        [handleNavigate],
    )

    const spotlightItems = React.useMemo(
        () => dedupeAndMapToSpotlight(allEntries, handleNavigate),
        [allEntries, handleNavigate],
    )

    if (error && !collection) return <ErrorBanner message="Hubo un problema al cargar tu biblioteca." />
    if (collection && allEntries.length === 0) return <EmptyState />

    const isReady = !!collection && (!isLoading || allEntries.length > 0)

    return (
        <div className="relative min-h-screen text-on-surface overflow-x-hidden">
            <AnimatePresence>
                {!isReady && (
                    <m.div
                        key="home-skeleton"
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="absolute inset-0 z-20 pointer-events-none"
                    >
                        <HomeSkeleton />
                    </m.div>
                )}
            </AnimatePresence>

            {isReady && spotlightItems.length > 0 && (
                <m.div
                    key="home-content"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="relative z-10 flex flex-col"
                >
                    <MediaSpotlight
                        items={spotlightItems}
                        onNavigate={handleSpotlightNavigate}
                    />
                </m.div>
            )}
        </div>
    )
}
