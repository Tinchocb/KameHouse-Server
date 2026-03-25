import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { useGetContinuityWatchHistory } from "@/api/hooks/continuity.hooks"
import type {
    Anime_Episode,
    Anime_LibraryCollectionEntry,
    Models_LibraryMedia,
} from "@/api/generated/types"
import { HeroBanner, type HeroBannerItem, HeroBannerSkeleton } from "@/components/ui/hero-banner"
import { Swimlane, type SwimlaneItem, SwimlaneSkeleton } from "@/components/ui/swimlane"
import { ErrorBoundary } from "@/components/shared/error-boundary"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Sparkles, Zap, Globe2, Clapperboard } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import * as React from "react"
import {
    useContinueWatching,
    useHomeIntelligence,
    useIntelligenceStore,
    type IntelligentEntry,
} from "@/hooks/useHomeIntelligence"
import { DynamicBackdrop } from "@/components/shared/dynamic-backdrop"
import { SmartSwimlane } from "@/components/ui/smart-swimlane"
import { SourcePicker } from "@/components/shared/source-picker"
import type { MediaSource } from "@/api/types/unified.types"

// Local imports
import { getTitle, getBackdrop } from "./home.helpers"
import { 
    mapEpisodeToSwimlaneItem, 
    mapEntryToHeroItem, 
    mapEpisodeToHeroItem 
} from "./home.mappers"
import { ErrorBanner, EmptyState, SectionLabel } from "./home.components"
import { useQuickPlay } from "./home.hooks"

export const Route = createFileRoute("/home/")({
    component: HomePage,
})

// ─── HomePage ─────────────────────────────────────────────────────────────────

