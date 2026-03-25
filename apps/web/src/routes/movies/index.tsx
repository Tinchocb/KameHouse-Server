import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo, memo } from "react"
import { FaPlay, FaSearch, FaFilter } from "react-icons/fa"
import { EmptyState } from "@/components/shared/empty-state"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { Anime_LibraryCollectionEntry } from "@/api/generated/types"
import { Loader2, Clapperboard, Search, Filter } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { MediaCard } from "@/components/ui/media-card"
import { HeroSection } from "@/components/shared/hero-section"


export const Route = createFileRoute("/movies/")({
    component: MoviesPage,
})

// ─── Component ────────────────────────────────────────────────────────────────

function MoviesPage() {
    const [search, setSearch] = useState("")
    const [activeGenre, setActiveGenre] = useState<string | null>(null)

    const { data: collection, isLoading } = useGetLibraryCollection()

    const allMovies = useMemo(() => {
        if (!collection?.lists) return []
        const rawMovies = collection.lists
            .flatMap(list => list.entries || [])
            .filter(entry => entry.media?.format === "MOVIE")
        const unique = new Map<number, NonNullable<typeof rawMovies[0]>>()
        rawMovies.forEach(m => { if (m.mediaId) unique.set(m.mediaId, m) })
        return Array.from(unique.values())
    }, [collection])

    const ALL_GENRES = useMemo(() => {
        const genres = new Set<string>()
        allMovies.forEach(m => { m.media?.genres?.forEach(g => genres.add(g)) })
        return Array.from(genres).sort()
    }, [allMovies])

    const filtered = useMemo(() => {
        return allMovies.filter(m => {
            const media = m.media
            if (!media) return false
            const matchesGenre = activeGenre ? media.genres?.includes(activeGenre) : true
            const title = media.titleRomaji || media.titleEnglish || media.titleOriginal || ""
            const matchesSearch = search
                ? title.toLowerCase().includes(search.toLowerCase()) ||
                  (media.description || "").toLowerCase().includes(search.toLowerCase())
                : true
            return matchesGenre && matchesSearch
        })
    }, [search, activeGenre, allMovies])
 
     return (
         <div className="flex-1 w-full min-h-screen bg-background text-white overflow-y-auto pb-32 font-sans selection:bg-primary/30">
             <HeroSection
                 title={<>A<br /><span className="text-transparent stroke-text opacity-30">RCHI</span>VO</>}
                 subtitle="Módulo Cápsula"
                 decorationTag="Corporación Cápsula"
                 verticalTag="PELÍCULAS · CRÓNICAS · ARCHIVOS"
                 count={isLoading ? "..." : allMovies.length}
                 countLabel="Títulos"
             />
 

            {/* ── Controls ── */}
            <div className="sticky top-0 z-30 glass-panel-premium border-y border-white/[0.03] backdrop-blur-3xl">
                <div className="max-w-[1400px] mx-auto px-6 md:px-14 py-4 flex flex-wrap gap-6 items-center justify-between">
                    {/* Search */}
                    <div className="relative w-full sm:w-80 group">
                        <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary transition-colors text-sm" />
                        <input
                            className="w-full pl-12 pr-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.05] focus:bg-white/[0.08] border border-white/5 focus:border-primary/40 rounded-xl text-sm outline-none transition-all duration-300 placeholder:text-zinc-600"
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar en la filmoteca..."
                        />
                    </div>

                    {/* Genres */}
                    <div className="flex flex-nowrap sm:flex-wrap items-center gap-2 overflow-x-auto sm:overflow-x-visible no-scrollbar pb-2 sm:pb-0">
                        <div className="flex items-center gap-2 mr-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5">
                            <FaFilter className="text-[10px] text-zinc-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Géneros</span>
                        </div>
                        
                        <GenrePill label="TODO" active={activeGenre === null} onClick={() => setActiveGenre(null)} />
                        {ALL_GENRES.slice(0, 12).map(g => (
                            <GenrePill
                                key={g}
                                label={g.toUpperCase()}
                                active={activeGenre === g}
                                onClick={() => setActiveGenre(activeGenre === g ? null : g)}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Grid ── */}
            <div className="max-w-[1400px] mx-auto px-6 md:px-14 pt-12">
                {isLoading ? (
                    <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-6 gap-y-10">
                        {Array.from({ length: 14 }).map((_, i) => (
                            <MovieCardSkeleton key={i} />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <EmptyState 
                        title="Sin coincidencias" 
                        message="No hemos encontrado películas que coincidan con tu búsqueda actual."
                        illustration={<Clapperboard className="w-20 h-20 text-zinc-800" />}
                    />
                ) : (
                    <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-6 gap-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                        {filtered.map(entry => (
                            <MovieCard key={entry.mediaId} entry={entry} />
                        ))}
                    </div>
                )}
            </div>
            <style>{`
                .stroke-text {
                    -webkit-text-stroke: 1.5px white;
                }
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const GenrePill = memo(function GenrePill({
    label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button 
            className={cn(
                "px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest transition-all duration-300 border",
                active 
                    ? "bg-primary text-white border-primary shadow-[0_0_20px_rgba(249,115,22,0.3)] scale-105" 
                    : "bg-white/[0.03] text-zinc-500 border-white/5 hover:border-primary/40 hover:text-primary"
            )}
            onClick={onClick}
        >
            {label}
        </button>
    )
})

const MovieCard = memo(function MovieCard({ entry }: { entry: Anime_LibraryCollectionEntry }) {
    const navigate = useNavigate()
    const movie = entry.media

    if (!movie) return null

    return (
        <div className="flex flex-col gap-3 group">
            <MediaCard 
                artwork={movie.posterImage || ""}
                title={movie.titleEnglish || movie.titleRomaji || movie.titleOriginal || "Sin título"}
                badge={movie.format === "MOVIE" ? "PELÍCULA" : undefined}
                year={movie.year}
                rating={movie.score ? movie.score / 10 : undefined}
                aspect="poster"
                onClick={() => navigate({ to: "/series/$seriesId", params: { seriesId: entry.mediaId.toString() } })}
                className="w-full"
            />
            
            <div className="px-1 space-y-1">
                <h3 className="text-[13px] font-bold text-zinc-200 group-hover:text-primary transition-colors line-clamp-2 leading-tight">
                    {movie.titleEnglish || movie.titleRomaji || movie.titleOriginal || "Sin título"}
                </h3>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-wider">{movie.genres?.[0] || "Anime"}</span>
                    {movie.totalEpisodes && movie.totalEpisodes > 1 && (
                        <span className="text-[10px] font-bold text-zinc-700 tabular-nums">{movie.totalEpisodes} eps</span>
                    )}
                </div>
            </div>
        </div>
    )
})
 
export const MovieCardSkeleton = memo(function MovieCardSkeleton() {
    return (
        <div className="flex flex-col gap-3 animate-pulse">
            <div className="aspect-[2/3] w-full bg-white/[0.03] rounded-2xl border border-white/5 shadow-xl" />
            <div className="px-1 space-y-2">
                <div className="h-4 w-5/6 bg-white/[0.04] rounded-md" />
                <div className="flex items-center gap-2">
                    <div className="h-3 w-12 bg-white/[0.02] rounded" />
                    <div className="h-3 w-8 bg-white/[0.01] rounded" />
                </div>
            </div>
        </div>
    )
})
