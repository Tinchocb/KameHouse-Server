import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo, memo } from "react"
import { Clapperboard, Search, SlidersHorizontal } from "lucide-react"
import { MediaCard } from "@/components/ui/media-card"
import { PageHeader } from "@/components/ui/page-header"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { NativeSelect } from "@/components/ui/native-select"
import { EmptyState } from "@/components/shared/empty-state"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import type { Anime_LibraryCollectionEntry } from "@/api/generated/types"

export const Route = createFileRoute("/movies/")({
    component: MoviesPage,
})

// ─── Constants & Data ────────────────────────────────────────────────────────

type EraTab = "all" | "classic" | "z" | "super" | "specials"

type SortOption = "year_asc" | "year_desc" | "recently_add" | "alpha"

const ERA_TABS: { value: EraTab; label: string }[] = [
    { value: "all", label: "Todas" },
    { value: "classic", label: "Dragon Ball" },
    { value: "z", label: "Dragon Ball Z" },
    { value: "super", label: "Dragon Ball Super" },
    { value: "specials", label: "Especiales y OVAs" },
]

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: "year_asc", label: "Año (Más antiguo)" },
    { value: "year_desc", label: "Año (Más reciente)" },
    { value: "recently_add", label: "Agregado recientemente" },
    { value: "alpha", label: "Alfabético" },
]

// Hardcoded watch order for Dragon Ball (example)
const WATCH_ORDER_MAP: Record<number, string> = {
    // DB Movies
    227: "Ver después del ep. 153", // Curse of the Blood Rubies
    // DBZ Movies
    845: "Ver después del ep. 35", // Dead Zone
    894: "Ver después del ep. 54", // World's Strongest
    895: "Ver después del ep. 81", // Tree of Might
    896: "Ver después del ep. 117", // Lord Slug
    984: "Ver después del ep. 124", // Cooler's Revenge
    1151: "Ver después del ep. 147", // Return of Cooler
    1163: "Ver después del ep. 175", // Super Android 13
    1164: "Ver después del ep. 191", // Broly Second Coming
    // Add more as needed
}

function getEntryEra(entry: Anime_LibraryCollectionEntry): EraTab {
    const media = entry.media
    if (!media) return "all"

    const title = (media.titleRomaji || media.titleEnglish || "").toLowerCase()
    const format = media.format

    if (format === "OVA" || format === "SPECIAL") {
        return "specials"
    }

    if (title.includes("super")) {
        return "super"
    }

    if (title.includes("z") || title.includes("kai") || title.includes("改造")) {
        return "z"
    }

    if (title.includes("dragon ball") && !title.includes("z") && !title.includes("super")) {
        return "classic"
    }

    return "all"
}

// ─── Component ────────────────────────────────────────────────────────────────

