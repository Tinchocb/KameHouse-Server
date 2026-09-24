import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { IconUiCheck } from "@/components/ui/icons";
import type { AudioTrack } from "../track-types"

interface AudioSettingsProps {
    audioTracks: AudioTrack[]
    activeAudioIndex: number
    onSelectAudio: (track: AudioTrack) => void
    getFriendlyLanguage: (lang: string) => string
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
                <p className="px-3 py-3 text-xs text-on-surface-variant">
                    No se detectaron otras pistas de audio.
                </p>
            )}
            {audioTracks.map((track) => {
                const isActive = track.index === activeAudioIndex
                return (
                    <button
                        key={track.index}
                        onClick={() => onSelectAudio(track)}
                        className={cn(
                            "w-full flex items-center justify-between min-h-10 py-2 px-3 rounded-full transition-colors duration-200 group text-left relative overflow-hidden",
                            isActive ? "bg-white/10 text-white" : "text-on-surface-variant hover:bg-white/10 hover:text-white"
                        )}
                    >
                        {/* Hover/Active left-edge accent indicator */}
                        <span className={cn(
                            "hidden",
                            isActive ? "h-1/2 bg-brand-accent" : "h-0 bg-outline-variant group-hover:h-1/3"
                        )} />

                        <div className="flex flex-col  transition-transform duration-base ease-out">
                            <span className={cn(
                                "text-xs font-bold leading-none transition-colors duration-base",
                                isActive ? "text-brand-accent" : "text-on-surface group-hover:text-on-surface"
                            )}>
                                {track.title || getFriendlyLanguage(track.language)}
                            </span>
                            <span className={cn(
                                "text-xs mt-0.5 transition-colors duration-base",
                                isActive ? "text-on-surface/60" : "text-on-surface-variant group-hover:text-on-surface"
                            )}>
                                {[track.codec, track.channels ? `${track.channels}ch` : undefined].filter(Boolean).join(" // ")}
                            </span>
                        </div>
                            {isActive && <IconUiCheck className="w-4 h-4 text-brand-accent" />}
                    </button>
                )
            })}
        </div>
    )
}
