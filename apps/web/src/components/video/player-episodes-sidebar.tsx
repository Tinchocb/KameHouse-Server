import React, { useRef, useEffect, useLayoutEffect } from "react"
import { m, AnimatePresence } from "framer-motion"
import { useVirtualizer } from "@tanstack/react-virtual"
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "@/components/shared/deferred-image"
import { IconMediaPlay, IconUiClose, IconUiCheck } from "@/components/ui/icons"
import { useReducedMotion } from "@/components/ui/kinetics/hooks"
import { useFocusTrap } from "@/hooks/use-focus-trap"
import { PLAYER_GLASS, PLAYER_ICON_BTN } from "./player-theme"

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
    /** Sin uso: Maratón vive ahora en el menú "Más". Se conserva por compatibilidad. */
    marathonMode?: boolean
    onMarathonModeChange?: (enabled: boolean) => void
}

const CARD_WIDTH = 224
const CARD_GAP = 12

/**
 * Episodios como fila horizontal de miniaturas sobre la barra de controles (AVKit/tvOS).
 * Virtualizada en horizontal; foco atrapado mientras está abierta; Esc cierra.
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

    // Al abrir: centrar el episodio actual antes de pintar (un timer de 60 ms dejaba ver el salto
    // desde el inicio de la lista, G4-NV1) y darle el foco (teclado / control remoto).
    useLayoutEffect(() => {
        if (!isOpen || currentIndex < 0) return
        virtualizer.scrollToIndex(currentIndex, { align: "center" })
        const frame = requestAnimationFrame(() => {
            dialogRef.current
                ?.querySelector<HTMLButtonElement>(`[data-episode-index="${currentIndex}"]`)
                ?.focus({ preventScroll: true })
        })
        return () => cancelAnimationFrame(frame)
    }, [isOpen, currentIndex, virtualizer])

    useEffect(() => {
        if (!isOpen) return
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation()
                e.stopImmediatePropagation()
                onClose()
            }
        }
        window.addEventListener("keydown", handleKeyDown, { capture: true })
        return () => window.removeEventListener("keydown", handleKeyDown, { capture: true })
    }, [isOpen, onClose])

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <m.div
                        key="episodes-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        onClick={onClose}
                        className="absolute inset-0 z-player-overlay bg-black/40 pointer-events-auto"
                    />
                    <m.div
                        key="episodes-strip"
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Episodios"
                        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(16px)" }}
                        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, transform: "translateY(0px)" }}
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(12px)" }}
                        transition={{ duration: reduceMotion ? 0.15 : 0.24, ease: [0.23, 1, 0.32, 1] }}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                            "absolute inset-x-3 sm:inset-x-8 bottom-[calc(7rem+env(safe-area-inset-bottom,0px))] z-player-settings pointer-events-auto rounded-3xl overflow-hidden",
                            PLAYER_GLASS
                        )}
                    >
                        <div className="flex items-center justify-between h-12 pl-5 pr-1.5">
                            <div className="flex items-baseline gap-2">
                                <span className="text-sm font-semibold tracking-wide text-label-1">Episodios</span>
                                <span className="text-xs text-label-2 tabular-nums">{episodes.length}</span>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Cerrar episodios"
                                className={PLAYER_ICON_BTN}
                            >
                                <IconUiClose className="w-4 h-4" />
                            </button>
                        </div>

                        <div
                            ref={scrollRef}
                            className="overflow-x-auto overflow-y-hidden no-scrollbar overscroll-x-contain px-4 pb-4 pt-1 touch-pan-x"
                        >
                            <ul
                                className="relative h-[188px] [[data-tv=true]_&]:h-[208px]"
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
                                                className={cn(
                                                    "group/ep flex flex-col w-full h-full p-1.5 rounded-2xl text-left cursor-pointer",
                                                    "transition-[background-color,transform] duration-fast ease-out-strong active:scale-[0.97]",
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
                                                            <span className="flex items-center gap-1.5 h-7 px-3 rounded-full bg-[var(--selected-bg)] text-[var(--selected-fg)] text-2xs font-semibold tracking-wide">
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
                    </m.div>
                </>
            )}
        </AnimatePresence>
    )
})
