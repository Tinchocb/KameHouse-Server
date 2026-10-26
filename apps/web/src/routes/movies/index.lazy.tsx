import { createLazyFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { useDebounce } from "use-debounce"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { useGetContinuityWatchHistory } from "@/api/hooks/continuity.hooks"
import type { Anime_LibraryCollectionEntry } from "@/api/generated/types"
import { ERAS, KNOWN_MOVIE_TMDB_IDS, type EraId } from "@/lib/config/eras"
import {
    SortOption, type MovieStatus, getEntryEra, getEntryEraId, getReleaseDateTimestamp, getEntryTitle, getEntryRating,
    mapCollectionSortToOption, getMovieLore, getMovieStatus, getEntryDecade, gridHeading, loadMoviesPrefs, saveMoviesPrefs,
} from "./-components/movies-utils"
import { getAddedBaseline, isNewlyAdded } from "./-components/movies-added"
import { MoviesRows } from "./-components/movies-rows"
import { MoviesHero } from "./-components/movies-hero"
import { MoviesFilterBar } from "./-components/movies-filter-bar"
import { MoviesGrid } from "./-components/movies-grid"
import { LibraryErrorState } from "@/components/shared/library-error-state"
import { LibraryBanner } from "./-components/library-banner"
import { useThemeSettings } from "@/lib/theme/theme-hooks"
import { getLargeResImage } from "@/lib/helpers/images"
import { SectionBar } from "@/components/ui/sectionbar/sectionbar"
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
    // Era, estado, orden y búsqueda viven en la URL (validateSearch en index.tsx):
    // sobreviven a recargar y a volver desde la ficha de una película.
    const setSearch = useCallback((patch: Partial<MoviesSearch>) => {
        void navigate({ from: "/movies/", search: (prev) => ({ ...prev, ...patch }), replace: true })
    }, [navigate])
    const activeEra: EraId | "all" = search.era ?? "all"
    const ts = useThemeSettings()
    const { playSound } = useSound()

    // Default vivo desde Settings (llega async): ?sort manda cuando el
    // usuario elige manualmente en la filter-bar; ausente = seguir al ajuste.
    const defaultSort = mapCollectionSortToOption(ts.themeAnimeLibraryCollectionDefaultSorting)
    const sortBy: SortOption = search.sort ?? defaultSort
    const handleSortChange = useCallback((v: SortOption) => {
        setSearch({ sort: v })
        saveMoviesPrefs({ sort: v })
    }, [setSearch])
    const status: MovieStatus = search.estado ?? "all"
    const decade = search.decada ?? null
    const handleStatusChange = useCallback((v: MovieStatus) => {
        setSearch({ estado: v === "all" ? undefined : v })
        saveMoviesPrefs({ estado: v === "all" ? null : v })
    }, [setSearch])
    const handleDecadeChange = useCallback((v: number | null) => {
        setSearch({ decada: v ?? undefined })
        saveMoviesPrefs({ decada: v })
    }, [setSearch])
    // Orden y filtros recordados por dispositivo: solo rellenan lo que la URL no trae
    // (una dirección compartida o recargada manda sobre lo guardado).
    const prefsApplied = useRef(false)
    useEffect(() => {
        if (prefsApplied.current) return
        prefsApplied.current = true
        const prefs = loadMoviesPrefs()
        const patch: Partial<MoviesSearch> = {}
        if (!search.sort && prefs.sort) patch.sort = prefs.sort
        if (!search.estado && prefs.estado) patch.estado = prefs.estado
        if (!search.decada && prefs.decada) patch.decada = prefs.decada
        if (Object.keys(patch).length > 0) setSearch(patch)
    }, [search.sort, search.estado, search.decada, setSearch])
    // El input es local (tipeo inmediato); a la URL va el valor con debounce.
    const [searchQuery, setSearchQuery] = useState(search.q ?? "")
    const [debouncedSearchQuery] = useDebounce(searchQuery, 200)
    const urlQuery = search.q ?? ""
    useEffect(() => {
        const q = debouncedSearchQuery.trim()
        if (q !== urlQuery) setSearch({ q: q || undefined })
    }, [debouncedSearchQuery, urlQuery, setSearch])

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

    const handleEraSelect = useCallback((eraId: EraId | "all") => {
        playSound("category")
        setSearch({ era: eraId === "all" || eraId === activeEra ? undefined : eraId })
    }, [playSound, setSearch, activeEra])

    const handleHoverSound = useCallback(() => {
        playSound("hover")
    }, [playSound])

    // Era, década y búsqueda recortan la lista; el estado va aparte para que cada chip
    // muestre cuántas películas daría (los conteos no dependen del chip elegido).
    const scopedEntries = useMemo(() => {
        const query = debouncedSearchQuery.toLowerCase().trim()
        return searchIndex.filter(({ movie, hay }) => {
            if (activeEra !== "all") {
                if (activeEra === "dbkai") {
                    if (movie.eraId !== "dbz" && movie.eraId !== "dbkai") return false
                } else if (movie.eraId !== activeEra) {
                    return false
                }
            }
            if (decade != null && getEntryDecade(movie) !== decade) return false
            if (query && !hay.includes(query)) return false
            return true
        }).map(e => e.movie)
    }, [searchIndex, activeEra, decade, debouncedSearchQuery])

    const movieStatuses = useMemo(() => {
        const map = new Map<number, Exclude<MovieStatus, "all">>()
        for (const m of allMovies) {
            if (m.mediaId != null) map.set(m.mediaId, getMovieStatus(m, watchHistory?.[m.mediaId]))
        }
        return map
    }, [allMovies, watchHistory])

    const statusCounts = useMemo(() => {
        const counts: Record<MovieStatus, number> = { all: scopedEntries.length, pending: 0, continue: 0, watched: 0 }
        for (const m of scopedEntries) {
            const st = m.mediaId != null ? movieStatuses.get(m.mediaId) : undefined
            if (st) counts[st]++
        }
        return counts
    }, [scopedEntries, movieStatuses])

    // Décadas que existen en la biblioteca (el menú no ofrece décadas vacías).
    const decades = useMemo(() => {
        const set = new Set<number>()
        for (const m of allMovies) {
            const d = getEntryDecade(m)
            if (d != null) set.add(d)
        }
        return [...set].sort((a, b) => a - b)
    }, [allMovies])

    // Filas sobre la grilla: con la era (o todas) y sin búsqueda ni filtros de estado/década.
    const showRows = !debouncedSearchQuery.trim() && status === "all" && decade == null
    // Alta más antigua de toda la biblioteca: el escaneo inicial no cuenta como "nuevo".
    const addedBaseline = useMemo(() => getAddedBaseline(allMovies), [allMovies])
    const { continueMovies, watchedMovies, recentMovies } = useMemo(() => {
        const cont: MovieEntry[] = []
        const done: MovieEntry[] = []
        const recent: MovieEntry[] = []
        if (showRows) {
            for (const m of scopedEntries) {
                const st = m.mediaId != null ? movieStatuses.get(m.mediaId) : undefined
                if (st === "continue") cont.push(m)
                else if (st === "watched") done.push(m)
                // Lo que ya está en "Continuar viendo" no se repite en "Recién añadidas".
                if (st !== "continue" && isNewlyAdded(m, addedBaseline)) recent.push(m)
            }
            recent.sort((a, b) => (Date.parse(b.media?.createdAt ?? "") || 0) - (Date.parse(a.media?.createdAt ?? "") || 0))
            // Lo último que se vio, primero.
            const updated = (m: MovieEntry) => Date.parse(watchHistory?.[m.mediaId]?.timeUpdated ?? "") || 0
            cont.sort((a, b) => updated(b) - updated(a))
        }
        return { continueMovies: cont, watchedMovies: done, recentMovies: recent }
    }, [showRows, scopedEntries, movieStatuses, watchHistory, addedBaseline])

    const hasActiveFilters = activeEra !== "all" || status !== "all" || decade != null || debouncedSearchQuery.trim() !== ""
    const handleResetFilters = useCallback(() => {
        setSearchQuery("")
        setSearch({ era: undefined, sort: undefined, q: undefined, estado: undefined, decada: undefined })
        saveMoviesPrefs({ sort: null, estado: null, decada: null })
    }, [setSearch])
    const eraTitle = activeEra === "all" ? null : (ERAS.find(e => e.id === activeEra)?.title ?? null)

    const filteredSorted = useMemo(() => {
        const result = status === "all"
            ? scopedEntries
            : scopedEntries.filter(m => m.mediaId != null && movieStatuses.get(m.mediaId) === status)

        // Si el ordenamiento es default (ya ordenado por release date en allMovies), evitamos el .sort()
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
    }, [scopedEntries, status, movieStatuses, sortBy])

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
        <div className="neutro-sentence min-h-screen text-on-surface selection:bg-brand-accent/30 relative z-10 bg-transparent">

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

            <div className="page-container mt-6">
                {/* Filas y grilla quedan bajo el hero (846 px): se montan tras el primer pintado. */}
                <DeferredMount heightKey="movies-body" className="space-y-8">
                {!isLoading && (
                    <MoviesRows
                        watchHistory={watchHistory}
                        continueMovies={continueMovies}
                        watchedMovies={watchedMovies}
                        recentMovies={recentMovies}
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
                            {filteredSorted.length === allMovies.length
                                ? `${allMovies.length} ${allMovies.length === 1 ? "título" : "títulos"}`
                                : `${filteredSorted.length} de ${allMovies.length} títulos`}
                        </span>
                    )}
                >
                    <MoviesFilterBar
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        sortBy={sortBy}
                        setSortBy={handleSortChange}
                        status={status}
                        setStatus={handleStatusChange}
                        statusCounts={statusCounts}
                        decade={decade}
                        setDecade={handleDecadeChange}
                        decades={decades}
                        totalCount={allMovies.length}
                        filteredCount={filteredSorted.length}
                        hasActiveFilters={hasActiveFilters}
                        onResetFilters={handleResetFilters}
                    />

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

        </div>
    )
}
