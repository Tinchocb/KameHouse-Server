import React, { useRef, useEffect, useLayoutEffect, useState, useCallback } from "react"
import { m, AnimatePresence } from "framer-motion"
import { useVirtualizer } from "@tanstack/react-virtual"
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "@/components/shared/deferred-image"
import {
    IconMediaPlay,
    IconUiClose,
    IconUiCheck,
    IconNavigationChevronLeft,
    IconNavigationChevronRight,
} from "@/components/ui/icons"
import { useReducedMotion } from "@/components/ui/kinetics/hooks"
import { useFocusTrap } from "@/hooks/use-focus-trap"
import { PLAYER_GLASS, PLAYER_ICON_BTN, FOCUS_RING } from "./player-theme"

interface Episode {
    title?: string
    episodeNumber: number
    absoluteEpisodeNumber?: number
    thumbnail?: string
    watched?: boolean
}

interface PlayerEpisodesSidebarProps {
    isOpen: boolean
    onClose: () => void
    episodes: Episode[]
    currentEpisodeNumber?: number
    onSelectEpisode?: (episodeNumber: number) => void
}

const CARD_WIDTH = 224
const CARD_GAP = 12

/**
 * Episodios como fila horizontal de miniaturas sobre la barra de controles (AVKit/tvOS).
 * Virtualizada en horizontal; foco atrapado mientras está abierta; Esc cierra.
 * Flechas laterales y en cabecera para desplazamiento suave con puntero fino/ratón.
 * Soporte de rueda de ratón vertical para scroll horizontal y flechas de teclado.
 * Se mantiene el nombre del componente para no tocar a quien lo monta.
 */
