import React from "react"
import { Play, Pause, ChevronLeft, ChevronRight, Volume2, VolumeX, Maximize, Minimize, ChevronUp, Subtitles } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { TimelineHeatmap, type InsightNode } from "@/components/ui/timeline-heatmap"
import { PlayerSettingsMenu } from "@/components/ui/PlayerSettingsMenu"
import type { AudioTrack, SubtitleTrack } from "@/components/ui/track-types"
import type { EpisodeSource } from "@/api/types/unified.types"

// We use a helper here to format the time since it is shared.
const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return "00:00"
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export interface PlayerBottomBarProps {
    duration: number
    insights: InsightNode[]
    progressBarRef: React.RefObject<HTMLDivElement>
    progressInputRef: React.RefObject<HTMLInputElement>
    handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void
    isPlaying: boolean
    togglePlay: () => void
    skipTime: (amount: number) => void
    isMuted: boolean
    toggleMute: () => void
    volume: number
    handleVolume: (e: React.ChangeEvent<HTMLInputElement>) => void
    timeTextRef: React.RefObject<HTMLSpanElement>
    
    // settings menu
    audioTracks: AudioTrack[]
    activeAudioIndex: number
    onSelectAudio: (track: AudioTrack) => void
    subtitleTracks: SubtitleTrack[]
    activeSubtitleIndex: number | null
    onSelectSubtitle: (track: SubtitleTrack | null) => void
    isJassubLoading: boolean
    episodeSources: EpisodeSource[]
    activeStreamUrl: string
    handleSourceSwitch: (source: EpisodeSource) => void

    isFullscreen: boolean
    toggleFullscreen: () => void
}

export function PlayerBottomBar({
    duration, insights, progressBarRef, progressInputRef, handleSeek,
    isPlaying, togglePlay, skipTime,
    isMuted, toggleMute, volume, handleVolume,
    timeTextRef,
    audioTracks, activeAudioIndex, onSelectAudio,
    subtitleTracks, activeSubtitleIndex, onSelectSubtitle,
    isJassubLoading, episodeSources, activeStreamUrl, handleSourceSwitch,
    isFullscreen, toggleFullscreen
}: PlayerBottomBarProps) {
    return (
        <div className={cn(
            "absolute bottom-0 inset-x-0 w-full flex flex-col pointer-events-auto select-none",
            "bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-12 pb-6 px-6",
            "transition-all duration-300 ease-out",
            "opacity-100 translate-y-0"
        )}>
            
            {/* Sleek Progress Timeline */}
            <div className="relative w-full h-1 bg-white/20 group cursor-pointer flex items-center hover:h-1.5 transition-all duration-200" onClick={(e) => { e.stopPropagation() }}>
                
                <TimelineHeatmap duration={duration} insights={insights} />

                <div
                    ref={progressBarRef}
                    className="h-full bg-white relative z-10"
                    style={{ width: "0%" }}
                >
                    {/* Hover Thumb Component (Circular dot) */}
                    <div
                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    />
                </div>

                {/* Dragging input */}
                <input
                    ref={progressInputRef}
                    type="range"
                    min={0}
                    max={duration || 100}
                    defaultValue={0}
                    onChange={(e) => { e.stopPropagation(); handleSeek(e); }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer touch-none z-20"
                />
            </div>

            {/* Bottom Controls Row */}
            <div className="flex items-center justify-between w-full pt-4">

                {/* Left Wing */}
                <div className="flex items-center gap-6">
                    <button
                        onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                        aria-label={isPlaying ? "Pausar" : "Reproducir"}
                        className="text-zinc-200 hover:text-white transition-all flex items-center justify-center">
                        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                    </button>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={(e) => { e.stopPropagation(); skipTime(-10); }}
                            aria-label="Retroceder 10 segundos"
                            className="text-zinc-400 hover:text-white transition-all flex items-center justify-center">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); skipTime(10); }}
                            aria-label="Adelantar 10 segundos"
                            className="text-zinc-400 hover:text-white transition-all flex items-center justify-center">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Volume Control */}
                    <div className="hidden md:flex items-center gap-3 group">
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                            aria-label={isMuted || volume === 0 ? "Activar sonido" : "Silenciar"}
                            className="text-zinc-400 hover:text-white transition-all flex items-center justify-center">
                            {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </button>
                        <div className="w-0 overflow-hidden group-hover:w-20 transition-all duration-300 flex items-center relative h-full">
                            <div className="w-full h-1 bg-white/20 relative rounded-full">
                                <div className="absolute left-0 h-full bg-white rounded-full" style={{ width: `${isMuted ? 0 : volume * 100}%` }} />
                                <input
                                    type="range"
                                    min={0} max={1} step={0.05}
                                    value={isMuted ? 0 : volume}
                                    onChange={(e) => { e.stopPropagation(); handleVolume(e); }}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer touch-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Time indicator */}
                    <div className="flex items-center gap-1.5 text-sm font-medium tracking-wide tabular-nums">
                        <span ref={timeTextRef} className="text-white">00:00</span>
                        <span className="text-zinc-600">/</span>
                        <span className="text-zinc-400">{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Right Wing: Settings, Fullscreen */}
                <div className="flex items-center gap-5">
                    
                    <button
                        aria-label="Siguiente Episodio (Próximamente)"
                        className="text-zinc-400 hover:text-white transition-all flex items-center justify-center">
                        <ChevronUp className="w-5 h-5" />
                    </button>
                    
                    <button
                        onClick={(e) => { e.stopPropagation(); /* TODO: quick subtitle toggle */ }}
                        aria-label="Subtítulos"
                        className="text-zinc-400 hover:text-white transition-all flex items-center justify-center relative">
                        <Subtitles className="w-5 h-5" />
                        {activeSubtitleIndex !== null && (
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-brand-orange rounded-full" />
                        )}
                    </button>

                    <PlayerSettingsMenu
                        audioTracks={audioTracks}
                        activeAudioIndex={activeAudioIndex}
                        onSelectAudio={onSelectAudio}
                        subtitleTracks={subtitleTracks}
                        activeSubtitleIndex={activeSubtitleIndex}
                        onSelectSubtitle={onSelectSubtitle}
                        isLoadingSubtitle={isJassubLoading}
                        sources={episodeSources}
                        currentSourceUrl={activeStreamUrl}
                        onSourceChange={handleSourceSwitch}
                        className="!w-auto !h-auto !bg-transparent !border-none !text-zinc-400 hover:!text-white flex items-center justify-center p-0"
                    />

                    <button
                        onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                        aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                        className="text-zinc-400 hover:text-white transition-all flex items-center justify-center">
                        {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                    </button>
                </div>
            </div>
        </div>
    )
}
