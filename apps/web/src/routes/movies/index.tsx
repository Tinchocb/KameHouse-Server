import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo, useEffect, useCallback } from "react"
import { useDebounce } from "use-debounce"
import { useGetLibraryCollection, fetchLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { useGetContinuityWatchHistory } from "@/api/hooks/continuity.hooks"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import type { Anime_LibraryCollectionEntry } from "@/api/generated/types"
import { isTmdbId } from "@/lib/helpers/type-guards"
import type { EraId } from "@/lib/config/eras"
import type { EraTab } from "./-MovieCard"
import { SortOption, getEntryEra, getEntryEraId, getReleaseDateTimestamp, getEntryTitle, getEntryRating, mapCollectionSortToOption, getMovieLore } from "./-components/movies-utils"
import { MoviesHero } from "./-components/movies-hero"
import { MoviesFilterBar, type MovieStatusFilter } from "./-components/movies-filter-bar"
import { MoviesGrid } from "./-components/movies-grid"
import { LibraryBanner } from "./-components/library-banner"
import { useThemeSettings } from "@/lib/theme/theme-hooks"
import { getLargeResImage } from "@/lib/helpers/images"
import { AppErrorBoundary } from "@/components/shared/app-error-boundary"
import { SectionBar } from "@/components/ui/sectionbar/sectionbar"
import { IconNavigationFilm } from "@/components/ui/icons";
import { useSound } from "@/hooks/use-sound"
import type { SwimlaneItem } from "@/components/ui/swimlane"

// Blur del fondo personalizado de biblioteca (Settings → Apariencia)
const LIBRARY_BG_BLUR_PX: Record<string, number> = { none: 0, sm: 8, md: 16, lg: 32 }

export type MovieEntry = Anime_LibraryCollectionEntry & { era: EraTab; eraId: EraId; startedAtTimestamp: number }

export const Route = createFileRoute("/movies/")({
    loader: async ({ context }) => {
        const qc = context.queryClient
        await qc.ensureQueryData({
            queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key],
            queryFn: fetchLibraryCollection,
        })
    },
    component: MoviesPage,
    errorComponent: AppErrorBoundary,
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

    // Debounce hover so backdrop doesn't flicker on fast cursor moves
    useEffect(() => {
        const t = setTimeout(() => setDebouncedMovie(hoveredMovie), 160)
        return () => clearTimeout(t)
    }, [hoveredMovie])

    const allMovies: MovieEntry[] = useMemo(() => {
        if (!collection?.lists) return []
        const allEntries = collection.lists.flatMap(l => l.entries || [])
        const rawMovies = allEntries.filter(e => {
            const fmt = e.media?.format
            const type = e.media?.type
            return fmt === "MOVIE" || fmt === "OVA" || fmt === "SPECIAL" || type?.toUpperCase() === "MOVIE" || isTmdbId(e.mediaId)
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
            bucket.movies.push({
                id: `media-${m.mediaId}`,
                mediaId: m.mediaId ?? undefined,
                tmdbId: m.media?.tmdbId ?? undefined,
                title: getEntryTitle(m),
                image: m.media?.posterImage || "",
                year: m.media?.year,
                badge: m.media?.format || "MOVIE",
                onClick: () => {},
            })
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
        let result = activeEra === "all" ? allMovies : allMovies.filter(e => e.eraId === activeEra)

        if (debouncedSearchQuery.trim()) {
            const query = debouncedSearchQuery.toLowerCase().trim()
            result = result.filter(e => {
                const media = e.media
                if (!media) return false
                const titleSpanish = (media.titleSpanish || "").toLowerCase()
                const titleEnglish = (media.titleEnglish || "").toLowerCase()
                const titleRomaji = (media.titleRomaji || "").toLowerCase()
                const titleOriginal = (media.titleOriginal || "").toLowerCase()
                const loreTitle = (getMovieLore(e)?.title || "").toLowerCase()
                return titleSpanish.includes(query) || loreTitle.includes(query) || titleEnglish.includes(query) || titleRomaji.includes(query) || titleOriginal.includes(query)
            })
        }

        if (statusFilter === "completed") {
            result = result.filter(e => {
                const media = e.media
                return media?.watched || (e.listData?.progress || 0) >= (media?.totalEpisodes || 1)
            })
        } else if (statusFilter === "unwatched") {
            result = result.filter(e => {
                const media = e.media
                return !media?.watched && (e.listData?.progress || 0) < (media?.totalEpisodes || 1)
            })
        }

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
                return [...result].sort((a, b) => getEntryTitle(a).localeCompare(getEntryTitle(b)))
            case "alpha_desc":
                return [...result].sort((a, b) => getEntryTitle(b).localeCompare(getEntryTitle(a)))
            case "rating_desc":
                return [...result].sort((a, b) => getEntryRating(b) - getEntryRating(a))
            default:
                return result
        }
    }, [allMovies, activeEra, statusFilter, sortBy, debouncedSearchQuery])

    // Limpiar hover al cambiar de era (useEffect, no durante render)
    useEffect(() => {
        setHoveredMovie(null)
        setDebouncedMovie(null)
    }, [activeEra])

    // Lista de películas para el Hero: todas las películas disponibles en orden cronológico
    const topFeatured = useMemo(() => {
        if (filteredSorted.length > 0) return filteredSorted
        return allMovies
    }, [filteredSorted, allMovies])

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
                />
            ) : (
                <LibraryBanner />
            )}

            <div className="page-container mt-6 space-y-6">
                <SectionBar label="Películas de Dragon Ball" icon={IconNavigationFilm} variant="minimal" badge={<span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--glass-bg)] text-on-surface-variant border border-[var(--glass-border-side)]">{filteredSorted.length}</span>}>
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
