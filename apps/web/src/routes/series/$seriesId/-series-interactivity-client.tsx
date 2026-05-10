import React from "react"
import { FaPlay } from "react-icons/fa"
import { ManualMatchModal } from "@/components/shared/manual-match-modal"
import { useAnimeEntryUnmatch } from "@/api/hooks/anime_entries.hooks"
import { Anime_Episode, Anime_LocalFile } from "@/api/generated/types"
import { DeferredImage } from "@/components/shared/deferred-image"
import { cn } from "@/components/ui/core/styling"
import { sanitizeHtml } from "@/lib/helpers/sanitizer"

// ─── MediaActionButtons ───────────────────────────────────────────────────────

interface MediaActionButtonsProps {
    seriesId: string
    directoryPath: string
}

const MediaActionButtons = React.memo(function MediaActionButtons({
    seriesId,
    directoryPath,
}: MediaActionButtonsProps) {
    const [matchOpen, setMatchOpen] = React.useState(false)
    const { mutateAsync: unmatch, isPending: isUnmatching } = useAnimeEntryUnmatch()

    const handleUnmatch = async () => {
        if (!directoryPath) return
        try {
            await unmatch({ paths: [directoryPath] })
        } catch (error) {
            console.error("Failed to unmatch", error)
        }
    }

    return (
        <div className="flex flex-wrap items-center gap-6 mt-8">
            {/* Play Button - Stark Brutalist */}
            <button
                className={cn(
                    "group/play relative flex items-center gap-4 px-12 py-5 bg-white text-black transition-all duration-200",
                    "font-black text-xs uppercase tracking-[0.4em] border border-white",
                    "hover:bg-black hover:text-white active:scale-95"
                )}
                onClick={() => {
                    // Trigger scan/library open
                }}
            >
                <FaPlay className="w-4 h-4" />
                <span>Reproducir</span>
            </button>

            {/* Manual Link - Stark Outline */}
            <button
                onClick={() => setMatchOpen(true)}
                className={cn(
                    "flex items-center gap-3 px-10 py-5 bg-black text-white border border-white transition-all duration-200",
                    "font-black text-xs uppercase tracking-[0.3em]",
                    "hover:bg-white hover:text-black active:scale-95"
                )}
            >
                <span>Vincular</span>
            </button>
            
            {/* Unmatch Button */}
            <button
                onClick={handleUnmatch}
                disabled={isUnmatching}
                className={cn(
                    "flex items-center gap-3 px-10 py-5 bg-transparent text-red-500 border border-red-500/50 transition-all duration-200",
                    "font-black text-xs uppercase tracking-[0.3em]",
                    "hover:bg-red-500 hover:text-white active:scale-95 disabled:opacity-50"
                )}
            >
                <span>Desvincular</span>
            </button>

            <ManualMatchModal
                isOpen={matchOpen}
                onClose={() => setMatchOpen(false)}
                directoryPath={directoryPath}
                currentMediaId={Number(seriesId)}
            />
        </div>
    )
})
MediaActionButtons.displayName = "MediaActionButtons"

// ─── EpisodeCard (Grid Version) ──────────────────────────────────────────────

interface EpisodeCardProps {
    episode: Anime_Episode
    fallbackThumb: string
    localFile?: Anime_LocalFile
    onPlay?: (localFile: Anime_LocalFile, episode: Anime_Episode) => void
    onToggleWatched?: (episode: Anime_Episode) => void
    isCurrentlyPlaying?: boolean
}

