import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { useGetContinuityWatchHistory } from "@/api/hooks/continuity.hooks"
import type {
    Anime_Episode,
    Anime_LibraryCollectionEntry,
    Continuity_WatchHistory,
    Models_LibraryMedia,
} from "@/api/generated/types"
import { LoadingOverlayWithLogo } from "@/components/shared/loading-overlay-with-logo"
import { HeroBanner, type HeroBannerItem } from "@/components/ui/hero-banner"
import { Swimlane, type SwimlaneItem } from "@/components/ui/swimlane"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { AlertTriangle, FolderOpen, Sparkles } from "lucide-react"
import * as React from "react"

export const Route = createFileRoute("/home/")({
    component: HomePage,
})

function getTitle(media: Models_LibraryMedia): string {
    return media.titleEnglish || media.titleRomaji || media.titleOriginal || "Sin titulo"
}

function getProgress(mediaId: number, watchHistory?: Continuity_WatchHistory): number | undefined {
    const item = watchHistory?.[mediaId]

    if (!item?.duration) {
        return undefined
    }

    return (item.currentTime / item.duration) * 100
}

function getBackdrop(media: Models_LibraryMedia): string {
    return media.bannerImage || media.posterImage
}

function toTimestamp(value?: string): number {
    if (!value) {
        return 0
    }

    const timestamp = Date.parse(value)
    return Number.isNaN(timestamp) ? 0 : timestamp
}

function mapEntryToSwimlaneItem(
    entry: Anime_LibraryCollectionEntry,
    watchHistory: Continuity_WatchHistory | undefined,
    onNavigate: (mediaId: number) => void,
    aspect: "poster" | "wide",
): SwimlaneItem | null {
    if (!entry.media) {
        return null
    }

    const media = entry.media

    return {
        id: `entry-${media.id}`,
        title: getTitle(media),
        image: aspect === "wide" ? getBackdrop(media) : media.posterImage,
        subtitle: media.year > 0 ? String(media.year) : media.format,
        badge: media.format,
        description: media.description,
        progress: getProgress(media.id, watchHistory),
        aspect,
        onClick: () => onNavigate(media.id),
    }
}

function mapEpisodeToSwimlaneItem(
    episode: Anime_Episode,
    media: Models_LibraryMedia,
    watchHistory: Continuity_WatchHistory | undefined,
    onNavigate: (mediaId: number) => void,
): SwimlaneItem {
    return {
        id: `continue-${media.id}-${episode.episodeNumber}`,
        title: getTitle(media),
        image: episode.episodeMetadata?.image || getBackdrop(media),
        subtitle: episode.displayTitle || `Episodio ${episode.episodeNumber}`,
        badge: media.format,
        description: episode.episodeMetadata?.summary || episode.episodeMetadata?.overview || media.description,
        progress: getProgress(media.id, watchHistory),
        aspect: "wide",
        onClick: () => onNavigate(media.id),
    }
}

function mapEpisodeToHeroItem(
    episode: Anime_Episode,
    media: Models_LibraryMedia,
    watchHistory: Continuity_WatchHistory | undefined,
    onNavigate: (mediaId: number) => void,
): HeroBannerItem {
    return {
        id: `hero-continue-${media.id}-${episode.episodeNumber}`,
        title: getTitle(media),
        synopsis: episode.episodeMetadata?.summary || episode.episodeMetadata?.overview || media.description,
        backdropUrl: episode.episodeMetadata?.image || getBackdrop(media),
        posterUrl: media.posterImage,
        year: media.year || undefined,
        format: media.format,
        episodeCount: media.totalEpisodes || undefined,
        progress: getProgress(media.id, watchHistory),
        onPlay: () => onNavigate(media.id),
        onMoreInfo: () => onNavigate(media.id),
    }
}

function mapEntryToHeroItem(
    entry: Anime_LibraryCollectionEntry,
    watchHistory: Continuity_WatchHistory | undefined,
    onNavigate: (mediaId: number) => void,
): HeroBannerItem | null {
    if (!entry.media) {
        return null
    }

    const media = entry.media

    return {
        id: `hero-entry-${media.id}`,
        title: getTitle(media),
        synopsis: media.description,
        backdropUrl: getBackdrop(media),
        posterUrl: media.posterImage,
        year: media.year || undefined,
        format: media.format,
        episodeCount: media.totalEpisodes || undefined,
        progress: getProgress(media.id, watchHistory),
        onPlay: () => onNavigate(media.id),
        onMoreInfo: () => onNavigate(media.id),
    }
}

function ErrorBanner({ message }: { message: string }) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-black px-6">
            <div className="max-w-md text-center">
                <AlertTriangle className="mx-auto mb-5 h-12 w-12 text-zinc-300" />
                <h2 className="mb-3 text-2xl font-semibold uppercase tracking-[0.18em] text-white">
                    No se pudo cargar la biblioteca
                </h2>
                <p className="text-sm leading-6 text-zinc-400">{message}</p>
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="mt-6 rounded-full border border-white/12 bg-white/8 px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-white/14"
                >
                    Reintentar
                </button>
            </div>
        </div>
    )
}