export const PlayerEpisodesSidebar = React.memo(function PlayerEpisodesSidebar({
    isOpen,
    onClose,
    episodes,
    currentEpisodeNumber,
    onSelectEpisode,
}: PlayerEpisodesSidebarProps) {
    const reduceMotion = useReducedMotion()
    const dialogRef = useRef<HTMLDivElement>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const edgesRafRef = useRef<number>(0)
    const [edges, setEdges] = useState({ start: true, end: false })
    useFocusTrap(dialogRef, isOpen)

    const virtualizer = useVirtualizer({
        horizontal: true,
        count: episodes.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => CARD_WIDTH + CARD_GAP,
        overscan: 4,
    })

    const currentIndex = episodes.findIndex(
        ep => (ep.absoluteEpisodeNumber ?? ep.episodeNumber) === currentEpisodeNumber
    )

    const flushEdges = useCallback(() => {
        edgesRafRef.current = 0
        const el = scrollRef.current
        if (!el) return
        const maxScroll = el.scrollWidth - el.clientWidth
        const nextStart = el.scrollLeft <= 4
        const nextEnd = maxScroll <= 4 || el.scrollLeft >= maxScroll - 4
        setEdges((prev) => (prev.start === nextStart && prev.end === nextEnd ? prev : { start: nextStart, end: nextEnd }))
    }, [])

    const updateEdges = useCallback(() => {
        if (edgesRafRef.current) return
        edgesRafRef.current = requestAnimationFrame(flushEdges)
    }, [flushEdges])

    const scrollByDirection = useCallback((dir: -1 | 1) => {
        const el = scrollRef.current
        if (!el) return
        const scrollAmount = Math.max(CARD_WIDTH + CARD_GAP, Math.round(el.clientWidth * 0.75))
        el.scrollBy({
            left: dir * scrollAmount,
            behavior: reduceMotion ? "auto" : "smooth",
        })
    }, [reduceMotion])

    // Al abrir: centrar el episodio actual antes de pintar y darle el foco (teclado / control remoto).
    useLayoutEffect(() => {
        if (!isOpen || currentIndex < 0) return
        virtualizer.scrollToIndex(currentIndex, { align: "center" })
        const frame = requestAnimationFrame(() => {
            dialogRef.current
                ?.querySelector<HTMLButtonElement>(`[data-episode-index="${currentIndex}"]`)
                ?.focus({ preventScroll: true })
            flushEdges()
        })
        return () => cancelAnimationFrame(frame)
    }, [isOpen, currentIndex, virtualizer, flushEdges])

    // Actualizar límites cuando el contenedor cambia de tamaño o de elementos
    useEffect(() => {
        const el = scrollRef.current
        if (!el || !isOpen) return
        flushEdges()
        const ro = new ResizeObserver(updateEdges)
        ro.observe(el)
        return () => {
            ro.disconnect()
            if (edgesRafRef.current) {
                cancelAnimationFrame(edgesRafRef.current)
                edgesRafRef.current = 0
            }
        }
    }, [isOpen, flushEdges, updateEdges, episodes.length])

    // Convertir rueda vertical del ratón en desplazamiento horizontal
    useEffect(() => {
        const el = scrollRef.current
        if (!el || !isOpen) return
        const onWheel = (e: WheelEvent) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.shiftKey) {
                e.preventDefault()
                el.scrollLeft += e.deltaY
            }
        }
        el.addEventListener("wheel", onWheel, { passive: false })
        return () => el.removeEventListener("wheel", onWheel)
    }, [isOpen])

    // Teclado: Escape cierra; flechas izquierda y derecha navegan entre tarjetas de episodios
    useEffect(() => {
        if (!isOpen) return
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation()
                e.stopImmediatePropagation()
                onClose()
                return
            }
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                const active = document.activeElement as HTMLElement | null
                const indexAttr = active?.getAttribute("data-episode-index")
                if (indexAttr != null) {
                    const currentIdx = parseInt(indexAttr, 10)
                    if (!Number.isNaN(currentIdx)) {
                        const targetIdx = e.key === "ArrowLeft" ? currentIdx - 1 : currentIdx + 1
                        if (targetIdx >= 0 && targetIdx < episodes.length) {
                            e.preventDefault()
                            virtualizer.scrollToIndex(targetIdx, { align: "auto" })
                            requestAnimationFrame(() => {
                                dialogRef.current
                                    ?.querySelector<HTMLButtonElement>(`[data-episode-index="${targetIdx}"]`)
                                    ?.focus({ preventScroll: true })
                                updateEdges()
                            })
                        }
                    }
                }
            }
        }
        window.addEventListener("keydown", handleKeyDown, { capture: true })
        return () => window.removeEventListener("keydown", handleKeyDown, { capture: true })
    }, [isOpen, onClose, episodes.length, virtualizer, updateEdges])

    const canScroll = !edges.start || !edges.end

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <m.div
                        key="episodes-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.15 } }}
                        transition={{ duration: reduceMotion ? 0.15 : 0.25, ease: "easeInOut" }}
                        onClick={onClose}
                        className="absolute inset-0 z-player-overlay bg-black/40 pointer-events-auto"
                    />
                    <m.div
                        key="episodes-strip"
                        ref={dialogRef}
                        role="dialog"
                        data-liquid-surface="panel"
                        data-liquid-context="video"
                        aria-modal="true"
                        aria-label="Episodios"
                        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(12px)" }}
                        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, transform: "translateY(0px)" }}
                        exit={reduceMotion
                            ? { opacity: 0, transition: { duration: 0.15 } }
                            : { opacity: 0, transform: "translateY(8px)", transition: { duration: 0.25, ease: "easeInOut" } }}
                        transition={{ duration: reduceMotion ? 0.15 : 0.4, ease: "easeInOut" }}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                            "absolute inset-x-3 sm:inset-x-8 mx-auto max-w-7xl bottom-28 z-player-settings pointer-events-auto rounded-3xl overflow-hidden",
                            PLAYER_GLASS
                        )}
                    >
                        <div className="flex items-center justify-between h-12 pl-5 pr-1.5">
                            <div className="flex items-baseline gap-2">
                                <span className="text-sm font-semibold tracking-wide text-label-1">Episodios</span>
                                <span className="text-xs text-label-2 tabular-nums">{episodes.length}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                {canScroll && (
                                    <div className="hidden sm:flex items-center gap-1 mr-1">
                                        <button
                                            type="button"
                                            onClick={() => scrollByDirection(-1)}
                                            disabled={edges.start}
                                            aria-label="Episodios anteriores"
                                            className={cn(
                                                PLAYER_ICON_BTN,
                                                "disabled:opacity-[var(--control-disabled-opacity)] disabled:pointer-events-none disabled:cursor-not-allowed"
                                            )}
                                        >
                                            <IconNavigationChevronLeft className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => scrollByDirection(1)}
                                            disabled={edges.end}
                                            aria-label="Siguientes episodios"
                                            className={cn(
                                                PLAYER_ICON_BTN,
                                                "disabled:opacity-[var(--control-disabled-opacity)] disabled:pointer-events-none disabled:cursor-not-allowed"
                                            )}
                                        >
                                            <IconNavigationChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={onClose}
                                    aria-label="Cerrar episodios"
                                    className={PLAYER_ICON_BTN}
                                >
                                    <IconUiClose className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="relative group/strip">
                            {/* Gradiente decorativo y flecha flotante izquierda */}
                            <div
                                aria-hidden="true"
                                className={cn(
                                    "pointer-events-none absolute left-0 top-0 bottom-4 w-20 z-10 rounded-l-2xl",
                                    "bg-gradient-to-r from-black/85 via-black/40 to-transparent",
                                    "transition-opacity duration-fast ease-smooth-out",
                                    edges.start ? "opacity-0" : "opacity-100"
                                )}
                            />
                            <button
                                type="button"
                                tabIndex={edges.start ? -1 : 0}
                                disabled={edges.start}
                                onClick={() => scrollByDirection(-1)}
                                aria-label="Desplazar episodios hacia la izquierda"
                                className={cn(
                                    "absolute left-2.5 top-[70px] -translate-y-1/2 z-20 flex items-center justify-center w-10 h-10 rounded-full",
                                    "bg-[var(--neutral-elev-2)] text-label-1 border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-control-shadow)]",
                                    "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-white motion-safe:active:scale-[0.97]",
                                    "transition-[background-color,transform,color,opacity] duration-fast ease-smooth-out cursor-pointer",
                                    edges.start ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto",
                                    FOCUS_RING
                                )}
                            >
                                <IconNavigationChevronLeft className="w-5 h-5" />
                            </button>

                            {/* Gradiente decorativo y flecha flotante derecha */}
                            <div
                                aria-hidden="true"
                                className={cn(
                                    "pointer-events-none absolute right-0 top-0 bottom-4 w-20 z-10 rounded-r-2xl",
                                    "bg-gradient-to-l from-black/85 via-black/40 to-transparent",
                                    "transition-opacity duration-fast ease-smooth-out",
                                    edges.end ? "opacity-0" : "opacity-100"
                                )}
                            />
                            <button
                                type="button"
                                tabIndex={edges.end ? -1 : 0}
                                disabled={edges.end}
                                onClick={() => scrollByDirection(1)}
                                aria-label="Desplazar episodios hacia la derecha"
                                className={cn(
                                    "absolute right-2.5 top-[70px] -translate-y-1/2 z-20 flex items-center justify-center w-10 h-10 rounded-full",
                                    "bg-[var(--neutral-elev-2)] text-label-1 border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-control-shadow)]",
                                    "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-white motion-safe:active:scale-[0.97]",
                                    "transition-[background-color,transform,color,opacity] duration-fast ease-smooth-out cursor-pointer",
                                    edges.end ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto",
                                    FOCUS_RING
                                )}
                            >
                                <IconNavigationChevronRight className="w-5 h-5" />
                            </button>

                            <div
                                ref={scrollRef}
                                onScroll={updateEdges}
                                className="overflow-x-auto overflow-y-hidden no-scrollbar overscroll-x-contain px-4 pb-4 pt-1 touch-pan-x"
                            >
                                <ul
                                    className="relative h-[188px]"
                                    style={{ width: `${virtualizer.getTotalSize()}px` }}
                                >
                                    {virtualizer.getVirtualItems().map((item) => {
                                        const ep = episodes[item.index]
                                        if (!ep) return null
                                        const epNum = ep.absoluteEpisodeNumber ?? ep.episodeNumber
                                        const isCurrent = epNum === currentEpisodeNumber
                                        return (
                                            <li
                                                key={item.key}
                                                className="absolute top-0 h-full"
                                                style={{ width: CARD_WIDTH, transform: `translateX(${item.start}px)` }}
                                            >
                                                <button
                                                    type="button"
                                                    data-episode-index={item.index}
                                                    onClick={() => {
                                                        onSelectEpisode?.(epNum)
                                                        onClose()
                                                    }}
                                                    aria-label={`Episodio ${epNum}${ep.title ? `: ${ep.title}` : ""}${ep.watched ? " (visto)" : ""}`}
                                                    aria-current={isCurrent ? "true" : undefined}
                                                    title={ep.title || `Episodio ${epNum}`}
                                                    className={cn(
                                                        "group/ep flex flex-col w-full h-full p-1.5 rounded-2xl text-left cursor-pointer",
                                                        "transition-[background-color,transform] duration-fast ease-out-strong active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
                                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
                                                        isCurrent ? "bg-[var(--neutral-elev-3)]" : "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-2)]"
                                                    )}
                                                >
                                                    <span className="relative block w-full aspect-video rounded-xl overflow-hidden bg-[var(--neutral-elev-2)]">
                                                        {ep.thumbnail && (
                                                            <DeferredImage
                                                                src={ep.thumbnail}
                                                                alt=""
                                                                className="w-full h-full object-cover"
                                                                showSkeleton={false}
                                                            />
                                                        )}
                                                        {isCurrent && (
                                                            <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                                                                <span className="flex items-center gap-1.5 h-7 px-3 rounded-full bg-[var(--selected-bg)] text-[var(--selected-fg)] text-xs font-semibold tracking-wide">
                                                                    <IconMediaPlay className="w-3 h-3 fill-current" />
                                                                    Viendo
                                                                </span>
                                                            </span>
                                                        )}
                                                        {!isCurrent && ep.watched && (
                                                            <span className="absolute top-1.5 right-1.5 flex items-center justify-center w-6 h-6 rounded-full bg-black/70 text-white" title="Visto">
                                                                <IconUiCheck className="w-3.5 h-3.5" />
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className={cn(
                                                        "mt-2 px-1 text-xs font-medium tabular-nums",
                                                        isCurrent ? "text-brand-accent-readable" : "text-on-surface-variant"
                                                    )}>
                                                        Episodio {epNum}
                                                    </span>
                                                    <span className={cn(
                                                        "px-1 text-xs font-semibold tracking-wide line-clamp-2 mt-0.5",
                                                        "text-label-1"
                                                    )}>
                                                        {ep.title || `Episodio ${epNum}`}
                                                    </span>
                                                </button>
                                            </li>
                                        )
                                    })}
                                </ul>
                            </div>
                        </div>
                    </m.div>
                </>
            )}
        </AnimatePresence>
    )
})