const EpisodeCard = React.memo(function EpisodeCard({
    episode,
    fallbackThumb,
    localFile,
    onPlay,
    onToggleWatched,
    isCurrentlyPlaying
}: EpisodeCardProps) {
    const thumb = episode.episodeMetadata?.image || fallbackThumb
    const epTitle = episode.titleSpanish || episode.episodeMetadata?.title || episode.episodeTitle || episode.displayTitle || `Episodio ${episode.episodeNumber}`
    const hasLocalFile = !!localFile
    const isWatched = episode.watched
    
    // Technical Info
    const technical = localFile?.technicalInfo
    const resolution = technical?.videoStream ? `${technical.videoStream.width}x${technical.videoStream.height}` : null
    const codec = technical?.videoStream?.codec?.toUpperCase()
    const fileSize = technical?.size ? `${(technical.size / (1024 * 1024 * 1024)).toFixed(2)} GB` : null
    const duration = episode.episodeMetadata?.length ? `${episode.episodeMetadata.length} MIN` : null

    const handlePlay = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (hasLocalFile && localFile && onPlay) {
            onPlay(localFile, episode)
        }
    }

    const handleToggleWatched = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (onToggleWatched) onToggleWatched(episode)
    }

    // Dynamic gradient fallback for thumb
    const baseColor = `hsl(${episode.episodeNumber * 137.5 % 360}, 50%, 20%)`

    return (
        <div
            onClick={handlePlay}
            className={cn(
                "group relative flex flex-col bg-[#0d0d14] border transition-all duration-500 overflow-hidden rounded-xl",
                isCurrentlyPlaying 
                    ? "border-brand-orange ring-1 ring-brand-orange/50 shadow-[0_0_30px_rgba(255,110,58,0.15)]" 
                    : "border-white/5 hover:border-white/20 hover:bg-white/[0.02]",
                !hasLocalFile && "opacity-60",
                hasLocalFile ? "cursor-pointer" : "cursor-default"
            )}
        >
            {/* Thumbnail Area (16:9) */}
            <div className="relative aspect-video w-full overflow-hidden bg-zinc-900/50">
                <DeferredImage
                    src={thumb}
                    alt={epTitle}
                    className={cn(
                        "w-full h-full object-cover transition-all duration-700 group-hover:scale-110",
                        isWatched && "opacity-40 grayscale-[0.5]"
                    )}
                    showSkeleton={false}
                    fallback={
                        <div 
                            className="w-full h-full opacity-30 blur-2xl"
                            style={{ background: `radial-gradient(circle at 50% 30%, ${baseColor}, transparent 80%)` }}
                        />
                    }
                />

                {/* Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60" />
                
                {/* Watched Checkmark Overlay */}
                {isWatched && (
                    <div className="absolute inset-0 flex items-center justify-center bg-brand-orange/10 backdrop-blur-[2px] transition-all duration-500">
                        <div className="w-12 h-12 rounded-full bg-brand-orange/90 text-white flex items-center justify-center shadow-xl transform scale-100 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                            </svg>
                        </div>
                    </div>
                )}

                {/* Status Badges */}
                <div className="absolute top-3 left-3 flex flex-col gap-2 z-20">
                    {hasLocalFile ? (
                        <span className="px-2 py-0.5 bg-green-500/20 backdrop-blur-md text-[8px] font-black text-green-500 tracking-widest uppercase border border-green-500/20 rounded-md">
                            LOCAL
                        </span>
                    ) : (
                        <span className="px-2 py-0.5 bg-red-500/20 backdrop-blur-md text-[8px] font-black text-red-500 tracking-widest uppercase border border-red-500/20 rounded-md">
                            FALTA
                        </span>
                    )}
                </div>

                <div className="absolute top-3 right-3 z-20">
                    <span className="px-2 py-0.5 bg-black/60 backdrop-blur-md text-[10px] font-bebas text-white tracking-widest border border-white/10 rounded-md">
                        EP {episode.episodeNumber}
                    </span>
                </div>

                {/* Hover Actions Area */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-30 bg-black/40 backdrop-blur-[2px]">
                    <div className="flex items-center gap-4">
                        {hasLocalFile && (
                            <button 
                                onClick={handlePlay}
                                className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform active:scale-95"
                            >
                                <FaPlay className="w-4 h-4 ml-1" />
                            </button>
                        )}
                        <button 
                            onClick={handleToggleWatched}
                            title={isWatched ? "Marcar como no visto" : "Marcar como visto"}
                            className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center border transition-all hover:scale-110 active:scale-95",
                                isWatched 
                                    ? "bg-brand-orange border-brand-orange text-white" 
                                    : "bg-black/60 border-white/20 text-white hover:bg-white hover:text-black hover:border-white"
                            )}
                        >
                            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Progress Bar (if in progress) - Using a mock progress for now as per user request */}
                {isCurrentlyPlaying && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-40 overflow-hidden">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: "45%" }} 
                            className="h-full bg-brand-orange" 
                        />
                    </div>
                )}
            </div>

            {/* Info Area */}
            <div className="p-4 flex flex-col gap-2">
                <h4 className={cn(
                    "text-lg font-bebas leading-tight tracking-widest uppercase line-clamp-1 transition-colors duration-300",
                    isCurrentlyPlaying ? "text-brand-orange" : "text-white group-hover:text-brand-orange"
                )}>
                    {epTitle}
                </h4>
                
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-black uppercase tracking-[0.2em] text-white/40">
                    {duration && <span className="text-white/60">{duration}</span>}
                    {resolution && <span>{resolution}</span>}
                    {codec && <span className="px-1.5 py-0.5 bg-white/5 rounded border border-white/5">{codec}</span>}
                    {fileSize && <span>{fileSize}</span>}
                </div>
            </div>
        </div>
    )
})
EpisodeCard.displayName = "EpisodeCard"

export { MediaActionButtons, EpisodeCard }
