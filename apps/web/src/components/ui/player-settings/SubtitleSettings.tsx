import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { Check } from "lucide-react"
import type { SubtitleTrack } from "../track-types"

interface SubtitleSettingsProps {
    subtitleTracks: SubtitleTrack[]
    activeSubtitleIndex: number | null
    onSelectSubtitle: (track: SubtitleTrack | null) => void
}

export function SubtitleSettings({
    subtitleTracks,
    activeSubtitleIndex,
    onSelectSubtitle,
}: SubtitleSettingsProps) {
    const langLabel = (lang: string) => lang.toUpperCase().slice(0, 3)

    return (
        <div className="flex flex-col">
            <button
                onClick={() => onSelectSubtitle(null)}
                className={cn(
                    "flex items-center justify-between px-4 py-3 transition-all",
                    activeSubtitleIndex === null ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"
                )}
            >
                <span className="text-xs font-bold uppercase tracking-widest">Desactivado</span>
                {activeSubtitleIndex === null && <Check className="w-3.5 h-3.5" />}
            </button>

            {subtitleTracks.map((track) => {
                const isActive = track.index === activeSubtitleIndex
                return (
                    <button
                        key={track.index}
                        onClick={() => onSelectSubtitle(track)}
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
                                {[track.codec?.toUpperCase(), track.forced ? "FORZADO" : undefined].filter(Boolean).join(" // ")}
                            </span>
                        </div>
                        {isActive && <Check className="w-3.5 h-3.5" />}
                    </button>
                )
            })}
        </div>
    )
}
