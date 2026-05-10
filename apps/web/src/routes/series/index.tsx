import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo, useRef } from "react"
import { Search, Filter, Tv, LayoutGrid, Library, SortAsc, LayoutList } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { VhsCollection, type VhsCollectionItem } from "@/components/shared/vhs-collection"
import { ContinueWatchingCarousel } from "@/components/shared/continue-watching-carousel"
import { PremiumPosterCard } from "@/components/shared/premium-poster-card"
import { motion, AnimatePresence } from "framer-motion"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"

export const Route = createFileRoute("/series/")({
    component: SeriesPage,
})

function SeriesPage() {
    const [search, setSearch] = useState("")
    const [activeGenre, setActiveGenre] = useState<string | null>(null)
    const [viewMode, setViewMode] = useState<"grid" | "shelf">("shelf")
    
    const navigate = useNavigate()
    const { data: collection, isLoading } = useGetLibraryCollection()
    const containerRef = useRef<HTMLDivElement>(null)

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

    const vhsTapeItems = useMemo<VhsCollectionItem[]>(() => {
        return filtered.map((s) => {
            const media = s.media
            const title = media?.titleEnglish || media?.titleRomaji || media?.titleOriginal || "Sin título"
            return {
                id: s.mediaId,
                title: title,
                episodesCount: media?.totalEpisodes || 0,
                watchedCount: s.listData?.progress || 0,
                genres: media?.genres || [],
                year: media?.year,
                status: s.listData?.status === "COMPLETED" ? "Completado" : s.listData?.status === "CURRENT" ? "En progreso" : "Sin comenzar",
                isNew: !!(media?.year && media.year >= 2024),
                posterUrl: media?.posterImage || "",
                bannerUrl: media?.bannerImage || "",
            }
        })
    }, [filtered])

    useGSAP(() => {
        if (isLoading || filtered.length === 0) return

        const cards = gsap.utils.toArray(".series-card")
        if (cards.length > 0) {
            gsap.from(cards, {
                opacity: 0,
                y: 30,
                scale: 0.9,
                duration: 0.6,
                stagger: {
                    amount: 0.8,
                    grid: "auto",
                    from: "start"
                },
                ease: "back.out(1.2)",
                clearProps: "all"
            })
        }
    }, { scope: containerRef, dependencies: [isLoading, filtered.length, viewMode] })

    return (
        <div ref={containerRef} className="flex-1 w-full bg-background text-white overflow-x-hidden font-sans pb-10">
            
            {/* ── Floating Premium Toolbar ── */}
            <div className="sticky top-0 z-40 px-6 md:px-14 py-6 bg-background/0 pointer-events-none">
                <div className="max-w-[1600px] mx-auto pointer-events-auto">
                    <div className="bg-[#0a0e1a]/40 backdrop-blur-3xl border border-white/10 rounded-3xl p-3 flex flex-wrap items-center justify-between gap-4 shadow-2xl">
                        
                        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-brand-orange transition-colors w-4 h-4" />
                                <input
                                    className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/5 focus:border-brand-orange/40 rounded-2xl text-[11px] font-bold uppercase tracking-widest outline-none transition-all placeholder:text-zinc-600 focus:bg-white/10"
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="BUSCAR EN TU COLECCIÓN..."
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full md:max-w-md lg:max-w-xl">
                            <button
                                onClick={() => setActiveGenre(null)}
                                className={cn(
                                    "whitespace-nowrap px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-2xl border transition-all",
                                    activeGenre === null
                                        ? "bg-brand-orange text-white border-brand-orange shadow-lg shadow-brand-orange/20"
                                        : "bg-white/5 text-zinc-500 border-white/5 hover:text-white hover:bg-white/10"
                                )}
                            >
                                TODOS
                            </button>
                            {ALL_GENRES.slice(0, 8).map(g => (
                                <button
                                    key={g}
                                    onClick={() => setActiveGenre(activeGenre === g ? null : g)}
                                    className={cn(
                                        "whitespace-nowrap px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-2xl border transition-all",
                                        activeGenre === g
                                            ? "bg-brand-orange text-white border-brand-orange shadow-lg shadow-brand-orange/20"
                                            : "bg-white/5 text-zinc-500 border-white/5 hover:text-white hover:bg-white/10"
                                    )}
                                >
                                    {g}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center bg-white/5 border border-white/5 p-1 rounded-2xl">
                            <button
                                onClick={() => setViewMode("grid")}
                                className={cn(
                                    "p-2 rounded-xl transition-all",
                                    viewMode === "grid" ? "bg-white text-black shadow-xl" : "text-zinc-500 hover:text-white"
                                )}
                            >
                                <LayoutGrid className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode("shelf")}
                                className={cn(
                                    "p-2 rounded-xl transition-all",
                                    viewMode === "shelf" ? "bg-white text-black shadow-xl" : "text-zinc-500 hover:text-white"
                                )}
                            >
                                <LayoutList className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Content Area ── */}
            <div className="max-w-[1600px] mx-auto px-6 md:px-14 pb-20">
                <AnimatePresence mode="wait">
                    {isLoading ? (
                        <div key="loading" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                            {Array.from({ length: 12 }).map((_, i) => (
                                <div key={i} className="aspect-[2/3] bg-zinc-900 animate-pulse rounded-2xl" />
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div key="empty" className="py-20">
                            <EmptyState
                                title="Sin resultados"
                                message="No encontramos series con esos filtros."
                                illustration={<Tv className="w-20 h-20 text-zinc-800" />}
                            />
                        </div>
                    ) : viewMode === "grid" ? (
                        <motion.div 
                            key="grid"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 md:gap-8"
                        >
                            {filtered.map((entry) => (
                                <div key={entry.mediaId} className="series-card">
                                    <PremiumPosterCard
                                        id={entry.mediaId}
                                        title={entry.media?.titleEnglish || entry.media?.titleRomaji || "Sin título"}
                                        posterUrl={entry.media?.posterImage || ""}
                                        rating={entry.media?.score}
                                        year={entry.media?.year}
                                        format={entry.media?.format}
                                        genres={entry.media?.genres}
                                        onClick={() => navigate({ to: "/series/$seriesId", params: { seriesId: entry.mediaId.toString() } })}
                                    />
                                </div>
                            ))}
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="shelf"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <VhsCollection
                                items={vhsTapeItems}
                                onItemClick={(item) => navigate({ to: "/series/$seriesId", params: { seriesId: item.id.toString() } })}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .perspective-1000 { perspective: 1000px; }
            `}</style>
        </div>
    )
}