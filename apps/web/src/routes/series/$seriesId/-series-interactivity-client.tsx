import React from "react"
import { FaPlay } from "react-icons/fa"
import { ManualMatchModal } from "@/components/shared/manual-match-modal"
import { useAnimeEntryManualMatch, useAnimeEntryUnmatch } from "@/api/hooks/anime_entries.hooks"
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

// ─── EpisodeListItem ────────────────────────────────────────────────────────

interface EpisodeListItemProps {
    episode: Anime_Episode
    seriesTitle: string
    fallbackThumb: string
    localFile?: Anime_LocalFile
    onPlay?: (localFile: Anime_LocalFile, episode: Anime_Episode) => void
    isCurrentlyPlaying?: boolean
}

const EpisodeListItem = React.memo(function EpisodeListItem({
    episode,
    seriesTitle,
    fallbackThumb,
    localFile,
    onPlay,
    isCurrentlyPlaying
}: EpisodeListItemProps) {
    const thumb = episode.episodeMetadata?.image || fallbackThumb
    const epTitle = episode.titleSpanish || episode.episodeMetadata?.title || episode.episodeTitle || episode.displayTitle || `Episodio ${episode.episodeNumber}`
    const overview = episode.episodeMetadata?.overview || episode.episodeMetadata?.summary || ""
    const cleanOverview = overview ? sanitizeHtml(overview) : ""
    const hasLocalFile = !!localFile

    const handleClick = () => {
        if (hasLocalFile && localFile && onPlay) {
            onPlay(localFile, episode)
        }
    }

    return (
        <div
            onClick={handleClick}
            className={cn(
                "group relative flex flex-col md:flex-row gap-6 p-4 border transition-all duration-500 bg-black/40 backdrop-blur-sm overflow-hidden",
                isCurrentlyPlaying 
                    ? "border-brand-orange bg-brand-orange/5 shadow-[0_0_40px_rgba(255,110,58,0.2)]" 
                    : "border-white/5 hover:border-white/20 hover:bg-white/[0.03]",
                !hasLocalFile && "opacity-40 grayscale hover:opacity-80",
                hasLocalFile && "cursor-pointer",
            )}
        >
            {/* VHS Thumbnail Area (16:9) */}
            <div className="relative aspect-video w-full md:w-80 shrink-0 border border-white/10 overflow-hidden bg-zinc-900 shadow-2xl">
                {/* Scanlines Filter */}
                <div className="absolute inset-0 z-10 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] opacity-40 group-hover:opacity-20 transition-opacity" />
                
                <DeferredImage
                    src={thumb}
                    alt={epTitle}
                    className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
                />
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                
                {/* Orange Sticker (Top Left) */}
                <div className="absolute top-4 left-4 z-20 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.6)] transform -rotate-3 group-hover:rotate-0 transition-transform duration-500">
                    <span className="px-3 py-1 bg-brand-orange text-xs font-black text-white tracking-[0.2em] uppercase border border-orange-400">
                        EP {episode.episodeNumber}
                    </span>
                </div>

                {/* Play Overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                    <div className="w-14 h-14 bg-white text-black flex items-center justify-center shadow-2xl scale-75 group-hover:scale-100 transition-all duration-500">
                        <FaPlay className="w-5 h-5 ml-1" />
                    </div>
                </div>

                {/* Watched Progress Line */}
                {isCurrentlyPlaying && (
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-brand-orange z-40" />
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col justify-center space-y-4">
                <div className="space-y-1">
                    <h4 className={cn(
                        "text-3xl font-bebas leading-none tracking-widest uppercase",
                        isCurrentlyPlaying ? "text-brand-orange" : "text-white"
                    )}>
                        {epTitle}
                    </h4>
                    
                    <div className="flex flex-wrap items-center gap-4 text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
                        {hasLocalFile && (
                            <span className="text-green-500 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                DISPONIBLE LOCAL
                            </span>
                        )}
                        {episode.episodeMetadata?.runtime && <span>{episode.episodeMetadata.runtime} MIN</span>}
                        {episode.episodeMetadata?.airDate && <span>{episode.episodeMetadata.airDate}</span>}
                    </div>
                </div>

                {/* Overview (3 lines max) */}
                {cleanOverview && (
                    <div
                        className="text-[14px] text-zinc-400 leading-relaxed line-clamp-3 font-medium tracking-wide uppercase"
                        dangerouslySetInnerHTML={{ __html: cleanOverview }}
                    />
                )}
            </div>
        </div>
    )
})
EpisodeListItem.displayName = "EpisodeListItem"

export { MediaActionButtons, EpisodeListItem }
