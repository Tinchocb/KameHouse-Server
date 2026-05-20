import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo, memo, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion"
import { Play, Clock, Star, ChevronDown, Check, Layers } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { useGetContinuityWatchHistory } from "@/api/hooks/continuity.hooks"
import type { Anime_LibraryCollectionEntry, Continuity_WatchHistoryItem } from "@/api/generated/types"
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "@/components/shared/deferred-image"
import { getHighResImage } from "@/lib/helpers/images"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"
import { CassetteCard } from "@/components/shared/cassette-card"

export const Route = createFileRoute("/movies/")({
    component: MoviesPage,
})

// ─── Constants & Data ────────────────────────────────────────────────────────

type EraTab = "all" | "Dragon Ball" | "Dragon Ball Z" | "Dragon Ball Super" | "Dragon Ball GT" | "Especiales y OVAs"
type SortOption = "year_asc" | "year_desc" | "recently_add" | "alpha"

const ERA_TABS: { value: EraTab; label: string; shortLabel: string; color: string; glow: string }[] = [
    { value: "all", label: "Todas", shortLabel: "Todas", color: "#ff6b00", glow: "rgba(255,107,0,0.3)" },
    { value: "Dragon Ball", label: "Dragon Ball", shortLabel: "Dragon Ball", color: "#e07030", glow: "rgba(224,112,48,0.3)" },
    { value: "Dragon Ball Z", label: "Dragon Ball Z", shortLabel: "Dragon Ball Z", color: "#e74c3c", glow: "rgba(231,76,60,0.3)" },
    { value: "Dragon Ball GT", label: "Dragon Ball GT", shortLabel: "Dragon Ball GT", color: "#3498db", glow: "rgba(52,152,219,0.3)" },
    { value: "Dragon Ball Super", label: "Dragon Ball Super", shortLabel: "Dragon Ball Super", color: "#9b59b6", glow: "rgba(155,89,182,0.3)" },
    { value: "Especiales y OVAs", label: "Especiales y OVAs", shortLabel: "Especiales y OVAs", color: "#1abc9c", glow: "rgba(26,188,156,0.3)" },
]

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: "year_asc", label: "Año: Más antiguo" },
    { value: "year_desc", label: "Año: Más reciente" },
    { value: "recently_add", label: "Añadido recientemente" },
    { value: "alpha", label: "Alfabético" },
]