function MoviesPage() {
    const [search, setSearch] = useState("")
    const [activeEra, setActiveEra] = useState<EraTab>("all")
    const [sortBy, setSortBy] = useState<SortOption>("recently_add")

    const navigate = useNavigate()
    const { data: collection, isLoading } = useGetLibraryCollection()

    const allMovies = useMemo(() => {
        if (!collection?.lists) return []
        const rawMovies = collection.lists
            .flatMap((list) => list.entries || [])
            .filter((entry) => entry.media?.format === "MOVIE" || entry.media?.format === "OVA" || entry.media?.format === "SPECIAL")

        const unique = new Map<number, Anime_LibraryCollectionEntry>()
        rawMovies.forEach((m) => {
            if (m.mediaId) unique.set(m.mediaId, m)
        })
        return Array.from(unique.values())
    }, [collection])

    const filteredMovies = useMemo(() => {
        let result = allMovies

        if (activeEra !== "all") {
            result = result.filter((entry) => getEntryEra(entry) === activeEra)
        }

        if (search) {
            const searchLower = search.toLowerCase()
            result = result.filter((entry) => {
                const media = entry.media
                const title = media 
                    ? (media.titleRomaji || media.titleEnglish || media.titleOriginal || "")
                    : `Desconocido (${entry.mediaId})`
                
                return title.toLowerCase().includes(searchLower)
            })
        }

        return result
    }, [allMovies, activeEra, search])

    const sortedMovies = useMemo(() => {
        const movies = [...filteredMovies]

        switch (sortBy) {
            case "year_asc":
                return movies.sort((a, b) => (a.media?.year || 0) - (b.media?.year || 0))
            case "year_desc":
                return movies.sort((a, b) => (b.media?.year || 0) - (a.media?.year || 0))
            case "recently_add":
                return movies.sort((a, b) => {
                    const dateA = a.listData?.startedAt ? new Date(a.listData.startedAt).getTime() : 0
                    const dateB = b.listData?.startedAt ? new Date(b.listData.startedAt).getTime() : 0
                    return dateB - dateA
                })
            case "alpha":
                return movies.sort((a, b) => {
                    const titleA = a.media?.titleRomaji || a.media?.titleEnglish || ""
                    const titleB = b.media?.titleRomaji || b.media?.titleEnglish || ""
                    return titleA.localeCompare(titleB)
                })
            default:
                return movies
        }
    }, [filteredMovies, sortBy])

    const handleMovieClick = (mediaId: number) => {
        navigate({ to: "/series/$seriesId", params: { seriesId: String(mediaId) } })
    }

    return (
        <div className="flex-1 w-full min-h-screen bg-background text-white overflow-y-auto pb-32 font-sans selection:bg-brand-orange/30">
            <PageHeader
                title={
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                            <Clapperboard className="w-6 h-6 text-brand-orange animate-pulse" />
                            <span className="font-bebas text-4xl tracking-wider text-white">
                                PELÍCULAS Y ESPECIALES
                            </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
                            <span>{allMovies.length} Títulos</span>
                            <span className="w-1 h-1 rounded-full bg-zinc-800" />
                            <span className="text-green-500/60">
                                {allMovies.filter(m => (m.libraryData?.mainFileCount || 0) > 0).length} Locales
                            </span>
                        </div>
                    </div>
                }
                className="px-6 md:px-14 border-b border-white/5 bg-background/20 backdrop-blur-md"
            />

            {/* Sticky Glass Tabs Navigation */}
            <Tabs 
                value={activeEra} 
                onValueChange={(v) => setActiveEra(v as EraTab)} 
                className="sticky top-0 z-30 bg-background/40 backdrop-blur-md border-b border-white/5 shadow-lg"
            >
                <TabsList className="max-w-[1600px] mx-auto px-6 md:px-14 justify-start border-none h-14">
                    {ERA_TABS.map((tab) => {
                        const count = tab.value === "all" 
                            ? allMovies.length 
                            : allMovies.filter(m => getEntryEra(m) === tab.value).length
                        
                        return (
                            <TabsTrigger 
                                key={tab.value} 
                                value={tab.value}
                                className="text-xs uppercase tracking-widest font-black transition-all duration-300 border-b-2 border-transparent data-[state=active]:border-brand-orange data-[state=active]:text-brand-orange hover:text-white px-5 py-4 flex items-center gap-2"
                            >
                                {tab.label}
                                <span className="text-[9px] opacity-40">({count})</span>
                            </TabsTrigger>
                        )
                    })}
                </TabsList>
            </Tabs>

            {/* Controls Toolbar (Search and Sort Option) */}
            <div className="max-w-[1600px] mx-auto px-6 md:px-14 py-8 flex flex-wrap gap-4 items-center justify-between">
                <div className="relative w-full sm:w-80 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-brand-orange transition-colors duration-300 text-sm" />
                    <input
                        className="w-full pl-12 pr-4 py-2.5 bg-[#0a0e1a]/60 backdrop-blur-md border border-white/5 focus:border-brand-orange/50 rounded-xl text-sm outline-none transition-all duration-300 placeholder:text-zinc-600 uppercase tracking-widest focus:shadow-[0_0_20px_rgba(255,110,58,0.15)] focus:bg-[#0a0e1a]/80"
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="BUSCAR EN FILMOTECA..."
                    />
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/5 rounded-full backdrop-blur-md text-[9px] font-black uppercase tracking-widest text-zinc-400">
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>Ordenar</span>
                    </div>
                    <NativeSelect
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        options={SORT_OPTIONS}
                        className="w-full sm:w-56 bg-[#0a0e1a]/60 border-white/5 rounded-xl hover:bg-[#0a0e1a]/80 text-sm focus:border-brand-orange/50 transition-all text-white py-2.5 px-4 h-[42px]"
                    />
                </div>
            </div>

            {/* Grid display of Movie Cards */}
            <div className="max-w-[1600px] mx-auto px-6 md:px-14 pt-4">
                {isLoading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <MovieCardSkeleton key={i} />
                        ))}
                    </div>
                ) : sortedMovies.length === 0 ? (
                    <EmptyState
                        title="Sin coincidencias"
                        message="No hemos encontrado películas que coincidan con tu búsqueda actual."
                        illustration={<Clapperboard className="w-20 h-20 text-zinc-800" />}
                    />
                ) : (
                    <div className="flex flex-col gap-12">
                        {ERA_TABS.filter(t => t.value !== "all").map(era => {
                            const eraMovies = sortedMovies.filter(m => getEntryEra(m) === era.value)
                            if (eraMovies.length === 0 && activeEra !== "all") return null
                            if (eraMovies.length === 0) return null

                            const localCount = eraMovies.filter(m => (m.libraryData?.mainFileCount || 0) > 0).length
                            const watchedCount = eraMovies.filter(m => m.media?.watched).length

                            return (
                                <section key={era.value} className="flex flex-col gap-6">
                                    <div className="flex items-end justify-between border-b border-white/5 pb-4">
                                        <div className="flex flex-col gap-1">
                                            <h2 className="font-bebas text-4xl tracking-widest text-white uppercase leading-none">
                                                {era.label}
                                            </h2>
                                            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                                                <span>{eraMovies.length} Películas</span>
                                                <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                                <span className="text-brand-orange">{watchedCount} Vistas</span>
                                                <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                                <span className="text-green-500/60">{localCount} Locales</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                                        {eraMovies.map((entry) => (
                                            <MoviePosterCard
                                                key={entry.mediaId}
                                                entry={entry}
                                                onClick={() => handleMovieClick(entry.mediaId)}
                                            />
                                        ))}
                                    </div>
                                </section>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Movie Poster Card ────────────────────────────────────────────────────────

const MoviePosterCard = memo(function MoviePosterCard({
    entry,
    onClick,
}: {
    entry: Anime_LibraryCollectionEntry
    onClick: () => void
}) {
    const movie = entry.media
    if (!movie) return null

    const title = movie.titleEnglish || movie.titleRomaji || movie.titleOriginal || "Sin título"
    const hasLocalFiles = (entry.libraryData?.mainFileCount || 0) > 0
    const isWatched = movie.watched || (entry.listData?.progress || 0) >= (movie.totalEpisodes || 0)
    const watchAfter = WATCH_ORDER_MAP[movie.id] || WATCH_ORDER_MAP[entry.mediaId]

    return (
        <div className="flex flex-col gap-3 group">
            {/* Poster Container (2:3) */}
            <div 
                className={cn(
                    "relative aspect-[2/3] w-full overflow-hidden rounded-xl border transition-all duration-500",
                    "border-white/5 group-hover:border-brand-orange/40 group-hover:shadow-[0_0_30px_rgba(255,110,58,0.15)]",
                    !hasLocalFiles && "opacity-60"
                )}
                onClick={onClick}
            >
                <DeferredImage
                    src={movie.posterImage || ""}
                    alt={title}
                    className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
                    showSkeleton={false}
                />

                {/* Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80" />
                
                {/* Visual State Badges (Top) */}
                <div className="absolute top-3 left-3 flex flex-col gap-2 z-20">
                    {hasLocalFiles ? (
                        <span className="px-2 py-0.5 bg-green-500/20 backdrop-blur-md text-[8px] font-black text-green-500 tracking-widest uppercase border border-green-500/20 rounded">
                            LOCAL
                        </span>
                    ) : (
                        <span className="px-2 py-0.5 bg-red-500/20 backdrop-blur-md text-[8px] font-black text-red-500 tracking-widest uppercase border border-red-500/20 rounded">
                            FALTA
                        </span>
                    )}
                </div>

                <div className="absolute top-3 right-3 z-20">
                    <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center backdrop-blur-md border",
                        isWatched ? "bg-green-500 border-green-400 text-white" : "bg-black/40 border-white/10 text-white/40"
                    )}>
                        {isWatched ? (
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                            </svg>
                        ) : (
                            <span className="font-bold text-xs">-</span>
                        )}
                    </div>
                </div>

                {/* Watch Order Badge (Bottom) */}
                {watchAfter && (
                    <div className="absolute bottom-3 left-0 right-0 px-3 z-20">
                        <div className="bg-brand-orange/90 backdrop-blur-md px-2 py-1 rounded text-center border border-white/10 shadow-xl">
                            <span className="text-[8px] font-black text-white uppercase tracking-widest">
                                {watchAfter}
                            </span>
                        </div>
                    </div>
                )}

                {/* Hover Reveal Area */}
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 opacity-0 group-hover:opacity-100 transition-all duration-300 z-30 bg-black/60 backdrop-blur-[2px]">
                    <div className="text-center space-y-4">
                        <p className="text-[10px] text-zinc-300 font-medium leading-relaxed line-clamp-4 uppercase tracking-wide">
                            {movie.description?.replace(/<[^>]*>?/gm, '') || "Sin sinopsis disponible."}
                        </p>
                        <button 
                            disabled={!hasLocalFiles}
                            className={cn(
                                "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 shadow-2xl",
                                hasLocalFiles 
                                    ? "bg-white text-black hover:scale-110 hover:bg-brand-orange hover:text-white" 
                                    : "bg-white/10 text-white/20 cursor-not-allowed"
                            )}
                        >
                            <svg className="w-5 h-5 fill-current ml-1" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Bottom Info */}
            <div className="flex flex-col gap-1 px-0.5">
                <h3 className="text-[13px] font-bebas text-white tracking-[0.05em] group-hover:text-brand-orange transition-colors duration-300 uppercase truncate">
                    {title}
                </h3>
                <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">
                    <span>{movie.year}</span>
                    <span className="w-1 h-1 rounded-full bg-zinc-800" />
                    <span>{movie.runtime || "???"} MIN</span>
                </div>
            </div>
        </div>
    )
})
MoviePosterCard.displayName = "MoviePosterCard"

// ─── Skeleton ──────────────────────────────────────────────────────────────

const MovieCardSkeleton = memo(function MovieCardSkeleton() {
    return (
        <div className="flex flex-col gap-3 animate-pulse">
            <div className="aspect-[2/3] w-full bg-zinc-900/60 rounded-xl border border-white/5" />
            <div className="space-y-2">
                <div className="h-4 w-5/6 bg-zinc-900/60 rounded" />
                <div className="h-3 w-1/2 bg-zinc-900/60 rounded" />
            </div>
        </div>
    )
})