"use no memo"
import React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import type { PremiumEpisode } from "@/api/types/series.types"
import type { useThemeSettings } from "@/lib/theme/theme-hooks"
import { useReducedMotion } from "@/components/ui/kinetics/hooks"

// Alto medido de cada fila (tarjeta + padding inferior) por breakpoint: compact (~164 px),
// medium (~156 px) y desktop (~181 px). Una estimación lejana obligaba a corregir cada fila
// al montarla y el alto total del scroll quedaba descompensado.
const ROW_HEIGHT_PX = { compact: 164, medium: 156, desktop: 181 } as const
// Filas montadas fuera de pantalla: sus miniaturas se piden antes de asomar
// (16 episodios por lado), dando más margen de carga al desplazarse rápido.
const LIST_OVERSCAN = 16
// Al entrar a la ficha casi todas las filas están bajo el pliegue. Montarlas todas junto con la
// entrada de la página costaba un commit y un layout largos; se empieza con pocas y se amplía
// cuando la entrada ya terminó.
const LIST_OVERSCAN_ON_MOUNT = 4
const LIST_OVERSCAN_DELAY_MS = 450
// Al llevar el arco activo arriba, su primer episodio no debe quedar bajo la píldora de navegación flotante (~72 px).
const ARC_SCROLL_PADDING_PX = 88

export interface EpisodeVirtualRowProps {
    ep: PremiumEpisode
    isHighlighted: boolean
    virtualStart: number
    scrollMargin: number
    /** Índice de la fila y ref de medición del virtualizador: la altura real varía con el largo del título. */
    rowIndex: number
    measureRef: (node: HTMLElement | null) => void
    priority?: boolean
    themeHideEpisodeCardDescription?: boolean
    onPlay?: (episodeNumber: number) => void
    onMouseEnter: (id: string) => void
    onMouseLeave: (id: string) => void
    seriesMediaId?: number
}

interface EpisodeVirtualListProps {
    filteredEpisodes: PremiumEpisode[]
    activeSubSagaStart?: number
    activeSubSagaEnd?: number
    ts: ReturnType<typeof useThemeSettings>
    onPlay?: (episodeNumber: number) => void
    onMouseEnter: (id: string) => void
    onMouseLeave: (id: string) => void
    scrollElement?: Element | null
    seriesMediaId?: number
    RowComponent: React.ComponentType<EpisodeVirtualRowProps>
}

