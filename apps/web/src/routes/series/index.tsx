import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo, useRef } from "react"
import { Search, Filter, Tv, LayoutGrid, Library, SortAsc, LayoutList } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { VhsShelfAccordion, type VhsTapeItem } from "@/components/shared/vhs-shelf-accordion"
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

    const vhsTapeItems = useMemo<VhsTapeItem[]>(() => {
        return filtered.map((s) => {
            const media = s.media
            const title = media?.titleEnglish || media?.titleRomaji || media?.titleOriginal || "Sin título"
            const rawScore = media?.score ?? null
            const score = rawScore
                ? (rawScore > 10 ? rawScore / 10 : rawScore).toFixed(1)
                : null
            return {
                id: s.mediaId,
                title,
                subtitle: media?.genres?.[0] || undefined,
                description: media?.description || undefined,
                posterUrl: media?.posterImage || "",
                bannerUrl: media?.bannerImage || "",
                episodesCount: media?.totalEpisodes || 0,
                runtime: media?.totalEpisodes ? `${media.totalEpisodes} eps` : undefined,
                score,
                year: media?.year,
                format: media?.format || undefined,
                genres: media?.genres || [],
                tmdbId: (media as any)?.tmdbId ?? null,
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
        <div ref={containerRef} className="flex-1 w-full h-full bg-background text-white font-sans flex flex-col overflow-x-hidden">

            {/* ── Content Area ── */}
            <AnimatePresence mode="wait">
                {isLoading ? (
                    <div key="loading" className="max-w-[1800px] mx-auto px-6 md:px-14 pb-20">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                            {Array.from({ length: 12 }).map((_, i) => (
                                <div key={i} className="aspect-[2/3] bg-zinc-900 animate-pulse rounded-2xl" />
                            ))}
                        </div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div key="empty" className="max-w-[1800px] mx-auto px-6 md:px-14 pb-20">
                        <div className="py-20">
                            <EmptyState
                                title="Sin resultados"
                                message="No encontramos series con esos filtros."
                                illustration={<Tv className="w-20 h-20 text-zinc-800" />}
                            />
                        </div>
                    </div>
                ) : viewMode === "grid" ? (
                    <motion.div
                        key="grid"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="max-w-[1800px] mx-auto px-6 md:px-14 pb-20"
                    >
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 md:gap-8">
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
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="shelf"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="flex-1 flex flex-col min-h-0"
                    >
                        <VhsShelfAccordion
                            items={vhsTapeItems}
                            onItemClick={(item) => navigate({ to: "/series/$seriesId", params: { seriesId: item.id.toString() } })}
                            type="series"
                            className="flex-1 h-full"
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .perspective-1000 { perspective: 1000px; }
            `}</style>
        </div>
    )
}