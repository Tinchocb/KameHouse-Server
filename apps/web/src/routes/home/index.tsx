import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { useGetContinuityWatchHistory } from "@/api/hooks/continuity.hooks"
import { useGetMediaCollections } from "@/api/hooks/collections.hooks"
import type {
    Anime_Episode,
    Anime_LibraryCollectionEntry,
    Models_LibraryMedia,
} from "@/api/generated/types"
import { HeroBanner, type HeroBannerItem, HeroBannerSkeleton } from "@/components/ui/hero-banner"
import { Swimlane, type SwimlaneItem, SwimlaneSkeleton } from "@/components/ui/swimlane"
import { ErrorBoundary } from "@/components/shared/app-error-boundary"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Sparkles, Zap, Globe2, Clapperboard, Layers, Tv, Film, Star } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import * as React from "react"
import {
    useContinueWatching,
    useHomeIntelligence,
    useIntelligenceStore,
    type IntelligentEntry,
} from "@/hooks/use-home-intelligence"
import { DynamicBackdrop } from "@/components/shared/dynamic-backdrop"
import { SmartSwimlane } from "@/components/ui/smart-swimlane"

import { getTitle, getBackdrop, getProgress, DRAGON_BALL_IDS } from "./home.helpers"
import { 
    mapEpisodeToSwimlaneItem, 
    mapEntryToHeroItem, 
    mapEpisodeToHeroItem 
} from "./home.mappers"
import { ErrorBanner, EmptyState, SectionLabel } from "./home.components"

export const Route = createFileRoute("/home/")({
    component: HomePage,
})

// ─── Dragon Ball Media Types ────────────────────────────────────────────────

const DB_SERIES_IDS: Record<string, number> = {
    DRAGON_BALL: 529,
    DRAGON_BALL_Z: 813,
    DRAGON_BALL_GT: 568,
    DRAGON_BALL_KAI: 30694,
    DRAGON_BALL_SUPER: 6033,
    DRAGON_BALL_DAIMA: 107,
}

const DB_MOVIE_IDS = [
    5644,  // DBZ Movie 1
    5645,  // DBZ Movie 2
    5646,  // DBZ Movie 3
    5647,  // DBZ Movie 4
    5648,  // DBZ Movie 5
    5649,  // DBZ Movie 6
    5650,  // DBZ Movie 7
    5651,  // DBZ Movie 8
    5652,  // DBZ Movie 9
    5653,  // DBZ Movie 10
    5654,  // DBZ Movie 11
    5655,  // DBZ Movie 12
    6027,  // DBZ Movie 13
    3390,  // DB Super Broly
    5054,  // DB Super: Super Hero
]

// ─── HomePage ────────────────────────────────────────────────────────────────────

