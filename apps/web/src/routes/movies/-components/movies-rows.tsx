import * as React from "react"
import { IconButton } from "@/components/ui/button"
import { IconNavigationChevronLeft, IconNavigationChevronRight } from "@/components/ui/icons"
import type { Continuity_WatchHistory } from "@/api/generated/types"
import { MovieCard } from "../-MovieCard"
import type { MovieEntry } from "../index"

/** Filas que se muestran como máximo por sección: más allá de esto la grilla ya cumple. */
const MAX_ROW_ITEMS = 20

interface MovieShelfProps {
    title: string
    count: number
    children: React.ReactNode
}

/**
 * Fila horizontal con scroll (snap) y flechas solo con puntero fino. En táctil se
 * desliza con el dedo; con teclado, cada tarjeta es una parada de Tab y el
 * navegador desplaza la fila hasta la tarjeta enfocada.
 */
function MovieShelf({ title, count, children }: MovieShelfProps) {
    const scrollerRef = React.useRef<HTMLDivElement>(null)
    const [edges, setEdges] = React.useState({ start: true, end: true })
    const headingId = React.useId()

    const updateEdges = React.useCallback(() => {
        const el = scrollerRef.current
        if (!el) return
        setEdges({
            start: el.scrollLeft <= 4,
            end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
        })
    }, [])

    React.useEffect(() => {
        const el = scrollerRef.current
        if (!el) return
        updateEdges()
        const observer = new ResizeObserver(updateEdges)
        observer.observe(el)
        return () => observer.disconnect()
    }, [updateEdges, count])

    const scrollByPage = (dir: -1 | 1) => {
        const el = scrollerRef.current
        if (!el) return
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? "auto" : "smooth" })
    }

    const canScroll = !(edges.start && edges.end)

    return (
        <section aria-labelledby={headingId} className="relative group/shelf">
            <div className="flex items-center justify-between gap-3 mb-1 px-1 min-h-8">
                <h2 id={headingId} className="text-base sm:text-lg font-semibold text-on-surface">
                    {title}
                </h2>
                <div className="flex items-center gap-2">
                    <span className="text-2xs font-semibold tabular-nums text-label-2">
                        {count} {count === 1 ? "película" : "películas"}
                    </span>
                    {/* Flechas solo con puntero fino y si la fila desborda; en táctil se desliza con el dedo. */}
                    {canScroll && (
                        <div className="hidden [@media(hover:hover)_and_(pointer:fine)]:flex items-center gap-1.5">
                            <IconButton
                                intent="secondary"
                                size="sm"
                                aria-label={`Anteriores: ${title}`}
                                tabIndex={-1}
                                disabled={edges.start}
                                onClick={() => scrollByPage(-1)}
                                icon={<IconNavigationChevronLeft className="w-4 h-4" />}
                            />
                            <IconButton
                                intent="secondary"
                                size="sm"
                                aria-label={`Siguientes: ${title}`}
                                tabIndex={-1}
                                disabled={edges.end}
                                onClick={() => scrollByPage(1)}
                                icon={<IconNavigationChevronRight className="w-4 h-4" />}
                            />
                        </div>
                    )}
                </div>
            </div>

            <div
                ref={scrollerRef}
                onScroll={updateEdges}
                role="list"
                // Relleno arriba y a los lados: el overflow-x recorta también en vertical y comería la elevación en hover.
                className="flex gap-3.5 overflow-x-auto snap-x snap-mandatory scroll-px-2 pt-3 pb-3 -mx-2 px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden overscroll-x-contain"
            >
                {children}
            </div>
        </section>
    )
}

interface MoviesRowsProps {
    watchHistory: Continuity_WatchHistory | undefined
    /** Ya clasificadas por estado (la página las calcula una sola vez para filtros y filas). */
    continueMovies: MovieEntry[]
    watchedMovies: MovieEntry[]
    recentMovies: MovieEntry[]
    handleMovieClick: (mediaId: number) => void
    handleHoverCard: (entry: MovieEntry | null) => void
}

/**
 * Secciones sobre la grilla: "Para ver de nuevo". Solo se
 * muestran si hay algo que poner (sin datos de visionado no aparece nada) y las
 * monta la página únicamente cuando no hay filtros activos.
 */
export function MoviesRows({ watchHistory, watchedMovies, handleMovieClick, handleHoverCard }: MoviesRowsProps) {
    const sections = [
        { key: "again", title: "Para ver de nuevo", items: watchedMovies },
    ].filter((s) => s.items.length > 0)

    if (sections.length === 0) return null

    return (
        <div className="space-y-8">
            {sections.map((section) => (
                <MovieShelf key={section.key} title={section.title} count={section.items.length}>
                    {section.items.slice(0, MAX_ROW_ITEMS).map((entry) => (
                        <div
                            key={entry.mediaId}
                            role="listitem"
                            className="w-[8.75rem] sm:w-40 lg:w-44 shrink-0 snap-start sm:hover:w-64 lg:hover:w-72 transition-[width,transform] duration-300 ease-smooth-out"
                        >
                            <MovieCard
                                entry={entry}
                                era={entry.era}
                                eraId={entry.eraId}
                                watchHistoryItem={entry.mediaId == null ? undefined : watchHistory?.[entry.mediaId]}
                                initial={false}
                                onClick={handleMovieClick}
                                onHoverCard={handleHoverCard}
                            />
                        </div>
                    ))}
                </MovieShelf>
            ))}
        </div>
    )
}
