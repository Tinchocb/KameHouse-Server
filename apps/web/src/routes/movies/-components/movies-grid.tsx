import { useState, useRef, useEffect, useMemo, useCallback, memo } from "react"
import { m } from "framer-motion"
import { useVirtualizer } from "@tanstack/react-virtual"
import type { Continuity_WatchHistory } from "@/api/generated/types"
import { EmptyState } from "@/components/shared/empty-state"
import { MovieCard } from "../-MovieCard"
import type { MovieEntry } from "../index"
import type { EraId } from "@/lib/config/eras"
import { PosterGridSkeleton } from "@/components/ui/shimmer-skeleton"

interface MoviesGridProps {
    filteredSorted: MovieEntry[]
    isLoading: boolean
    allMoviesLength: number
    watchHistory: Continuity_WatchHistory | undefined
    handleMovieClick: (mediaId: number) => void
    handleHoverCard: (entry: MovieEntry | null) => void
    activeEra?: EraId | "all"
    searchQuery?: string
    onResetFilters?: () => void
}

/**
 * Grid canónico compartido con Home (SpotlightLowerHub):
 * grid-cols-2 sm:3 md:4 lg:5 xl:6. Misma densidad => mismo ancho de tarjeta.
 */
function columnsForWidth(width: number): number {
    if (width < 640) return 2
    if (width < 768) return 3
    if (width < 1024) return 4
    if (width < 1280) return 5
    return 6
}

// gap-3.5 canónico en px para el cálculo de la fila virtualizada.
const CARD_GAP = 14
// pb-6 de cada fila virtualizada.
const ROW_BOTTOM_PADDING = 24
// Bloque bajo el póster: gap-2.5 + título (máx. 2 líneas de 15px leading-snug) + meta.
const CAPTION_HEIGHT = 74

export const MoviesGrid = memo(function MoviesGrid({
    filteredSorted,
    isLoading,
    allMoviesLength,
    watchHistory,
    handleMovieClick,
    handleHoverCard,
    activeEra: _activeEra,
    searchQuery: _searchQuery,
    onResetFilters,
}: MoviesGridProps) {
    const gridRef = useRef<HTMLDivElement | null>(null)
    const observerRef = useRef<ResizeObserver | null>(null)

    // Seeded from the viewport rather than a fixed desktop guess: the old
    // useState(5) rendered five hairline columns on a phone until a ResizeObserver
    // callback corrected it, so the first paint was wrong on every mobile load —
    // and stayed wrong wherever that callback didn't land.
    const initialWidth = typeof window === "undefined" ? 1200 : window.innerWidth
    const [columns, setColumns] = useState(() => columnsForWidth(initialWidth))
    const [gridWidth, setGridWidth] = useState(initialWidth)
    const [scrollMargin, setScrollMargin] = useState(500)
    // La página scrollea dentro del div raíz de /movies (overflow-x-hidden fuerza
    // overflow-y:auto), no en window: el virtualizador debe escuchar a ese elemento.
    const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null)

    // Callback ref, not a mount effect: the grid mounts only once data arrives
    // (the skeleton renders first), so an effect with [] deps would find a null
    // ref, bail, and never re-run.
    const attachGrid = useCallback((node: HTMLDivElement | null) => {
        observerRef.current?.disconnect()
        gridRef.current = node
        if (!node) {
            observerRef.current = null
            return
        }

        let scroller: HTMLElement | null = node.parentElement
        while (scroller) {
            const { overflowY } = getComputedStyle(scroller)
            if (overflowY === "auto" || overflowY === "scroll") break
            scroller = scroller.parentElement
        }
        setScrollEl(scroller ?? document.documentElement)

        const measure = (width: number) => {
            setGridWidth(width)
            setColumns(columnsForWidth(width))
            setScrollMargin(
                scroller
                    ? node.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
                    : node.offsetTop,
            )
        }

        measure(node.getBoundingClientRect().width)

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) measure(entry.contentRect.width)
        })
        observer.observe(node)
        observerRef.current = observer
    }, [])

    useEffect(() => () => observerRef.current?.disconnect(), [])

    const rows = useMemo(() => {
        const r = []
        for (let i = 0; i < filteredSorted.length; i += columns) {
            r.push(filteredSorted.slice(i, i + columns))
        }
        return r
    }, [filteredSorted, columns])

    const rowHeight = useMemo(() => {
        const cardWidth = Math.max(80, (gridWidth - (columns - 1) * CARD_GAP) / columns)
        const posterHeight = cardWidth * 1.5
        // Póster (aspect 2/3) + título/meta debajo, reservando siempre 2 líneas
        // de título para que todas las filas midan igual.
        return Math.ceil(posterHeight + CAPTION_HEIGHT + ROW_BOTTOM_PADDING)
    }, [gridWidth, columns])

    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => scrollEl,
        estimateSize: () => rowHeight,
        overscan: 2,
        scrollMargin: scrollMargin,
    })

    return (
        <div className="w-full relative pb-32">
            {isLoading && allMoviesLength === 0 ? (
                <PosterGridSkeleton count={18} />
            ) : filteredSorted.length === 0 ? (
                <m.div initial={false} animate={{ opacity: 1 }} className="py-32">
                    <EmptyState
                        title="Sin películas"
                        message="No hay películas que coincidan con este filtro."
                        action={
                            onResetFilters ? (
                                <button
                                    type="button"
                                    onClick={onResetFilters}
                                    className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-semibold text-white transition-colors cursor-pointer"
                                >
                                    Restablecer filtros
                                </button>
                            ) : undefined
                        }
                    />
                </m.div>
            ) : (
                <div
                    ref={attachGrid}
                    className="relative w-full"
                    style={{ height: `${virtualizer.getTotalSize()}px` }}
                >
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                        const rowItems = rows[virtualRow.index]
                        if (!rowItems) return null
                        return (
                            <div
                                key={virtualRow.index}
                                className="absolute left-0 top-0 w-full grid gap-x-3.5 pb-6 items-start"
                                style={{
                                    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                                    height: `${virtualRow.size}px`,
                                    transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
                                }}
                            >
                                {rowItems.filter(e => e != null).map((entry, idx) => (
                                    <div key={entry?.mediaId ?? `idx-${idx}`} className="h-full [content-visibility:auto] [contain-intrinsic-size:280px]">
                                        <MovieCard
                                            entry={entry}
                                            era={entry.era}
                                            eraId={entry.eraId}
                                            watchHistoryItem={entry.mediaId == null ? undefined : watchHistory?.[entry.mediaId]}
                                            onClick={handleMovieClick}
                                            onHoverCard={handleHoverCard}
                                        />
                                    </div>
                                ))}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
})
