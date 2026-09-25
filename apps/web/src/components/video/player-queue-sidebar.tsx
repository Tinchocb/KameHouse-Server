import React from "react"
import { m, AnimatePresence } from "framer-motion"
import { IconUiClose, IconMediaPlay } from "@/components/ui/icons"
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "@/components/shared/deferred-image"
import { useQueueStore, type PlaylistItem } from "@/lib/store"
import { PlayerPanelReveal } from "./player-panel-reveal"
import { ElasticCounter } from "@/components/ui/kinetics/elastic-counter"
import { HoldConfirm } from "@/components/ui/kinetics/hold-confirm"
import { useSpringPreset, useReducedMotion } from "@/components/ui/kinetics/hooks"

interface PlayerQueueSidebarProps {
    isOpen: boolean
    onClose: () => void
    playlistQueue: PlaylistItem[]
    currentQueueIndex: number
    onSelectItem?: (item: PlaylistItem, index: number) => void
}

export const PlayerQueueSidebar = React.memo(function PlayerQueueSidebar({
    isOpen,
    onClose,
    playlistQueue,
    currentQueueIndex,
    onSelectItem,
}: PlayerQueueSidebarProps) {
    const itemSpring = useSpringPreset("tabContent")
    const prefersReducedMotion = useReducedMotion()

    return (
        <PlayerPanelReveal
            isOpen={isOpen}
            onClose={onClose}
            title="Cola"
            titleBadge={
                <span className="flex items-center text-sm text-white/40 font-normal tabular-nums">
                    <ElasticCounter value={playlistQueue.length} />
                </span>
            }
            ariaLabel="Cola de reproducción"
        >
            {/* Queue Items List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar">
                <AnimatePresence mode="popLayout" initial={false}>
                    {playlistQueue.map((item, idx) => {
                        const isCurrent = idx === currentQueueIndex

                        return (
                            <m.div
                                key={`${String(item.id)}_${String(item.episodeNumber ?? "")}_${String(item.mediaId)}_${item.playableUrl}`}
                                layout={!prefersReducedMotion}
                                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
                                transition={itemSpring}
                                className={cn(
                                    "w-full flex items-center gap-1 p-2 rounded-xl transition-colors duration-150 group relative",
                                    isCurrent ? "bg-white/10" : "hover:bg-white/[0.06]"
                                )}
                            >
                                {/* Clickable Area to play */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        useQueueStore.getState().setCurrentQueueIndex(idx)
                                        onSelectItem?.(item, idx)
                                    }}
                                    aria-label={`Reproducir ${item.title}`}
                                    aria-current={isCurrent ? "true" : undefined}
                                    className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer text-left"
                                >
                                    {/* Thumbnail */}
                                    <div className="relative w-24 aspect-video rounded-sm overflow-hidden shrink-0 bg-white/5">
                                        {item.thumbnail && (
                                            <DeferredImage
                                                src={item.thumbnail}
                                                alt=""
                                                className="w-full h-full object-cover"
                                                showSkeleton={false}
                                            />
                                        )}
                                        {isCurrent && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                                <IconMediaPlay className="w-4 h-4 text-brand-accent fill-current" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        {item.subtitle && (
                                            <div className={cn("text-2xs font-semibold uppercase tracking-widest tabular-nums truncate", isCurrent ? "text-brand-accent" : "text-on-surface-variant")}>
                                                {item.subtitle}
                                            </div>
                                        )}
                                        <div className={cn("text-xs font-semibold tracking-wide truncate mt-0.5", isCurrent ? "text-white" : "text-white/80")}>
                                            {item.title}
                                        </div>
                                    </div>
                                </button>

                                {/* Remove button (accessible hit area min-h-[44px]) */}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        useQueueStore.getState().removeFromQueue(idx)
                                    }}
                                    aria-label={`Eliminar ${item.title} de la cola`}
                                    className="w-9 h-9 shrink-0 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-[color,background-color,border-color,transform] duration-150 cursor-pointer active:scale-90"
                                    title="Eliminar de la cola"
                                >
                                    <IconUiClose className="w-4 h-4" />
                                </button>
                            </m.div>
                        )
                    })}
                </AnimatePresence>

                {playlistQueue.length === 0 && (
                    <div className="py-20 flex flex-col items-center justify-center text-center">
                        <p className="text-xs font-semibold tracking-wide text-on-surface-variant">
                            La cola está vacía
                        </p>
                    </div>
                )}
            </div>

            {/* Footer / Actions with HoldConfirm */}
            {playlistQueue.length > 0 && (
                <div className="p-3 border-t border-white/10 shrink-0 flex">
                    <HoldConfirm
                        holdDurationMs={800}
                        label="Mantener para vaciar cola"
                        confirmLabel="¡Cola vaciada!"
                        variant="destructive"
                        onConfirm={() => {
                            useQueueStore.getState().clearQueue()
                        }}
                        className="w-full h-10 rounded-full text-xs font-semibold tracking-wide text-on-surface-variant hover:text-white hover:bg-white/10 transition-colors duration-200 cursor-pointer"
                    />
                </div>
            )}
        </PlayerPanelReveal>
    )
})
