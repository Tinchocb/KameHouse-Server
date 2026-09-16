import React, { useRef, useEffect } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "@/components/shared/deferred-image"
import { SpringSwitch } from "@/components/ui/switch/spring-switch"

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
        estimateSize: () => 92,
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
        <>
            {/* Backdrop overlay - always rendered, CSS opacity transition */}
            <div
                onClick={onClose}
                className={cn(
                    "absolute inset-0 z-player-overlay bg-scrim/60 backdrop-blur-overlay-sm pointer-events-auto transition-opacity duration-300 ease-out",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
            />

            {/* Sidebar Panel - always mounted, CSS transform transition */}
            <div
                className={cn(
                    "absolute right-0 top-0 bottom-0 w-full sm:w-[400px] z-player-sidebar bg-zinc-950/85 backdrop-blur-overlay-2xl border-l border-white/20 shadow-[-16px_0_40px_rgba(0,0,0,0.8),inset_1px_0_0_rgba(255,255,255,0.15)] flex flex-col pointer-events-auto select-none transition-transform duration-300 ease-out",
                    isOpen ? "translate-x-0" : "translate-x-full"
                )}
                style={{
                    transform: isOpen ? "translateX(0)" : "translateX(100%)",
                }}
            >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0 bg-zinc-950/40">
                            <h3 className="text-sm font-black tracking-cinema text-white uppercase flex items-center ml-2 [&>*:not(:first-child)]:ml-2">
                                <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] animate-pulse" />
                                EPISODIOS
                                <span className="text-xs font-mono text-zinc-500 font-normal">({episodes.length})</span>
                            </h3>
                            <button
                                onClick={onClose}
                                aria-label="Cerrar lista de episodios"
                                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white bg-zinc-900/60 hover:bg-zinc-800 border border-white/15 border-t-white/30 border-b-white/10 transition-all cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Marathon Mode Toggle */}
                        {onMarathonModeChange && (
                            <div className="px-6 py-3 border-b border-white/10 flex items-center justify-between bg-zinc-950/20">
                                <span className="text-label-sm font-black uppercase tracking-widest text-white/90">Modo Maratón</span>
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
                            className="flex-1 overflow-y-auto px-6 py-4 no-scrollbar relative"
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
                                                paddingBottom: "10px",
                                            }}
                                        >
                                            <button
                                                onClick={() => {
                                                    if (onSelectEpisode) {
                                                        onSelectEpisode(epNum)
                                                    }
                                                    onClose()
                                                }}
                                                className={cn(
                                                    "w-full h-full text-left flex p-2.5 rounded-2xl border transition-all duration-base group [&>*:not(:first-child)]:ml-3 items-center cursor-pointer",
                                                    isCurrent
                                                        ? "bg-white/[0.08] border-white/30 border-t-white/50 border-l-[3px] border-l-brand-accent shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_16px_rgba(0,0,0,0.5)] text-white"
                                                        : "bg-white/[0.02] hover:bg-white/[0.05] border-white/10 hover:border-white/20 border-t-white/15 text-zinc-400 hover:text-white"
                                                )}
                                            >
                                                {/* Thumbnail / Image container (AMOLED clean) */}
                                                <div className="relative w-24 aspect-video bg-black/80 border border-white/5 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                                                    {ep.thumbnail ? (
                                                        <DeferredImage
                                                            src={ep.thumbnail}
                                                            alt={ep.title || `Episodio ${epNum}`}
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-slow"
                                                            showSkeleton={false}
                                                        />
                                                    ) : (
                                                        <span className="text-label-sm font-black text-zinc-700">SIN IMAGEN</span>
                                                    )}

                                                    {/* Dark overlay */}
                                                    <div className="absolute inset-0 bg-[color:color-mix(in_srgb,var(--md-sys-color-surface)_20%,transparent)] group-hover:bg-black/0 transition-colors duration-base" />

                                                    {/* Play overlay for current or hover */}
                                                    <div className={cn(
                                                        "absolute inset-0 flex items-center justify-center transition-all duration-base",
                                                        isCurrent ? "opacity-100 bg-brand-accent/10" : "opacity-0 group-hover:opacity-100 bg-black/40"
                                                    )}>
                                                        <svg className={cn(
                                                            "w-4 h-4 drop-shadow-md transition-transform duration-base",
                                                            isCurrent ? "text-brand-accent scale-110" : "text-white scale-90 group-hover:scale-100"
                                                        )} fill="currentColor" viewBox="0 0 24 24">
                                                            <path d="M8 5v14l11-7z" />
                                                        </svg>
                                                    </div>
                                                </div>

                                                {/* Meta content */}
                                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                    <div className="flex items-center mb-0.5 [&>*:not(:first-child)]:ml-2">
                                                        <span className={cn(
                                                            "text-label-sm font-black tracking-widest",
                                                            isCurrent ? "text-brand-accent" : "text-zinc-500"
                                                        )}>
                                                            EPISODIO {epNum}
                                                        </span>

                                                        {ep.watched && (
                                                            <span className="flex items-center justify-center w-3 h-3 rounded-full bg-status-success/20 text-status-success border border-status-success/30">
                                                                <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h4 className={cn(
                                                        "text-label-md font-black uppercase tracking-wider truncate leading-tight transition-colors",
                                                        isCurrent ? "text-white" : "text-zinc-300 group-hover:text-white"
                                                    )}>
                                                        {ep.title || `Episodio ${epNum}`}
                                                    </h4>
                                                </div>
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
        </>
    )
})
