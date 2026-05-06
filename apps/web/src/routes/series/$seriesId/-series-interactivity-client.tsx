import React from "react"
import { FaPlay } from "react-icons/fa"
import { ManualMatchModal } from "@/components/shared/manual-match-modal"
import { Anime_Episode } from "@/api/generated/types"
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

// ─── EpisodeClientCard ────────────────────────────────────────────────────────

interface EpisodeClientCardProps {
    episode: Anime_Episode
    seriesTitle: string
    fallbackThumb: string
}

const EpisodeClientCard = React.memo(function EpisodeClientCard({
    episode,
    seriesTitle,
    fallbackThumb,
}: EpisodeClientCardProps) {
    const thumb = episode.episodeMetadata?.image || fallbackThumb
    const metaTitle = episode.episodeMetadata?.title || ""
    const epTitle = metaTitle || episode.episodeTitle || episode.displayTitle || `Episodio ${episode.episodeNumber}`
    const isGenericTitle = !metaTitle && !episode.episodeTitle
    const overview = episode.episodeMetadata?.overview || episode.episodeMetadata?.summary || ""
    const cleanOverview = overview ? sanitizeHtml(overview) : ""
    const airDate = episode.episodeMetadata?.airDate
    const duration = episode.episodeMetadata?.length

    return (
        <div
            className={cn(
                "group relative flex flex-col rounded-none overflow-hidden bg-black border border-white/10",
                "hover:border-white transition-all duration-200",
                !episode.isDownloaded && "opacity-40 grayscale hover:opacity-100",
            )}
        >
            {/* Thumbnail Area */}
            <div className="relative w-full aspect-video overflow-hidden bg-zinc-900 border-b border-white/10">
                <DeferredImage
                    src={thumb}
                    alt={epTitle}
                    className="w-full h-full object-cover grayscale transition-all duration-500 group-hover:grayscale-0 group-hover:scale-105"
                />
                
                {/* Overlay Area */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-12 h-12 border-2 border-white bg-black flex items-center justify-center">
                        <FaPlay className="w-4 h-4 text-white ml-1" />
                    </div>
                </div>

                {/* Top Label (Stark) */}
                <div className="absolute top-0 left-0">
                    <span className="px-3 py-1 bg-white text-[10px] font-black text-black tracking-widest uppercase border-r border-b border-white/20">
                        EP {episode.episodeNumber}
                    </span>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex flex-col gap-3 p-5 flex-1 bg-black">
                {/* Title */}
                <h4 className={cn(
                    "text-xs font-black leading-tight tracking-[0.2em] line-clamp-2 uppercase",
                    isGenericTitle ? "text-white/20 italic" : "text-white"
                )}>
                    {epTitle}
                </h4>

                {/* Overview (Stark Grey) */}
                {cleanOverview && (
                    <p
                        className="text-[10px] text-white/40 leading-relaxed line-clamp-3 font-bold uppercase tracking-wider"
                        dangerouslySetInnerHTML={{ __html: cleanOverview }}
                    />
                )}

                {/* Air Date Footer */}
                {airDate && (
                    <div className="mt-auto pt-3 border-t-2 border-white/20">
                        <span className="text-[8px] font-black tracking-[0.2em] text-white/40 uppercase">
                            {new Date(airDate).toLocaleDateString("es-ES", { month: "short", year: "numeric" })}
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
})
EpisodeClientCard.displayName = "EpisodeClientCard"

export { MediaActionButtons, EpisodeClientCard }
