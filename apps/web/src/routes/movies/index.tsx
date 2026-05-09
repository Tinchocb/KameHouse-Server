import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo, memo } from "react"
import { Clapperboard, Search, SortDesc, SlidersHorizontal } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
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

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Map Entries to Era ───────────────────────────────────────────────────────

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
                    <div className="flex items-center gap-3">
                        <Clapperboard className="w-6 h-6 text-brand-orange animate-pulse" />
                        <span className="font-bebas text-3xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-zinc-400">
                            PELÍCULAS Y ESPECIALES
                        </span>
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
                    {ERA_TABS.map((tab) => (
                        <TabsTrigger 
                            key={tab.value} 
                            value={tab.value}
                            className="text-xs uppercase tracking-widest font-black transition-all duration-300 border-b-2 border-transparent data-[state=active]:border-brand-orange data-[state=active]:text-brand-orange hover:text-white px-5 py-4"
                        >
                            {tab.label}
                        </TabsTrigger>
                    ))}
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-12">
                        {Array.from({ length: 12 }).map((_, i) => (
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {sortedMovies.map((entry) => (
                            <MovieCard
                                key={entry.mediaId}
                                entry={entry}
                                onClick={() => handleMovieClick(entry.mediaId)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Movie Card ────────────────────────────────────────────────────────────────

const MovieCard = memo(function MovieCard({
    entry,
    onClick,
}: {
    entry: Anime_LibraryCollectionEntry
    onClick: () => void
}) {
    const movie = entry.media

    if (!movie) return null

    const isCompleted = (entry.listData?.progress || 0) >= (movie.totalEpisodes || 0) && (movie.totalEpisodes || 0) > 0
    const progressPercent = movie.totalEpisodes && movie.totalEpisodes > 0 && entry.listData?.progress
        ? (entry.listData.progress / movie.totalEpisodes) * 100
        : undefined

    const title = movie.titleEnglish || movie.titleRomaji || movie.titleOriginal || "Sin título"

    const hasLocalFiles = (entry.libraryData?.mainFileCount || 0) > 0
    const availabilityType = hasLocalFiles ? "FULL_LOCAL" : "ONLY_ONLINE"

    return (
        <div className="flex flex-col gap-4 group">
            <div className="relative rounded-2xl overflow-hidden transition-transform duration-300 hover:scale-[1.03]">
                <MediaCard
                    artwork={movie.posterImage || ""}
                    title={title}
                    badge={movie.format === "MOVIE" ? "PELÍCULA" : movie.format === "OVA" ? "OVA" : movie.format === "SPECIAL" ? "ESPECIAL" : undefined}
                    year={movie.year}
                    rating={
                        movie.score
                            ? movie.score > 10
                                ? movie.score / 10
                                : movie.score
                            : undefined
                    }
                    aspect="poster"
                    progress={progressPercent}
                    progressColor="white"
                    onClick={onClick}
                    availabilityType={availabilityType}
                    className="w-full border border-white/5 rounded-2xl shadow-lg"
                />

                {isCompleted && (
                    <div className="absolute bottom-4 left-3 z-30 flex items-center gap-1 px-2.5 py-1 bg-green-950/80 backdrop-blur-md border border-green-500/30 rounded-lg">
                        <span className="text-[8px] font-black text-green-400 uppercase tracking-widest">
                            Completado
                        </span>
                    </div>
                )}
            </div>

            <div className="px-1 space-y-2">
                <h3 className="text-[12px] font-black text-white group-hover:text-brand-orange transition-colors duration-300 line-clamp-2 leading-tight uppercase tracking-tight">
                    {title}
                </h3>
                <div className="flex items-center gap-3">
                    <span className="text-[9px] font-bold text-brand-orange/90 uppercase tracking-[0.15em] bg-brand-orange/5 px-2 py-0.5 rounded border border-brand-orange/10">
                        {movie.genres?.[0] || "Anime"}
                    </span>
                    {movie.totalEpisodes && movie.totalEpisodes > 1 && (
                        <span className="text-[9px] font-bold text-zinc-500 tabular-nums uppercase tracking-widest">
                            {movie.totalEpisodes} EPS
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
})

// ─── Skeleton ──────────────────────────────────────────────────────────────

const MovieCardSkeleton = memo(function MovieCardSkeleton() {
    return (
        <div className="flex flex-col gap-4 animate-pulse">
            <div className="aspect-[2/3] w-full bg-zinc-900/60 border border-white/5 rounded-2xl shadow-xl" />
            <div className="px-1 space-y-3">
                <div className="h-4 w-5/6 bg-zinc-900/60 rounded-md" />
                <div className="flex items-center gap-3">
                    <div className="h-3.5 w-16 bg-zinc-900/60 rounded-md" />
                    <div className="h-3.5 w-8 bg-zinc-900/60 rounded-md" />
                </div>
            </div>
        </div>
    )
})