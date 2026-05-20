import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo, useRef } from "react"
import { Tv } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { VhsCollection, type VhsCollectionItem } from "@/components/shared/vhs-collection"
import { PremiumPosterCard } from "@/components/shared/premium-poster-card"
import { motion, AnimatePresence } from "framer-motion"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"

export const Route = createFileRoute("/series/")({
    component: SeriesPage,
})

function SeriesPage() {
    const [viewMode] = useState<"grid" | "shelf">("shelf")
    
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
        const uniqueArray = Array.from(unique.values())
        
        // Ordenar por año de lanzamiento (ascendente: más antiguo a más nuevo)
        uniqueArray.sort((a, b) => {
            const yearA = a.media?.year || 9999
            const yearB = b.media?.year || 9999
            return yearA - yearB
        })
        
        return uniqueArray
    }, [collection])


    const filtered = allSeries

    const vhsTapeItems = useMemo<VhsCollectionItem[]>(() => {
        return filtered.map((s) => {
            const media = s.media
            const title = media?.titleEnglish || media?.titleRomaji || media?.titleOriginal || "Sin título"
            
            // Hardcoded fallbacks for Dragon Ball series if metadata fails
            let epsCount = media?.totalEpisodes || s.libraryData?.mainFileCount || 0
            if (epsCount === 0) {
                const t = title.toLowerCase()
                if (t.includes("dragon ball super")) epsCount = 131
                else if (t.includes("dragon ball z")) epsCount = 291
                else if (t.includes("dragon ball kai")) epsCount = 167
                else if (t.includes("dragon ball gt")) epsCount = 64
                else if (t === "dragon ball") epsCount = 153
            }

            return {
                id: s.mediaId,
                title: title,
                episodesCount: epsCount,
                watchedCount: s.listData?.progress || 0,
                genres: media?.genres || [],
                year: media?.year,
                status: s.listData?.status === "COMPLETED" ? "Completado" : s.listData?.status === "CURRENT" ? "En progreso" : "Sin comenzar",
                isNew: !!(media?.year && media.year >= 2024),
                posterUrl: media?.posterImage || "",
                bannerUrl: media?.bannerImage || "",
                description: media?.description || "",
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

    return (        <div ref={containerRef} className="flex-1 w-full h-full bg-background text-white overflow-hidden font-sans">
            
            {/* ── Content Area ── */}
            <div className="w-full h-full">
                <AnimatePresence mode="wait">
                    {isLoading ? (
                        <div key="loading" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 px-14 py-20">
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
                            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 md:gap-8 px-14 py-20"
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
                            className="flex-1 w-full h-full min-h-0"
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