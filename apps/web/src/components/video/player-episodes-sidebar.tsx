import React, { useRef, useEffect } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "@/components/shared/deferred-image"
import { SpringSwitch } from "@/components/ui/switch/spring-switch"
import { IconMediaPlay } from "@/components/ui/icons"
import { PlayerPanelReveal } from "./player-panel-reveal"

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
    marathonMode?: boolean
    onMarathonModeChange?: (enabled: boolean) => void
}

export const PlayerEpisodesSidebar = React.memo(function PlayerEpisodesSidebar({
    isOpen,
    onClose,
    episodes,
    currentEpisodeNumber,
    onSelectEpisode,
    marathonMode = false,
    onMarathonModeChange,
}: PlayerEpisodesSidebarProps) {
    const parentRef = useRef<HTMLDivElement>(null)

    const rowVirtualizer = useVirtualizer({
        count: episodes.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 72,
        overscan: 4,
    })

    useEffect(() => {
        if (isOpen && currentEpisodeNumber !== undefined && episodes.length > 0) {
            const idx = episodes.findIndex(
                ep => (ep.absoluteEpisodeNumber ?? ep.episodeNumber) === currentEpisodeNumber
            )
            if (idx >= 0) {
                const timer = setTimeout(() => {
                    rowVirtualizer.scrollToIndex(idx, { align: "center" })
                }, 100)
                return () => clearTimeout(timer)
            }
        }
    }, [isOpen, currentEpisodeNumber, episodes, rowVirtualizer])

    return (
        <PlayerPanelReveal
            isOpen={isOpen}
            onClose={onClose}
            title="Episodios"
            titleBadge={<span className="text-sm text-white/40 font-normal tabular-nums">{episodes.length}</span>}
            ariaLabel="Lista de episodios"
        >
            {/* Marathon Mode Toggle */}
            {onMarathonModeChange && (
                <div className="h-12 px-5 border-b border-white/10 flex items-center justify-between">
                    <span className="text-xs font-semibold tracking-wide text-white">Modo Maratón</span>
                    <SpringSwitch
                        checked={marathonMode}
                        onChange={onMarathonModeChange}
                        ariaLabel="Modo Maratón"
                        size="sm"
                    />
                </div>
            )}

            {/* Virtualized Episodes List */}
            <div
                ref={parentRef}
                className="flex-1 overflow-y-auto px-2 py-2 no-scrollbar relative"
            >
                <div
                    style={{
                        height: `${rowVirtualizer.getTotalSize()}px`,
                        width: "100%",
                        position: "relative",
                    }}
                >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const ep = episodes[virtualRow.index]
                        if (!ep) return null
                        const epNum = ep.absoluteEpisodeNumber ?? ep.episodeNumber
                        const isCurrent = epNum === currentEpisodeNumber

                        return (
                            <div
                                key={virtualRow.key}
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                    height: `${virtualRow.size}px`,
                                    transform: `translateY(${virtualRow.start}px)`,
                                    paddingBottom: "4px",
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (onSelectEpisode) onSelectEpisode(epNum)
                                        onClose()
                                    }}
                                    aria-label={`Episodio ${epNum}: ${ep.title || ""}`}
                                    aria-current={isCurrent ? "true" : undefined}
                                    className={cn(
                                        "w-full h-full flex items-center gap-3 p-2 rounded-xl text-left cursor-pointer transition-colors duration-150",
                                        isCurrent ? "bg-white/10" : "hover:bg-white/[0.06]"
                                    )}
                                >
                                    <div className="relative w-24 aspect-video rounded-sm overflow-hidden shrink-0 bg-white/5">
                                        {ep.thumbnail && (
                                            <DeferredImage
                                                src={ep.thumbnail}
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
                                        <div className={cn("text-2xs font-semibold uppercase tracking-widest tabular-nums", isCurrent ? "text-brand-accent" : "text-on-surface-variant")}>
                                            Episodio {epNum}{ep.watched && <span className="text-white/40"> · Visto</span>}
                                        </div>
                                        <div className={cn("text-xs font-semibold tracking-wide truncate mt-0.5", isCurrent ? "text-white" : "text-white/80")}>
                                            {ep.title || `Episodio ${epNum}`}
                                        </div>
                                    </div>
                                </button>
                            </div>
                        )
                    })}
                </div>
            </div>
        </PlayerPanelReveal>
    )
})
