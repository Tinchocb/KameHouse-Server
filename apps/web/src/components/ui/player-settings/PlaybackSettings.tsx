import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { Gauge, FastForward } from "lucide-react"

interface PlaybackSettingsProps {
    playbackRate: number
    onPlaybackRateChange: (rate: number) => void
    autoSkipIntro: boolean
    onAutoSkipIntroChange: (enabled: boolean) => void
    showHeatmap: boolean
    onShowHeatmapChange: (enabled: boolean) => void
    showSeparator?: boolean
}

export function PlaybackSettings({
    playbackRate,
    onPlaybackRateChange,
    autoSkipIntro,
    onAutoSkipIntroChange,
    showHeatmap,
    onShowHeatmapChange,
    showSeparator = true,
}: PlaybackSettingsProps) {
    return (
        <div className="py-4">
            {showSeparator && <div className="mx-6 h-px bg-white/10 mb-4" />}
            
            <div className="flex items-center gap-2 px-6 mb-3">
                <Gauge className="w-3.5 h-3.5 text-zinc-600" />
                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-600">VELOCIDAD</span>
            </div>
            <div className="flex flex-row px-6 gap-2 flex-wrap mb-6">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <button
                        key={rate}
                        onClick={() => onPlaybackRateChange(rate)}
                        className={cn(
                            "flex-1 min-w-[50px] py-2 text-center text-[10px] font-black tracking-widest transition-all border",
                            playbackRate === rate
                                ? "bg-white text-black border-white"
                                : "text-zinc-500 border-white/10 hover:border-white/40 hover:text-white"
                        )}
                    >
                        {rate}x
                    </button>
                ))}
            </div>

            <div className="mx-6 h-px bg-white/10 mb-4" />
            <div className="flex items-center gap-2 px-6 mb-3">
                <FastForward className="w-3.5 h-3.5 text-zinc-600" />
                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-600">AUTOMATIZACIÓN</span>
            </div>
            <button
                onClick={() => onAutoSkipIntroChange(!autoSkipIntro)}
                className={cn(
                    "flex items-center justify-between w-full px-6 py-3 transition-all",
                    autoSkipIntro ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                )}
            >
                <span className="text-[11px] font-black uppercase tracking-widest">Saltar Intro Automáticamente</span>
                <div className={cn(
                    "w-10 h-5 rounded-full relative transition-all duration-300",
                    autoSkipIntro ? "bg-white" : "bg-white/10"
                )}>
                    <div className={cn(
                        "absolute top-1 w-3 h-3 rounded-full transition-all duration-300",
                        autoSkipIntro ? "right-1 bg-black" : "left-1 bg-zinc-600"
                    )} />
                </div>
            </button>
            <button
                onClick={() => onShowHeatmapChange(!showHeatmap)}
                className={cn(
                    "flex items-center justify-between w-full px-6 py-3 transition-all",
                    showHeatmap ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                )}
            >
                <span className="text-[11px] font-black uppercase tracking-widest">Mapa de Calor</span>
                <div className={cn(
                    "w-10 h-5 rounded-full relative transition-all duration-300",
                    showHeatmap ? "bg-white" : "bg-white/10"
                )}>
                    <div className={cn(
                        "absolute top-1 w-3 h-3 rounded-full transition-all duration-300",
                        showHeatmap ? "right-1 bg-black" : "left-1 bg-zinc-600"
                    )} />
                </div>
            </button>
        </div>
    )
}
