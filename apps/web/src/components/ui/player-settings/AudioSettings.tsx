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
            {audioTracks.map((track) => {
                const isActive = track.index === activeAudioIndex
                return (
                    <button
                        key={track.index}
                        onClick={() => onSelectAudio(track)}
                        className={cn(
                            "w-full flex items-center justify-between px-4 py-3 transition-all duration-base ease-out group text-left relative overflow-hidden",
                            isActive ? "bg-white/[0.04] text-on-surface" : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
                        )}
                    >
                        {/* Hover/Active left-edge accent indicator */}
                        <span className={cn(
                            "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] transition-all duration-base ease-out rounded-r-md",
                            isActive ? "h-1/2 bg-brand-accent" : "h-0 bg-outline-variant group-hover:h-1/3"
                        )} />

                        <div className="flex flex-col group-hover:translate-x-1.5 transition-transform duration-base ease-out">
                            <span className={cn(
                                "text-xs font-bold leading-none transition-colors duration-base",
                                isActive ? "text-brand-accent" : "text-on-surface group-hover:text-on-surface"
                            )}>
                                {track.title || getFriendlyLanguage(track.language)}
                            </span>
                            <span className={cn(
                                "text-label-sm font-bold mt-1.5 uppercase transition-colors duration-base",
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
