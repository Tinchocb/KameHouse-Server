import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo, useEffect, useCallback } from "react"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"

import { useGetLibraryCollection, fetchLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { useGetContinuityWatchHistory } from "@/api/hooks/continuity.hooks"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import type { Anime_LibraryCollectionEntry } from "@/api/generated/types"
import { isTmdbId } from "@/lib/helpers/type-guards"

import { EraTab, ERA_TABS } from "./-MovieCard"
import { SortOption, getEntryEra } from "./-components/movies-utils"
import { MoviesHero } from "./-components/movies-hero"
import { MoviesFilterBar } from "./-components/movies-filter-bar"
import { MoviesGrid } from "./-components/movies-grid"

export const Route = createFileRoute("/movies/")({
    loader: ({ context }) => {
        const qc = context.queryClient
        qc.prefetchQuery({
            queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key],
            queryFn: fetchLibraryCollection,
        })
        return { dehydrateState: dehydrate(qc) }
    },
    component: MoviesPageWrapper,
})

function MoviesPageWrapper() {
    const { dehydrateState } = Route.useLoaderData()
    return (
        <HydrationBoundary state={dehydrateState}>
            <MoviesPage />
        </HydrationBoundary>
    )
}

function MoviesPage() {
    const [activeEra, setActiveEra] = useState<EraTab>("all")
    const [sortBy, setSortBy] = useState<SortOption>("year_asc")
    const [sortOpen, setSortOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    
    const [hoveredMovie, setHoveredMovie] = useState<(Anime_LibraryCollectionEntry & { era: EraTab; startedAtTimestamp: number }) | null>(null)
    const [debouncedMovie, setDebouncedMovie] = useState<(Anime_LibraryCollectionEntry & { era: EraTab; startedAtTimestamp: number }) | null>(null)

    const navigate = useNavigate()

    const { data: collection, isLoading } = useGetLibraryCollection()
    const { data: watchHistory } = useGetContinuityWatchHistory()

    // Debounce hover so backdrop doesn't flicker on fast cursor moves
    useEffect(() => {
        const t = setTimeout(() => setDebouncedMovie(hoveredMovie), 160)
        return () => clearTimeout(t)
    }, [hoveredMovie])

    const allMovies = useMemo(() => {
        if (!collection?.lists) return []
        const allEntries = collection.lists.flatMap(l => l.entries || [])
        const rawMovies = allEntries.filter(e => {
            const fmt = e.media?.format
            const type = e.media?.type
            return fmt === "MOVIE" || fmt === "OVA" || fmt === "SPECIAL" || type?.toUpperCase() === "MOVIE" || isTmdbId(e.mediaId)
        })
        const unique = new Map<number, Anime_LibraryCollectionEntry>()
        rawMovies.forEach(m => { if (m.mediaId) unique.set(m.mediaId, m) })
        return Array.from(unique.values()).map(entry => {
            const startedAt = entry.listData?.startedAt
            return { ...entry, era: getEntryEra(entry), startedAtTimestamp: startedAt ? new Date(startedAt).getTime() : 0 }
        })
    }, [collection])

    const filteredSorted = useMemo(() => {
        let result = activeEra === "all" ? allMovies : allMovies.filter(e => e.era === activeEra)
        
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim()
            result = result.filter(e => {
                const media = e.media
                if (!media) return false
                const titleSpanish = (media.titleSpanish || "").toLowerCase()
                const titleEnglish = (media.titleEnglish || "").toLowerCase()
                const titleRomaji = (media.titleRomaji || "").toLowerCase()
                const titleOriginal = (media.titleOriginal || "").toLowerCase()
                return titleSpanish.includes(query) || titleEnglish.includes(query) || titleRomaji.includes(query) || titleOriginal.includes(query)
            })
        }

        switch (sortBy) {
            case "year_asc": return [...result].sort((a, b) => (a.media?.year || 0) - (b.media?.year || 0))
            case "year_desc": return [...result].sort((a, b) => (b.media?.year || 0) - (a.media?.year || 0))
            case "alpha": return [...result].sort((a, b) => (a.media?.titleRomaji || "").localeCompare(b.media?.titleRomaji || ""))
            default: return result
        }
    }, [allMovies, activeEra, sortBy, searchQuery])

    const activeEraConfig = ERA_TABS.find(t => t.value === activeEra) || ERA_TABS[0]

    // Reset state on era change (synchronized in render phase to avoid cascading renders)
    const [prevActiveEra, setPrevActiveEra] = useState<EraTab>("all")
    if (activeEra !== prevActiveEra) {
        setPrevActiveEra(activeEra)
        setHoveredMovie(null)
        setDebouncedMovie(null)
    }

    const featuredList = useMemo(() => filteredSorted.filter(m => m.media?.bannerImage), [filteredSorted])
    
    // Select recommendations: stable shuffle of 8 movies for 'all', top 5 for specific eras
    const topFeatured = useMemo(() => {
        if (activeEra === "all" && featuredList.length > 0) {
            // Seeded deterministic shuffle to keep useMemo pure and prevent React Compiler warnings
            const shuffled = [...featuredList]
            let seed = 42
            const random = () => {
                const x = Math.sin(seed++) * 10000
                return x - Math.floor(x)
            }
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(random() * (i + 1))
                const temp = shuffled[i]
                shuffled[i] = shuffled[j]
                shuffled[j] = temp
            }
            return shuffled.slice(0, 8)
        }
        return featuredList.slice(0, 5)
    }, [featuredList, activeEra])

    const handleMovieClick = useCallback((mediaId: number) => {
        navigate({ to: "/movies/$movieId", params: { movieId: String(mediaId) } })
    }, [navigate])

    const handleHoverCard = useCallback((entry: (Anime_LibraryCollectionEntry & { era: EraTab; startedAtTimestamp: number }) | null) => {
        setHoveredMovie(entry)
    }, [])

    return (
        <div className="min-h-screen bg-[#07070a]/40 text-white overflow-x-hidden selection:bg-orange-500/20 relative z-10">

            {/* Capa estática CRT global */}
            <div 
                className="absolute inset-0 pointer-events-none z-30 opacity-[0.04]"
                style={{
                    background: `linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.3) 50%), 
                                 linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))`,
                    backgroundSize: '100% 4px, 6px 100%'
                }}
            />

            <MoviesHero 
                topFeatured={topFeatured}
                debouncedMovie={debouncedMovie}
                activeEraConfig={activeEraConfig}
                handleMovieClick={handleMovieClick}
            />

            <div className="w-full max-w-[1800px] mx-auto px-6 md:px-12 lg:px-16 mt-12">
                <div className="flex flex-col lg:flex-row gap-8 min-h-[70vh]">
                    {/* Left Column: Filter Sidebar */}
                    <div className="lg:w-80 flex-shrink-0 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-7rem)]">
                        <MoviesFilterBar 
                            allMovies={allMovies}
                            activeEra={activeEra}
                            setActiveEra={setActiveEra}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            sortBy={sortBy}
                            setSortBy={setSortBy}
                            sortOpen={sortOpen}
                            setSortOpen={setSortOpen}
                        />
                    </div>

                    {/* Right Column: Movies Grid */}
                    <div className="flex-grow min-w-0">
                        <MoviesGrid 
                            filteredSorted={filteredSorted}
                            isLoading={isLoading}
                            allMoviesLength={allMovies.length}
                            watchHistory={watchHistory}
                            handleMovieClick={handleMovieClick}
                            handleHoverCard={handleHoverCard}
                            activeEra={activeEra}
                        />
                    </div>
                </div>
            </div>
            
        </div>
    )
}
