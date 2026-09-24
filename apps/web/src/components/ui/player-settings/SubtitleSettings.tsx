import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { IconUiMinus, IconUiPlus, IconUiCheck } from "@/components/ui/icons";
import type { SubtitleTrack } from "../track-types"

interface SubtitleSettingsProps {
    subtitleTracks: SubtitleTrack[]
    activeSubtitleIndex: number | null
    onSelectSubtitle: (track: SubtitleTrack | null, opts?: { auto?: boolean }) => void
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
                <div className="px-3 py-2 border-b border-white/10 mb-1">
                    <div className="text-2xs font-semibold uppercase tracking-widest text-on-surface-variant mb-3">Tamaño de subtítulos</div>
                    <div className="flex items-center justify-between gap-3">
                        <button
                            onClick={() => onSubtitleSizeChange(Math.max(50, subtitleSize - 10))}
                            disabled={subtitleSize <= 50}
                            className="flex items-center justify-center w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-colors"
                        >
                            <IconUiMinus className="w-4 h-4" />
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
                            className="flex items-center justify-center w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-colors"
                        >
                            <IconUiPlus className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Track list */}
            <button
                onClick={() => onSelectSubtitle(null)}
                className={cn(
                    "w-full flex items-center justify-between min-h-10 py-2 px-3 rounded-full transition-colors duration-200 group text-left relative overflow-hidden",
                    activeSubtitleIndex === null ? "bg-white/10 text-white" : "text-on-surface-variant hover:bg-white/10 hover:text-white"
                )}
            >
                {/* Hover/Active left-edge accent indicator */}
                <span className={cn(
                    "hidden",
                    activeSubtitleIndex === null ? "h-1/2 bg-brand-accent" : "h-0 bg-outline-variant group-hover:h-1/3"
                )} />

                <span className={cn(
                    "text-sm transition-colors duration-base ",
                    activeSubtitleIndex === null ? "text-brand-accent" : "text-on-surface group-hover:text-on-surface"
                )}>
                    Desactivado
                </span>
                {activeSubtitleIndex === null && <IconUiCheck className="w-4 h-4 text-brand-accent" />}
            </button>

            {subtitleTracks.map((track) => {
                const isActive = track.index === activeSubtitleIndex
                return (
                    <button
                        key={track.index}
                        onClick={() => onSelectSubtitle(track)}
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
                                {[track.codec?.toUpperCase(), track.forced ? "FORZADO" : undefined].filter(Boolean).join(" // ")}
                            </span>
                        </div>
                        {isActive && <IconUiCheck className="w-4 h-4 text-brand-accent" />}
                    </button>
                )
            })}
        </div>
    )
}
