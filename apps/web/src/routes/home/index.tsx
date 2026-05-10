import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { useGetContinuityWatchHistory } from "@/api/hooks/continuity.hooks"
import type {
    Anime_Episode,
    Anime_LibraryCollectionEntry,
    Models_LibraryMedia,
} from "@/api/generated/types"
import { HeroBanner, type HeroBannerItem, HeroBannerSkeleton } from "@/components/ui/hero-banner"
import { Swimlane, type SwimlaneItem, SwimlaneSkeleton } from "@/components/ui/swimlane"
import { ErrorBoundary } from "@/components/shared/app-error-boundary"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Sparkles, Zap, Globe2, Tv, Film } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import * as React from "react"
import {
    useContinueWatching,
    useHomeIntelligence,
    useIntelligenceStore,
} from "@/hooks/use-home-intelligence"
import { DynamicBackdrop } from "@/components/shared/dynamic-backdrop"
import { SmartSwimlane } from "@/components/ui/smart-swimlane"
import { BentoRecentlyAdded, type BentoItem } from "@/components/ui/bento-recently-added"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"

import { getTitle, getBackdrop } from "./home.helpers"
import { 
    mapEpisodeToSwimlaneItem, 
    mapEpisodeToHeroItem 
} from "./home.mappers"
import { ErrorBanner, EmptyState, SectionLabel } from "./home.components"

export const Route = createFileRoute("/home/")({
    component: HomePage,
})

// ─── HomePage ────────────────────────────────────────────────────────────────────