function EmptyState() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-black px-6">
            <div className="max-w-md text-center">
                <FolderOpen className="mx-auto mb-5 h-12 w-12 text-zinc-300" />
                <h2 className="mb-3 text-2xl font-semibold uppercase tracking-[0.18em] text-white">
                    Biblioteca vacia
                </h2>
                <p className="text-sm leading-6 text-zinc-400">
                    Aun no hay contenido listo para mostrar. Escanea tus rutas desde configuracion y vuelve a cargar la biblioteca.
                </p>
            </div>
        </div>
    )
}

function HomePage() {
    const navigate = useNavigate()
    const { data, isLoading, error } = useGetLibraryCollection()
    const { data: watchHistory } = useGetContinuityWatchHistory()

    const handleNavigate = React.useCallback(
        (mediaId: number) => {
            navigate({ to: "/series/$seriesId", params: { seriesId: String(mediaId) } })
        },
        [navigate],
    )

    const collection = data
    const lists = collection?.lists ?? []
    const continueWatchingEpisodes = collection?.continueWatchingList ?? []

    const entriesByMediaId = React.useMemo(() => {
        const map = new Map<number, Anime_LibraryCollectionEntry>()

        for (const list of lists) {
            for (const entry of list.entries ?? []) {
                if (entry.media) {
                    map.set(entry.mediaId, entry)
                }
            }
        }

        return map
    }, [lists])

    const allEntries = React.useMemo(() => Array.from(entriesByMediaId.values()), [entriesByMediaId])

    const resolveEpisodeMedia = React.useCallback(
        (episode: Anime_Episode): Models_LibraryMedia | undefined => {
            return episode.baseAnime || (episode.localFile?.mediaId ? entriesByMediaId.get(episode.localFile.mediaId)?.media : undefined)
        },
        [entriesByMediaId],
    )

    const continueWatchingItems = React.useMemo(() => {
        return continueWatchingEpisodes
            .map((episode) => {
                const media = resolveEpisodeMedia(episode)
                return media ? mapEpisodeToSwimlaneItem(episode, media, watchHistory, handleNavigate) : null
            })
            .filter((item): item is SwimlaneItem => item !== null)
    }, [continueWatchingEpisodes, handleNavigate, resolveEpisodeMedia, watchHistory])

    const trendingEntries = React.useMemo(() => {
        return [...allEntries]
            .sort((left, right) => {
                const scoreDiff = (right.media?.score ?? 0) - (left.media?.score ?? 0)
                if (scoreDiff !== 0) {
                    return scoreDiff
                }

                return (right.media?.year ?? 0) - (left.media?.year ?? 0)
            })
            .slice(0, 24)
    }, [allEntries])

    const recentEntries = React.useMemo(() => {
        return [...allEntries]
            .sort((left, right) => {
                const updatedDiff = toTimestamp(right.media?.updatedAt) - toTimestamp(left.media?.updatedAt)
                if (updatedDiff !== 0) {
                    return updatedDiff
                }

                return (right.media?.year ?? 0) - (left.media?.year ?? 0)
            })
            .slice(0, 24)
    }, [allEntries])

    const trendingItems = React.useMemo(() => {
        return trendingEntries
            .map((entry) => mapEntryToSwimlaneItem(entry, watchHistory, handleNavigate, "poster"))
            .filter((item): item is SwimlaneItem => item !== null)
    }, [handleNavigate, trendingEntries, watchHistory])

    const recentItems = React.useMemo(() => {
        return recentEntries
            .map((entry) => mapEntryToSwimlaneItem(entry, watchHistory, handleNavigate, "poster"))
            .filter((item): item is SwimlaneItem => item !== null)
    }, [handleNavigate, recentEntries, watchHistory])

    const heroItems = React.useMemo(() => {
        const items: HeroBannerItem[] = []
        const seen = new Set<number>()

        for (const episode of continueWatchingEpisodes) {
            const media = resolveEpisodeMedia(episode)
            if (!media || seen.has(media.id)) {
                continue
            }

            seen.add(media.id)
            items.push(mapEpisodeToHeroItem(episode, media, watchHistory, handleNavigate))
        }

        for (const entry of trendingEntries) {
            if (!entry.media || seen.has(entry.media.id)) {
                continue
            }

            const item = mapEntryToHeroItem(entry, watchHistory, handleNavigate)
            if (!item) {
                continue
            }

            seen.add(entry.media.id)
            items.push(item)

            if (items.length >= 5) {
                break
            }
        }

        return items
    }, [continueWatchingEpisodes, handleNavigate, resolveEpisodeMedia, trendingEntries, watchHistory])

    if (isLoading) {
        return <LoadingOverlayWithLogo />
    }

    if (error) {
        return (
            <ErrorBanner
                message={error instanceof Error ? error.message : "Se produjo un error al conectar con el servidor."}
            />
        )
    }

    if (allEntries.length === 0) {
        return <EmptyState />
    }

    return (
        <div className="min-h-screen bg-black">
            <HeroBanner items={heroItems} />

            <div className="relative z-10 -mt-20 space-y-14 pb-24">
                <div className="px-6 md:px-10 lg:px-14">
                    <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-zinc-300 backdrop-blur-xl">
                        <Sparkles className="h-3.5 w-3.5" />
                        Descubrimiento cinematografico
                    </div>
                </div>

                <Swimlane title="Continuar viendo" items={continueWatchingItems} defaultAspect="wide" />
                <Swimlane title="Tendencias" items={trendingItems} defaultAspect="poster" />
                <Swimlane title="Anadidos recientemente" items={recentItems} defaultAspect="poster" />
            </div>
        </div>
    )
}
