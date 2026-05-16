import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { useGetContinuityWatchHistory } from "@/api/hooks/continuity.hooks"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { motion, AnimatePresence } from "framer-motion"
import * as React from "react"
import {
    useContinueWatching,
    useHomeIntelligence,
    useIntelligenceStore,
} from "@/hooks/use-home-intelligence"
import { DynamicBackdrop } from "@/components/shared/dynamic-backdrop"
import { HeroBanner, HeroBannerSkeleton } from "@/components/ui/hero-banner"
import { SwimlaneSkeleton } from "@/components/ui/swimlane"

import { getTitle } from "./home.helpers"
import { 
    mapEpisodeToMediaCard, 
    mapLibraryEntryToMediaCard,
    mapToHeroItem
} from "./home.mappers"
import { ErrorBanner, EmptyState } from "./home.components"
import {
    HomeIntelligentSections,
    HomeContinueWatchingSection,
    HomeSeriesSection,
    HomeMoviesSection,
    HomeRecentBentoSection,
    HomeFullLibrarySection,
    HomeVibeFilteredSection
} from "./-home.sections"
import { VibePicker } from "./-vibe-picker"

export const Route = createFileRoute("/home/")({
    component: HomePage,
})

function HomePage() {
    const navigate = useNavigate()
    const { data: collection, isLoading: isCollectionLoading, error } = useGetLibraryCollection()
    const { data: watchHistory } = useGetContinuityWatchHistory()
    const { data: intelligenceData, isLoading: isIntelligenceLoading } = useHomeIntelligence()
    const { data: cwData, isLoading: isCwLoading } = useContinueWatching()
    const { setBackdropUrl } = useIntelligenceStore()
    const [selectedVibe, setSelectedVibe] = React.useState<string | null>(null)

    const isLoading = isCollectionLoading || isIntelligenceLoading || isCwLoading

    const handleNavigate = React.useCallback(
        (mediaId: number) => {
            navigate({ to: "/series/$seriesId", params: { seriesId: String(mediaId) } })
        },
        [navigate],
    )

    // ── Data Processing ────────────────────────────────────────────────────────
    
    const allEntries = React.useMemo(() => {
        if (!collection?.lists) return []
        return collection.lists.flatMap(list => list.entries ?? [])
    }, [collection])

    const heroItems = React.useMemo(() => {
        if (!collection?.continueWatchingList && !allEntries.length) return []
        
        // Priority: Continue Watching episodes
        const cwHero = (collection?.continueWatchingList ?? [])
            .slice(0, 3)
            .map(ep => mapToHeroItem(ep.baseAnime!, handleNavigate, ep.episodeMetadata?.summary))

        if (cwHero.length > 0) return cwHero

        // Fallback: Recent additions
        return allEntries
            .slice(0, 3)
            .map(entry => mapToHeroItem(entry.media!, handleNavigate))
    }, [collection, allEntries, handleNavigate])

    const continueWatchingItems = React.useMemo(() => {
        return (cwData || []).map(entry => 
            mapEpisodeToMediaCard(entry.episode, entry.media, watchHistory, handleNavigate)
        )
    }, [cwData, watchHistory, handleNavigate])

    const seriesItems = React.useMemo(() => {
        return allEntries
            .filter(e => e.media?.format === "TV")
            .map(e => mapLibraryEntryToMediaCard(e, handleNavigate))
    }, [allEntries, handleNavigate])

    const movieItems = React.useMemo(() => {
        return allEntries
            .filter(e => ["MOVIE", "OVA", "SPECIAL"].includes(e.media?.format || ""))
            .map(e => mapLibraryEntryToMediaCard(e, handleNavigate))
    }, [allEntries, handleNavigate])

    const bentoItems = React.useMemo(() => {
        return allEntries.slice(0, 6).map(e => ({
            id: `recent-${e.mediaId}`,
            title: getTitle(e.media!),
            image: e.media?.bannerImage || e.media?.posterImage || "",
            year: e.media?.year ?? undefined,
            rating: e.media?.score ?? undefined,
            description: e.media?.description || "",
            onClick: () => handleNavigate(e.mediaId),
        }))
    }, [allEntries, handleNavigate])

    const vibeItems = React.useMemo(() => {
        if (!selectedVibe) return []
        return (allEntries as any[])
            .filter(e => e.vibes?.includes(selectedVibe))
            .map(e => mapLibraryEntryToMediaCard(e, handleNavigate))
    }, [allEntries, selectedVibe, handleNavigate])

    // ── Render Helpers ─────────────────────────────────────────────────────────

    if (error && !collection) return <ErrorBanner message="Hubo un problema al cargar tu biblioteca." />
    if (isLoading && !heroItems.length) return <HomeSkeleton />
    if (!isCollectionLoading && allEntries.length === 0) return <EmptyState />

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative min-h-screen bg-zinc-950 text-white overflow-x-hidden"
        >
            <DynamicBackdrop />

            <div className="relative z-10 flex flex-col">
                <HeroBanner items={heroItems} />

                <div className="relative -mt-24 space-y-32 pb-40">
                    <div className="space-y-12">
                        <VibePicker 
                            selectedVibe={selectedVibe} 
                            onSelect={(vibe) => setSelectedVibe(vibe === selectedVibe ? null : vibe)}
                        />
                    </div>

                    <AnimatePresence mode="wait">
                        {selectedVibe ? (
                            <HomeVibeFilteredSection 
                                key={`vibe-${selectedVibe}`}
                                vibe={selectedVibe} 
                                items={vibeItems} 
                                onHover={setBackdropUrl}
                            />
                        ) : (
                            <motion.div 
                                key="main-feed"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="flex flex-col space-y-40"
                            >
                                <HomeContinueWatchingSection items={continueWatchingItems} onHover={setBackdropUrl} />
                                <HomeIntelligentSections swimlanes={intelligenceData?.swimlanes} onNavigate={handleNavigate} />
                                <HomeSeriesSection items={seriesItems} onHover={setBackdropUrl} />
                                <HomeRecentBentoSection items={bentoItems} />
                                <HomeMoviesSection items={movieItems} onHover={setBackdropUrl} />
                                <HomeFullLibrarySection items={seriesItems.slice(0, 10)} isLoading={false} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    )
}

function HomeSkeleton() {
    return (
        <div className="min-h-screen bg-zinc-950 flex flex-col gap-32 overflow-hidden">
            <HeroBannerSkeleton />
            <div className="space-y-32">
                <SwimlaneSkeleton aspect="wide" />
                <SwimlaneSkeleton aspect="poster" />
            </div>
        </div>
    )
}
