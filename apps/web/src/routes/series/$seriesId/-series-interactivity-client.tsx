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
        <div className="flex flex-wrap items-center gap-3">
            <button
                className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 active:scale-95 transition-all text-white font-black text-base uppercase tracking-wider shadow-[0_4px_20px_rgba(249,115,22,0.3)] button-glow-hover"
                onClick={() => {
                    // Trigger scan/library open — placeholder for now
                }}
            >
                <FaPlay className="w-3.5 h-3.5" />
                Reproducir
            </button>

            <button
                onClick={() => setMatchOpen(true)}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 active:scale-95 transition-all text-white/70 hover:text-white font-bold text-sm glass-panel"
            >
                Vincular manualmente
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
    // Priority: episodeMetadata.title > episodeTitle > displayTitle > "Episodio N"
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
                "group relative flex flex-col rounded-2xl overflow-hidden bg-white/[0.02] border border-white/[0.05]",
                "hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300",
                "hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)]",
                episode.isDownloaded ? "ring-1 ring-emerald-500/30" : "opacity-60",
            )}
        >
            {/* Thumbnail */}
            <div className="relative w-full aspect-video overflow-hidden bg-neutral-900">
                <DeferredImage
                    src={thumb}
                    alt={epTitle}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/* Overlay play */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
                        <FaPlay className="w-4 h-4 text-white ml-0.5" />
                    </div>
                </div>
                {/* Episode number badge */}
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[11px] font-black text-white/80 font-mono">
                    #{episode.episodeNumber}
                </span>
                {/* Duration */}
                {duration && duration > 0 && (
                    <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] font-bold text-white/60">
                        {duration} min
                    </span>
                )}
                {/* Downloaded indicator */}
                {episode.isDownloaded && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                )}
            </div>

            {/* Info */}
            <div className="flex flex-col gap-1.5 p-3 flex-1">
                {/* Title */}
                <p className={cn(
                    "text-sm font-bold leading-snug line-clamp-2",
                    isGenericTitle ? "text-white/40 italic" : "text-white/90"
                )}>
                    {epTitle}
                </p>

                {/* Overview */}
                {cleanOverview && (
                    <p
                        className="text-[11px] text-white/40 leading-relaxed line-clamp-3 mt-0.5"
                        dangerouslySetInnerHTML={{ __html: cleanOverview }}
                    />
                )}

                {/* Air date */}
                {airDate && (
                    <p className="text-[10px] text-white/25 font-medium mt-auto pt-1">
                        {new Date(airDate).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                )}
            </div>
        </div>
    )
})
EpisodeClientCard.displayName = "EpisodeClientCard"

export { MediaActionButtons, EpisodeClientCard }