function HomePage() {
    const navigate = useNavigate()
    const { data, isLoading: isCollectionLoading, error } = useGetLibraryCollection()
    const { data: watchHistory } = useGetContinuityWatchHistory()
    const { data: intelligenceData, isLoading: isIntelligenceLoading } = useHomeIntelligence()
    const { data: cwData, isLoading: isCwLoading } = useContinueWatching()
    const { setBackdropUrl } = useIntelligenceStore()

    const isLoading = isCollectionLoading || isIntelligenceLoading || isCwLoading
    const isRefetching = false

    const handleNavigate = React.useCallback(
        (mediaId: number) => {
            navigate({ to: "/series/$seriesId", params: { seriesId: String(mediaId) } })
        },
        [navigate],
    )

    const collection = data
    const lists = React.useMemo(() => collection?.lists ?? [], [collection?.lists])
    const continueWatchingEpisodes = React.useMemo(() => collection?.continueWatchingList ?? [], [collection?.continueWatchingList])

    const entriesByMediaId = React.useMemo(() => {
        const map = new Map<number, Anime_LibraryCollectionEntry>()
        for (const list of lists) {
            for (const entry of list.entries ?? []) {
                const entryToStore = { ...entry }
                if (!entryToStore.media) {
                    entryToStore.media = {
                        id: entryToStore.mediaId,
                        title: { 
                            userPreferred: `Desconocido (${entryToStore.mediaId})`, 
                            romaji: `Desconocido (${entryToStore.mediaId})`,
                            english: null,
                            native: null
                        },
                        format: "TV",
                        description: "Archivo local sin identificar",
                    } as unknown as Models_LibraryMedia
                }
                map.set(entryToStore.mediaId, entryToStore)
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

    // ── Series ──────────────────────────────────────────────────────────────
    const dbSeriesItems = React.useMemo((): SwimlaneItem[] => {
        return allEntries
            .filter((entry) => entry.media?.format === "TV")
            .sort((a, b) => {
                const aDate = a.media?.createdAt ? new Date(a.media.createdAt).getTime() : 0
                const bDate = b.media?.createdAt ? new Date(b.media.createdAt).getTime() : 0
                return bDate - aDate
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

    // ── Añadido Recientemente (Bento Grid) ────────────────────────────────────────────────
    const recentBentoItems = React.useMemo((): BentoItem[] => {
        return [...allEntries]
            .sort((a, b) => {
                const aDate = a.media?.createdAt ? new Date(a.media.createdAt).getTime() : 0
                const bDate = b.media?.createdAt ? new Date(b.media.createdAt).getTime() : 0
                return bDate - aDate
            })
            .slice(0, 6)
            .map((entry): BentoItem | null => {
                if (!entry.media) return null
                const m = entry.media
                return {
                    id: `recent-${entry.mediaId}`,
                    title: getTitle(m),
                    image: getBackdrop(m) || m.posterImage || "",
                    year: m.year,
                    rating: m.score ? (m.score > 10 ? m.score / 10 : m.score) : undefined,
                    description: m.description,
                    onClick: () => handleNavigate(entry.mediaId),
                }
            })
            .filter((x): x is BentoItem => x !== null)
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

        if (items.length === 0 && recentBentoItems.length > 0) {
            const charSum = recentBentoItems.reduce((acc, item) => acc + (item.title.charCodeAt(0) || 0), 0)
            const idx = charSum % Math.min(5, recentBentoItems.length)
            const randomEntry = recentBentoItems[idx]
            if (randomEntry) {
                const mediaId = Number(randomEntry.id.replace("recent-", ""))
                seen.add(mediaId)
                items.push({
                    id: `hero-suggestion-${mediaId}`,
                    title: randomEntry.title,
                    synopsis: randomEntry.description || "",
                    backdropUrl: randomEntry.image, // Using image (backdrop) from Bento
                    posterUrl: entriesByMediaId.get(mediaId)?.media?.posterImage,
                    year: randomEntry.year,
                    rating: randomEntry.rating,
                    mediaId: mediaId,
                    onPlay: () => handleNavigate(mediaId),
                    onMoreInfo: () => handleNavigate(mediaId),
                })
            }
        }

        return items
    }, [continueWatchingEpisodes, handleNavigate, resolveEpisodeMedia, watchHistory, recentBentoItems, entriesByMediaId])

    const containerRef = React.useRef<HTMLDivElement>(null)

    useGSAP(() => {
        if (isLoading) return

        const sections = gsap.utils.toArray(".home-section")
        if (sections.length > 0) {
            gsap.from(sections, {
                y: 40,
                opacity: 0,
                duration: 0.8,
                stagger: 0.15,
                ease: "power3.out",
                clearProps: "all"
            })
        }
    }, { scope: containerRef, dependencies: [isLoading] })

    if (error && !data) return <ErrorBanner message={error instanceof Error ? error.message : "Error de conexión."} />

    if (!isCollectionLoading && allEntries.length === 0) {
        return <EmptyState />
    }

    return (
        <div ref={containerRef} className="min-h-screen bg-background flex flex-col gap-8 w-full overflow-x-hidden pb-20">
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
                        <div key="content" className="space-y-8">
                            {/* 0. Secciones inteligentes */}
                            {intelligenceData?.swimlanes?.length ? (
                                <div className="space-y-8">
                                    {intelligenceData.swimlanes.map((lane) => (
                                        <ErrorBoundary
                                            key={lane.id}
                                            className="px-6 md:px-10 lg:px-16 xl:px-24 2xl:px-32"
                                        >
                                            <div className="home-section">
                                                <SmartSwimlane
                                                    lane={lane}
                                                    onNavigate={(mediaId) => handleNavigate(Number(mediaId))}
                                                />
                                            </div>
                                        </ErrorBoundary>
                                    ))}
                                </div>
                            ) : null}

                            {/* 1. Seguir Viendo */}
                            <ErrorBoundary className="px-6 md:px-10 lg:px-16 xl:px-24 2xl:px-32">
                                {continueWatchingItems.length > 0 && (
                                    <div className="home-section space-y-4">
                                        <SectionLabel icon={Zap} label="Seguir Viendo" />
                                        <Swimlane
                                            title="Continuar Viendo"
                                            items={continueWatchingItems}
                                            defaultAspect="wide"
                                            onHover={setBackdropUrl}
                                        />
                                    </div>
                                )}
                            </ErrorBoundary>

                            {/* 2. Series de Dragon Ball */}
                            <ErrorBoundary className="px-6 md:px-10 lg:px-16 xl:px-24 2xl:px-32">
                                {dbSeriesItems.length > 0 && (
                                    <div className="home-section space-y-4">
                                        <SectionLabel icon={Tv} label="Series" />
                                        <Swimlane
                                            title="Series"
                                            items={dbSeriesItems}
                                            defaultAspect="poster"
                                            onHover={setBackdropUrl}
                                        />
                                    </div>
                                )}
                            </ErrorBoundary>

                            {/* 3. Películas y Especiales */}
                            <ErrorBoundary className="px-6 md:px-10 lg:px-16 xl:px-24 2xl:px-32">
                                {moviesAndSpecialsItems.length > 0 && (
                                    <div className="home-section space-y-4">
                                        <SectionLabel icon={Film} label="Películas y Especiales" />
                                        <Swimlane
                                            title="Películas y OVAs"
                                            items={moviesAndSpecialsItems}
                                            defaultAspect="poster"
                                            onHover={setBackdropUrl}
                                        />
                                    </div>
                                )}
                            </ErrorBoundary>

                            {/* 4. Añadido Recientemente (Bento Grid) */}
                            <ErrorBoundary className="px-0">
                                {recentBentoItems.length > 0 && (
                                    <div className="home-section space-y-8">
                                        <SectionLabel icon={Sparkles} label="Añadido Recientemente" />
                                        <BentoRecentlyAdded 
                                            items={recentBentoItems} 
                                        />
                                    </div>
                                )}
                            </ErrorBoundary>

                            {/* Colección completa (fallback) */}
                            <ErrorBoundary className="px-6 md:px-10 lg:px-16 xl:px-24 2xl:px-32">
                                {!isCollectionLoading && allEntries.length > 0 && (
                                    <div className="home-section space-y-4 opacity-80 hover:opacity-100 transition-opacity pb-20">
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
                                    </div>
                                )}
                            </ErrorBoundary>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
