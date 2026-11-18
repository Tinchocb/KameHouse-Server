import { createLazyFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { useGetContinuityWatchHistory } from "@/api/hooks/continuity.hooks"
import type { Anime_LibraryCollectionEntry } from "@/api/generated/types"
import { useScreenEra } from "@/lib/theme/screen-era"
import { ERAS, KNOWN_MOVIE_TMDB_IDS, themeEraFromEraId, type EraId } from "@/lib/config/eras"
import {
    SortOption, type MovieStatus, getEntryEra, getEntryEraId, getReleaseDateTimestamp, getEntryTitle, getEntryRating,
    mapCollectionSortToOption, getMovieStatus, gridHeading, loadMoviesPrefs, saveMoviesPrefs,
} from "./-components/movies-utils"
import { getAddedBaseline } from "./-components/movies-added"
import { MoviesRows } from "./-components/movies-rows"
import { MoviesHero } from "./-components/movies-hero"
import { MoviesFilterBar } from "./-components/movies-filter-bar"
import { MoviesGrid } from "./-components/movies-grid"
import { LibraryErrorState } from "@/components/shared/library-error-state"
import { LibraryBanner } from "./-components/library-banner"
import { useThemeSettings } from "@/lib/theme/theme-hooks"
import { getLargeResImage } from "@/lib/helpers/images"
import { SectionBar } from "@/components/ui/sectionbar/sectionbar"
import { ElasticCounter } from "@/components/ui/kinetics/elastic-counter"
import { DeferredMount } from "@/components/shared/deferred-mount"
import { IconNavigationFilm } from "@/components/ui/icons";
import { useSound } from "@/hooks/use-sound"
import type { SwimlaneItem } from "@/components/ui/swimlane"
import { getSafeCollectionEntries } from "@/lib/helpers/collection"
import { getMovieWidescreenBackdrop } from "@/lib/config/hero-art"
import type { MoviesSearch, MovieEntry } from "./index"

// Blur del fondo personalizado de biblioteca (Settings → Apariencia)
const LIBRARY_BG_BLUR_PX: Record<string, number> = { none: 0, sm: 8, md: 16, lg: 32 }

// Collator para orden alfabético en español cacheado a nivel de módulo
const SPANISH_COLLATOR = new Intl.Collator("es", { sensitivity: "base", numeric: true })

export const Route = createLazyFileRoute("/movies/")({
    component: MoviesPage,
})

function MoviesPage() {
    const navigate = useNavigate()
    const search = Route.useSearch()
    // Era y orden viven en la URL (validateSearch en index.tsx):
    // sobreviven a recargar y a volver desde la ficha de una película.
    const setSearch = useCallback((patch: Partial<MoviesSearch>) => {
        void navigate({ from: "/movies/", search: (prev) => ({ ...prev, ...patch }), replace: true })
    }, [navigate])
    const activeEra: EraId | "all" = search.era ?? "all"
    const activeThemeEra = activeEra !== "all" ? themeEraFromEraId(activeEra) : null
    useScreenEra(activeThemeEra)
    const ts = useThemeSettings()
    const { playSound } = useSound()

    // Default vivo desde Settings (llega async): ?sort manda cuando el
    // usuario elige manualmente en el menú de orden; ausente = seguir al ajuste.
    const defaultSort = mapCollectionSortToOption(ts.themeAnimeLibraryCollectionDefaultSorting)
    const sortBy: SortOption = search.sort ?? defaultSort
    const handleSortChange = useCallback((v: SortOption) => {
        setSearch({ sort: v })
        saveMoviesPrefs({ sort: v })
    }, [setSearch])

    // Orden recordado por dispositivo: solo rellena lo que la URL no trae
    // (una dirección compartida o recargada manda sobre lo guardado).
    const prefsApplied = useRef(false)
    useEffect(() => {
        if (prefsApplied.current) return
        prefsApplied.current = true
        const prefs = loadMoviesPrefs()
        const patch: Partial<MoviesSearch> = {}
        if (!search.sort && prefs.sort) patch.sort = prefs.sort
        if (Object.keys(patch).length > 0) setSearch(patch)
    }, [search.sort, setSearch])

    const [hoveredMovie, setHoveredMovie] = useState<MovieEntry | null>(null)
    const [debouncedMovie, setDebouncedMovie] = useState<MovieEntry | null>(null)

    const { data: collection, isLoading, isError, error, refetch } = useGetLibraryCollection()
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
        const mapped = Array.from(unique.values()).map(entry => {
            const startedAt = entry.listData?.startedAt
            const base: MovieEntry = { ...entry, era: getEntryEra(entry), eraId: getEntryEraId(entry), startedAtTimestamp: startedAt ? new Date(startedAt).getTime() : 0 }
            return Object.assign(base, {
                _releaseTs: getReleaseDateTimestamp(base),
                _title: getEntryTitle(base),
                _rating: getEntryRating(base),
            })
        })

        // Orden inicial cronológico por fecha de estreno usando claves precalculadas
        return mapped.sort((a, b) => {
            if (a._releaseTs && b._releaseTs && a._releaseTs !== b._releaseTs) return a._releaseTs - b._releaseTs
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
            // Valores sueltos antes del objeto: React Compiler no admite ?. dentro de la prueba de un || o ??.
            const posterImage = m.media?.posterImage
            const tmdbId = m.media?.tmdbId
            const format = m.media?.format
            const widescreenBackdrop = getMovieWidescreenBackdrop({
                mediaId: m.mediaId,
                tmdbId,
                bannerImage: m.media?.bannerImage,
                posterImage,
            })
            const swimlaneItem: SwimlaneItem = {
                id: `media-${m.mediaId}`,
                mediaId: m.mediaId ?? undefined,
                tmdbId: tmdbId ?? undefined,
                title: getEntryTitle(m),
                image: posterImage || "",
                backdropUrl: widescreenBackdrop || undefined,
                year: m.media?.year,
                badge: format || "MOVIE",
                onClick: () => {},
            }
            bucket.movies.push(swimlaneItem)
            if (m.eraId === "dbz") {
                result.dbkai.movies.push(swimlaneItem)
            }
        }
        return result
    }, [allMovies])

    const handleEraSelect = useCallback((eraId: EraId | "all") => {
        playSound("category")
        setSearch({ era: eraId === "all" || eraId === activeEra ? undefined : eraId })
    }, [playSound, setSearch, activeEra])

    const handleHoverSound = useCallback(() => {
        playSound("hover")
    }, [playSound])

    // Era recorta la lista según la selección activa en el Hero/SpotlightEraNav.
    const scopedEntries = useMemo(() => {
        if (activeEra === "all") return allMovies
        return allMovies.filter((movie) => {
            if (activeEra === "dbkai") {
                return movie.eraId === "dbz" || movie.eraId === "dbkai"
            }
            return movie.eraId === activeEra
        })
    }, [allMovies, activeEra])

    const movieStatuses = useMemo(() => {
        const map = new Map<number, Exclude<MovieStatus, "all">>()
        for (const m of allMovies) {
            if (m.mediaId != null) map.set(m.mediaId, getMovieStatus(m, watchHistory?.[m.mediaId]))
        }
        return map
    }, [allMovies, watchHistory])

    // Alta más antigua de toda la biblioteca: el escaneo inicial no cuenta como "nuevo".
    const addedBaseline = useMemo(() => getAddedBaseline(allMovies), [allMovies])
    const watchedMovies = useMemo(
        () => scopedEntries.filter((m) => m.mediaId != null && movieStatuses.get(m.mediaId) === "watched"),
        [scopedEntries, movieStatuses]
    )

    const handleResetFilters = useCallback(() => {
        setSearch({ era: undefined })
    }, [setSearch])
    const eraTitle = activeEra === "all" ? null : (ERAS.find(e => e.id === activeEra)?.title ?? null)

    const filteredSorted = useMemo(() => {
        switch (sortBy) {
            case "year_asc":
                return [...scopedEntries].sort((a, b) => {
                    const dateA = (a as MovieEntry & { _releaseTs?: number })._releaseTs ?? getReleaseDateTimestamp(a)
                    const dateB = (b as MovieEntry & { _releaseTs?: number })._releaseTs ?? getReleaseDateTimestamp(b)
                    if (dateA && dateB && dateA !== dateB) return dateA - dateB
                    return (a.media?.year || 0) - (b.media?.year || 0)
                })
            case "year_desc":
                return [...scopedEntries].sort((a, b) => {
                    const dateA = (a as MovieEntry & { _releaseTs?: number })._releaseTs ?? getReleaseDateTimestamp(a)
                    const dateB = (b as MovieEntry & { _releaseTs?: number })._releaseTs ?? getReleaseDateTimestamp(b)
                    if (dateA && dateB && dateA !== dateB) return dateB - dateA
                    return (b.media?.year || 0) - (a.media?.year || 0)
                })
            case "alpha_asc":
                return [...scopedEntries].sort((a, b) =>
                    SPANISH_COLLATOR.compare(
                        (a as MovieEntry & { _title?: string })._title ?? getEntryTitle(a),
                        (b as MovieEntry & { _title?: string })._title ?? getEntryTitle(b),
                    ),
                )
            case "alpha_desc":
                return [...scopedEntries].sort((a, b) =>
                    SPANISH_COLLATOR.compare(
                        (b as MovieEntry & { _title?: string })._title ?? getEntryTitle(b),
                        (a as MovieEntry & { _title?: string })._title ?? getEntryTitle(a),
                    ),
                )
            case "rating_desc":
                return [...scopedEntries].sort((a, b) =>
                    ((b as MovieEntry & { _rating?: number })._rating ?? getEntryRating(b)) -
                    ((a as MovieEntry & { _rating?: number })._rating ?? getEntryRating(a)),
                )
            default:
                return scopedEntries
        }
    }, [scopedEntries, sortBy])

    // Limpiar hover al cambiar de era durante el render (solo si había un hover activo)
    const [prevActiveEra, setPrevActiveEra] = useState(activeEra)
    if (activeEra !== prevActiveEra) {
        setPrevActiveEra(activeEra)
        if (hoveredMovie !== null) setHoveredMovie(null)
        if (debouncedMovie !== null) setDebouncedMovie(null)
    }

    // Lista de películas para el Hero: sigue el filtro activo sin fallback
    const topFeatured = filteredSorted

    const handleMovieClick = useCallback((mediaId: number) => {
        navigate({ to: "/movies/$movieId", params: { movieId: String(mediaId) } })
    }, [navigate])

    const handleHoverCard = useCallback((entry: MovieEntry | null) => {
        setHoveredMovie(entry)
    }, [])

    if (isError && !collection) return <LibraryErrorState error={error} onRetry={() => { void refetch() }} />

    return (
        <div className="neutro-sentence min-h-dvh text-on-surface selection:bg-brand-accent/30 relative z-10 bg-transparent">

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

            <h1 className="sr-only">Películas</h1>
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
                    libraryHasMovies={allMovies.length > 0}
                />
            ) : (
                <LibraryBanner />
            )}

            {(isLoading || allMovies.length > 0 || (ts.themeLibraryScreenBannerType !== "dynamic" && !!ts.themeLibraryScreenBannerType)) && (
            <div className="page-container mt-6">
                {/* Filas y grilla quedan bajo el hero (846 px): se montan tras el primer pintado. */}
                <DeferredMount heightKey="movies-body" className="space-y-8">
                {!isLoading && (
                    <MoviesRows
                        watchHistory={watchHistory}
                        watchedMovies={watchedMovies}
                        handleMovieClick={handleMovieClick}
                        handleHoverCard={handleHoverCard}
                    />
                )}
                <SectionBar
                    label={gridHeading(eraTitle)}
                    icon={IconNavigationFilm}
                    variant="minimal"
                    // Durante la carga no se muestra "0 títulos": todavía no se sabe cuántos hay.
                    badge={isLoading ? undefined : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums bg-[var(--neutral-elev-2)] text-label-2 border border-[var(--neutral-separator)]">
                            <span className="sr-only">{filteredSorted.length === allMovies.length
                                ? `${allMovies.length} ${allMovies.length === 1 ? "título" : "títulos"}`
                                : `${filteredSorted.length} de ${allMovies.length} títulos`}</span>
                            <span aria-hidden="true" className="inline-flex items-baseline gap-1">
                                <ElasticCounter value={filteredSorted.length} className="min-w-[2ch] justify-end" />
                                {filteredSorted.length === allMovies.length
                                    ? (allMovies.length === 1 ? "título" : "títulos")
                                    : `de ${allMovies.length} títulos`}
                            </span>
                        </span>
                    )}
                    action={
                        <MoviesFilterBar
                            sortBy={sortBy}
                            setSortBy={handleSortChange}
                        />
                    }
                >
                    <MoviesGrid
                        filteredSorted={filteredSorted}
                        isLoading={isLoading}
                        allMoviesLength={allMovies.length}
                        watchHistory={watchHistory}
                        handleMovieClick={handleMovieClick}
                        handleHoverCard={handleHoverCard}
                        onResetFilters={handleResetFilters}
                        addedBaseline={addedBaseline}
                    />
                </SectionBar>
                </DeferredMount>
            </div>
            )}

        </div>
    )
}
