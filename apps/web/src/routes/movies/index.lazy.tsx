import { createLazyFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo, useEffect, useCallback } from "react"
import { useDebounce } from "use-debounce"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { useGetContinuityWatchHistory } from "@/api/hooks/continuity.hooks"
import type { Anime_LibraryCollectionEntry } from "@/api/generated/types"
import { KNOWN_MOVIE_TMDB_IDS, type EraId } from "@/lib/config/eras"
import type { EraTab } from "./-MovieCard"
import { SortOption, getEntryEra, getEntryEraId, getReleaseDateTimestamp, getEntryTitle, getEntryRating, mapCollectionSortToOption, getMovieLore } from "./-components/movies-utils"
import { MoviesHero } from "./-components/movies-hero"
import { MoviesFilterBar, type MovieStatusFilter } from "./-components/movies-filter-bar"
import { MoviesGrid } from "./-components/movies-grid"
import { LibraryBanner } from "./-components/library-banner"
import { useThemeSettings } from "@/lib/theme/theme-hooks"
import { getLargeResImage } from "@/lib/helpers/images"
import { SectionBar } from "@/components/ui/sectionbar/sectionbar"
import { IconNavigationFilm } from "@/components/ui/icons";
import { useSound } from "@/hooks/use-sound"
import type { SwimlaneItem } from "@/components/ui/swimlane"
import { getSafeCollectionEntries } from "@/lib/helpers/collection"
import { getMovieWidescreenBackdrop } from "@/lib/config/hero-art"

// Blur del fondo personalizado de biblioteca (Settings → Apariencia)
const LIBRARY_BG_BLUR_PX: Record<string, number> = { none: 0, sm: 8, md: 16, lg: 32 }

export type MovieEntry = Anime_LibraryCollectionEntry & { era: EraTab; eraId: EraId; startedAtTimestamp: number }

// Collator para orden alfabético en español cacheado a nivel de módulo
const SPANISH_COLLATOR = new Intl.Collator("es", { sensitivity: "base", numeric: true })

export const Route = createLazyFileRoute("/movies/")({
    component: MoviesPage,
})

