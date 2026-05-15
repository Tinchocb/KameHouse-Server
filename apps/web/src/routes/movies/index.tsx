import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo, memo } from "react"
import { Clapperboard, SlidersHorizontal } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { NativeSelect } from "@/components/ui/native-select"
import { EmptyState } from "@/components/shared/empty-state"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import type { Anime_LibraryCollectionEntry } from "@/api/generated/types"
import { cn } from "@/components/ui/core/styling"
import { Play } from "lucide-react"
import { DeferredImage } from "@/components/shared/deferred-image"
import { getHighResImage } from "@/lib/helpers/images"

export const Route = createFileRoute("/movies/")({
    component: MoviesPage,
})

// ─── Constants & Data ────────────────────────────────────────────────────────

type EraTab = "all" | "classic" | "z" | "super" | "gt" | "specials"

type SortOption = "year_asc" | "year_desc" | "recently_add" | "alpha"

const ERA_TABS: { value: EraTab; label: string }[] = [
    { value: "all", label: "Todas" },
    { value: "classic", label: "Dragon Ball" },
    { value: "z", label: "Dragon Ball Z" },
    { value: "gt", label: "Dragon Ball GT" },
    { value: "super", label: "Dragon Ball Super" },
    { value: "specials", label: "Especiales y OVAs" },
]

const SAGA_CONFIG: Record<EraTab, { name: string; color: string }> = {
    all: { name: "Todas", color: "#ff6b00" },
    super: { name: "Dragon Ball Super", color: "#9b59b6" },
    z: { name: "Dragon Ball Z", color: "#e74c3c" },
    gt: { name: "Dragon Ball GT", color: "#3498db" },
    classic: { name: "Dragon Ball", color: "#e07030" },
    specials: { name: "Especiales y OVAs", color: "#1abc9c" }
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: "year_asc", label: "Año (Más antiguo)" },
    { value: "year_desc", label: "Año (Más reciente)" },
    { value: "recently_add", label: "Agregado recientemente" },
    { value: "alpha", label: "Alfabético" },
]


function getEntryEra(entry: Anime_LibraryCollectionEntry): EraTab {
    const media = entry.media
    if (!media) return "specials"

    // Check all title variants including Spanish
    const allTitles = [
        media.titleRomaji,
        media.titleEnglish,
        media.titleOriginal,
        media.titleSpanish,
    ].filter(Boolean).join(" ").toLowerCase()

    // Super must come first (contains "super" and "dragon ball")
    if (allTitles.includes("super")) return "super"

    // GT detection
    if (allTitles.includes(" gt") || allTitles.includes("gt ")) return "gt"

    // DBZ detection — look for " z" as word boundary, common Spanish keywords
    const isZ = allTitles.includes(" z ") || allTitles.includes(" z:") || 
                 allTitles.includes("kai") || allTitles.includes("改") ||
                 // Spanish-specific DBZ movie keywords
                 allTitles.includes("freezer") || allTitles.includes("frieza") ||
                 allTitles.includes("cooler") || allTitles.includes("androide") ||
                 allTitles.includes("android") || allTitles.includes("bojack") ||
                 allTitles.includes("janemba") || allTitles.includes("tapion") ||
                 allTitles.includes("bardock") || allTitles.includes("trunks") ||
                 allTitles.includes("broly") || allTitles.includes("slug") ||
                 allTitles.includes("turles") || allTitles.includes("dead zone") ||
                 allTitles.includes("fusion") || allTitles.includes("bio-broly") ||
                 allTitles.includes("gohan") || allTitles.includes("vegeta") ||
                 // Year clue: all Z movies are 1989–2013
                 (media.year != null && media.year >= 1989 && media.year <= 2013 && 
                  allTitles.includes("dragon ball"))
    if (isZ) return "z"

    // Classic Dragon Ball (1986-1988 movies, El Camino 1996)
    if (allTitles.includes("dragon ball")) return "classic"

    // True OVAs/Specials (format from API + no DB keyword) go to specials
    if (media.format === "OVA" || media.format === "SPECIAL") return "specials"

    return "specials"
}

// ─── Component ────────────────────────────────────────────────────────────────

