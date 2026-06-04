import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion"
import { Clock, Star, ChevronDown } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"
import { useGetLibraryCollection, fetchLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { useGetContinuityWatchHistory } from "@/api/hooks/continuity.hooks"
import type { Anime_LibraryCollectionEntry } from "@/api/generated/types"
import { cn } from "@/components/ui/core/styling"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { MovieCard, ERA_TABS, EraTab, cleanMovieTitle } from "./-MovieCard"
import { useWindowVirtualizer } from "@tanstack/react-virtual"
import { isTmdbId } from "@/lib/helpers/type-guards"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"

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

type SortOption = "year_asc" | "year_desc" | "alpha"

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: "year_asc", label: "Año: Antiguos" },
    { value: "year_desc", label: "Año: Recientes" },
    { value: "alpha", label: "Alfabético" },
]

const specialsTmdbIds = new Set([39323, 39324, 38594, 47734, 15461, 1259215, 109963])
const classicTmdbIds = new Set([39144, 33499, 39145, 116776, 33513, 39148])
const zTmdbIds = new Set([28609, 15448, 39100, 39101, 39102, 24752, 15452, 39103, 39104, 15454, 34433, 39105, 44251, 39106, 39107, 39108, 177572, 126963, 303857])
const gtTmdbIds = new Set([18095, 39149])
const superTmdbIds = new Set([503314, 610150])
const zKeywords = ["z ", " z:", "kai", "改", "freezer", "frieza", "cooler", "androide", "android", "bojack", "janemba", "tapion", "bardock", "trunks", "broly", "slug", "turles", "dead zone", "fusion", "bio-broly", "gohan", "vegeta"]

function getEntryEra(entry: Anime_LibraryCollectionEntry): EraTab {
    const media = entry.media
    if (!media) return "Especiales y OVAs"
    const tmdbId = media.tmdbId || 0
    if (specialsTmdbIds.has(tmdbId)) return "Especiales y OVAs"
    if (classicTmdbIds.has(tmdbId)) return "Dragon Ball"
    if (zTmdbIds.has(tmdbId)) return "Dragon Ball Z"
    if (gtTmdbIds.has(tmdbId)) return "Dragon Ball GT"
    if (superTmdbIds.has(tmdbId)) return "Dragon Ball Super"
    if (isTmdbId(tmdbId)) return "Especiales y OVAs"
    const allTitles = [media.titleRomaji, media.titleEnglish, media.titleOriginal, media.titleSpanish]
        .filter(Boolean).join(" ").toLowerCase()
    if (!allTitles.includes("dragon ball")) return "Especiales y OVAs"
    if (allTitles.includes("special") || allTitles.includes("especial") || allTitles.includes("ova") || media.format === "SPECIAL" || media.format === "OVA") return "Especiales y OVAs"
    if (allTitles.includes("super")) return "Dragon Ball Super"
    if (allTitles.includes(" gt") || allTitles.includes("gt ")) return "Dragon Ball GT"
    if (zKeywords.some(k => allTitles.includes(k))) return "Dragon Ball Z"
    return "Dragon Ball"
}

