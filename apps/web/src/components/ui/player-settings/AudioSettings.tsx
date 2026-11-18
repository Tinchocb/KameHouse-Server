import { cn } from "@/components/ui/core/styling"
import { SelectionMark } from "@/components/ui/kinetics/selection-mark"
import type { AudioTrack } from "../track-types"
import { audioTrackName } from "./track-labels"

interface AudioSettingsProps {
    audioTracks: AudioTrack[]
    activeAudioIndex: number
    onSelectAudio: (track: AudioTrack) => void
    getFriendlyLanguage: (lang: string) => string
}

/** 1 → "Mono", 2 → "Estéreo", 6 → "5.1", 8 → "7.1"; otro valor, "N canales". */
function channelsLabel(channels?: number): string | undefined {
    if (!channels) return undefined
    if (channels === 1) return "Mono"
    if (channels === 2) return "Estéreo"
    if (channels === 6) return "5.1"
    if (channels === 8) return "7.1"
    return `${channels} canales`
}

export function AudioSettings({
    audioTracks,
    activeAudioIndex,
    onSelectAudio,
    getFriendlyLanguage,
}: AudioSettingsProps) {

    return (
        <div className="flex flex-col">
            {audioTracks.length === 0 && (
                <p className="px-3 py-3 text-xs text-label-2">
                    No se detectaron otras pistas de audio.
                </p>
            )}
            {audioTracks.map((track, position) => {
                const isActive = track.index === activeAudioIndex
                return (
                    <button
                        type="button"
                        key={track.index}
                        onClick={() => onSelectAudio(track)}
                        aria-pressed={isActive}
                        className={cn(
                            "w-full flex items-center justify-between min-h-[44px] py-2 px-3 rounded-full transition-[background-color,color,transform] duration-fast ease-out-strong motion-safe:active:scale-[0.97] cursor-pointer group text-left relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
                            isActive ? "bg-[var(--neutral-elev-3)] text-label-1" : "text-label-2 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-label-1"
                        )}
                    >
                        <div className="flex flex-col transition-transform duration-base ease-out">
                            <span className={cn(
                                "text-xs font-bold leading-none transition-colors duration-base",
                                isActive ? "text-brand-accent-readable" : "text-on-surface [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-on-surface"
                            )}>
                                {audioTrackName(track, position, getFriendlyLanguage)}
                            </span>
                            <span className={cn(
                                "text-xs mt-0.5 transition-colors duration-base",
                                isActive ? "text-label-2" : "text-label-2 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-on-surface"
                            )}>
                                {[track.codec?.toUpperCase(), channelsLabel(track.channels)].filter(Boolean).join(" · ")}
                            </span>
                        </div>
                        <SelectionMark selected={isActive} />
                    </button>
                )
            })}
        </div>
    )
}