function HomePage() {
    const navigate = useNavigate()
    const { data, isLoading: isCollectionLoading, error } = useGetLibraryCollection()
    const { data: watchHistory, isLoading: isContinuityLoading } = useGetContinuityWatchHistory()
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

    const { resolution, open: openSourcePicker, close: closeSourcePicker } = useQuickPlay(handleNavigate)

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

    // ── Sections mapping ──────────────────────────────────────────────────

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
                    rating: m.score ? m.score / 10 : undefined,
                    onClick: () => handleNavigate(entry.mediaId),
                }
            })
            .filter((x): x is SwimlaneItem => x !== null)
    }, [allEntries, handleNavigate])

    const heroItems = React.useMemo((): HeroBannerItem[] => {
        const items: HeroBannerItem[] = []
        const seen = new Set<number>()

        // 1. Smart Intelligence (EPIC items)
        if (intelligenceData) {
            for (const lane of intelligenceData.swimlanes) {
                if (lane.type === "trending") continue // Skip trending for hero primary
                for (const entry of lane.entries) {
                    const intel = (entry as IntelligentEntry).intelligence
                    if (!entry.media || seen.has(entry.mediaId)) continue
                    if (intel?.tag !== "EPIC") continue
                    seen.add(entry.mediaId)
                    const item = mapEntryToHeroItem(entry as IntelligentEntry, watchHistory, handleNavigate)
                    if (item) items.push(item)
                    if (items.length >= 3) break
                }
                if (items.length >= 3) break
            }
        }

        // 2. Continue Watching
        for (const ep of continueWatchingEpisodes) {
            const media = resolveEpisodeMedia(ep)
            if (!media || seen.has(media.id)) continue
            seen.add(media.id)
            items.push(mapEpisodeToHeroItem(ep, media, watchHistory, handleNavigate))
            if (items.length >= 5) break
        }

        // 3. Robust Fallback: Recently Added
        // If we still have fewer than 3 items, pull from recentItems
        if (items.length < 3 && recentItems.length > 0) {
            for (const recent of recentItems) {
                if (seen.has(Number(recent.id.replace("recent-", "")))) continue
                const mediaId = Number(recent.id.replace("recent-", ""))
                seen.add(mediaId)
                items.push({
                    id: `hero-fallback-${mediaId}`,
                    title: recent.title,
                    synopsis: recent.description || "",
                    backdropUrl: recent.backdropUrl || recent.image,
                    posterUrl: recent.image,
                    year: recent.year,
                    rating: recent.rating,
                    mediaId: mediaId,
                    onPlay: () => handleNavigate(mediaId),
                    onMoreInfo: () => handleNavigate(mediaId),
                })
                if (items.length >= 5) break
            }
        }

        return items
    }, [continueWatchingEpisodes, handleNavigate, resolveEpisodeMedia, intelligenceData, watchHistory, recentItems])

    if (error && !data) return <ErrorBanner message={error instanceof Error ? error.message : "Error de conexión."} />

    if (!isCollectionLoading && allEntries.length === 0 && (!intelligenceData || (intelligenceData as any).swimlanes.length === 0)) {
        return <EmptyState />
    }

    return (
        <div className="min-h-screen bg-background flex flex-col gap-8 w-full overflow-x-hidden pb-20">
            <DynamicBackdrop />

            {/* ── Hero Experience ── */}
            {isIntelligenceLoading && heroItems.length === 0 ? (
                <HeroBannerSkeleton className="-mt-[53px]" />
            ) : (
                <HeroBanner
                    className="-mt-[53px]"
                    items={heroItems.map((item) => ({
                        ...item,
                        onPlay: () => {
                            if (item.mediaId) openSourcePicker(item.mediaId)
                            else item.onPlay()
                        },
                    }))}
                />
            )}

            <SourcePicker
                response={resolution}
                onSelect={(source: MediaSource) => {
                    closeSourcePicker()
                    window.open(source.urlPath, "_blank")
                }}
                onClose={closeSourcePicker}
            />

            {/* ── Content Sections ── */}
            <div className="relative z-10 -mt-24 flex flex-col gap-12">
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
                            <SwimlaneSkeleton title="Novedades en tu biblioteca" aspect="poster" />
                            <SwimlaneSkeleton aspect="wide" />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="content"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="space-y-8"
                        >
                            {/* 1. Continue Watching */}
                            <ErrorBoundary className="px-6 md:px-10 lg:px-16 xl:px-24 2xl:px-32">
                                {continueWatchingItems.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                                        className="space-y-4"
                                    >
                                        <SectionLabel icon={Zap} label="Continuar viendo" />
                                        <Swimlane
                                            title="Continuar viendo"
                                            items={continueWatchingItems}
                                            defaultAspect="wide"
                                            onHover={setBackdropUrl}
                                        />
                                    </motion.div>
                                )}
                            </ErrorBoundary>

                            {/* 2. Recently Added */}
                            <ErrorBoundary className="px-6 md:px-10 lg:px-16 xl:px-24 2xl:px-32">
                                {recentItems.length > 0 && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                                        className="space-y-4"
                                    >
                                        <SectionLabel icon={Sparkles} label="Novedades en tu biblioteca" />
                                        <Swimlane
                                            title="Añadidos recientemente"
                                            items={recentItems}
                                            defaultAspect="poster"
                                            onHover={setBackdropUrl}
                                        />
                                    </motion.div>
                                )}
                            </ErrorBoundary>

                            {/* 3. Curated Sagas / Intelligence */}
                            {(intelligenceData as any)?.swimlanes.map((lane: any, index: number) => (
                                <ErrorBoundary key={lane.id} className="px-6 md:px-10 lg:px-16 xl:px-24 2xl:px-32">
                                    <motion.div 
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.3 + index * 0.15 }}
                                        className="space-y-4"
                                    >
                                        <SectionLabel 
                                            icon={lane.type === "epic_moments" ? Zap : Clapperboard} 
                                            label={lane.title} 
                                        />
                                        <SmartSwimlane
                                            lane={lane}
                                            onNavigate={(id) => handleNavigate(Number(id))}
                                        />
                                    </motion.div>
                                </ErrorBoundary>
                            ))}

                            {/* 4. Full Collection Fallback */}
                            <ErrorBoundary className="px-6 md:px-10 lg:px-16 xl:px-24 2xl:px-32">
                                {!isCollectionLoading && allEntries.length > 0 && (
                                    <motion.div 
                                        initial={{ opacity: 0 }}
                                        whileInView={{ opacity: 1 }}
                                        viewport={{ once: true }}
                                        className="space-y-4 opacity-80 hover:opacity-100 transition-opacity pb-20"
                                    >
                                        <SectionLabel icon={Globe2} label="Explorar colección completa" />
                                        <Swimlane
                                            title="Tu colección"
                                            items={allEntries.slice(0, 40).map((entry) => ({
                                                id: `coll-${entry.mediaId}`,
                                                title: getTitle(entry.media!),
                                                image: entry.media!.posterImage || getBackdrop(entry.media!),
                                                subtitle: entry.media!.year ? String(entry.media!.year) : entry.media!.format,
                                                badge: entry.media!.format,
                                                availabilityType: entry.availabilityType as SwimlaneItem["availabilityType"],
                                                backdropUrl: getBackdrop(entry.media!) || undefined,
                                                description: entry.media!.description,
                                                year: entry.media!.year,
                                                rating: entry.media!.score ? entry.media!.score / 10 : undefined,
                                                onClick: () => handleNavigate(entry.mediaId),
                                            }))}
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