function getEntryEra(entry: Anime_LibraryCollectionEntry): EraTab {
    const media = entry.media
    if (!media) return "Especiales y OVAs"
    const tmdbId = media.tmdbId || 0

    const specialsTmdbIds = new Set([39323, 39324, 38594, 47734, 15461, 1259215, 109963])
    if (specialsTmdbIds.has(tmdbId)) return "Especiales y OVAs"

    const classicTmdbIds = new Set([39144, 33499, 39145, 116776, 33513, 39148])
    if (classicTmdbIds.has(tmdbId)) return "Dragon Ball"

    const zTmdbIds = new Set([28609, 15448, 39100, 39101, 39102, 24752, 15452, 39103, 39104, 15454, 34433, 39105, 44251, 39106, 39107, 39108, 126963])
    if (zTmdbIds.has(tmdbId)) return "Dragon Ball Z"

    const gtTmdbIds = new Set([18095, 39149])
    if (gtTmdbIds.has(tmdbId)) return "Dragon Ball GT"

    const superTmdbIds = new Set([503314, 610150, 177572, 303857])
    if (superTmdbIds.has(tmdbId)) return "Dragon Ball Super"

    if (tmdbId >= 1000000) return "Especiales y OVAs"

    const allTitles = [media.titleRomaji, media.titleEnglish, media.titleOriginal, media.titleSpanish]
        .filter(Boolean).join(" ").toLowerCase()

    if (!allTitles.includes("dragon ball")) return "Especiales y OVAs"
    if (allTitles.includes("special") || allTitles.includes("especial") || allTitles.includes("ova") || media.format === "SPECIAL" || media.format === "OVA") return "Especiales y OVAs"
    if (allTitles.includes("super")) return "Dragon Ball Super"
    if (allTitles.includes(" gt") || allTitles.includes("gt ")) return "Dragon Ball GT"
    const isZ = ["z ", " z:", "kai", "改", "freezer", "frieza", "cooler", "androide", "android", "bojack", "janemba", "tapion", "bardock", "trunks", "broly", "slug", "turles", "dead zone", "fusion", "bio-broly", "gohan", "vegeta"].some(k => allTitles.includes(k))
    if (isZ) return "Dragon Ball Z"
    return "Dragon Ball"
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function MoviesPage() {
    const [activeEra, setActiveEra] = useState<EraTab>("all")
    const [sortBy, setSortBy] = useState<SortOption>("year_asc")
    const [sortOpen, setSortOpen] = useState(false)
    const [hoveredMovie, setHoveredMovie] = useState<Anime_LibraryCollectionEntry | null>(null)
    const heroRef = useRef<HTMLDivElement>(null)
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const navigate = useNavigate()
    const { data: collection, isLoading } = useGetLibraryCollection()
    const { data: watchHistory } = useGetContinuityWatchHistory()

    const { scrollY } = useScroll()
    const heroOpacity = useTransform(scrollY, [0, 360], [1, 0])
    const heroScale = useTransform(scrollY, [0, 360], [1, 1.06])

    const { setBackdropUrl } = useIntelligenceStore()

    const allMovies = useMemo(() => {
        if (!collection?.lists) return []
        const allEntries = collection.lists.flatMap(l => l.entries || [])
        const rawMovies = allEntries.filter(e => {
            const fmt = e.media?.format
            const type = e.media?.type
            return fmt === "MOVIE" || fmt === "OVA" || fmt === "SPECIAL" || type?.toUpperCase() === "MOVIE" || (e.mediaId && e.mediaId >= 1000000)
        })
        const unique = new Map<number, Anime_LibraryCollectionEntry & { _era?: EraTab, _addedAt?: number }>()
        rawMovies.forEach(m => { 
            if (m.mediaId && !unique.has(m.mediaId)) {
                unique.set(m.mediaId, {
                    ...m,
                    _era: getEntryEra(m),
                    _addedAt: m.listData?.startedAt ? new Date(m.listData.startedAt).getTime() : 0
                })
            } 
        })
        return Array.from(unique.values())
    }, [collection])

    const filteredSorted = useMemo(() => {
        const result = activeEra === "all" ? allMovies : allMovies.filter(e => e._era === activeEra)
        switch (sortBy) {
            case "year_asc": return [...result].sort((a, b) => (a.media?.year || 0) - (b.media?.year || 0))
            case "year_desc": return [...result].sort((a, b) => (b.media?.year || 0) - (a.media?.year || 0))
            case "recently_add": return [...result].sort((a, b) => (b._addedAt || 0) - (a._addedAt || 0))
            case "alpha": return [...result].sort((a, b) => (a.media?.titleRomaji || "").localeCompare(b.media?.titleRomaji || ""))
            default: return result
        }
    }, [allMovies, activeEra, sortBy])

    const filteredSortedIds = useMemo(() => new Set(filteredSorted.map(m => m.mediaId)), [filteredSorted])

    const activeMovie = useMemo(() => {
        if (hoveredMovie && filteredSortedIds.has(hoveredMovie.mediaId)) {
            return hoveredMovie
        }
        return filteredSorted[0] || null
    }, [hoveredMovie, filteredSorted, filteredSortedIds])

    // Sync active movie backdrop to the global intelligence store
    useEffect(() => {
        if (activeMovie?.media?.bannerImage || activeMovie?.media?.posterImage) {
            setBackdropUrl(activeMovie.media.bannerImage || activeMovie.media.posterImage)
        } else {
            setBackdropUrl(null)
        }
        return () => {
            setBackdropUrl(null)
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
        }
    }, [activeMovie, setBackdropUrl])

    const activeMovieEra = activeMovie ? ((activeMovie as any)._era || getEntryEra(activeMovie)) : "all"
    const activeMovieEraConfig = ERA_TABS.find(t => t.value === activeMovieEra) || ERA_TABS[0]

    const backdropSrc = useMemo(() => {
        return activeMovie?.media?.bannerImage || activeMovie?.media?.posterImage || null
    }, [activeMovie])

    const handleMovieClick = useCallback((mediaId: number) => {
        navigate({ to: "/movies/$movieId", params: { movieId: String(mediaId) } })
    }, [navigate])

    const handleMovieHover = useCallback((entry: Anime_LibraryCollectionEntry | null) => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = setTimeout(() => {
            setHoveredMovie(entry)
        }, 150)
    }, [])

    const localCount = allMovies.filter(m => (m.libraryData?.mainFileCount || 0) > 0).length

    return (
        <div className="min-h-screen bg-transparent text-white overflow-x-hidden selection:bg-brand-orange/30">

            {/* ── Cinematic Hero ─────────────────────────────────────────── */}
            <div ref={heroRef} className="relative min-h-[460px] lg:h-[480px] overflow-hidden flex flex-col justify-end">
                {/* Backdrop layer */}
                <motion.div className="absolute inset-0" style={{ scale: heroScale, opacity: heroOpacity }}>
                    <AnimatePresence mode="sync">
                        {backdropSrc && (
                            <motion.img
                                key={backdropSrc}
                                src={getHighResImage(backdropSrc)}
                                alt=""
                                aria-hidden
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.8 }}
                                className="w-full h-full object-cover object-center scale-110 blur-3xl saturate-150 opacity-20"
                                style={{ willChange: "opacity" }}
                            />
                        )}
                    </AnimatePresence>
                    {/* Dark vignette gradients */}
                    <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-background" />
                    <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-background/50" />
                    {/* Era color tint */}
                    <motion.div
                        className="absolute inset-0 opacity-20"
                        animate={{ backgroundColor: activeMovieEraConfig.glow }}
                        transition={{ duration: 0.6 }}
                    />
                </motion.div>

                {/* Hero content */}
                <div className="relative w-full h-full max-w-[1700px] mx-auto px-6 md:px-14 pt-24 pb-8 flex flex-col lg:flex-row items-center lg:items-end gap-8 z-10">
                    {/* Left Column: Widescreen Card of Active Movie */}
                    {activeMovie && (
                        <motion.div
                            initial={{ opacity: 0, x: -30, scale: 0.95 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            key={`hero-card-${activeMovie.mediaId}`}
                            transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                            onClick={() => handleMovieClick(activeMovie.mediaId)}
                            className="relative w-full max-w-[440px] aspect-video lg:h-[240px] lg:w-[426px] rounded-2xl overflow-hidden border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] cursor-pointer group/hero shrink-0 self-center lg:self-end"
                        >
                            {/* Card Image */}
                            <DeferredImage
                                src={getHighResImage(activeMovie.media?.bannerImage || activeMovie.media?.posterImage || "")}
                                alt={activeMovie.media?.titleSpanish || activeMovie.media?.titleEnglish || ""}
                                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover/hero:scale-105"
                                showSkeleton={true}
                            />
                            {/* Glass gradient overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/hero:opacity-100 transition-opacity duration-300" />
                            {/* Play indicator */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/hero:opacity-100 transition-all duration-300">
                                <div
                                    className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-2xl scale-90 group-hover/hero:scale-100 transition-all duration-300"
                                    style={{ boxShadow: `0 0 30px ${activeMovieEraConfig.glow}` }}
                                >
                                    <Play className="w-6 h-6 text-white fill-white ml-1" />
                                </div>
                            </div>

                            {/* Accent bottom border using era color */}
                            <div
                                className="absolute bottom-0 inset-x-0 h-1 transition-all duration-500"
                                style={{ backgroundColor: activeMovieEraConfig.color }}
                            />
                        </motion.div>
                    )}

                    {/* Right Column: Complete movie details */}
                    <div className="flex-1 flex flex-col justify-end text-center lg:text-left self-center lg:self-end w-full">
                        {activeMovie ? (
                            <motion.div
                                key={`hero-info-${activeMovie.mediaId}`}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.1, ease: [0.23, 1, 0.32, 1] }}
                                className="flex flex-col items-center lg:items-start"
                            >
                                {/* Era Badge */}
                                <div
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-[0.25em] mb-3 backdrop-blur-md shadow-md"
                                    style={{
                                        borderColor: `${activeMovieEraConfig.color}40`,
                                        backgroundColor: `${activeMovieEraConfig.color}15`,
                                        color: activeMovieEraConfig.color,
                                        boxShadow: `0 2px 10px ${activeMovieEraConfig.glow}`
                                    }}
                                >
                                    <Layers className="w-3 h-3" />
                                    <span>{activeMovieEra === "all" ? "Películas & Especiales" : activeMovieEra}</span>
                                </div>

                                {/* Title */}
                                <h1 className="font-bebas text-4xl md:text-5xl lg:text-6xl tracking-wider leading-none text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] mb-3 text-center lg:text-left">
                                    {activeMovie.media?.titleSpanish || activeMovie.media?.titleEnglish || activeMovie.media?.titleRomaji || "Sin título"}
                                </h1>

                                {/* Metadata Row */}
                                <div className="flex items-center justify-center lg:justify-start gap-4 text-xs font-bold text-zinc-300 mb-4 select-none">
                                    {activeMovie.media?.year && (
                                        <span className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/5">{activeMovie.media.year}</span>
                                    )}
                                    {activeMovie.media?.runtime && (
                                        <span className="flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5 text-zinc-400" />
                                            {activeMovie.media.runtime}m
                                        </span>
                                    )}
                                    {activeMovie.media?.score && activeMovie.media.score > 0 && (
                                        <span className="flex items-center gap-1 text-amber-400 font-black">
                                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                            {(activeMovie.media.score / 10).toFixed(1)} Ki
                                        </span>
                                    )}
                                    {/* Action count or badges */}
                                    {(activeMovie.libraryData?.mainFileCount || 0) > 0 ? (
                                        <span className="text-[9px] font-black uppercase text-emerald-400 tracking-widest px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">Disponible</span>
                                    ) : (
                                        <span className="text-[9px] font-black uppercase text-zinc-500 tracking-widest px-2 py-0.5 rounded-md bg-zinc-900 border border-white/5">No descargada</span>
                                    )}
                                </div>

                                {/* Synopsis / Description */}
                                {activeMovie.media?.description && (
                                    <p className="text-zinc-400 text-xs md:text-sm max-w-2xl leading-relaxed line-clamp-3 text-center lg:text-left drop-shadow mb-6">
                                        {activeMovie.media.description.replace(/<[^>]*>/g, "")}
                                    </p>
                                )}

                                {/* Action Buttons */}
                                <div className="flex items-center gap-3">
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleMovieClick(activeMovie.mediaId)}
                                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black font-black uppercase tracking-widest text-[10px] shadow-[0_8px_30px_rgba(255,255,255,0.15)] hover:bg-brand-orange hover:text-white transition-all duration-300"
                                        style={{
                                            boxShadow: `0 8px 30px ${activeMovieEraConfig.glow}`
                                        }}
                                    >
                                        <Play className="w-4 h-4 fill-current" />
                                        Ver Película
                                    </motion.button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col gap-2 py-8 items-center lg:items-start"
                            >
                                <div className="flex items-center gap-3 mb-1">
                                    <div
                                        className="w-6 h-6 rounded-md flex items-center justify-center bg-brand-orange/20 border border-brand-orange/30"
                                    >
                                        <Layers className="w-3.5 h-3.5 text-brand-orange" />
                                    </div>
                                    <span className="text-[9px] font-black uppercase tracking-[0.5em] text-zinc-500">Películas &amp; Especiales</span>
                                </div>

                                <h1 className="font-bebas text-5xl md:text-7xl tracking-wider leading-none text-white drop-shadow-xl">
                                    Colección
                                </h1>

                                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.3em]">
                                    <span className="text-brand-orange">{filteredSorted.length} Títulos</span>
                                    <span className="w-1 h-1 rounded-full bg-zinc-700" />
                                    <span className="text-zinc-500">{localCount} Descargados</span>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Sticky Filters Bar ─────────────────────────────────────── */}
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-white/[0.04] shadow-[0_1px_0_rgba(255,255,255,0.04)]">
                <div className="max-w-[1700px] mx-auto px-4 md:px-10 h-14 flex items-center justify-between gap-4">

                    {/* Era Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                        {ERA_TABS.map(tab => {
                            const isActive = activeEra === tab.value
                            return (
                                <motion.button
                                    key={tab.value}
                                    onClick={() => setActiveEra(tab.value)}
                                    whileTap={{ scale: 0.95 }}
                                    className={cn(
                                        "relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shrink-0 transition-all duration-300 select-none",
                                        isActive
                                            ? "text-white shadow-lg"
                                            : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                                    )}
                                    style={isActive ? {
                                        backgroundColor: tab.color + "20",
                                        border: `1px solid ${tab.color}40`,
                                        boxShadow: `0 0 20px ${tab.glow}, 0 4px 12px rgba(0,0,0,0.5)`,
                                        color: tab.color
                                    } : { border: "1px solid transparent" }}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="era-active-pill"
                                            className="absolute inset-0 rounded-full"
                                            style={{ backgroundColor: tab.color + "15" }}
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                                        />
                                    )}
                                    <span className="relative z-10">{tab.shortLabel}</span>
                                </motion.button>
                            )
                        })}
                    </div>

                    {/* Sort dropdown */}
                    <div className="relative shrink-0">
                        <button
                            onClick={() => setSortOpen(o => !o)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all duration-200"
                        >
                            <span>{SORT_OPTIONS.find(s => s.value === sortBy)?.label}</span>
                            <motion.span animate={{ rotate: sortOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                <ChevronDown className="w-3.5 h-3.5" />
                            </motion.span>
                        </button>

                        <AnimatePresence>
                            {sortOpen && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.92, y: -4 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.92, y: -4 }}
                                    transition={{ duration: 0.18 }}
                                    className="absolute right-0 top-full mt-2 w-52 bg-zinc-950/98 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl z-50 overflow-hidden p-1"
                                    onMouseLeave={() => setSortOpen(false)}
                                >
                                    {SORT_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => { setSortBy(opt.value); setSortOpen(false) }}
                                            className={cn(
                                                "w-full flex items-center justify-between px-4 py-3 rounded-xl text-[11px] font-bold transition-all duration-150",
                                                sortBy === opt.value
                                                    ? "text-brand-orange bg-brand-orange/10"
                                                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                                            )}
                                        >
                                            {opt.label}
                                            {sortBy === opt.value && <Check className="w-3.5 h-3.5" />}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* ── Movie Grid ─────────────────────────────────────────────── */}
            <div className="max-w-[1700px] mx-auto px-4 md:px-10 py-10 pb-32">
                {isLoading ? (
                    <MovieGridSkeleton />
                ) : filteredSorted.length === 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-32">
                        <EmptyState
                            title="Sin películas"
                            message="No hay películas que coincidan con este filtro."
                        />
                    </motion.div>
                ) : (
                    <motion.div
                        key={activeEra}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                        className="grid gap-x-5 gap-y-16 md:gap-x-6 md:gap-y-20 pt-8"
                        style={{
                            gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))",
                        }}
                    >
                        {filteredSorted.map((entry, i) => (
                            <AnimatedCassetteCard
                                key={entry.mediaId}
                                entry={entry}
                                index={i}
                                watchHistoryItem={watchHistory?.[entry.mediaId]}
                                onClick={handleMovieClick}
                                onHover={handleMovieHover}
                            />
                        ))}
                    </motion.div>
                )}
            </div>
        </div>
    )
}

