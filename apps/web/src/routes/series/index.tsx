import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo, memo } from "react"
import { Search, Filter, Tv, Play, Star, List, Sparkles, LayoutGrid, Library } from "lucide-react"
import { FaStar } from "react-icons/fa"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { DeferredImage } from "@/components/shared/deferred-image"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import type { Anime_LibraryCollectionEntry } from "@/api/generated/types"
import { VhsShelfAccordion, type VhsTapeItem } from "@/components/shared/vhs-shelf-accordion"
import { ContinueWatchingCarousel } from "@/components/shared/continue-watching-carousel"
import { AnimePosterCard } from "@/components/shared/anime-poster-card"

export const Route = createFileRoute("/series/")({
    component: SeriesPage,
})

// ─── Constants ─────────────────────────────────────────────────────────────────

const SPINE_WIDTH = 40

// ─── SeriesPage Component ─────────────────────────────────────────────────

function SeriesPage() {
    const [search, setSearch] = useState("")
    const [activeGenre, setActiveGenre] = useState<string | null>(null)
    const [viewMode, setViewMode] = useState<"grid" | "shelf">("shelf")
    
    const navigate = useNavigate()
    const { data: collection, isLoading } = useGetLibraryCollection()

    const allSeries = useMemo(() => {
        if (!collection?.lists) return []
        const raw = collection.lists
            .flatMap(list => list.entries || [])
            .filter(entry => entry.media?.format !== "MOVIE")
        const unique = new Map<number, NonNullable<typeof raw[0]>>()
        raw.forEach(s => { if (s.mediaId) unique.set(s.mediaId, s) })
        return Array.from(unique.values())
    }, [collection])

    const ALL_GENRES = useMemo(() => {
        const genres = new Set<string>()
        allSeries.forEach(s => { s.media?.genres?.forEach(g => genres.add(g)) })
        return Array.from(genres).sort()
    }, [allSeries])

    const filtered = useMemo(() => {
        return allSeries.filter(s => {
            const media = s.media
            if (!media) return false
            const matchesGenre = activeGenre ? media.genres?.includes(activeGenre) : true
            const title = media.titleRomaji || media.titleEnglish || media.titleOriginal || ""
            const matchesSearch = search
                ? title.toLowerCase().includes(search.toLowerCase()) ||
                  (media.description || "").toLowerCase().includes(search.toLowerCase())
                : true
            return matchesGenre && matchesSearch
        })
    }, [allSeries, search, activeGenre])

    const vhsTapeItems = useMemo<VhsTapeItem[]>(() => {
        return filtered.map((s) => {
            const media = s.media
            const title = media?.titleEnglish || media?.titleRomaji || media?.titleOriginal || "Sin título"
            return {
                id: s.mediaId,
                title: title,
                subtitle: media?.genres?.[0] || "Anime",
                description: media?.description || "",
                posterUrl: media?.posterImage || "",
                bannerUrl: media?.bannerImage || "",
                episodesCount: media?.totalEpisodes || 0,
                runtime: media?.year?.toString() || "",
                score: media?.score,
                year: media?.year,
                format: media?.format || "TV",
                genres: media?.genres || [],
                tmdbId: media?.tmdbId,
            }
        })
    }, [filtered])

    return (
        <div className="flex-1 w-full min-h-screen bg-background text-white overflow-y-auto font-sans selection:bg-brand-orange/30 pb-32">
            <PageHeader
                title={
                    <div className="flex items-center gap-3">
                        <Tv className="w-6 h-6 text-brand-orange animate-pulse" />
                        <span className="font-bebas text-3xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-zinc-400">
                            SERIES DE TELEVISIÓN
                        </span>
                    </div>
                }
                className="px-6 md:px-14 border-b border-white/5 bg-background/20 backdrop-blur-md"
            />

            {/* ── Controls Toolbar (Glassmorphic) ── */}
            <div className="sticky top-0 z-30 bg-background/40 backdrop-blur-md border-b border-white/5 shadow-lg">
                <div className="max-w-[1600px] mx-auto px-6 md:px-14 py-4 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex items-center gap-4 w-full sm:w-auto shrink-0">
                        {/* Search */}
                        <div className="relative w-full sm:w-72 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-brand-orange transition-colors duration-300 text-sm" />
                            <input
                                className="w-full pl-12 pr-4 py-2.5 bg-[#0a0e1a]/60 backdrop-blur-md border border-white/5 focus:border-brand-orange/50 rounded-xl text-sm outline-none transition-all duration-300 placeholder:text-zinc-600 uppercase tracking-widest focus:shadow-[0_0_20px_rgba(255,110,58,0.15)] focus:bg-[#0a0e1a]/80"
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="BUSCAR EN ARCHIVO..."
                            />
                        </div>

                        {/* View Switcher */}
                        <div className="flex items-center bg-white/5 border border-white/5 p-1 rounded-xl backdrop-blur-md">
                            <button
                                onClick={() => setViewMode("shelf")}
                                className={cn(
                                    "p-2 rounded-lg transition-all duration-300 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider",
                                    viewMode === "shelf"
                                        ? "bg-brand-orange text-white shadow-md"
                                        : "text-zinc-400 hover:text-white"
                                )}
                                title="Estantería VHS"
                            >
                                <Library className="w-4 h-4" />
                                <span className="hidden xl:inline text-[9px] font-black tracking-widest">ESTANTERÍA</span>
                            </button>
                            <button
                                onClick={() => setViewMode("grid")}
                                className={cn(
                                    "p-2 rounded-lg transition-all duration-300 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider",
                                    viewMode === "grid"
                                        ? "bg-brand-orange text-white shadow-md"
                                        : "text-zinc-400 hover:text-white"
                                )}
                                title="Cuadrícula"
                            >
                                <LayoutGrid className="w-4 h-4" />
                                <span className="hidden xl:inline text-[9px] font-black tracking-widest">CUADRÍCULA</span>
                            </button>
                        </div>
                    </div>

                    {/* Genre Pills (Capsules) */}
                    <div className="flex flex-nowrap sm:flex-wrap items-center gap-2 overflow-x-auto no-scrollbar pb-2 sm:pb-0">
                        <div className="flex items-center gap-2 mr-2 px-3 py-1.5 bg-white/5 border border-white/5 rounded-full backdrop-blur-md">
                            <Filter className="text-[10px] text-zinc-400" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Filtrar</span>
                        </div>
                        
                        <button
                            onClick={() => setActiveGenre(null)}
                            className={cn(
                                "px-4 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all duration-300 border rounded-full backdrop-blur-md",
                                activeGenre === null
                                    ? "bg-brand-orange text-white border-brand-orange shadow-[0_0_15px_rgba(255,110,58,0.35)]"
                                    : "bg-white/5 text-zinc-400 border-white/5 hover:border-white/20 hover:text-white hover:bg-white/10"
                            )}
                        >
                            TODOS
                        </button>
                        
                        {ALL_GENRES.slice(0, 10).map(g => (
                            <button
                                key={g}
                                onClick={() => setActiveGenre(activeGenre === g ? null : g)}
                                className={cn(
                                    "px-4 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all duration-300 border rounded-full backdrop-blur-md",
                                    activeGenre === g
                                        ? "bg-brand-orange text-white border-brand-orange shadow-[0_0_15px_rgba(255,110,58,0.35)]"
                                        : "bg-white/5 text-zinc-400 border-white/5 hover:border-white/20 hover:text-white hover:bg-white/10"
                                )}
                            >
                                {g.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Continue Watching Carousel ── */}
            <ContinueWatchingCarousel />

            {/* ── Main Grid / Shelf ── */}
            <div className="max-w-[1600px] mx-auto px-6 md:px-14 py-8">
                {isLoading ? (
                    <ShelfSkeleton />
                ) : filtered.length === 0 ? (
                    <EmptyState
                        title="Sin coincidencias"
                        message="No hemos encontrado series que coincidan con tu búsqueda actual."
                        illustration={<Tv className="w-20 h-20 text-zinc-800" />}
                    />
                ) : viewMode === "shelf" ? (
                    <div className="pt-2">
                        <VhsShelfAccordion
                            items={vhsTapeItems}
                            type="series"
                            onItemClick={(item) => navigate({ to: "/series/$seriesId", params: { seriesId: item.id.toString() } })}
                        />
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 pt-4">
                        {filtered.map((entry) => {
                            const m = entry.media
                            if (!m) return null
                            const title = m.titleEnglish || m.titleRomaji || m.titleOriginal || "Sin título"
                            return (
                                <AnimePosterCard
                                    key={entry.mediaId}
                                    mediaId={entry.mediaId}
                                    title={title}
                                    posterUrl={m.posterImage || ""}
                                    subtitle={m.genres?.[0] ?? m.format ?? undefined}
                                    totalEpisodes={m.totalEpisodes ?? undefined}
                                    onClick={() => navigate({ to: "/series/$seriesId", params: { seriesId: entry.mediaId.toString() } })}
                                />
                            )
                        })}
                    </div>
                )}
            </div>

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    )
}

// ─── Cassette Card Component (3D Expanding Cassette Showstopper) ────────────────────────────────────────────────────────

const CassetteCard = memo(function CassetteCard({
    entry,
    onClick,
}: {
    entry: Anime_LibraryCollectionEntry
    onClick: () => void
}) {
    const media = entry.media
    if (!media) return null

    const title = media.titleEnglish || media.titleRomaji || media.titleOriginal || "Sin título"
    const score = media.score 
        ? (media.score > 10 ? media.score / 10 : media.score).toFixed(1)
        : null

    // SVG Reel for the realistic cassette tape
    const CassetteReel = () => (
        <motion.svg
            variants={{
                idle: { rotate: 0 },
                hover: { rotate: 360, transition: { repeat: Infinity, duration: 3, ease: "linear" } }
            }}
            className="w-8 h-8 text-zinc-700/80 fill-zinc-900/60"
            viewBox="0 0 100 100"
        >
            <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="8" fill="transparent" />
            <path d="M 50 15 L 50 85 M 15 50 L 85 50 M 25 25 L 75 75 M 25 75 L 75 25" stroke="currentColor" strokeWidth="6" />
            <circle cx="50" cy="50" r="16" fill="#03060f" stroke="currentColor" strokeWidth="4" />
        </motion.svg>
    )

    return (
        <motion.div 
            className="group relative cursor-pointer"
            initial="idle"
            whileHover="hover"
            animate="idle"
            style={{ transformStyle: "preserve-3d" }}
            onClick={onClick}
        >
            {/* ── 1. The Slidable Plastic Cassette Tape Body (Slides Up on Hover) ── */}
            <motion.div
                className="absolute inset-x-2 bg-gradient-to-b from-[#0e1220] to-[#04060b] border border-white/10 rounded-xl p-3 flex flex-col justify-between shadow-[0_4px_30px_rgba(0,0,0,0.8)]"
                style={{
                    aspectRatio: "1 / 1.7",
                    zIndex: 5,
                    transformOrigin: "bottom center"
                }}
                variants={{
                    idle: { y: 0, scale: 0.95, opacity: 0.5 },
                    hover: { 
                        y: "-45%", 
                        scale: 1, 
                        opacity: 1,
                        transition: { type: "spring", stiffness: 180, damping: 18 } 
                    }
                }}
            >
                {/* Cassette Top notches & brand label */}
                <div className="flex justify-between items-center px-1 border-b border-white/5 pb-2">
                    <span className="text-[7px] font-mono font-black text-brand-orange/60 tracking-widest uppercase">
                        KAMEHOUSE TAPE
                    </span>
                    <span className="text-[7px] font-mono text-zinc-500 font-bold tracking-tight">
                        SIDE A
                    </span>
                </div>

                {/* Cassette Mechanical Reels Center section */}
                <div className="relative py-2 px-1 bg-[#020408]/80 border border-white/5 rounded-lg flex items-center justify-around">
                    {/* Tape spool window background */}
                    <div className="absolute inset-y-1.5 inset-x-8 bg-amber-950/20 rounded-md border border-amber-950/40 flex items-center justify-center">
                        {/* Fake magnetic tape roll */}
                        <div className="w-10 h-0.5 bg-brand-orange/40 rounded shadow-[0_0_10px_rgba(255,110,58,0.3)] animate-pulse" />
                    </div>

                    <CassetteReel />
                    <CassetteReel />
                </div>

                {/* Bottom recording specifications info */}
                <div className="flex flex-col gap-1.5 px-1 pt-1 text-[8px] font-mono text-zinc-400">
                    <div className="flex justify-between items-center">
                        <span className="text-zinc-600">VOLUMEN:</span>
                        <span className="font-bold text-white uppercase tracking-tight line-clamp-1 max-w-[70px]">
                            {title}
                        </span>
                    </div>
                    {media.totalEpisodes && (
                        <div className="flex justify-between items-center text-brand-orange">
                            <span>EPISODES:</span>
                            <span className="font-bold tabular-nums">
                                {media.totalEpisodes}
                            </span>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* ── 2. The Translucent Protective Sleeve/Case (Main Front Area) ── */}
            <motion.div
                className="relative z-10 w-full overflow-hidden bg-[#0d111d]/45 border border-white/5 rounded-2xl shadow-xl flex flex-col justify-end"
                style={{
                    aspectRatio: "1 / 1.7",
                    boxShadow: "0 10px 40px rgba(0,0,0,0.4), inset 0 0 30px rgba(255,255,255,0.02)",
                    backdropFilter: "blur(12px)"
                }}
                variants={{
                    idle: { rotateY: 0, rotateX: 0, scale: 1 },
                    hover: { 
                        rotateY: -8, 
                        rotateX: 4, 
                        scale: 1.02, 
                        borderColor: "rgba(255,110,58,0.25)",
                        boxShadow: "10px 20px 40px rgba(0,0,0,0.6), inset 0 0 40px rgba(255,110,58,0.05)",
                        transition: { duration: 0.3 } 
                    }
                }}
            >
                {/* Spine representation (left-aligned stripe inside case) */}
                <div
                    className="absolute inset-y-0 left-0 z-20 overflow-hidden border-r border-white/5 bg-[#03060f]/60 backdrop-blur-md flex flex-col justify-between py-4"
                    style={{ width: SPINE_WIDTH }}
                >
                    {/* Glossy edge gradient */}
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-white/30 to-transparent" />

                    {/* Spine score indicator */}
                    {score ? (
                        <div className="flex flex-col items-center gap-1">
                            <FaStar className="text-[7px] text-brand-orange drop-shadow-[0_0_5px_rgba(255,110,58,0.5)]" />
                            <span className="text-[8px] font-black text-brand-orange tracking-tighter tabular-nums">{score}</span>
                        </div>
                    ) : <div />}

                    {/* Spine vertically stacked labels */}
                    <div className="flex flex-col items-center gap-2">
                        {media.year && (
                            <span className="text-[7px] font-mono font-black text-zinc-500 uppercase tracking-widest rotate-90 my-2 whitespace-nowrap">
                                {media.year}
                            </span>
                        )}
                        <span className="text-[7px] font-mono font-bold text-zinc-600 rotate-90 py-1 uppercase whitespace-nowrap">
                            {media.format || "TV"}
                        </span>
                    </div>
                </div>

                {/* Cover Art Poster (inside case) */}
                <div 
                    className="absolute inset-y-0 right-0 overflow-hidden rounded-r-2xl"
                    style={{ left: SPINE_WIDTH }}
                >
                    <DeferredImage
                        src={media.posterImage || ""}
                        alt={title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />

                    {/* Premium glass reflection gloss overlay */}
                    <div 
                        className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.04] to-white/[0.08] pointer-events-none transition-all duration-300" 
                    />
                    
                    {/* Shadow overlay at bottom for text visibility */}
                    <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-[#020408]/90 via-[#020408]/50 to-transparent" />
                </div>

                {/* ── Outer text information overlay (always readable) ── */}
                <div className="relative z-20 p-3 pl-14 w-full">
                    {/* Badge */}
                    <div className="mb-1">
                        <span className="text-[7px] font-black uppercase tracking-[0.2em] text-brand-orange bg-brand-orange/10 px-1.5 py-0.5 rounded-md border border-brand-orange/10 backdrop-blur-md">
                            {media.genres?.[0] || "SERIE"}
                        </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-[11px] font-black text-white uppercase tracking-tight leading-snug line-clamp-2 drop-shadow-md group-hover:text-brand-orange transition-colors duration-300">
                        {title}
                    </h3>
                </div>

                {/* Interactive Play icon hovering at the top of the case on hover */}
                <div className="absolute top-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="w-7 h-7 rounded-full bg-brand-orange text-white flex items-center justify-center shadow-lg shadow-brand-orange/40 hover:scale-110 active:scale-95 transition-all">
                        <Play className="w-3.5 h-3.5 fill-current text-white translate-x-0.5" />
                    </div>
                </div>
            </motion.div>

            {/* ── 3. Subtle Floating Shadow base underneath ── */}
            <div className="absolute -bottom-6 inset-x-4 h-6 opacity-40 blur-lg bg-[#000000] rounded-full scale-95 group-hover:scale-105 group-hover:opacity-60 transition-all duration-300 pointer-events-none" />
        </motion.div>
    )
})

// ─── Skeleton Loader ────────────────────────────────────────────────────────────

function ShelfSkeleton() {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-20 pt-10">
            {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                    <div className="aspect-[1/1.7] bg-zinc-900/60 border border-white/5 rounded-2xl" />
                    <div className="mt-4 space-y-2.5 px-2">
                        <div className="h-3 w-12 bg-zinc-900/60 rounded-md" />
                        <div className="h-4 w-5/6 bg-zinc-900/60 rounded-md" />
                    </div>
                </div>
            ))}
        </div>
    )
}

export const SeriesCardSkeleton = ShelfSkeleton