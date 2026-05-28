import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo, memo, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion"
import { Play, Clock, Star, ChevronDown, Check, Layers, ListPlus } from "lucide-react"
import { useAppStore } from "@/lib/store"
import { EmptyState } from "@/components/shared/empty-state"
import { useGetLibraryCollection, fetchLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { useGetContinuityWatchHistory } from "@/api/hooks/continuity.hooks"
import { fetchAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import type { Anime_LibraryCollectionEntry, Continuity_WatchHistoryItem } from "@/api/generated/types"
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "@/components/shared/deferred-image"
import { getHighResImage, getMediumResImage, getLowResImage } from "@/lib/helpers/images"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { API_ENDPOINTS } from "@/api/generated/endpoints"

export const Route = createFileRoute("/movies/")({
    loader: async ({ context }) => {
        const qc = context.queryClient
        await qc.prefetchQuery({
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

    if (tmdbId >= 1000000) return "Especiales y OVAs"

    const allTitles = [media.titleRomaji, media.titleEnglish, media.titleOriginal, media.titleSpanish]
        .filter(Boolean).join(" ").toLowerCase()

    if (!allTitles.includes("dragon ball")) return "Especiales y OVAs"
    if (allTitles.includes("special") || allTitles.includes("especial") || allTitles.includes("ova") || media.format === "SPECIAL" || media.format === "OVA") return "Especiales y OVAs"
    if (allTitles.includes("super")) return "Dragon Ball Super"
    if (allTitles.includes(" gt") || allTitles.includes("gt ")) return "Dragon Ball GT"
    const isZ = zKeywords.some(k => allTitles.includes(k))
    if (isZ) return "Dragon Ball Z"
    return "Dragon Ball"
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function MoviesPage() {
    const [activeEra, setActiveEra] = useState<EraTab>("all")
    const [sortBy, setSortBy] = useState<SortOption>("year_asc")
    const [sortOpen, setSortOpen] = useState(false)
    const [hoveredBackdrop, setHoveredBackdrop] = useState<string | null>(null)
    const [debouncedBackdrop, setDebouncedBackdrop] = useState<string | null>(null)
    const heroRef = useRef<HTMLDivElement>(null)
    const navigate = useNavigate()
    const { data: collection, isLoading } = useGetLibraryCollection()
    const { data: watchHistory } = useGetContinuityWatchHistory()

    const { scrollY } = useScroll()
    const heroOpacity = useTransform(scrollY, [0, 280], [1, 0])
    const heroScale = useTransform(scrollY, [0, 280], [1, 1.06])

    // Debounce del backdrop para evitar renders e hipo de red en movimientos rápidos del cursor
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedBackdrop(hoveredBackdrop)
        }, 200)
        return () => clearTimeout(timer)
    }, [hoveredBackdrop])

    const allMovies = useMemo(() => {
        if (!collection?.lists) return []
        const allEntries = collection.lists.flatMap(l => l.entries || [])
        const rawMovies = allEntries.filter(e => {
            const fmt = e.media?.format
            const type = e.media?.type
            return fmt === "MOVIE" || fmt === "OVA" || fmt === "SPECIAL" || type?.toUpperCase() === "MOVIE" || (e.mediaId && e.mediaId >= 1000000)
        })
        const unique = new Map<number, Anime_LibraryCollectionEntry>()
        rawMovies.forEach(m => { if (m.mediaId) unique.set(m.mediaId, m) })
        return Array.from(unique.values()).map(entry => {
            const startedAt = entry.listData?.startedAt
            const startedAtTimestamp = startedAt ? new Date(startedAt).getTime() : 0
            return {
                ...entry,
                era: getEntryEra(entry),
                startedAtTimestamp
            }
        })
    }, [collection])

    const filteredSorted = useMemo(() => {
        const result = activeEra === "all" ? allMovies : allMovies.filter(e => e.era === activeEra)
        switch (sortBy) {
            case "year_asc": return [...result].sort((a, b) => (a.media?.year || 0) - (b.media?.year || 0))
            case "year_desc": return [...result].sort((a, b) => (b.media?.year || 0) - (a.media?.year || 0))
            case "recently_add": return [...result].sort((a, b) => b.startedAtTimestamp - a.startedAtTimestamp)
            case "alpha": return [...result].sort((a, b) => (a.media?.titleRomaji || "").localeCompare(b.media?.titleRomaji || ""))
        }
    }, [allMovies, activeEra, sortBy])

    const activeEraConfig = ERA_TABS.find(t => t.value === activeEra) || ERA_TABS[0]

    // Hero backdrop: use hovered poster, else first movie with poster
    const backdropSrc = useMemo(() => {
        if (debouncedBackdrop) return debouncedBackdrop
        const first = filteredSorted.find(m => m.media?.bannerImage || m.media?.posterImage)
        return first?.media?.bannerImage || first?.media?.posterImage || null
    }, [debouncedBackdrop, filteredSorted])

    const handleMovieClick = useCallback((mediaId: number) => {
        navigate({ to: "/movies/$movieId", params: { movieId: String(mediaId) } })
    }, [navigate])

    const localCount = allMovies.filter(m => (m.libraryData?.mainFileCount || 0) > 0).length

    return (
        <div className="min-h-screen bg-[#09090b] text-white overflow-x-hidden selection:bg-brand-orange/30">

            {/* ── Cinematic Hero ─────────────────────────────────────────── */}
            <div ref={heroRef} className="relative h-[340px] overflow-hidden">
                {/* Backdrop layer */}
                <motion.div className="absolute inset-0" style={{ scale: heroScale, opacity: heroOpacity }}>
                    <AnimatePresence mode="sync">
                        {backdropSrc && (
                            <motion.img
                                key={backdropSrc}
                                src={getLowResImage(backdropSrc)}
                                alt=""
                                aria-hidden
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.8 }}
                                className="w-full h-full object-cover object-center scale-110 blur-sm"
                            />
                        )}
                    </AnimatePresence>
                    {/* Dark vignette gradients */}
                    <div className="absolute inset-0 bg-gradient-to-b from-[#09090b]/60 via-transparent to-[#09090b]" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#09090b]/80 via-transparent to-[#09090b]/50" />
                    {/* Era color tint */}
                    <motion.div
                        className="absolute inset-0 opacity-20"
                        animate={{ backgroundColor: activeEraConfig.glow }}
                        transition={{ duration: 0.6 }}
                    />
                </motion.div>

                {/* Hero content */}
                <div className="relative h-full flex flex-col justify-end pb-8 px-6 md:px-14">
                    {/* Title block */}
                    <motion.div
                        className="flex flex-col gap-2"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                    >
                        <div className="flex items-center gap-3 mb-1">
                            <motion.div
                                className="w-6 h-6 rounded-md flex items-center justify-center"
                                style={{ backgroundColor: activeEraConfig.color + "30", border: `1px solid ${activeEraConfig.color}40` }}
                                animate={{ borderColor: activeEraConfig.color + "60", backgroundColor: activeEraConfig.color + "25" }}
                                transition={{ duration: 0.5 }}
                            >
                                <Layers className="w-3.5 h-3.5" style={{ color: activeEraConfig.color }} />
                            </motion.div>
                            <span className="text-[9px] font-black uppercase tracking-[0.5em] text-zinc-500">Películas &amp; Especiales</span>
                        </div>

                        <h1 className="font-bebas text-5xl md:text-7xl tracking-wider leading-none text-white drop-shadow-xl">
                            <motion.span
                                key={activeEra}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4 }}
                                className="block"
                            >
                                {activeEraConfig.label === "Todas" ? "Colección" : activeEraConfig.label}
                            </motion.span>
                        </h1>

                        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.3em]">
                            <span style={{ color: activeEraConfig.color }}>{filteredSorted.length} Títulos</span>
                            <span className="w-1 h-1 rounded-full bg-zinc-700" />
                            <span className="text-zinc-500">{localCount} Descargados</span>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* ── Sticky Filters Bar ─────────────────────────────────────── */}
            <div className="sticky top-0 z-40 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/[0.04] shadow-[0_1px_0_rgba(255,255,255,0.04)]">
                <div className="max-w-[1700px] mx-auto px-4 md:px-10 h-14 flex items-center justify-between gap-4">

                    {/* Era Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                        {ERA_TABS.map(tab => {
                            const count = tab.value === "all" ? allMovies.length : allMovies.filter(m => m.era === tab.value).length
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
                                    <span className="relative z-10 opacity-40 text-[8px]">{count}</span>
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
                    <motion.div
                        className="grid gap-5 md:gap-6"
                        style={{
                            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                        }}
                    >
                        <AnimatePresence mode="popLayout">
                            {filteredSorted.map((entry) => (
                                <motion.div
                                    key={entry.mediaId}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.25, ease: "easeInOut" }}
                                >
                                    <MovieCard
                                        entry={entry}
                                        era={entry.era}
                                        watchHistoryItem={watchHistory?.[entry.mediaId]}
                                        onClick={handleMovieClick}
                                        onHoverBackdrop={setHoveredBackdrop}
                                    />
                                </motion.div>
                            ))}
                        </AnimatePresence>
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
    onHoverBackdrop,
}: {
    entry: Anime_LibraryCollectionEntry
    era: EraTab
    watchHistoryItem?: Continuity_WatchHistoryItem | null
    onClick: (id: number) => void
    onHoverBackdrop: (url: string | null) => void
}) {
    const movie = entry.media
    if (!movie || !entry.mediaId) return null

    const handleCardClick = () => {
        onClick(entry.mediaId!)
    }

    const eraConfig = ERA_TABS.find(t => t.value === era) || ERA_TABS[0]
    const title = movie.titleSpanish || movie.titleEnglish || movie.titleRomaji || "Sin título"
    const hasLocalFiles = (entry.libraryData?.mainFileCount || 0) > 0
    const isCompleted = movie.watched || (entry.listData?.progress || 0) >= (movie.totalEpisodes || 1)

    const progressTime = watchHistoryItem?.currentTime || 0
    const totalDuration = watchHistoryItem?.duration || 0
    const hasProgress = progressTime > 30 && totalDuration > 0 && progressTime < totalDuration
    const progressPercent = hasProgress ? Math.min(100, (progressTime / totalDuration) * 100) : 0

    const posterUrl = getMediumResImage(movie.posterImage || "")
    const backdropUrl = movie.bannerImage || movie.posterImage || ""

    return (
        <div
            className="group relative cursor-pointer"
            onClick={handleCardClick}
            onMouseEnter={() => onHoverBackdrop(backdropUrl || null)}
            onMouseLeave={() => onHoverBackdrop(null)}
        >
            {/* ─ Poster ─ */}
            <div className={cn(
                "relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-white/[0.06] group-hover:border-white/20 group-hover:shadow-2xl",
                !hasLocalFiles && "grayscale opacity-40",
            )}
                style={{
                    boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
                    transition: "border-color 600ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 600ms cubic-bezier(0.16, 1, 0.3, 1)",
                }}
            >
                {/* Poster image */}
                <DeferredImage
                    src={posterUrl}
                    alt={title}
                    className="w-full h-full object-cover transform-gpu group-hover:scale-105"
                    style={{
                        transition: "transform 800ms cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                    showSkeleton={false}
                    fallback={
                        <div
                            className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center"
                            style={{ background: `linear-gradient(135deg, ${eraConfig.color}20, #09090b)` }}
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
                <div 
                    className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100"
                    style={{
                        transition: "opacity 500ms cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                />

                {/* Play & Add Queue buttons on hover */}
                <div 
                    className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 z-30"
                    style={{
                        transition: "opacity 500ms cubic-bezier(0.16, 1, 0.3, 1), transform 500ms cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                >
                    <div
                        onClick={(e) => { e.stopPropagation(); handleCardClick(); }}
                        className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-2xl cursor-pointer active:scale-[0.94] transform-gpu"
                        style={{ 
                            boxShadow: `0 0 30px ${eraConfig.glow}`,
                            transition: "transform 400ms cubic-bezier(0.16, 1, 0.3, 1), background-color 300ms",
                        }}
                        title="Reproducir ahora"
                    >
                        <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                    </div>
                    {hasLocalFiles && (
                        <div
                            onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                    const fullEntry = await fetchAnimeEntry(String(entry.mediaId));
                                    const localFile = fullEntry?.localFiles?.[0];
                                    if (localFile && localFile.path) {
                                        const epNum = localFile.parsedInfo?.episode || localFile.metadata?.episode || 1;
                                        useAppStore.getState().addToQueue({
                                            id: entry.mediaId!,
                                            title: title,
                                            playableUrl: localFile.path,
                                            thumbnail: getHighResImage(movie.posterImage || ""),
                                            mediaId: entry.mediaId!,
                                            episodeNumber: Number(epNum),
                                            malId: movie.idMal ?? null,
                                            mediaFormat: movie.format ?? "MOVIE"
                                        });
                                        const { toast } = await import("sonner");
                                        toast.success("Añadido a la cola de reproducción");
                                    } else {
                                        const { toast } = await import("sonner");
                                        toast.error("No hay archivos locales disponibles para esta película.");
                                    }
                                } catch (err) {
                                    console.error("Error fetching movie entry:", err);
                                    const { toast } = await import("sonner");
                                    toast.error("Error al obtener detalles del archivo.");
                                }
                            }}
                            className="w-10 h-10 rounded-full bg-black/40 hover:bg-brand-orange backdrop-blur-md border border-white/10 hover:border-brand-orange/30 flex items-center justify-center shadow-2xl text-zinc-300 hover:text-white active:scale-[0.94] transform-gpu cursor-pointer"
                            style={{
                                transition: "transform 400ms cubic-bezier(0.16, 1, 0.3, 1), background-color 300ms, border-color 300ms",
                            }}
                            title="Añadir a la cola"
                        >
                            <ListPlus className="w-4 h-4" />
                        </div>
                    )}
                </div>

                {/* Era accent line (bottom left corner) */}
                <div
                    className="absolute bottom-0 left-0 w-full h-0.5 opacity-70 scale-x-[0.12] origin-left group-hover:scale-x-100 transform-gpu"
                    style={{ 
                        backgroundColor: eraConfig.color,
                        transition: "transform 600ms cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MovieGridSkeleton() {
    return (
        <div
            className="grid gap-5"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}
        >
            {Array.from({ length: 18 }).map((_, i) => (
                <div key={i} className="space-y-3">
                    <div className="aspect-[2/3] rounded-xl bg-white/[0.04] animate-pulse" />
                    <div className="space-y-1.5">
                        <div className="h-2.5 w-3/4 bg-white/[0.04] rounded animate-pulse" />
                        <div className="h-2 w-1/2 bg-white/[0.03] rounded animate-pulse" />
                    </div>
                </div>
            ))}
        </div>
    )
}