export function EpisodeVirtualList({
    filteredEpisodes,
    activeSubSagaStart,
    activeSubSagaEnd,
    ts,
    onPlay,
    onMouseEnter,
    onMouseLeave,
    scrollElement,
    seriesMediaId,
    RowComponent,
}: EpisodeVirtualListProps) {
    const listRef = React.useRef<HTMLDivElement>(null)
    // El salto a una sub-saga respeta movimiento reducido (C-02): antes era `smooth` fijo.
    const reduceMotion = useReducedMotion()
    const [overscan, setOverscan] = React.useState(LIST_OVERSCAN_ON_MOUNT)
    React.useEffect(() => {
        const timer = window.setTimeout(() => setOverscan(LIST_OVERSCAN), LIST_OVERSCAN_DELAY_MS)
        return () => window.clearTimeout(timer)
    }, [])
    const [scrollMargin, setScrollMargin] = React.useState(() => {
        if (typeof window === "undefined") return 0
        return window.innerWidth < 768 ? 550 : 700
    })

    const getScrollElement = React.useCallback(() => {
        return (
            (scrollElement as HTMLElement | null) ??
            listRef.current?.closest("main") ??
            listRef.current?.parentElement ??
            (typeof document !== "undefined" ? document.documentElement : null)
        )
    }, [scrollElement])

    React.useLayoutEffect(() => {
        const el = listRef.current
        const scrollEl = (scrollElement as HTMLElement | null) ?? el?.closest("main") ?? el?.parentElement
        if (!el || !scrollEl) return

        const updateOffset = () => {
            if (!listRef.current || !scrollEl) return
            // Posición de la lista dentro del contenido del scroller. Con offsetTop la cadena
            // de offsetParent se salteaba el scroller si no estaba posicionado.
            const top = Math.round(
                listRef.current.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop,
            )
            if (top > 0) {
                setScrollMargin(prev => (Math.abs(prev - top) <= 1 ? prev : top))
            }
        }
        updateOffset()

        // Lo de arriba de la lista (continuar viendo, personajes) carga después y la corre.
        const ro = new ResizeObserver(updateOffset)
        if (scrollEl.firstElementChild) ro.observe(scrollEl.firstElementChild)
        window.addEventListener("resize", updateOffset, { passive: true })
        return () => {
            ro.disconnect()
            window.removeEventListener("resize", updateOffset)
        }
    }, [scrollElement])

    const estimateSize = React.useCallback(() => {
        if (typeof window !== "undefined") {
            if (window.innerWidth < 640) return ROW_HEIGHT_PX.compact
            if (window.innerWidth < 768) return ROW_HEIGHT_PX.medium
        }
        return ROW_HEIGHT_PX.desktop
    }, [])

    // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer devuelve funciones no memoizables por diseño; React Compiler lo omite a proposito.
    const virtualizer = useVirtualizer({
        count: filteredEpisodes.length,
        getScrollElement,
        estimateSize,
        // Sin leer el DOM en el ref: al montar, la fila recibe el tamaño que ya se conoce (o la
        // estimación) y el ResizeObserver la mide con borderBoxSize después del layout. Por defecto
        // cada fila leía offsetHeight dentro del commit (un layout forzado por fila, ~67 ms al cargar).
        measureElement: (element, entry, instance) => {
            if (entry) return Math.round(entry.borderBoxSize?.[0]?.blockSize ?? (element as HTMLElement).offsetHeight)
            const cached = instance.measurementsCache[Number(element.getAttribute("data-index"))]
            return cached ? cached.size : estimateSize()
        },
        initialRect: {
            width: typeof window !== "undefined" ? window.innerWidth : 1280,
            height: typeof window !== "undefined" ? window.innerHeight : 800,
        },
        // Clave por episodio: las alturas medidas siguen al episodio al filtrar o reordenar.
        getItemKey: (index) => filteredEpisodes[index]?.id ?? index,
        overscan,
        scrollMargin,
        scrollPaddingStart: ARC_SCROLL_PADDING_PX,
        useFlushSync: false,
    })

    const prevActiveSubSagaStart = React.useRef<number | undefined>(undefined)
    React.useEffect(() => {
        if (activeSubSagaStart != null && activeSubSagaStart !== prevActiveSubSagaStart.current) {
            prevActiveSubSagaStart.current = activeSubSagaStart
            const targetIndex = filteredEpisodes.findIndex(e => e.number === activeSubSagaStart)
            if (targetIndex >= 0) {
                virtualizer.scrollToIndex(targetIndex, { align: "start", behavior: reduceMotion ? "auto" : "smooth" })
            }
        }
    }, [activeSubSagaStart, filteredEpisodes, virtualizer, reduceMotion])

    return (
        <div ref={listRef} className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
                const ep = filteredEpisodes[virtualRow.index]
                if (!ep) return null
                const isHighlighted = activeSubSagaStart != null &&
                                    activeSubSagaEnd != null &&
                                    ep.number >= activeSubSagaStart &&
                                    ep.number <= activeSubSagaEnd;

                return (
                    <RowComponent
                        key={ep.id}
                        ep={ep}
                        isHighlighted={isHighlighted}
                        virtualStart={virtualRow.start}
                        scrollMargin={virtualizer.options.scrollMargin || 0}
                        rowIndex={virtualRow.index}
                        measureRef={virtualizer.measureElement}
                        priority={virtualRow.index < 4}
                        themeHideEpisodeCardDescription={ts.themeHideEpisodeCardDescription}
                        onPlay={onPlay}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                        seriesMediaId={seriesMediaId}
                    />
                )
            })}
        </div>
    )
}
