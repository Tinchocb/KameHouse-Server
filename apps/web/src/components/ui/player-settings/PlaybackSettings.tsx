import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { Gauge, FastForward, Repeat } from "lucide-react"

interface PlaybackSettingsProps {
    playbackRate: number
    onPlaybackRateChange: (rate: number) => void
    autoSkipIntro: boolean
    onAutoSkipIntroChange: (enabled: boolean) => void
    autoSkipOutro: boolean
    onAutoSkipOutroChange: (enabled: boolean) => void
    showHeatmap: boolean
    onShowHeatmapChange: (enabled: boolean) => void
    loopEnabled: boolean
    onLoopEnabledChange: (enabled: boolean) => void
    autoDisableSubtitlesWhenDubbed?: boolean
    onAutoDisableSubtitlesWhenDubbedChange?: (enabled: boolean) => void
    ambilightEnabled?: boolean
    onAmbilightChange?: (enabled: boolean) => void
    tvMode?: boolean
    onTvModeChange?: (enabled: boolean) => void
    showSeparator?: boolean
}

function ToggleRow({ label, enabled, onChange }: { label: string; enabled: boolean; onChange: (v: boolean) => void }) {
    const handleToggle = () => {
        onChange(!enabled)
    }

    return (
        <button
            onClick={handleToggle}
            className={cn(
                "flex items-center justify-between w-full px-6 py-3 transition-all duration-300 ease-out group text-left relative overflow-hidden",
                enabled ? "text-white" : "text-zinc-500 hover:text-zinc-300"
            )}
        >
            {/* Hover visual accent indicator on the left edge */}
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-0 bg-brand-orange group-hover:h-1/2 transition-all duration-300 ease-out rounded-r-md" />

            <span className="text-[11px] font-black uppercase tracking-widest text-left group-hover:translate-x-1.5 transition-transform duration-300 ease-out">{label}</span>
            <div className={cn(
                "w-9 h-5 rounded-full relative transition-all duration-300 shrink-0 ml-4 border border-white/5",
                enabled ? "bg-brand-orange" : "bg-white/10"
            )}>
                <div className={cn(
                    "absolute top-[3px] w-3 h-3 rounded-full transition-all duration-300 shadow-sm",
                    enabled ? "left-[21px] bg-white" : "left-[3px] bg-zinc-400"
                )} />
            </div>
        </button>
    )
}

export function PlaybackSettings({
    playbackRate,
    onPlaybackRateChange,
    autoSkipIntro,
    onAutoSkipIntroChange,
    autoSkipOutro,
    onAutoSkipOutroChange,
    showHeatmap,
    onShowHeatmapChange,
    loopEnabled,
    onLoopEnabledChange,
    autoDisableSubtitlesWhenDubbed = true,
    onAutoDisableSubtitlesWhenDubbedChange = () => {},
    ambilightEnabled = true,
    onAmbilightChange = () => {},
    tvMode = false,
    onTvModeChange = () => {},
    showSeparator = true,
}: PlaybackSettingsProps) {
    return (
        <div className="py-4">
            {showSeparator && <div className="mx-6 h-px bg-white/10 mb-4" />}

            {/* Speed */}
            <div className="flex items-center gap-2 px-6 mb-3">
                <Gauge className="w-3.5 h-3.5 text-zinc-600" />
                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-600">Velocidad</span>
            </div>
            <div className="flex flex-row px-6 gap-2 flex-wrap mb-6">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => {
                    const isActive = playbackRate === rate
                    return (
                        <button
                            key={rate}
                            onClick={() => onPlaybackRateChange(rate)}
                            className={cn(
                                "flex-1 min-w-[50px] py-2 text-center text-[10px] font-black tracking-widest transition-all duration-300 border rounded-lg active:scale-95",
                                isActive
                                    ? "bg-brand-orange text-white border-brand-orange shadow-md shadow-brand-orange/15"
                                    : "text-zinc-500 border-white/5 hover:border-white/20 hover:text-white bg-white/[0.02]"
                            )}
                        >
                            {rate}x
                        </button>
                    )
                })}
            </div>

            {/* Auto-skip section */}
            <div className="mx-6 h-px bg-white/10 mb-4" />
            <div className="flex items-center gap-2 px-6 mb-3">
                <FastForward className="w-3.5 h-3.5 text-zinc-600" />
                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-600">Skip Automático</span>
            </div>
            <ToggleRow label="Modo TV (Reproducción Continua)" enabled={tvMode} onChange={onTvModeChange} />
            <ToggleRow label="Saltar Intro Automáticamente" enabled={autoSkipIntro} onChange={onAutoSkipIntroChange} />
            <ToggleRow label="Saltar Outro Automáticamente" enabled={autoSkipOutro} onChange={onAutoSkipOutroChange} />

            {/* Misc section */}
            <div className="mx-6 h-px bg-white/10 my-4" />
            <div className="flex items-center gap-2 px-6 mb-3">
                <Repeat className="w-3.5 h-3.5 text-zinc-600" />
                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-600">Opciones</span>
            </div>
            <ToggleRow label="Iluminación Inmersiva Ambilight" enabled={ambilightEnabled} onChange={onAmbilightChange} />
            <ToggleRow label="Mapa de Calor (timeline)" enabled={showHeatmap} onChange={onShowHeatmapChange} />
            <ToggleRow label="Repetir Episodio (Loop)" enabled={loopEnabled} onChange={onLoopEnabledChange} />
            <ToggleRow label="Desactivar subs con Audio Español (Dub)" enabled={autoDisableSubtitlesWhenDubbed} onChange={onAutoDisableSubtitlesWhenDubbedChange} />
        </div>
    )
}