function HomePage() {
    const navigate = useNavigate()
    const { data, isLoading: isCollectionLoading, error } = useGetLibraryCollection()
    const { data: watchHistory, isLoading: isContinuityLoading } = useGetContinuityWatchHistory()
    const { data: intelligenceData, isLoading: isIntelligenceLoading } = useHomeIntelligence()
    const { data: cwData, isLoading: isCwLoading } = useContinueWatching()
    const { data: collections, isLoading: isCollectionsLoading } = useGetMediaCollections()
    const { setBackdropUrl } = useIntelligenceStore()

    const isLoading = isCollectionLoading || isIntelligenceLoading || isCwLoading || isCollectionsLoading
    const isRefetching = false

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
                if (entry.media) map.set(entry.mediaId, entry)
            }
        }
        return map
    }, [lists])

    const allEntries = React.useMemo(() => Array.from(entriesByMediaId.values()), [entriesByMediaId])

    const resolveEpisodeMedia = React.useCallback(
        (episode: Anime_Episode): Models_LibraryMedia | undefined =>
            episode.baseAnime ||
            (episode.localFile?.mediaId
                ? entriesByMediaId.get(episode.localFile.mediaId)?.media
                : undefined),
        [entriesByMediaId],
    )

    // ── Continue Watching ─────────────────────────────────────────────────────
    const continueWatchingItems = React.useMemo(
        () =>
            (cwData || [])
                .map((entry) => {
                    return mapEpisodeToSwimlaneItem(
                        entry.episode,
                        entry.media,
                        entriesByMediaId.get(entry.media.id)?.availabilityType,
                        watchHistory,
                        handleNavigate,
                    )
                }),
        [cwData, entriesByMediaId, handleNavigate, watchHistory],
    )

    // ── Series de Dragon Ball ────────────────────────────────────────────────
    const dbSeriesItems = React.useMemo((): SwimlaneItem[] => {
        return allEntries
            .filter((entry) => DRAGON_BALL_IDS.has(entry.mediaId))
            .sort((a, b) => {
                const idxA = Object.values(DB_SERIES_IDS).indexOf(a.mediaId)
                const idxB = Object.values(DB_SERIES_IDS).indexOf(b.mediaId)
                return idxA - idxB
            })
            .map((entry): SwimlaneItem | null => {
                if (!entry.media) return null
                const m = entry.media
                return {
                    id: `db-series-${entry.mediaId}`,
                    title: getTitle(m),
                    image: m.posterImage || getBackdrop(m),
                    subtitle: m.year ? String(m.year) : m.format,
                    badge: m.format,
                    availabilityType: entry.availabilityType as SwimlaneItem["availabilityType"],
                    backdropUrl: getBackdrop(m) || undefined,
                    description: m.description,
                    aspect: "poster",
                    year: m.year,
                    rating: m.score ? (m.score > 10 ? m.score / 10 : m.score) : undefined,
                    onClick: () => handleNavigate(entry.mediaId),
                }
            })
            .filter((x): x is SwimlaneItem => x !== null)
    }, [allEntries, handleNavigate])

    // ── Películas y Especiales ────────────────────────────────────────────
    const moviesAndSpecialsItems = React.useMemo((): SwimlaneItem[] => {
        return allEntries
            .filter((entry) => {
                const format = entry.media?.format
                return format === "MOVIE" || format === "OVA" || format === "SPECIAL"
            })
            .sort((a, b) => {
                const aDate = a.media?.createdAt ? new Date(a.media.createdAt).getTime() : 0
                const bDate = b.media?.createdAt ? new Date(b.media.createdAt).getTime() : 0
                return bDate - aDate
            })
            .map((entry): SwimlaneItem | null => {
                if (!entry.media) return null
                const m = entry.media
                return {
                    id: `movie-${entry.mediaId}`,
                    title: getTitle(m),
                    image: m.posterImage || getBackdrop(m),
                    subtitle: m.year ? String(m.year) : m.format,
                    badge: m.format,
                    availabilityType: entry.availabilityType as SwimlaneItem["availabilityType"],
                    backdropUrl: getBackdrop(m) || undefined,
                    description: m.description,
                    aspect: "poster",
                    year: m.year,
                    rating: m.score ? (m.score > 10 ? m.score / 10 : m.score) : undefined,
                    onClick: () => handleNavigate(entry.mediaId),
                }
            })
            .filter((x): x is SwimlaneItem => x !== null)
    }, [allEntries, handleNavigate])

    // ── Sagas Destacadas (Collections) ────────────────────────────────
    const sagasItems = React.useMemo((): SwimlaneItem[] => {
        return (collections || [])
            .filter((coll) => {
                const name = coll.name.toLowerCase()
                return name.includes("saiyajin") || name.includes("freezer") || 
                       name.includes("cell") || name.includes("buu") || 
                       name.includes("torneo") || name.includes("universo") ||
                       name.includes("batalla") || name.includes("diosa")
            })
            .map((coll): SwimlaneItem => {
                return {
                    id: `saga-${coll.id}`,
                    title: coll.name,
                    image: coll.posterPath || coll.backdropPath,
                    subtitle: `${coll.memberIds?.length || 0} Entregas`,
                    badge: "SAGA",
                    availabilityType: "FULL_LOCAL",
                    backdropUrl: coll.backdropPath || undefined,
                    description: coll.overview,
                    aspect: "poster",
                    onClick: () => navigate({ to: "/collections/$id", params: { id: String(coll.tmdbCollectionId) } }),
                }
            })
    }, [collections, navigate])

    // ── Añadido Recientemente ────────────────────────────────────────────────
    const recentItems = React.useMemo((): SwimlaneItem[] => {
        return [...allEntries]
            .sort((a, b) => {
                const aDate = a.media?.createdAt ? new Date(a.media.createdAt).getTime() : 0
                const bDate = b.media?.createdAt ? new Date(b.media.createdAt).getTime() : 0
                return bDate - aDate
            })
            .slice(0, 20)
            .map((entry): SwimlaneItem | null => {
                if (!entry.media) return null
                const m = entry.media
                return {
                    id: `recent-${entry.mediaId}`,
                    title: getTitle(m),
                    image: m.posterImage || getBackdrop(m),
                    subtitle: m.year ? String(m.year) : m.format,
                    badge: m.format,
                    availabilityType: entry.availabilityType as SwimlaneItem["availabilityType"],
                    backdropUrl: getBackdrop(m) || undefined,
                    description: m.description,
                    aspect: "poster",
                    year: m.year,
                    rating: m.score ? (m.score > 10 ? m.score / 10 : m.score) : undefined,
                    onClick: () => handleNavigate(entry.mediaId),
                }
            })
            .filter((x): x is SwimlaneItem => x !== null)
    }, [allEntries, handleNavigate])

    // ── Hero: Prioridad 1 = Continuar, Prioridad 2 = Sugerencia aleatoria ─────────────
    const heroItems = React.useMemo((): HeroBannerItem[] => {
        const items: HeroBannerItem[] = []
        const seen = new Set<number>()

        // 1. Continuar Viendo (máxima prioridad)
        for (const ep of continueWatchingEpisodes) {
            const media = resolveEpisodeMedia(ep)
            if (!media || seen.has(media.id)) continue
            seen.add(media.id)
            items.push(mapEpisodeToHeroItem(ep, media, watchHistory, handleNavigate))
            if (items.length >= 3) break
        }

        if (items.length === 0 && recentItems.length > 0) {
            const charSum = recentItems.reduce((acc, item) => acc + (item.title.charCodeAt(0) || 0), 0)
            const idx = charSum % Math.min(5, recentItems.length)
            const randomEntry = recentItems[idx]
            if (randomEntry) {
                const mediaId = Number(randomEntry.id.replace("recent-", ""))
                seen.add(mediaId)
                items.push({
                    id: `hero-suggestion-${mediaId}`,
                    title: randomEntry.title,
                    synopsis: randomEntry.description || "",
                    backdropUrl: randomEntry.backdropUrl || randomEntry.image,
                    posterUrl: randomEntry.image,
                    year: randomEntry.year,
                    rating: randomEntry.rating,
                    mediaId: mediaId,
                    onPlay: () => handleNavigate(mediaId),
                    onMoreInfo: () => handleNavigate(mediaId),
                })
            }
        }

        return items
    }, [continueWatchingEpisodes, handleNavigate, resolveEpisodeMedia, watchHistory, recentItems])

    if (error && !data) return <ErrorBanner message={error instanceof Error ? error.message : "Error de conexión."} />

    if (!isCollectionLoading && allEntries.length === 0) {
        return <EmptyState />
    }

    return (
        <div className="min-h-screen bg-background flex flex-col gap-8 w-full overflow-x-hidden pb-20">
            <DynamicBackdrop />

            {/* ── Hero ── */}
            {isIntelligenceLoading && heroItems.length === 0 ? (
                <HeroBannerSkeleton />
            ) : (
                <HeroBanner
                    items={heroItems.map((item) => ({
                        ...item,
                        onPlay: () => item.mediaId && handleNavigate(item.mediaId),
                    }))}
                />
            )}

            {/* ── Content Sections ── */}
            <div className="relative z-10 flex flex-col gap-12">
                <AnimatePresence mode="wait">
                    {isLoading || isRefetching ? (
                        <motion.div 
                            key="skeletons"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.6 }}
                            className="space-y-8 px-6 md:px-10 lg:px-16 xl:px-24 2xl:px-32"
                        >
                            <SwimlaneSkeleton title="Continuar viendo" aspect="wide" />
                            <SwimlaneSkeleton title="Series" aspect="poster" />
                            <SwimlaneSkeleton title="Películas" aspect="poster" />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="content"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="space-y-8"
                        >
                            {/* 0. Secciones inteligentes */}
                            {intelligenceData?.swimlanes?.length ? (
                                <div className="space-y-8">
                                    {intelligenceData.swimlanes.map((lane) => (
                                        <ErrorBoundary
                                            key={lane.id}
                                            className="px-6 md:px-10 lg:px-16 xl:px-24 2xl:px-32"
                                        >
                                            <motion.div
                                                initial={{ opacity: 0, y: 24 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                                            >
                                                <SmartSwimlane
                                                    lane={lane}
                                                    onNavigate={(mediaId) => handleNavigate(Number(mediaId))}
                                                />
                                            </motion.div>
                                        </ErrorBoundary>
                                    ))}
                                </div>
                            ) : null}

                            {/* 1. Seguir Viendo */}
                            <ErrorBoundary className="px-6 md:px-10 lg:px-16 xl:px-24 2xl:px-32">
                                {continueWatchingItems.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                                        className="space-y-4"
                                    >
                                        <SectionLabel icon={Zap} label="Seguir Viendo" />
                                        <Swimlane
                                            title="Continuar Viendo"
                                            items={continueWatchingItems}
                                            defaultAspect="wide"
                                            onHover={setBackdropUrl}
                                        />
                                    </motion.div>
                                )}
                            </ErrorBoundary>

                            {/* 2. Series de Dragon Ball */}
                            <ErrorBoundary className="px-6 md:px-10 lg:px-16 xl:px-24 2xl:px-32">
                                {dbSeriesItems.length > 0 && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                                        className="space-y-4"
                                    >
                                        <SectionLabel icon={Tv} label="Series" />
                                        <Swimlane
                                            title="Series de Dragon Ball"
                                            items={dbSeriesItems}
                                            defaultAspect="poster"
                                            onHover={setBackdropUrl}
                                        />
                                    </motion.div>
                                )}
                            </ErrorBoundary>

                            {/* 3. Sagas Destacadas */}
                            <ErrorBoundary className="px-6 md:px-10 lg:px-16 xl:px-24 2xl:px-32">
                                {sagasItems.length > 0 && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
                                        className="space-y-4"
                                    >
                                        <SectionLabel icon={Layers} label="Sagas Destacadas" />
                                        <Swimlane
                                            title="Sagas de Dragon Ball"
                                            items={sagasItems}
                                            defaultAspect="poster"
                                            onHover={setBackdropUrl}
                                        />
                                    </motion.div>
                                )}
                            </ErrorBoundary>

                            {/* 4. Películas y Especiales */}
                            <ErrorBoundary className="px-6 md:px-10 lg:px-16 xl:px-24 2xl:px-32">
                                {moviesAndSpecialsItems.length > 0 && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                                        className="space-y-4"
                                    >
                                        <SectionLabel icon={Film} label="Películas y Especiales" />
                                        <Swimlane
                                            title="Películas y OVAs"
                                            items={moviesAndSpecialsItems}
                                            defaultAspect="poster"
                                            onHover={setBackdropUrl}
                                        />
                                    </motion.div>
                                )}
                            </ErrorBoundary>

                            {/* 5. Añadido Recientemente */}
                            <ErrorBoundary className="px-6 md:px-10 lg:px-16 xl:px-24 2xl:px-32">
                                {recentItems.length > 0 && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
                                        className="space-y-4"
                                    >
                                        <SectionLabel icon={Sparkles} label="Añadido Recientemente" />
                                        <Swimlane
                                            title="Añadido Recientemente"
                                            items={recentItems}
                                            defaultAspect="poster"
                                            onHover={setBackdropUrl}
                                        />
                                    </motion.div>
                                )}
                            </ErrorBoundary>

                            {/* Colección completa (fallback) */}
                            <ErrorBoundary className="px-6 md:px-10 lg:px-16 xl:px-24 2xl:px-32">
                                {!isCollectionLoading && allEntries.length > 0 && (
                                    <motion.div 
                                        initial={{ opacity: 0 }}
                                        whileInView={{ opacity: 1 }}
                                        viewport={{ once: true }}
                                        className="space-y-4 opacity-80 hover:opacity-100 transition-opacity pb-20"
                                    >
                                        <SectionLabel icon={Globe2} label="Biblioteca Completa" />
                                        <Swimlane
                                            title="Tu colección"
                                            items={allEntries.slice(0, 40).filter(e => e.media).map((entry) => {
                                                const m = entry.media!
                                                return {
                                                    id: `coll-${entry.mediaId}`,
                                                    title: getTitle(m),
                                                    image: m.posterImage || getBackdrop(m),
                                                    subtitle: m.year ? String(m.year) : m.format,
                                                    badge: m.format,
                                                    availabilityType: entry.availabilityType as SwimlaneItem["availabilityType"],
                                                    backdropUrl: getBackdrop(m) || undefined,
                                                    description: m.description,
                                                    year: m.year,
                                                    rating: m.score ? (m.score > 10 ? m.score / 10 : m.score) : undefined,
                                                    onClick: () => handleNavigate(entry.mediaId),
                                                }
                                            })}
                                            defaultAspect="poster"
                                        />
                                    </motion.div>
                                )}
                            </ErrorBoundary>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
