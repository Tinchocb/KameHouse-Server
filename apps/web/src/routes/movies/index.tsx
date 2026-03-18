import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo, memo } from "react"
import { FaPlay, FaSearch, FaFilter } from "react-icons/fa"
import { EmptyState } from "@/components/shared/empty-state"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { Anime_LibraryCollectionEntry } from "@/api/generated/types"
import { Loader2, Clapperboard, Search, Filter } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { MediaCard } from "@/components/ui/media-card"

// ─── Shared Cinematic Decorations ───────────────────────

function SpeedLines({ opacity = 0.04 }: { opacity?: number }) {
    return (
        <svg
            aria-hidden
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ opacity }}
            viewBox="0 0 900 320"
            preserveAspectRatio="xMidYMid slice"
        >
            {Array.from({ length: 32 }).map((_, i) => {
                const angle = (i / 32) * 360
                const rad = (angle * Math.PI) / 180
                return (
                    <line
                        key={i}
                        x1="450" y1="160"
                        x2={450 + Math.cos(rad) * 1400}
                        y2={160 + Math.sin(rad) * 1400}
                        stroke="white"
                        strokeWidth={i % 4 === 0 ? "1.5" : "0.6"}
                    />
                )
            })}
        </svg>
    )
}

function HalftoneDots() {
    return (
        <svg
            aria-hidden
            className="absolute inset-0 w-full h-full opacity-[0.025] pointer-events-none"
        >
            <defs>
                <pattern id="dots" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
                    <circle cx="6" cy="6" r="1.5" fill="white" />
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
    )
}

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
            {/* ── Hero ── */}
            <div className="relative overflow-hidden pt-24 pb-14 px-6 md:px-14">
                {/* Cinematic Glow & Decorations */}
                <div className="absolute top-[-160px] left-[-80px] w-[640px] h-[520px] rounded-full bg-gradient-to-br from-primary to-rose-600 opacity-[0.08] blur-[120px] pointer-events-none" />
                <SpeedLines opacity={0.03} />
                <HalftoneDots />
                <div className="absolute right-6 top-1/2 -translate-y-1/2 [writing-mode:vertical-rl] font-black text-[10px] tracking-[0.5em] text-zinc-800 uppercase pointer-events-none select-none">
                    PELÍCULAS · CINE · ARCHIVOS
                </div>

                <div className="relative z-10 max-w-[1400px] mx-auto">
                    <div className="flex items-center gap-3 mb-4 animate-in fade-in slide-in-from-left-4 duration-700">
                        <div className="h-[2px] w-8 bg-primary shadow-[0_0_15px_rgba(249,115,22,0.5)]" />
                        <p className="text-[11px] font-black uppercase tracking-[0.4em] text-primary/90">Colección Premium</p>
                    </div>
                    
                    <h1 className="font-bebas text-6xl md:text-8xl lg:text-9xl leading-[0.8] tracking-[0.02em] text-white animate-in fade-in slide-in-from-left-6 duration-1000">
                        MI<br />
                        <span className="text-transparent stroke-text opacity-30">PELÍ</span>CULA
                    </h1>
                    <p className="font-bebas text-2xl md:text-4xl tracking-[0.05em] text-primary mt-2 animate-in fade-in slide-in-from-left-8 duration-1000 delay-100">
                        Biblioteca Cinematográfica
                    </p>
                    
                    <div className="flex items-center gap-4 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
                        <div className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 backdrop-blur-md">
                            <p className="text-[12px] font-bold text-zinc-400 tabular-nums">
                                {isLoading ? "..." : allMovies.length} <span className="text-[10px] font-black text-zinc-600 uppercase ml-1">Títulos</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

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
                    <div className="flex flex-wrap items-center gap-2">
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
                    <div className="h-64 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="w-10 h-10 text-primary animate-spin" />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">Procesando Biblioteca</p>
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
                title={movie.titleRomaji || movie.titleEnglish || "Sin título"}
                badge={movie.format === "MOVIE" ? "PELÍCULA" : undefined}
                year={movie.year}
                rating={movie.score ? movie.score / 10 : undefined}
                aspect="poster"
                onClick={() => navigate({ to: "/series/$seriesId", params: { seriesId: entry.mediaId.toString() } })}
                className="w-full"
            />
            
            <div className="px-1 space-y-1">
                <h3 className="text-[13px] font-bold text-zinc-200 group-hover:text-primary transition-colors line-clamp-2 leading-tight">
                    {movie.titleRomaji || movie.titleEnglish || "Sin título"}
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