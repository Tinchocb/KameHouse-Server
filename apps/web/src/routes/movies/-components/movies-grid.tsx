import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback, memo } from "react"
import { m } from "framer-motion"
import { Link } from "@tanstack/react-router"
import { Button, ButtonAnatomy } from "@/components/ui/button"
import { cn } from "@/components/ui/core/styling"
import { useVirtualizer } from "@tanstack/react-virtual"
import type { Continuity_WatchHistory } from "@/api/generated/types"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/ui/skeleton/skeleton"
import { MovieCard } from "../-MovieCard"
import type { MovieEntry } from "../index"
import { useRevealRef } from "@/components/ui/kinetics/scroll-reveal"
import { LoadSwap } from "@/components/ui/kinetics/load-swap"
import { getAddedBaseline, isNewlyAdded } from "./movies-added"

interface MoviesGridProps {
    filteredSorted: MovieEntry[]
    isLoading: boolean
    allMoviesLength: number
    watchHistory: Continuity_WatchHistory | undefined
    handleMovieClick: (mediaId: number) => void
    handleHoverCard: (entry: MovieEntry | null) => void
    onResetFilters?: () => void
    /** Alta más antigua de toda la biblioteca (ver `getAddedBaseline`); sin ella se usa la de la lista visible. */
    addedBaseline?: number
}

/**
 * Grid canónico compartido con Home (SpotlightLowerHub):
 * 1 / 2 / 3 / 4 columnas según el ancho real del contenedor (formato de ficha lateral amplia).
 * Requiere >=420px por columna (por la ficha lateral abierta): solo escala a 4 columnas
 * en monitores muy amplios (>= 1660px) para no desbalancear portátiles (1024-1366px).
 * Esqueleto, lista simple y lista virtualizada usan las mismas columnas: misma geometría.
 */
function columnsForWidth(width: number): number {
    if (width < 640) return 1
    if (width < 1024) return 2
    if (width >= 1660) return 4
    return 3
}

// Aire bajo cada fila (pb-6 / gap-y-6).
const ROW_BOTTOM_PADDING = 24
// Hasta este número de títulos la grilla es una lista normal (Tab, buscar en la
// página y lectores de pantalla ven todo); por encima se virtualiza por filas, y las
// filas fuera de pantalla no están en el DOM. Bajado de 150 a 12 para que Películas
// monte solo las filas cercanas (ver la medición de la entrada en el informe).
const VIRTUALIZE_FROM = 12

/** Esqueleto con la geometría de la grilla real: mismas columnas y ficha lateral 3-col */
function MoviesGridSkeleton({ columns }: { columns: number }) {
    return (
        <div
            role="status"
            aria-label="Cargando películas"
            className="grid gap-x-4.5 gap-y-6"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
            {Array.from({ length: columns * 2 }).map((_, idx) => (
                <div key={idx} className="w-full">
                    <Skeleton className="h-[225px] sm:h-[240px] w-full rounded-2xl" />
                </div>
            ))}
        </div>
    )
}