function MoviesPage() {
    const [activeEra, setActiveEra] = useState<EraTab>("all")
    const [sortBy, setSortBy] = useState<SortOption>("year_asc")

    const navigate = useNavigate()
    const { data: collection, isLoading } = useGetLibraryCollection()

    const allMovies = useMemo(() => {
        if (!collection?.lists) return []

        const allEntries = collection.lists.flatMap((list) => list.entries || [])

        const rawMovies = allEntries.filter((entry) => {
            const format = entry.media?.format
            const type = entry.media?.type
            return (
                format === "MOVIE" || format === "OVA" || format === "SPECIAL" ||
                type?.toUpperCase() === "MOVIE" ||
                (entry.mediaId && entry.mediaId >= 1000000)
            )
        })

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

        return result
    }, [allMovies, activeEra])

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
            <div className="relative z-10">
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
            <div className="max-w-[1600px] mx-auto px-6 md:px-14 py-8 flex flex-wrap gap-4 items-center justify-end">

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

            {/* Saga-grouped Content */}
            <div className="max-w-[1600px] mx-auto px-6 md:px-14 pt-4">
                {isLoading ? (
                    <div className="space-y-12">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="space-y-4">
                                <div className="h-6 w-48 bg-zinc-900 rounded animate-pulse" />
                                <div className="flex gap-4 overflow-hidden">
                                    {[1, 2, 3, 4, 5, 6].map(j => (
                                        <div key={j} className="w-[120px] aspect-[2/3] bg-zinc-900 rounded-lg animate-pulse shrink-0" />
                                    ))}
                                </div>
                            </div>
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
                            if (activeEra !== "all" && activeEra !== era.value) return null
                            if (eraMovies.length === 0) return null

                            const config = SAGA_CONFIG[era.value as EraTab]

                            return (
                                <div key={era.value} className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1 h-5 rounded-full" style={{ backgroundColor: config.color }} />
                                        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/70">
                                            {config.name}
                                        </h2>
                                        <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                                            {eraMovies.length} Títulos
                                        </span>
                                    </div>

                                    <div className="flex gap-5 overflow-x-auto pb-6 no-scrollbar snap-x">
                                        {eraMovies.map((entry) => (
                                            <MoviePosterCard
                                                key={entry.mediaId}
                                                entry={entry}
                                                color={config.color}
                                                onClick={() => handleMovieClick(entry.mediaId)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
            </div>
        </div>
    )
}

// ─── Movie Poster Card ────────────────────────────────────────────────────────

const MoviePosterCard = memo(function MoviePosterCard({
    entry,
    color,
    onClick,
}: {
    entry: Anime_LibraryCollectionEntry
    color?: string
    onClick: () => void
}) {
    const movie = entry.media
    if (!movie) return null

    const title = movie.titleSpanish || movie.titleEnglish || movie.titleRomaji || "Sin título"
    const hasLocalFiles = (entry.libraryData?.mainFileCount || 0) > 0
    const isWatched = movie.watched || (entry.listData?.progress || 0) >= (movie.totalEpisodes || 0)

    return (
        <div className="group relative shrink-0 w-[120px] snap-start">
            {/* Tooltip on Hover */}
            <div className="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 w-[220px] p-4 bg-[#12151c]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 z-50">
                <h4 className="text-xs font-black uppercase text-white mb-1 line-clamp-2 leading-tight tracking-wide">{title}</h4>
                <div className="flex items-center gap-2 text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
                    <span>{movie.year}</span>
                    <span className="w-1 h-1 rounded-full bg-zinc-800" />
                    <span>{movie.runtime || "???"} MIN</span>
                </div>
                <button 
                    onClick={(e) => { e.stopPropagation(); onClick(); }}
                    className="w-full py-2 bg-brand-orange hover:bg-brand-orange/80 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 pointer-events-auto"
                >
                    <Play className="w-3 h-3 fill-current" />
                    Ver ahora
                </button>
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#12151c]/95" />
            </div>

            <div 
                className="flex flex-col gap-3 cursor-pointer"
                onClick={onClick}
            >
                {/* Poster Container */}
                <div 
                    className={cn(
                        "relative aspect-[2/3] w-full overflow-hidden rounded-xl border transition-all duration-300",
                        "border-white/5 group-hover:border-brand-orange/40 group-hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)]",
                        !hasLocalFiles && "grayscale opacity-50"
                    )}
                    style={{ backgroundColor: `${color}10` }}
                >
                    <DeferredImage
                        src={getHighResImage(movie.posterImage || "")}
                        alt={title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        showSkeleton={false}
                    />

                    {/* Badge LOC */}
                    {hasLocalFiles && (
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-sm bg-black/60 backdrop-blur-md border border-white/10 text-[7px] font-black text-white/70 uppercase tracking-widest">
                            LOC
                        </div>
                    )}

                    {/* Watched Badge */}
                    {isWatched && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white shadow-lg">
                            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                            </svg>
                        </div>
                    )}

                    {/* Hover Tint */}
                    <div className="absolute inset-0 bg-brand-orange/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>

                {/* Info */}
                <div className="flex flex-col gap-1 min-w-0">
                    <h3 className="text-[10px] font-bold text-white/90 uppercase tracking-wide truncate group-hover:text-brand-orange transition-colors">
                        {title}
                    </h3>
                    <div className="text-[9px] font-medium text-zinc-500 tabular-nums">
                        {movie.year} · {movie.runtime || "???"}m
                    </div>
                </div>
            </div>
        </div>
    )
})
MoviePosterCard.displayName = "MoviePosterCard"

// ─── Skeleton ──────────────────────────────────────────────────────────────
