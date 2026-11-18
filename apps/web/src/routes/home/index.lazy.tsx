import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { createLazyFileRoute, useNavigate } from "@tanstack/react-router"
import * as React from "react"
import { HomeSkeleton } from "@/components/ui/shimmer-skeleton"
import { LoadSwap } from "@/components/ui/kinetics"

import {
    dedupeAndMapToSpotlight,
    isMovieLike,
    resolveTargetId,
    type MappableEntry,
} from "./home.mappers"
import { LibraryErrorState } from "@/components/shared/library-error-state"
import { LibraryEmptyState } from "@/components/shared/library-empty-state"
import { MediaSpotlight } from "@/components/ui/media-spotlight"

export const Route = createLazyFileRoute("/home/")({
    component: HomeClient,
})

function HomeClient() {
    const navigate = useNavigate()
    const { data: collection, isLoading, error, refetch } = useGetLibraryCollection()
    // React Query borra `error` y vuelve a `pending` cuando otra pieza vuelve a pedir la colección sin datos
    // (p. ej. la precarga de Series/Películas en main.tsx). Se recuerda el último error almacenándolo en render.
    const [lastError, setLastError] = React.useState(error)
    if (error && error !== lastError) {
        setLastError(error)
    }
    const failure = error ?? lastError

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

    if (!collection && failure) return <LibraryErrorState error={failure} onRetry={() => { void refetch() }} />
    if (collection && allEntries.length === 0) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center px-4 pt-nav">
                <h1 className="sr-only">Inicio</h1>
                <LibraryEmptyState />
            </div>
        )
    }

    const isReady = !!collection && (!isLoading || allEntries.length > 0)

    return (
        <div className="relative min-h-dvh text-on-surface">
            <h1 className="sr-only">Inicio</h1>
            <LoadSwap
                loading={!isReady}
                skeleton={<HomeSkeleton />}
                className="relative z-10 flex flex-col w-full"
                // MediaSpotlight ya anima su propia entrada: sin esto el contenido se funde dos veces.
                ownEntrance
            >
                {spotlightItems.length > 0 && (
                    <MediaSpotlight
                        items={spotlightItems}
                        onNavigate={handleSpotlightNavigate}
                    />
                )}
            </LoadSwap>
        </div>
    )
}