export const MoviesGrid = memo(function MoviesGrid({
    filteredSorted,
    isLoading,
    allMoviesLength,
    watchHistory,
    handleMovieClick,
    handleHoverCard,
    onResetFilters,
    addedBaseline,
}: MoviesGridProps) {
    const wrapperRef = useRef<HTMLDivElement | null>(null)
    const observerRef = useRef<ResizeObserver | null>(null)
    const scrollerRef = useRef<HTMLElement | null>(null)

    // Seeded from the viewport rather than a fixed desktop guess: the old
    // useState(5) rendered five hairline columns on a phone until a ResizeObserver
    // callback corrected it, so the first paint was wrong on every mobile load.
    const initialWidth = typeof window === "undefined" ? 1200 : window.innerWidth
    const [columns, setColumns] = useState(() => columnsForWidth(initialWidth))
    const [gridWidth, setGridWidth] = useState(initialWidth)
    const [scrollMargin, setScrollMargin] = useState(500)
    // La página scrollea dentro del contenedor del shell, no en window: el
    // virtualizador debe escuchar a ese elemento.
    const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null)
    // Las tarjetas que montan al bajar (fuera de la cascada inicial) entran con revelado.
    // Variante "list": filas de una lista que se recorre rápido, solo fundido corto y sin escalonado (como los episodios).
    // Sin clave fija: cada tarjeta se deduplica por su data-reveal-key.
    const revealRef = useRevealRef<HTMLDivElement>(undefined, "list")

    // Solo las primeras 12 tarjetas se animan en cascada al primer render o tras
    // cambiar de filtro/búsqueda; el resto monta con initial={false} para no
    // acumular retrasos de varios segundos.
    const [filterKey, setFilterKey] = useState(0)
    const [isInitialEntranceDone, setIsInitialEntranceDone] = useState(false)
    const prevFilteredRef = useRef(filteredSorted)

    if (prevFilteredRef.current !== filteredSorted) {
        prevFilteredRef.current = filteredSorted
        setFilterKey(k => k + 1)
        setIsInitialEntranceDone(false)
    }

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsInitialEntranceDone(true)
        }, 800)
        return () => clearTimeout(timer)
    }, [filterKey])

    // El contenedor se mide aunque todavía no haya datos: así el esqueleto ya
    // trae las columnas definitivas. Callback ref y no efecto de montaje para no
    // perder el nodo si cambia.
    const attachWrapper = useCallback((node: HTMLDivElement | null) => {
        observerRef.current?.disconnect()
        wrapperRef.current = node
        if (!node) {
            observerRef.current = null
            return
        }

        // El que scrollea es el contenedor del shell (`data-scroll-container`). El div
        // raíz de /movies también tiene overflow-y:auto (por overflow-x-hidden), pero
        // crece con su contenido y nunca scrollea: tomarlo como scroller dejaba al
        // virtualizador viendo toda la lista a la vez.
        let scroller: HTMLElement | null = node.closest<HTMLElement>("[data-scroll-container]")
        if (!scroller) {
            scroller = node.parentElement
            while (scroller) {
                const { overflowY } = getComputedStyle(scroller)
                if ((overflowY === "auto" || overflowY === "scroll") && scroller.scrollHeight > scroller.clientHeight + 1) break
                scroller = scroller.parentElement
            }
        }
        scrollerRef.current = scroller
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

    const virtualized = filteredSorted.length > VIRTUALIZE_FROM

    // Con filas encima de la grilla que cargan después, su posición cambia sin que
    // cambie su ancho: se vuelve a medir el desplazamiento del virtualizador.
    useLayoutEffect(() => {
        const node = wrapperRef.current
        if (!virtualized || !node) return
        const scroller = scrollerRef.current
        setScrollMargin(
            scroller
                ? node.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
                : node.offsetTop,
        )
    }, [virtualized, filteredSorted.length, isLoading])

    const rows = useMemo(() => {
        if (!virtualized) return []
        const r = []
        for (let i = 0; i < filteredSorted.length; i += columns) {
            r.push(filteredSorted.slice(i, i + columns))
        }
        return r
    }, [filteredSorted, columns, virtualized])

    // Alto calibrado para formato de ficha lateral amplia (h-[225px] sm:h-[240px])
    const cardHeight = useMemo(() => {
        return gridWidth < 640 ? 225 : 240
    }, [gridWidth])
    const rowHeight = cardHeight + ROW_BOTTOM_PADDING

    // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer devuelve funciones no memoizables por diseño; React Compiler lo omite a proposito.
    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => scrollEl,
        estimateSize: () => rowHeight,
        overscan: 3,
        scrollMargin: scrollMargin,
        enabled: virtualized,
    })

    const baseline = useMemo(
        () => addedBaseline ?? getAddedBaseline(filteredSorted),
        [addedBaseline, filteredSorted],
    )
    const now = useMemo(() => Date.now(), [])
    const priorityCount = columns * 2

    const renderCard = useCallback((entry: MovieEntry, itemIndex: number) => {
        const shouldAnimateEntrance = !isInitialEntranceDone && itemIndex < 12
        const isAboveFold = itemIndex < priorityCount
        return (
            <div
                key={entry.mediaId ?? `idx-${itemIndex}`}
                ref={shouldAnimateEntrance ? undefined : revealRef}
                data-reveal-key={`movie:${entry.mediaId ?? itemIndex}`}
                className={virtualized || isAboveFold
                    ? "h-full relative hover:z-20 transition-[transform,opacity] duration-300"
                    : "h-full [content-visibility:auto] relative hover:z-20 transition-[transform,opacity] duration-300"
                }
                style={virtualized || isAboveFold ? undefined : { containIntrinsicSize: `auto ${cardHeight}px` }}
            >
                <MovieCard
                    entry={entry}
                    era={entry.era}
                    eraId={entry.eraId}
                    watchHistoryItem={entry.mediaId == null ? undefined : watchHistory?.[entry.mediaId]}
                    index={shouldAnimateEntrance ? itemIndex : undefined}
                    initial={shouldAnimateEntrance ? "hidden" : false}
                    isNew={isNewlyAdded(entry, baseline, now)}
                    priority={isAboveFold}
                    onClick={handleMovieClick}
                    onHoverCard={handleHoverCard}
                />
            </div>
        )
    }, [isInitialEntranceDone, priorityCount, virtualized, revealRef, cardHeight, watchHistory, baseline, now, handleMovieClick, handleHoverCard])

    return (
        <div ref={attachWrapper} className="w-full relative pb-32">
            <LoadSwap loading={isLoading && allMoviesLength === 0} skeleton={<MoviesGridSkeleton columns={columns} />}>
                {filteredSorted.length === 0 ? (
                    <m.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                        className="py-24"
                    >
                        <EmptyState
                            headingLevel="h2"
                            title={allMoviesLength === 0 ? "Tu biblioteca no tiene películas todavía" : "No hay películas con estos filtros"}
                            message={allMoviesLength === 0
                                ? "Añade las carpetas con tus películas en Ajustes y escanea la biblioteca para verlas aquí."
                                : "Prueba con otra búsqueda, otra era o quita los filtros."}
                            action={allMoviesLength === 0 ? (
                                <Link
                                    to="/settings"
                                    search={{ tab: "library" }}
                                    data-intent="primary"
                                    data-size="lg"
                                    className={cn(
                                        ButtonAnatomy.root({ intent: "primary", size: "lg" }),
                                        "transition-[transform,background-color,border-color,color,box-shadow,filter] duration-fast ease-out-strong motion-safe:active:scale-[0.97]"
                                    )}
                                >
                                    Ir a Ajustes
                                </Link>
                            ) : onResetFilters ? (
                                <Button intent="secondary" size="lg" onClick={onResetFilters}>
                                    Quitar filtros
                                </Button>
                            ) : undefined}
                        />
                    </m.div>
                ) : virtualized ? (
                    <div
                        className="relative w-full"
                        style={{ height: `${virtualizer.getTotalSize()}px` }}
                    >
                        {virtualizer.getVirtualItems().map((virtualRow) => {
                            const rowItems = rows[virtualRow.index]
                            if (!rowItems) return null
                            return (
                                <div
                                    key={virtualRow.index}
                                    className="absolute left-0 top-0 w-full grid gap-x-4.5 pb-6 items-start"
                                    style={{
                                        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                                        height: `${virtualRow.size}px`,
                                        transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
                                    }}
                                >
                                    {rowItems.map((entry, idx) => renderCard(entry, virtualRow.index * columns + idx))}
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div
                        className="grid w-full gap-x-4.5 gap-y-6 items-start"
                        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                    >
                        {filteredSorted.map((entry, idx) => renderCard(entry, idx))}
                    </div>
                )}
            </LoadSwap>
        </div>
    )
})
