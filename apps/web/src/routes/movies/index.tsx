import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo, memo } from "react"
import { FaPlay, FaSearch, FaFilter } from "react-icons/fa"
import { EmptyState } from "@/components/shared/empty-state"
import { GenrePill } from "@/components/shared/genre-pill"
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
            <div className="sticky top-0 z-30 bg-black border-y border-white/10">
                <div className="max-w-[1400px] mx-auto px-6 md:px-14 py-4 flex flex-wrap gap-6 items-center justify-between">
                    {/* Search */}
                    <div className="relative w-full sm:w-80 group">
                        <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-white transition-colors text-sm" />
                        <input
                            className="w-full pl-12 pr-4 py-2.5 bg-black hover:bg-zinc-900 border border-white/10 focus:border-white rounded-none text-sm outline-none transition-all duration-200 placeholder:text-zinc-600 uppercase tracking-widest"
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="BUSCAR EN FILMOTECA..."
                        />
                    </div>

                    {/* Genres */}
                    <div className="flex flex-nowrap sm:flex-wrap items-center gap-2 overflow-x-auto sm:overflow-x-visible no-scrollbar pb-2 sm:pb-0">
                        <div className="flex items-center gap-2 mr-2 px-3 py-1.5 bg-black border border-white/10">
                            <FaFilter className="text-[10px] text-zinc-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Filtro</span>
                        </div>
                        
                        <GenrePill label="TODOS" active={activeGenre === null} onClick={() => setActiveGenre(null)} />
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
                    <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-8 gap-y-12">
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
                    <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-8 gap-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
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



const MovieCard = memo(function MovieCard({ entry }: { entry: Anime_LibraryCollectionEntry }) {
    const navigate = useNavigate()
    const movie = entry.media

    if (!movie) return null

    return (
        <div className="flex flex-col gap-4 group">
            <MediaCard 
                artwork={movie.posterImage || ""}
                title={movie.titleEnglish || movie.titleRomaji || movie.titleOriginal || "Sin título"}
                badge={movie.format === "MOVIE" ? "PELÍCULA" : undefined}
                year={movie.year}
                rating={movie.score ? (movie.score > 10 ? movie.score / 10 : movie.score) : undefined}
                aspect="poster"
                onClick={() => navigate({ to: "/series/$seriesId", params: { seriesId: entry.mediaId.toString() } })}
                className="w-full"
            />
            
            <div className="px-1 space-y-2">
                <h3 className="text-[13px] font-black text-white group-hover:text-zinc-400 transition-colors line-clamp-2 leading-tight uppercase tracking-tight">
                    {movie.titleEnglish || movie.titleRomaji || movie.titleOriginal || "Sin título"}
                </h3>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">{movie.genres?.[0] || "Anime"}</span>
                    {movie.totalEpisodes && movie.totalEpisodes > 1 && (
                        <span className="text-[10px] font-black text-zinc-700 tabular-nums uppercase tracking-widest">{movie.totalEpisodes} EPS</span>
                    )}
                </div>
            </div>
        </div>
    )
})
 
export const MovieCardSkeleton = memo(function MovieCardSkeleton() {
    return (
        <div className="flex flex-col gap-4 animate-pulse">
            <div className="aspect-[2/3] w-full bg-zinc-900 border border-white/5 shadow-xl" />
            <div className="px-1 space-y-3">
                <div className="h-4 w-5/6 bg-zinc-900" />
                <div className="flex items-center gap-3">
                    <div className="h-3 w-16 bg-zinc-900" />
                    <div className="h-3 w-8 bg-zinc-900" />
                </div>
            </div>
        </div>
    )
})