function MoviesPage() {
    const [activeEra, setActiveEra] = useState<EraTab>("all")
    const [sortBy, setSortBy] = useState<SortOption>("year_asc")
    const [sortOpen, setSortOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [hoveredMovie, setHoveredMovie] = useState<(Anime_LibraryCollectionEntry & { era: EraTab; startedAtTimestamp: number }) | null>(null)
    const [debouncedMovie, setDebouncedMovie] = useState<(Anime_LibraryCollectionEntry & { era: EraTab; startedAtTimestamp: number }) | null>(null)
    const [featuredIndex, setFeaturedIndex] = useState(0)
    const [isHeroHovered, setIsHeroHovered] = useState(false)
    const heroRef = useRef<HTMLDivElement>(null)
    const navigate = useNavigate()
    const setBackdropUrl = useIntelligenceStore(s => s.setBackdropUrl)

    const { data: collection, isLoading } = useGetLibraryCollection()
    const { data: watchHistory } = useGetContinuityWatchHistory()

    const { scrollY } = useScroll()
    const heroOpacity = useTransform(scrollY, [0, 340], [1, 0])
    const heroScale = useTransform(scrollY, [0, 340], [1, 1.05])

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
        setFeaturedIndex(0)
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

    // Auto-rotate active slide every 8s when not hovering the Hero
    useEffect(() => {
        if (isHeroHovered || topFeatured.length <= 1) return
        const id = setInterval(() => setFeaturedIndex(p => (p + 1) % topFeatured.length), 8000)
        return () => clearInterval(id)
    }, [isHeroHovered, topFeatured])

    const defaultFeatured = useMemo(() => topFeatured[featuredIndex] ?? topFeatured[0] ?? null, [topFeatured, featuredIndex])
    const currentMovie = debouncedMovie ?? defaultFeatured
    const displayMedia = currentMovie?.media
    const currentEraConfig = ERA_TABS.find(t => t.value === currentMovie?.era) ?? activeEraConfig

    useEffect(() => {
        const bg = currentMovie?.media?.bannerImage || currentMovie?.media?.posterImage || null
        if (bg) {
            setBackdropUrl(bg)
        }
        return () => {
            setBackdropUrl(null)
        }
    }, [currentMovie, setBackdropUrl])

    const backdropSrc = displayMedia?.bannerImage ?? null

    const handleMovieClick = useCallback((mediaId: number) => {
        navigate({ to: "/movies/$movieId", params: { movieId: String(mediaId) } })
    }, [navigate])

    const localCount = allMovies.filter(m => (m.libraryData?.mainFileCount || 0) > 0).length
    const handleHoverCard = useCallback((entry: (Anime_LibraryCollectionEntry & { era: EraTab; startedAtTimestamp: number }) | null) => {
        setHoveredMovie(entry)
    }, [])
    
    // Real-time VHS tape running counter logic
    const [counterSeconds, setCounterSeconds] = useState(0)
    const [prevMediaId, setPrevMediaId] = useState<number | undefined>(undefined)
    if (currentMovie?.mediaId !== prevMediaId) {
        setPrevMediaId(currentMovie?.mediaId)
        setCounterSeconds(0)
    }

    useEffect(() => {
        const intervalId = setInterval(() => {
            setCounterSeconds(prev => prev + 1)
        }, 1000)
        return () => clearInterval(intervalId)
    }, [currentMovie?.mediaId])
 
    const formattedCounter = useMemo(() => {
        const hrs = String(Math.floor(counterSeconds / 3600)).padStart(2, "0")
        const mins = String(Math.floor((counterSeconds % 3600) / 60)).padStart(2, "0")
        const secs = String(counterSeconds % 60).padStart(2, "0")
        return `${hrs}:${mins}:${secs}`
    }, [counterSeconds])
 
    // Responsive grid columns measuring
    const gridRef = useRef<HTMLDivElement>(null)
    const [columns, setColumns] = useState(5)
    const [gridWidth, setGridWidth] = useState(1200)
    const [scrollMargin, setScrollMargin] = useState(500)
 
    useEffect(() => {
        if (!gridRef.current) return
        setScrollMargin(gridRef.current.offsetTop)
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const width = entry.contentRect.width
                setGridWidth(width)
                // minmax(230px, 1fr) with gap 24px
                const colCount = Math.floor((width + 24) / (230 + 24))
                setColumns(Math.max(1, colCount))
            }
            if (gridRef.current) {
                setScrollMargin(gridRef.current.offsetTop)
            }
        })
        observer.observe(gridRef.current)
        return () => observer.disconnect()
    }, [])
 
    const rows = useMemo(() => {
        const r = []
        for (let i = 0; i < filteredSorted.length; i += columns) {
            r.push(filteredSorted.slice(i, i + columns))
        }
        return r
    }, [filteredSorted, columns])
 
    const rowHeight = useMemo(() => {
        const cardWidth = Math.max(230, (gridWidth - (columns - 1) * 24) / columns)
        const posterHeight = cardWidth * 1.5
        // Card title block is 36px (title) + 14px (info) + 14px (gap) = 64px
        // Row pb-10 is 40px
        return Math.ceil(posterHeight + 64 + 40)
    }, [gridWidth, columns])

    const virtualizer = useWindowVirtualizer({
        count: rows.length,
        estimateSize: () => rowHeight,
        overscan: 2,
        scrollMargin: scrollMargin,
    })

    return (
        <div className="min-h-screen bg-[#07070a]/40 backdrop-blur-[64px] text-white overflow-x-hidden selection:bg-orange-500/20 relative">

            {/* Capa estática CRT global */}
            <div 
                className="absolute inset-0 pointer-events-none z-30 opacity-[0.04]"
                style={{
                    background: `linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.3) 50%), 
                                 linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))`,
                    backgroundSize: '100% 4px, 6px 100%'
                }}
            />

            {/* ── Hero ── */}
            <div 
                ref={heroRef} 
                className="relative h-[40vh] md:h-[50vh] min-h-[300px] md:min-h-[380px] overflow-hidden border-b border-zinc-900"
                onMouseEnter={() => setIsHeroHovered(true)}
                onMouseLeave={() => setIsHeroHovered(false)}
            >
                 {/* Desktop: Dynamic Ambient Cover Glow behind the card */}
                <div className="hidden md:block absolute right-14 top-[12.5%] h-[75%] md:aspect-[16/9] z-0 pointer-events-none select-none">
                    <AnimatePresence mode="wait">
                        {backdropSrc && (
                            <motion.img
                                key={backdropSrc}
                                src={backdropSrc}
                                alt=""
                                initial={{ opacity: 0, scale: 1.1 }}
                                animate={{ opacity: 0.35, scale: 1.25 }}
                                exit={{ opacity: 0, scale: 1.1 }}
                                transition={{ duration: 0.8 }}
                                className="w-full h-full object-cover filter blur-[60px] md:blur-[80px] rounded-2xl"
                            />
                        )}
                    </AnimatePresence>
                </div>

                 {/* Backdrop Banner / Floating Poster */}
                <motion.div 
                    className="absolute inset-0 md:inset-auto md:right-14 md:top-[12.5%] md:h-[75%] md:aspect-[16/9] z-0 md:z-10 flex flex-col items-center justify-center pointer-events-none" 
                    style={{ scale: heroScale, opacity: heroOpacity }}
                >
                    <div className="relative w-full h-full rounded-none md:rounded-2xl overflow-hidden md:border md:border-white/10 md:shadow-[0_25px_60px_rgba(0,0,0,0.85)]">
                        <AnimatePresence mode="wait">
                            {backdropSrc ? (
                                <motion.img
                                    key={backdropSrc}
                                    src={backdropSrc}
                                    alt={displayMedia?.titleSpanish || displayMedia?.titleEnglish || ""}
                                    initial={{ opacity: 0, scale: 0.96 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.96 }}
                                    transition={{ duration: 0.5 }}
                                    className="w-full h-full object-cover opacity-30 md:opacity-100"
                                />
                            ) : (
                                <div className="w-full h-full bg-[#0a0a0c]" />
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Desktop Slider Dots (Centered directly under the card) */}
                    {topFeatured.length > 1 && (
                        <div className="hidden md:flex items-center gap-1.5 mt-4 pointer-events-auto">
                            {topFeatured.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setFeaturedIndex(i)}
                                    className={cn(
                                        "h-1.5 rounded-full transition-all duration-300",
                                        i === featuredIndex ? "w-8" : "w-2 bg-white/20 hover:bg-white/40"
                                    )}
                                    style={i === featuredIndex ? { backgroundColor: currentEraConfig.color } : {}}
                                />
                            ))}
                        </div>
                    )}
                </motion.div>

                {/* Mobile: Bottom fade overlay for text readability over full background image */}
                <div 
                    className="block md:hidden absolute inset-0 z-10 pointer-events-none"
                    style={{
                        background: 'linear-gradient(to top, #07070a 0%, rgba(7,7,10,0.85) 50%, transparent 100%)'
                    }}
                />
                <div
                    className="absolute top-0 left-0 right-0 h-[1px] transition-colors duration-700 z-20"
                    style={{ background: `linear-gradient(90deg, transparent, ${currentEraConfig.color}60, transparent)` }}
                />

                {/* Hero content */}
                <div className="relative h-full flex flex-col justify-center px-6 md:px-14 max-w-[1700px] mx-auto w-full z-20">
                    <div className="max-w-xs md:max-w-xl h-[230px] md:h-[270px] flex flex-col justify-between items-start">
                        
                        <div className="flex flex-col items-start w-full">
                            {/* Título Cinematográfico */}
                            <AnimatePresence mode="wait">
                                <motion.h1 
                                    key={displayMedia?.id ?? "default"}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -12 }}
                                    transition={{ duration: 0.3 }}
                                    className="font-bebas text-3xl md:text-5xl tracking-wider leading-tight text-white mb-2 uppercase drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]"
                                >
                                    {displayMedia
                                        ? cleanMovieTitle(displayMedia.titleSpanish ?? displayMedia.titleEnglish ?? displayMedia.titleRomaji)
                                        : "Películas"}
                                </motion.h1>
                            </AnimatePresence>

                            {/* Metadatos de la Cinta seleccionada */}
                            {displayMedia && (
                                <AnimatePresence mode="wait">
                                    <motion.div 
                                        key={displayMedia.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.25 }}
                                        className="flex flex-wrap items-center gap-3 mb-3 text-[11px] font-mono"
                                    >
                                        {displayMedia.year ? (displayMedia.year > 0 && (
                                            <span className="bg-white/5 border border-white/10 rounded px-2.5 py-0.5 text-white/95">
                                                {displayMedia.year}
                                            </span>
                                        )) : null}
                                        {displayMedia.runtime ? (displayMedia.runtime > 0 && (
                                            <span className="flex items-center gap-1 text-white/50">
                                                <Clock className="w-3.5 h-3.5" />
                                                {displayMedia.runtime} MIN
                                            </span>
                                        )) : null}
                                        {displayMedia.score ? (displayMedia.score > 0 && (
                                            <span className="flex items-center gap-1 text-amber-400">
                                                <Star className="w-3.5 h-3.5 fill-current" />
                                                {(displayMedia.score / 10).toFixed(1)} OUT OF 10
                                            </span>
                                        )) : null}
                                    </motion.div>
                                </AnimatePresence>
                            )}

                            {/* Sinopsis */}
                            {displayMedia?.description && (
                                <AnimatePresence mode="wait">
                                    <motion.p 
                                        key={displayMedia.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.25 }}
                                        className="text-xs md:text-sm leading-relaxed text-zinc-400 mb-4 line-clamp-2 max-w-xs md:max-w-lg font-sans text-justify"
                                        dangerouslySetInnerHTML={{ __html: displayMedia.description }}
                                    />
                                </AnimatePresence>
                            )}
                        </div>

                        <div className="flex flex-col items-start w-full">
                            {/* Action Buttons (Netflix Style) */}
                            {currentMovie && (
                                <div className="flex items-center gap-3 mt-2">
                                    <button
                                        onClick={() => handleMovieClick(currentMovie.mediaId!)}
                                        className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-mono font-bold text-xs uppercase tracking-widest transition-all shadow-[0_4px_12px_rgba(234,88,12,0.3)] hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        ▶ VER AHORA
                                    </button>
                                </div>
                            )}

                            {/* Puntos de Navegación del Slider (Sólo Móvil) */}
                            {topFeatured.length > 1 && (
                                <div className="flex md:hidden items-center gap-1.5 mt-4">
                                    {topFeatured.map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setFeaturedIndex(i)}
                                            className={cn(
                                                "h-1.5 rounded-full transition-all duration-300",
                                                i === featuredIndex ? "w-8" : "w-2 bg-white/20 hover:bg-white/40"
                                            )}
                                            style={i === featuredIndex ? { backgroundColor: currentEraConfig.color } : {}}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>

            {/* ── Sticky nav bar ── */}
            <div className="sticky top-0 z-40 bg-[#07070a]/92 backdrop-blur-3xl border-b border-white/[0.04] transition-all duration-300">
                <div className="max-w-[1700px] mx-auto px-6 md:px-14 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4">

                    {/* Era tabs */}
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0 py-1">
                        {ERA_TABS.map(tab => {
                            const count = tab.value === "all" ? allMovies.length : allMovies.filter(m => m.era === tab.value).length
                            const isActive = activeEra === tab.value
                            return (
                                <motion.button
                                    key={tab.value}
                                    onClick={() => setActiveEra(tab.value)}
                                    whileTap={{ scale: 0.95 }}
                                    className={cn(
                                        "relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[10px] font-mono font-black tracking-widest uppercase shrink-0 border transition-colors duration-300",
                                        isActive
                                            ? "border-transparent"
                                            : "text-white/30 border-transparent hover:text-white/60 bg-transparent"
                                    )}
                                    style={isActive ? { color: tab.color } : {}}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="activeEraPill"
                                            className="absolute inset-0 rounded-full border z-0"
                                            style={{
                                                borderColor: tab.color + "40",
                                                backgroundColor: tab.color + "12",
                                            } as any}
                                            transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                        />
                                    )}
                                    <span className="relative z-10">{tab.label}</span>
                                    <span className="relative z-10 text-[8px] opacity-40 font-bold px-1 rounded bg-white/5">
                                        {count}
                                    </span>
                                </motion.button>
                            )
                        })}
                    </div>

                    {/* Panel de búsqueda y ordenación */}
                    <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
                        
                        {/* Buscador de texto */}
                        <div className="relative flex-1 md:w-64">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar Peliculas..."
                                className="w-full bg-[#111115] border border-zinc-800 rounded-lg pl-9 pr-8 py-1.5 text-[11px] font-mono tracking-widest uppercase text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all"
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-[10px] font-mono"
                                >
                                    CLEAR
                                </button>
                            )}
                        </div>

                        {/* Sort dropdown */}
                        <div className="relative shrink-0">
                            <button
                                onClick={() => setSortOpen(o => !o)}
                                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#111115] border border-zinc-800 text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:border-zinc-700 transition-all duration-200"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h13M3 8h9M3 12h5m0 0v8m0 0l3-3m-3 3l-3-3" />
                                </svg>
                                <span>{SORT_OPTIONS.find(s => s.value === sortBy)?.label}</span>
                                <motion.span animate={{ rotate: sortOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                    <ChevronDown className="w-3.5 h-3.5 ml-1" />
                                </motion.span>
                            </button>

                            <AnimatePresence>
                                {sortOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute right-0 top-full mt-2 w-52 bg-[#0d0d12] border border-zinc-800 rounded-lg shadow-2xl z-50 overflow-hidden p-1 font-mono"
                                        onMouseLeave={() => setSortOpen(false)}
                                    >
                                        {SORT_OPTIONS.map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => { setSortBy(opt.value); setSortOpen(false) }}
                                                className={cn(
                                                    "w-full flex items-center justify-between px-3.5 py-2.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-150",
                                                    sortBy === opt.value
                                                        ? "text-orange-400 bg-orange-500/10"
                                                        : "text-zinc-400 hover:text-white hover:bg-zinc-800/40"
                                                )}
                                            >
                                                <span>{opt.label}</span>
                                                {sortBy === opt.value && <span className="text-orange-500">•</span>}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                </div>
            </div>

            {/* ── Movie grid ── */}
            <div className="max-w-[1700px] mx-auto px-6 md:px-14 py-12 pb-32">
                {isLoading && allMovies.length === 0 ? (
                    <MovieGridSkeleton />
                ) : filteredSorted.length === 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-32">
                        <EmptyState
                            title="Sin películas"
                            message="No hay películas que coincidan con este filtro."
                        />
                    </motion.div>
                ) : (
                    <div
                        ref={gridRef}
                        className="relative w-full"
                        style={{ height: `${virtualizer.getTotalSize()}px` }}
                    >
                        {virtualizer.getVirtualItems().map((virtualRow) => {
                            const rowItems = rows[virtualRow.index]
                            if (!rowItems) return null
                            return (
                                <div
                                    key={virtualRow.index}
                                    className="absolute left-0 top-0 w-full grid gap-x-6 pb-10"
                                    style={{
                                        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                                        height: `${virtualRow.size}px`,
                                        transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
                                    }}
                                >
                                    {rowItems.map((entry) => (
                                        <motion.div
                                            key={entry.mediaId}
                                            initial={{ opacity: 0, y: 24, scale: 0.96 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.94, y: 12 }}
                                            transition={{ type: "spring", stiffness: 100, damping: 15 }}
                                        >
                                            <MovieCard
                                                entry={entry}
                                                era={entry.era}
                                                watchHistoryItem={watchHistory?.[entry.mediaId]}
                                                onClick={handleMovieClick}
                                                onHoverCard={handleHoverCard}
                                            />
                                        </motion.div>
                                    ))}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

function MovieGridSkeleton() {
    return (
        <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
            {Array.from({ length: 18 }).map((_, i) => (
                <div key={i} className="space-y-3">
                    <div className="aspect-[2/3] rounded-2xl bg-white/[0.03] animate-pulse" />
                    <div className="space-y-1.5">
                        <div className="h-2.5 w-3/4 bg-white/[0.03] rounded animate-pulse" />
                        <div className="h-2 w-1/2 bg-white/[0.02] rounded animate-pulse" />
                    </div>
                </div>
            ))}
        </div>
    )
}
