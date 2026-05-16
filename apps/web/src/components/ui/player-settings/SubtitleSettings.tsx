import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { Check, Minus, Plus } from "lucide-react"
import type { SubtitleTrack } from "../track-types"

interface SubtitleSettingsProps {
    subtitleTracks: SubtitleTrack[]
    activeSubtitleIndex: number | null
    onSelectSubtitle: (track: SubtitleTrack | null) => void
    subtitleSize?: number
    onSubtitleSizeChange?: (size: number) => void
    getFriendlyLanguage: (lang: string) => string
}

export function SubtitleSettings({
    subtitleTracks,
    activeSubtitleIndex,
    onSelectSubtitle,
    subtitleSize = 100,
    onSubtitleSizeChange,
    getFriendlyLanguage,
}: SubtitleSettingsProps) {

    return (
        <div className="flex flex-col">
            {/* Subtitle size control */}
            {onSubtitleSizeChange && (
                <div className="px-4 py-3 border-b border-white/5 mb-1">
                    <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Tamaño de subtítulos</div>
                    <div className="flex items-center justify-between gap-3">
                        <button
                            onClick={() => onSubtitleSizeChange(Math.max(50, subtitleSize - 10))}
                            disabled={subtitleSize <= 50}
                            className="flex items-center justify-center w-7 h-7 rounded bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 transition-all"
                        >
                            <Minus className="w-3 h-3" />
                        </button>
                        <div className="flex-1 flex flex-col items-center gap-1.5">
                            <span className="text-sm font-bold text-white tabular-nums">{subtitleSize}%</span>
                            <div className="w-full h-1.5 bg-white/10 rounded-full relative">
                                <div
                                    className="absolute left-0 h-full bg-white rounded-full transition-all"
                                    style={{ width: `${((subtitleSize - 50) / 150) * 100}%` }}
                                />
                                <input
                                    type="range" min={50} max={200} step={10}
                                    value={subtitleSize}
                                    onChange={(e) => onSubtitleSizeChange(Number(e.target.value))}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                            </div>
                        </div>
                        <button
                            onClick={() => onSubtitleSizeChange(Math.min(200, subtitleSize + 10))}
                            disabled={subtitleSize >= 200}
                            className="flex items-center justify-center w-7 h-7 rounded bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 transition-all"
                        >
                            <Plus className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            )}

            {/* Track list */}
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
                                {track.title || getFriendlyLanguage(track.language)}
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
