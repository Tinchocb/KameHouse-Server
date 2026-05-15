import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { FaPlay } from "react-icons/fa"
import { BsClock } from "react-icons/bs"
import { Star, Folder, Zap, Layers } from "lucide-react"
import { useEpisodeSources, usePrefetchEpisodeSources } from "@/api/hooks/useEpisodeSources"
import type { Episode, Saga } from "./episode-list"

interface EpisodeThumbnailProps {
    url?: string
    episodeNumber: number
    title: string
}

export const EpisodeThumbnail = React.memo(function EpisodeThumbnail({ url, episodeNumber, title }: EpisodeThumbnailProps) {
    const [broken, setBroken] = React.useState(false)
    const showFallback = !url || broken

    return (
        <div
            className={cn(
                "relative shrink-0 overflow-hidden rounded-xl border border-white/5",
                "w-[160px] h-[90px] md:w-[220px] md:h-[124px] lg:w-[260px] lg:h-[146px]",
                "bg-zinc-900",
            )}
        >
            {showFallback ? (
                <div className="w-full h-full flex items-center justify-center">
                    <span className="text-zinc-500 text-xl font-black tabular-nums select-none">
                        {episodeNumber}
                    </span>
                </div>
            ) : (
                <img
                    src={url}
                    alt={title}
                    loading="lazy"
                    draggable={false}
                    onError={() => setBroken(true)}
                    className={cn(
                        "w-full h-full object-cover select-none",
                        "transition-transform duration-300 ease-out",
                        "group-hover:scale-105",
                    )}
                />
            )}

            {!showFallback && (
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/50 to-transparent" />
            )}

            <div
                className={cn(
                    "absolute inset-0 flex items-center justify-center",
                    "opacity-0 group-hover:opacity-100",
                    "transition-opacity duration-200",
                )}
            >
                <div
                    className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        "bg-white/10 backdrop-blur-md border border-white/20",
                        "shadow-[0_0_20px_rgba(0,0,0,0.5)]",
                        "scale-75 group-hover:scale-100",
                        "transition-all duration-300 ease-out",
                    )}
                >
                    <FaPlay className="w-3 h-3 text-white ml-1" />
                </div>
            </div>
        </div>
    )
})

interface SourceBadgeProps {
    hasLocal: boolean
    hasStream: boolean
}

export const SourceBadge = React.memo(function SourceBadge({ hasLocal, hasStream }: SourceBadgeProps) {
    if (!hasLocal && !hasStream) return null

    if (hasLocal && hasStream) {
        return (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold tracking-wide bg-amber-500/10 text-amber-400">
                <Layers className="w-3 h-3" />
                <span>LOCAL + STREAM</span>
            </div>
        )
    }

    if (hasLocal) {
        return (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold tracking-wide bg-green-500/10 text-green-400">
                <Folder className="w-3 h-3" />
                <span>LOCAL</span>
            </div>
        )
    }

    return (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold tracking-wide bg-blue-500/10 text-blue-400">
            <Zap className="w-3 h-3 fill-current" />
            <span>STREAM</span>
        </div>
    )
})

export interface EpisodeCardProps {
    episode: Episode
    saga: Saga
    onPlay?: (episode: Episode, saga: Saga) => void
}

export const EpisodeCardContent = React.memo(function EpisodeCardContent({ episode, saga, onPlay }: EpisodeCardProps) {
    const { isEpic, isFiller } = episode
    const prefetch = usePrefetchEpisodeSources()

    const { data: sourcesData } = useEpisodeSources(
        episode.mediaId ? { mediaId: episode.mediaId, epNum: episode.number } : null,
    )

    const { hasLocal, hasStream } = React.useMemo(() => {
        if (sourcesData) {
            return {
                hasLocal: sourcesData.sources.some((s) => s.type === "local"),
                hasStream: sourcesData.sources.some((s) => (s.type as string) === "torrentio"),
            }
        }
        return { hasLocal: !!episode.hasLocalFile, hasStream: !episode.hasLocalFile && episode.hasLocalFile !== undefined }
    }, [sourcesData, episode.hasLocalFile])

    const handleMouseEnter = React.useCallback(() => {
        if (episode.mediaId) {
            prefetch({ mediaId: episode.mediaId, epNum: episode.number })
        }
    }, [episode.mediaId, episode.number, prefetch])

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onPlay?.(episode, saga)}
            onKeyDown={(e) => e.key === "Enter" && onPlay?.(episode, saga)}
            onMouseEnter={handleMouseEnter}
            className={cn(
                "group flex items-start lg:items-center gap-4 md:gap-6 p-3 lg:p-4 rounded-2xl cursor-pointer",
                "transition-all duration-300 active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
                "hover:bg-zinc-800/40 hover:backdrop-blur-xl border border-transparent hover:border-white/5",
                "hover:shadow-2xl hover:-translate-y-0.5",
                isEpic && "border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.05)] hover:shadow-[0_0_30px_rgba(234,179,8,0.15)]",
                isFiller && "opacity-50 grayscale hover:grayscale-0 hover:opacity-100",
                !isEpic && "active:bg-zinc-800/60"
            )}
        >
            <EpisodeThumbnail
                url={episode.thumbnailUrl}
                episodeNumber={episode.number}
                title={episode.title}
            />

            <div className="flex flex-col gap-1 min-w-0 flex-1 pt-0.5">
                <div className="flex items-baseline gap-2 flex-wrap pb-1">
                    <span className={cn(
                        "text-xs font-black tabular-nums shrink-0",
                        isEpic ? "text-yellow-500" : "text-zinc-500"
                    )}>
                        {episode.number}.
                    </span>
                    <h3 className={cn(
                        "text-sm md:text-base font-semibold leading-snug line-clamp-1 transition-colors",
                        isEpic ? "text-yellow-100 group-hover:text-yellow-50" : "text-zinc-200 group-hover:text-white"
                    )}>
                        {episode.title}
                    </h3>

                    {isEpic && (
                        <span className="inline-flex items-center text-yellow-500 shrink-0 ml-1" title="Episodio Épico">
                            <Star className="w-3.5 h-3.5 fill-current" />
                        </span>
                    )}
                    {isFiller && (
                        <span className="inline-flex items-center text-zinc-400 shrink-0 ml-1" title="Episodio de Relleno">
                            (Relleno)
                        </span>
                    )}
                </div>

                {episode.synopsis && (
                    <p className="text-zinc-400 text-xs md:text-sm leading-relaxed line-clamp-2 mt-1">
                        {episode.synopsis}
                    </p>
                )}

                {(episode.durationMin !== undefined || episode.airDate) && (
                    <div className="flex items-center gap-2 mt-0.5">
                        {episode.durationMin !== undefined && (
                            <span className="flex items-center gap-1 text-zinc-500 text-xs font-medium">
                                <BsClock className="w-2.5 h-2.5" />
                                {episode.durationMin}m
                            </span>
                        )}
                        {episode.airDate && episode.durationMin !== undefined && (
                            <span className="text-zinc-700 text-[10px]">·</span>
                        )}
                        {episode.airDate && (
                            <span className="text-zinc-600 text-xs">{episode.airDate}</span>
                        )}
                    </div>
                )}

                <div className="flex items-center justify-between mt-2">
                    <div>
                        {episode.watched && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-white/10 text-zinc-400">
                                Visto
                            </span>
                        )}
                    </div>
                    <SourceBadge hasLocal={hasLocal} hasStream={hasStream} />
                </div>
            </div>
        </div>
    )
})
