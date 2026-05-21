import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { Search, Tv, LayoutGrid, LayoutList, X, ChevronRight } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { EmptyState } from "@/components/shared/empty-state"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { VhsShelfAccordion, type VhsTapeItem } from "@/components/shared/vhs-shelf-accordion"
import { PremiumPosterCard } from "@/components/shared/premium-poster-card"
import { SeriesQuickPanel } from "@/components/shared/series-quick-panel"
import { motion, AnimatePresence } from "framer-motion"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"

export const Route = createFileRoute("/series/")({
    component: SeriesPage,
})

// ─── Constantes ───────────────────────────────────────────────────────────────

const MAX_GENRE_CHIPS = 8
const SEARCH_DEBOUNCE_MS = 280

// ─── VHS Skeleton ─────────────────────────────────────────────────────────────
// Imita la forma de los tapes en el estante

function VhsShelfSkeleton() {
    return (
        <div className="w-full flex-1 flex flex-col min-h-[600px]">
            <div
                className="relative flex flex-row items-stretch w-full flex-1 bg-[#06080d] border-y border-white/[0.04] overflow-hidden"
                style={{ perspective: "2000px" }}
            >
                {/* Estante inferior */}
                <div
                    className="absolute bottom-0 inset-x-0 h-6 z-20 pointer-events-none"
                    style={{ background: "linear-gradient(to top, #14100a 0%, #261a0d 60%, transparent 100%)" }}
                />
                <div
                    className="absolute bottom-6 inset-x-0 h-[2px] z-20 pointer-events-none"
                    style={{
                        background: "linear-gradient(to right, transparent, #3d2e14 15%, #4a3818 50%, #3d2e14 85%, transparent)",
                    }}
                />
                <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/70 to-transparent z-10 pointer-events-none" />

                {/* Tapes skeleton */}
                <div className="flex flex-row items-stretch gap-[3px] h-full z-10 px-3 pb-7 pt-4">
                    {Array.from({ length: 9 }).map((_, i) => (
                        <div
                            key={i}
                            className="w-[90px] shrink-0 h-full rounded-sm overflow-hidden animate-pulse"
                            style={{
                                background: `linear-gradient(to bottom, #0e1118 0%, #13151e 50%, #0a0c12 100%)`,
                                animationDelay: `${i * 80}ms`,
                                boxShadow: "8px 0 24px rgba(0,0,0,0.7)",
                            }}
                        >
                            {/* Borde izquierdo acento */}
                            <div
                                className="absolute left-0 inset-y-0 w-1"
                                style={{ background: `rgba(${40 + i * 20},${30 + i * 8},${20 + i * 5},0.4)` }}
                            />
                            {/* Año */}
                            <div className="flex items-center justify-center pt-3">
                                <div className="w-8 h-2.5 bg-zinc-800/60 rounded-[2px]" />
                            </div>
                            {/* Título vertical */}
                            <div className="flex-1 flex items-center justify-center py-4">
                                <div className="w-3 h-24 bg-zinc-800/40 rounded" />
                            </div>
                            {/* Chassis */}
                            <div
                                className="h-[54px] flex items-center justify-center shrink-0"
                                style={{
                                    background: "linear-gradient(160deg, #0e1018 0%, #161820 45%, #0a0c12 100%)",
                                    borderTop: "1px solid rgba(255,255,255,0.04)",
                                }}
                            >
                                <div className="w-10 h-5 bg-zinc-900/80 rounded-sm border border-white/5" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// ─── Grid Skeleton ────────────────────────────────────────────────────────────

function GridSkeleton() {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 md:gap-8">
            {Array.from({ length: 12 }).map((_, i) => (
                <div
                    key={i}
                    className="aspect-[2/3] bg-zinc-900 animate-pulse rounded-2xl"
                    style={{ animationDelay: `${i * 50}ms` }}
                />
            ))}
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function SeriesPage() {
    const [searchRaw, setSearchRaw] = useState("")
    const [search, setSearch] = useState("")
    const [activeGenre, setActiveGenre] = useState<string | null>(null)
    const [viewMode, setViewMode] = useState<"grid" | "shelf">("shelf")
    const [quickPanelId, setQuickPanelId] = useState<number | string | null>(null)
    const [showAllGenres, setShowAllGenres] = useState(false)

    const navigate = useNavigate()
    const { data: collection, isLoading } = useGetLibraryCollection()
    const containerRef = useRef<HTMLDivElement>(null)
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // ── Debounce del buscador
    const handleSearchChange = useCallback((val: string) => {
        setSearchRaw(val)
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
        searchTimerRef.current = setTimeout(() => setSearch(val), SEARCH_DEBOUNCE_MS)
    }, [])

    useEffect(() => () => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }, [])

    // ── Datos
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
        const counts = new Map<string, number>()
        allSeries.forEach(s => {
            s.media?.genres?.forEach(g => counts.set(g, (counts.get(g) ?? 0) + 1))
        })
        // Ordenar por frecuencia
        return Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([g]) => g)
    }, [allSeries])

    const visibleGenres = showAllGenres ? ALL_GENRES : ALL_GENRES.slice(0, MAX_GENRE_CHIPS)
    const hiddenGenreCount = ALL_GENRES.length - MAX_GENRE_CHIPS

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

    // ── GSAP entrada tarjetas en modo grid
    useGSAP(() => {
        if (isLoading || filtered.length === 0 || viewMode !== "grid") return
        const cards = gsap.utils.toArray(".series-card")
        if (cards.length > 0) {
            gsap.from(cards, {
                opacity: 0,
                y: 30,
                scale: 0.9,
                duration: 0.55,
                stagger: { amount: 0.7, grid: "auto", from: "start" },
                ease: "back.out(1.2)",
                clearProps: "all",
            })
        }
    }, { scope: containerRef, dependencies: [isLoading, filtered.length, viewMode] })

    // ── Handlers QuickPanel
    const handleTapeClick = useCallback((item: VhsTapeItem) => {
        setQuickPanelId(item.id)
    }, [])

    const handlePanelNavigate = useCallback((seriesId: string) => {
        navigate({ to: "/series/$seriesId", params: { seriesId } })
    }, [navigate])

    const handlePanelPlay = useCallback((seriesId: string) => {
        navigate({ to: "/series/$seriesId", params: { seriesId } })
    }, [navigate])

    return (
        <div ref={containerRef} className="flex-1 w-full h-full bg-background text-white font-sans flex flex-col overflow-x-hidden">
            {/* ═══════════════════════════════════════════════════════════
                CONTENT AREA
            ═══════════════════════════════════════════════════════════ */}
            <AnimatePresence mode="wait">
                {isLoading ? (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex-1 flex flex-col"
                    >
                        {viewMode === "shelf" ? (
                            <VhsShelfSkeleton />
                        ) : (
                            <div className="max-w-[1800px] mx-auto px-6 md:px-14 pb-20 pt-6 w-full">
                                <GridSkeleton />
                            </div>
                        )}
                    </motion.div>
                ) : filtered.length === 0 ? (
                    <motion.div
                        key="empty"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="max-w-[1800px] mx-auto px-6 md:px-14 pb-20 pt-6"
                    >
                        <div className="py-20">
                            <EmptyState
                                title={search ? `Sin resultados para "${search}"` : "Sin resultados"}
                                message={
                                    activeGenre
                                        ? `No hay series en el género "${activeGenre}".`
                                        : "No encontramos series con esos filtros."
                                }
                                illustration={<Tv className="w-20 h-20 text-zinc-800" />}
                            />
                        </div>
                    </motion.div>
                ) : viewMode === "grid" ? (
                    <motion.div
                        key="grid"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="max-w-[1800px] mx-auto px-6 md:px-14 pb-20 pt-6 w-full"
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
                                        onClick={() => setQuickPanelId(entry.mediaId)}
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
                            onItemClick={handleTapeClick}
                            type="series"
                            className="flex-1 h-full"
                        />
                        {/* Hint de uso */}
                        <div className="flex items-center justify-center py-2.5 shrink-0">
                            <span
                                className="text-[9px] font-mono uppercase tracking-[0.3em]"
                                style={{ color: "rgba(255,255,255,0.12)" }}
                            >
                                Hover para explorar · Click para ver detalles
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══════════════════════════════════════════════════════════
                QUICK PANEL
            ═══════════════════════════════════════════════════════════ */}
            <SeriesQuickPanel
                seriesId={quickPanelId}
                open={quickPanelId !== null}
                onClose={() => setQuickPanelId(null)}
                onNavigate={handlePanelNavigate}
                onPlay={handlePanelPlay}
            />

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    )
}