// ─── Movie Card ───────────────────────────────────────────────────────────────

const MovieCard = memo(function MovieCard({
    entry,
    era,
    watchHistoryItem,
    onClick,
    onHoverMovie,
}: {
    entry: Anime_LibraryCollectionEntry
    era: EraTab
    watchHistoryItem?: Continuity_WatchHistoryItem | null
    onClick: () => void
    onHoverMovie: (entry: Anime_LibraryCollectionEntry | null) => void
}) {
    const movie = entry.media
    if (!movie) return null

    const eraConfig = ERA_TABS.find(t => t.value === era) || ERA_TABS[0]
    const title = movie.titleSpanish || movie.titleEnglish || movie.titleRomaji || "Sin título"
    const hasLocalFiles = (entry.libraryData?.mainFileCount || 0) > 0
    const isCompleted = movie.watched || (entry.listData?.progress || 0) >= (movie.totalEpisodes || 1)

    const progressTime = watchHistoryItem?.currentTime || 0
    const totalDuration = watchHistoryItem?.duration || 0
    const hasProgress = progressTime > 30 && totalDuration > 0 && progressTime < totalDuration
    const progressPercent = hasProgress ? Math.min(100, (progressTime / totalDuration) * 100) : 0

    const posterUrl = getHighResImage(movie.posterImage || "")

    return (
        <div
            className="group relative cursor-pointer"
            onClick={onClick}
            onMouseEnter={() => onHoverMovie(entry)}
            onMouseLeave={() => onHoverMovie(null)}
        >
            {/* ─ Poster ─ */}
            <div className={cn(
                "relative aspect-[2/3] w-full overflow-hidden rounded-xl",
                "border border-white/[0.06] transition-all duration-500 ease-out",
                "group-hover:border-white/20 group-hover:shadow-2xl",
                !hasLocalFiles && "grayscale opacity-40",
            )}
                style={{
                    boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
                }}
            >
                {/* Poster image */}
                <DeferredImage
                    src={posterUrl}
                    alt={title}
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    showSkeleton={false}
                    fallback={
                        <div
                            className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center"
                            style={{ background: `linear-gradient(135deg, ${eraConfig.color}20, #07090e)` }}
                        >
                            <span className="font-bebas text-lg tracking-widest text-white/80 line-clamp-3 leading-tight drop-shadow-lg">
                                {title}
                            </span>
                        </div>
                    }
                />

                {/* Top gradient — for badges */}
                <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/70 to-transparent" />

                {/* Bottom gradient — for play overlay */}
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400" />

                {/* Play button */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <motion.div
                        whileHover={{ scale: 1.12 }}
                        whileTap={{ scale: 0.94 }}
                        className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-2xl"
                        style={{ boxShadow: `0 0 30px ${eraConfig.glow}` }}
                    >
                        <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                    </motion.div>
                </div>

                {/* Era accent line (bottom left corner) */}
                <div
                    className="absolute bottom-0 left-0 w-8 h-0.5 opacity-70 group-hover:w-full transition-all duration-500 ease-out"
                    style={{ backgroundColor: eraConfig.color }}
                />

                {/* Top badges */}
                <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
                    {/* Year badge */}
                    {movie.year && (
                        <div className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[8px] font-black text-white/60 tracking-widest">
                            {movie.year}
                        </div>
                    )}

                    {/* Status badges */}
                    <div className="flex flex-col items-end gap-1 ml-auto">
                        {isCompleted && (
                            <div className="px-1.5 py-0.5 rounded-md bg-green-500/80 backdrop-blur-sm border border-green-400/30 text-[7px] font-black text-white uppercase tracking-wider">
                                ✓ Visto
                            </div>
                        )}
                        {!isCompleted && hasProgress && (
                            <div className="px-1.5 py-0.5 rounded-md bg-brand-orange/80 backdrop-blur-sm text-[7px] font-black text-white uppercase tracking-wider">
                                {Math.round(progressPercent)}%
                            </div>
                        )}
                        {!hasLocalFiles && (
                            <div className="px-1.5 py-0.5 rounded-md bg-zinc-900/80 backdrop-blur-sm border border-white/10 text-[7px] font-black text-zinc-500 uppercase tracking-wider">
                                No local
                            </div>
                        )}
                    </div>
                </div>

                {/* Progress bar */}
                {hasProgress && (
                    <div className="absolute bottom-0 inset-x-0 h-[2px] bg-black/50">
                        <div
                            className="h-full transition-all duration-500"
                            style={{ width: `${progressPercent}%`, backgroundColor: eraConfig.color }}
                        />
                    </div>
                )}
            </div>

            {/* ─ Info below poster ─ */}
            <div className="mt-3 px-0.5 space-y-0.5">
                <h3 className="text-[11px] font-bold text-white/80 leading-tight line-clamp-2 group-hover:text-white transition-colors duration-300">
                    {title}
                </h3>
                <div className="flex items-center gap-2 text-[9px] text-zinc-600 font-medium">
                    {movie.runtime && (
                        <span className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {movie.runtime}m
                        </span>
                    )}
                    {movie.score && movie.score > 0 && (
                        <>
                            <span className="w-0.5 h-0.5 rounded-full bg-zinc-700" />
                            <span className="flex items-center gap-1">
                                <Star className="w-2.5 h-2.5 fill-amber-400/60 text-amber-400/60" />
                                {(movie.score / 10).toFixed(1)}
                            </span>
                        </>
                    )}
                    {!movie.runtime && !movie.score && (
                        <span
                            className="text-[8px] font-black uppercase tracking-widest"
                            style={{ color: eraConfig.color + "80" }}
                        >
                            {movie.format || "PELÍCULA"}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
})
MovieCard.displayName = "MovieCard"

// ─── Animated Cassette Wrapper ────────────────────────────────────────────────

const AnimatedCassetteCard = memo(function AnimatedCassetteCard({
    entry,
    index,
    watchHistoryItem,
    onClick,
    onHover
}: {
    entry: Anime_LibraryCollectionEntry;
    index: number;
    watchHistoryItem?: Continuity_WatchHistoryItem | null;
    onClick: (id: number) => void;
    onHover: (entry: Anime_LibraryCollectionEntry | null) => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: Math.min(index * 0.025, 0.4), ease: [0.23, 1, 0.32, 1] }}
        >
            <CassetteCard
                entry={entry}
                watchHistoryItem={watchHistoryItem}
                onClick={() => {
                    if (entry.mediaId) onClick(entry.mediaId)
                }}
                onMouseEnter={() => onHover(entry)}
                onMouseLeave={() => onHover(null)}
            />
        </motion.div>
    )
})
AnimatedCassetteCard.displayName = "AnimatedCassetteCard"

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MovieGridSkeleton() {
    return (
        <div
            className="grid gap-x-5 gap-y-16 md:gap-x-6 md:gap-y-20 pt-8"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))" }}
        >
            {Array.from({ length: 18 }).map((_, i) => (
                <div key={i} className="space-y-3">
                    <div className="aspect-[1/1.7] rounded-2xl bg-white/[0.04] animate-pulse" />
                    <div className="space-y-1.5 px-2">
                        <div className="h-2.5 w-3/4 bg-white/[0.04] rounded animate-pulse" />
                        <div className="h-2 w-1/2 bg-white/[0.03] rounded animate-pulse" />
                    </div>
                </div>
            ))}
        </div>
    )
}