function MoviesPage() {
    const [activeEra, setActiveEra] = useState<EraId | "all">("all")
    const [statusFilter, setStatusFilter] = useState<MovieStatusFilter>("all")
    const navigate = useNavigate()
    const ts = useThemeSettings()
    const { playSound } = useSound()

    // Default vivo desde Settings (llega async): userSort manda cuando el
    // usuario elige manualmente en la filter-bar; null = seguir al ajuste.
    const defaultSort = mapCollectionSortToOption(ts.themeAnimeLibraryCollectionDefaultSorting)
    const [userSort, setUserSort] = useState<SortOption | null>(null)
    const sortBy: SortOption = userSort ?? defaultSort
    const handleSortChange = useCallback((v: SortOption) => setUserSort(v), [])
    const [searchQuery, setSearchQuery] = useState("")
    const [debouncedSearchQuery] = useDebounce(searchQuery, 200)

    const [hoveredMovie, setHoveredMovie] = useState<MovieEntry | null>(null)
    const [debouncedMovie, setDebouncedMovie] = useState<MovieEntry | null>(null)

    const { data: collection, isLoading } = useGetLibraryCollection()
    const { data: watchHistory } = useGetContinuityWatchHistory()

    // Asymmetric intent debounce: 80ms on hover entry (responsive, filters fast traversal),
    // 150ms on hover exit (prevents backdrop snap between adjacent cards)
    useEffect(() => {
        const delay = hoveredMovie ? 80 : 150
        const t = setTimeout(() => setDebouncedMovie(hoveredMovie), delay)
        return () => clearTimeout(t)
    }, [hoveredMovie])

    const allMovies: MovieEntry[] = useMemo(() => {
        if (!collection?.lists) return []
        const allEntries = getSafeCollectionEntries(collection)
        const rawMovies = allEntries.filter(e => {
            if (!e) return false
            const fmt = e?.media?.format
            const type = e?.media?.type
            if (fmt === "TV") return false

            // Exclude empty/generic zombie placeholder fallbacks without cover image
            const spanish = (e.media?.titleSpanish || "").toLowerCase().trim()
            const english = (e.media?.titleEnglish || "").toLowerCase().trim()
            const isGenericTitle = spanish === "dragon ball serie" || spanish === "dragon ball series" || english === "dragon ball series"
            const hasCover = !!(e.media?.posterImage || e.media?.bannerImage)
            if (isGenericTitle && !hasCover) {
                return false
            }
            // Defense against false positive Dark Nature horror film collision
            if (spanish === "dark nature" || english === "dark nature") {
                return false
            }

            const isMovieFmt = fmt === "MOVIE" || fmt === "OVA" || fmt === "SPECIAL" || type?.toUpperCase() === "MOVIE"
            if (isMovieFmt) return true
            const id = e.mediaId ?? 0
            const rawId = id >= 1000000 ? id - 1000000 : id
            return KNOWN_MOVIE_TMDB_IDS.has(id) || KNOWN_MOVIE_TMDB_IDS.has(rawId)
        })
        const unique = new Map<number, Anime_LibraryCollectionEntry>()
        rawMovies.forEach(m => { if (m.mediaId) unique.set(m.mediaId, m) })
        const mapped: MovieEntry[] = Array.from(unique.values()).map(entry => {
            const startedAt = entry.listData?.startedAt
            return { ...entry, era: getEntryEra(entry), eraId: getEntryEraId(entry), startedAtTimestamp: startedAt ? new Date(startedAt).getTime() : 0 }
        })

        // Orden inicial cronológico por fecha de estreno
        return mapped.sort((a, b) => {
            const dateA = getReleaseDateTimestamp(a)
            const dateB = getReleaseDateTimestamp(b)
            if (dateA && dateB && dateA !== dateB) return dateA - dateB
            return (a.media?.year || 0) - (b.media?.year || 0)
        })
    }, [collection])

    // Pre-computar índice de búsqueda plano para no recalcular toLowerCase() ni getMovieLore en cada pulsación
    const searchIndex = useMemo(() => {
        return allMovies.map(movie => {
            const media = movie.media
            const titleSpanish = (media?.titleSpanish || "").toLowerCase()
            const titleEnglish = (media?.titleEnglish || "").toLowerCase()
            const titleRomaji = (media?.titleRomaji || "").toLowerCase()
            const titleOriginal = (media?.titleOriginal || "").toLowerCase()
            const loreTitle = (getMovieLore(movie)?.title || "").toLowerCase()
            const hay = `${titleSpanish} ${loreTitle} ${titleEnglish} ${titleRomaji} ${titleOriginal}`
            return { movie, hay }
        })
    }, [allMovies])

    // Datos categorizados para SpotlightEraNav (paridad total con Home):
    // series=null (Movies no tiene serie principal), movies por EraId canónica.
    const categorizedData = useMemo(() => {
        const result: Record<EraId, { series: SwimlaneItem | null; movies: SwimlaneItem[] }> = {
            db: { series: null, movies: [] },
            dbz: { series: null, movies: [] },
            dbgt: { series: null, movies: [] },
            dbkai: { series: null, movies: [] },
            dbs: { series: null, movies: [] },
            dbdaima: { series: null, movies: [] },
        }
        for (const m of allMovies) {
            const bucket = result[m.eraId]
            if (!bucket) continue
            const swimlaneItem: SwimlaneItem = {
                id: `media-${m.mediaId}`,
                mediaId: m.mediaId ?? undefined,
                tmdbId: m.media?.tmdbId ?? undefined,
                title: getEntryTitle(m),
                image: m.media?.posterImage || "",
                backdropUrl: getMovieWidescreenBackdrop({
                    mediaId: m.mediaId,
                    tmdbId: m.media?.tmdbId,
                    bannerImage: m.media?.bannerImage,
                    posterImage: m.media?.posterImage,
                }) || undefined,
                year: m.media?.year,
                badge: m.media?.format || "MOVIE",
                onClick: () => {},
            }
            bucket.movies.push(swimlaneItem)
            if (m.eraId === "dbz") {
                result.dbkai.movies.push(swimlaneItem)
            }
        }
        return result
    }, [allMovies])

    const handleEraSelect = useCallback((eraId: EraId) => {
        playSound("category")
        setActiveEra(prev => (prev === eraId ? "all" : eraId))
    }, [playSound])

    const handleHoverSound = useCallback(() => {
        playSound("hover")
    }, [playSound])

    const filteredSorted = useMemo(() => {
        const query = debouncedSearchQuery.toLowerCase().trim()

        // 1. Filtrado rápido usando el índice memoizado
        const matchingEntries = searchIndex.filter(({ movie, hay }) => {
            if (activeEra !== "all") {
                if (activeEra === "dbkai") {
                    if (movie.eraId !== "dbz" && movie.eraId !== "dbkai") return false
                } else if (movie.eraId !== activeEra) {
                    return false
                }
            }

            if (query && !hay.includes(query)) return false

            if (statusFilter === "completed") {
                const media = movie.media
                return media?.watched || (movie.listData?.progress || 0) >= (media?.totalEpisodes || 1)
            }
            if (statusFilter === "unwatched") {
                const media = movie.media
                return !media?.watched && (movie.listData?.progress || 0) < (media?.totalEpisodes || 1)
            }

            return true
        })

        const result = matchingEntries.map(e => e.movie)

        // 2. Si el ordenamiento es default (ya ordenado por release date en allMovies), evitamos el .sort()
        switch (sortBy) {
            case "year_asc":
                return [...result].sort((a, b) => {
                    const dateA = getReleaseDateTimestamp(a)
                    const dateB = getReleaseDateTimestamp(b)
                    if (dateA && dateB && dateA !== dateB) return dateA - dateB
                    return (a.media?.year || 0) - (b.media?.year || 0)
                })
            case "year_desc":
                return [...result].sort((a, b) => {
                    const dateA = getReleaseDateTimestamp(a)
                    const dateB = getReleaseDateTimestamp(b)
                    if (dateA && dateB && dateA !== dateB) return dateB - dateA
                    return (b.media?.year || 0) - (a.media?.year || 0)
                })
            case "alpha_asc":
                return [...result].sort((a, b) => SPANISH_COLLATOR.compare(getEntryTitle(a), getEntryTitle(b)))
            case "alpha_desc":
                return [...result].sort((a, b) => SPANISH_COLLATOR.compare(getEntryTitle(b), getEntryTitle(a)))
            case "rating_desc":
                return [...result].sort((a, b) => getEntryRating(b) - getEntryRating(a))
            default:
                return result
        }
    }, [searchIndex, activeEra, statusFilter, sortBy, debouncedSearchQuery])

    // Limpiar hover al cambiar de era durante el render
    const [prevActiveEra, setPrevActiveEra] = useState(activeEra)
    if (activeEra !== prevActiveEra) {
        setPrevActiveEra(activeEra)
        setHoveredMovie(null)
        setDebouncedMovie(null)
    }

    // Lista de películas para el Hero: sigue el filtro activo sin fallback
    const topFeatured = filteredSorted

    const handleMovieClick = useCallback((mediaId: number) => {
        navigate({ to: "/movies/$movieId", params: { movieId: String(mediaId) } })
    }, [navigate])

    const handleHoverCard = useCallback((entry: MovieEntry | null) => {
        setHoveredMovie(entry)
    }, [])

    return (
        <div className="min-h-screen text-on-surface overflow-x-hidden selection:bg-brand-accent/30 relative z-10 bg-transparent">

            {/* Fondo personalizado de biblioteca (Settings → Apariencia → Pantalla de Biblioteca) */}
            {ts.themeLibraryScreenCustomBackgroundImage && (
                <div className="fixed inset-0 pointer-events-none" aria-hidden>
                    <img
                        src={getLargeResImage(ts.themeLibraryScreenCustomBackgroundImage)}
                        alt=""
                        className="w-full h-full object-cover"
                        style={{
                            opacity: (ts.themeLibraryScreenCustomBackgroundOpacity ?? 10) / 100,
                            filter: LIBRARY_BG_BLUR_PX[ts.themeLibraryScreenCustomBackgroundBlur || "none"]
                                ? `blur(${LIBRARY_BG_BLUR_PX[ts.themeLibraryScreenCustomBackgroundBlur || "none"]}px)`
                                : undefined,
                        }}
                    />
                </div>
            )}

            {ts.themeLibraryScreenBannerType === "dynamic" || !ts.themeLibraryScreenBannerType ? (
                <MoviesHero
                    topFeatured={topFeatured}
                    debouncedMovie={debouncedMovie}
                    handleMovieClick={handleMovieClick}
                    watchHistory={watchHistory}
                    activeEraId={activeEra}
                    categorizedData={categorizedData}
                    onSelectEra={handleEraSelect}
                    onHoverSound={handleHoverSound}
                    isLoading={isLoading}
                />
            ) : (
                <LibraryBanner />
            )}

            <div className="page-container mt-6 space-y-6">
                <SectionBar
                    label="Películas de Dragon Ball"
                    icon={IconNavigationFilm}
                    variant="minimal"
                    badge={
                        <span className="px-2 py-0.5 rounded-full text-3xs font-mono font-bold bg-[var(--glass-bg)] text-on-surface-variant border border-[var(--glass-border-side)]">
                            {filteredSorted.length === allMovies.length ? `${allMovies.length} títulos` : `${filteredSorted.length} de ${allMovies.length}`}
                        </span>
                    }
                >
                    <MoviesFilterBar
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        statusFilter={statusFilter}
                        setStatusFilter={setStatusFilter}
                        sortBy={sortBy}
                        setSortBy={handleSortChange}
                        totalCount={allMovies.length}
                        filteredCount={filteredSorted.length}
                    />

                    <MoviesGrid
                        filteredSorted={filteredSorted}
                        isLoading={isLoading}
                        allMoviesLength={allMovies.length}
                        watchHistory={watchHistory}
                        handleMovieClick={handleMovieClick}
                        handleHoverCard={handleHoverCard}
                        activeEra={activeEra}
                        searchQuery={searchQuery}
                        onResetFilters={() => {
                            setActiveEra("all")
                            setSearchQuery("")
                            setStatusFilter("all")
                            setUserSort(null)
                        }}
                    />
                </SectionBar>
            </div>

        </div>
    )
}
