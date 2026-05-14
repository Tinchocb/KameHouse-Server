import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { Check } from "lucide-react"
import type { AudioTrack } from "../track-types"

interface AudioSettingsProps {
    audioTracks: AudioTrack[]
    activeAudioIndex: number
    onSelectAudio: (track: AudioTrack) => void
}

export function AudioSettings({
    audioTracks,
    activeAudioIndex,
    onSelectAudio,
}: AudioSettingsProps) {
    const langLabel = (lang: string) => lang.toUpperCase().slice(0, 3)

    return (
        <div className="flex flex-col">
            {audioTracks.map((track) => {
                const isActive = track.index === activeAudioIndex
                return (
                    <button
                        key={track.index}
                        onClick={() => onSelectAudio(track)}
                        className={cn(
                            "flex items-center justify-between px-4 py-3 transition-all",
                            isActive ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"
                        )}
                    >
                        <div className="flex flex-col">
                            <span className="text-xs font-bold leading-none">
                                {track.title || langLabel(track.language)}
                            </span>
                            <span className={cn(
                                "text-[9px] font-bold mt-1.5 uppercase opacity-60",
                                isActive ? "text-white" : "text-zinc-500"
                            )}>
                                {[track.codec, track.channels ? `${track.channels}ch` : undefined].filter(Boolean).join(" // ")}
                            </span>
                        </div>
                        {isActive && <Check className="w-3.5 h-3.5" />}
                    </button>
                )
            })}
        </div>
    )
}
