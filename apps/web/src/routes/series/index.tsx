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
import { CassetteCard } from "@/components/shared/cassette-card"

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
            const title = media 
                ? (media.titleRomaji || media.titleEnglish || media.titleOriginal || "")
                : `Desconocido (${s.mediaId})`
            
            const matchesGenre = activeGenre && media ? media.genres?.includes(activeGenre) : !activeGenre
            const matchesSearch = search
                ? title.toLowerCase().includes(search.toLowerCase()) ||
                  (media?.description || "").toLowerCase().includes(search.toLowerCase())
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8 pt-6">
                        {filtered.map((entry) => (
                            <CassetteCard
                                key={entry.mediaId}
                                entry={entry}
                                onClick={() => navigate({ to: "/series/$seriesId", params: { seriesId: entry.mediaId.toString() } })}
                            />
                        ))}
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

// ─── Cassette Card Component movido a @/components/shared/cassette-card.tsx ───

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