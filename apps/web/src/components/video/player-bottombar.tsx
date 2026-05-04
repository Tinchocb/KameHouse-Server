import React from "react"
import { FaPlay, FaPause, FaForward, FaBackward, FaExpand, FaCompress, FaVolumeUp, FaVolumeMute } from "react-icons/fa"
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
            "absolute bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-5xl flex flex-col gap-2 pointer-events-auto select-none",
            "bg-black/50 backdrop-blur-2xl border border-white/10 rounded-full px-6 py-4 shadow-2xl",
            "transition-all duration-300 ease-out",
            "opacity-100 translate-y-0"
        )}>
            
            {/* Minimalist Expanding Progress Timeline */}
            <div className="relative w-full h-1 hover:h-1.5 transition-all bg-white/20 group cursor-pointer flex items-center rounded-full" onClick={(e) => { e.stopPropagation() }}>
                
                <TimelineHeatmap duration={duration} insights={insights} />

                <div
                    ref={progressBarRef}
                    className="h-full bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.8)] transition-all ease-linear rounded-full rounded-r-none relative z-10"
                    style={{ width: "0%" }}
                >
                    {/* Hover Thumb Component */}
                    <div
                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 md:w-4 md:h-4 bg-orange-500 rounded-full shadow-[0_0_10px_rgba(249,115,22,1)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
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
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer touch-none"
                    style={{ height: "40px", top: "50%", transform: "translateY(-50%)" }}
                />
            </div>

            {/* Bottom Controls Row */}
            <div className="flex items-center justify-between w-full mt-1">

                {/* Left Wing */}
                <div className="flex items-center gap-2 md:gap-4">
                    <button
                        onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                        aria-label={isPlaying ? "Pausar" : "Reproducir"}
                        className="text-zinc-400 hover:text-white transition-colors flex items-center justify-center transform hover:scale-110 p-2">
                        {isPlaying ? <FaPause className="w-5 h-5" /> : <FaPlay className="w-5 h-5 pl-0.5" />}
                    </button>

                    <button
                        onClick={(e) => { e.stopPropagation(); skipTime(-10); }}
                        aria-label="Retroceder 10 segundos"
                        className="text-zinc-400 hover:text-white transition-colors flex items-center justify-center p-2 hidden sm:block">
                        <FaBackward className="w-4 h-4" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); skipTime(10); }}
                        aria-label="Adelantar 10 segundos"
                        className="text-zinc-400 hover:text-white transition-colors flex items-center justify-center p-2 hidden sm:block">
                        <FaForward className="w-4 h-4" />
                    </button>

                    {/* Volume Control */}
                    <div className="hidden md:flex items-center gap-2 group ml-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                            aria-label={isMuted || volume === 0 ? "Activar sonido" : "Silenciar"}
                            className="text-zinc-400 hover:text-white transition-colors flex items-center justify-center p-2">
                            {isMuted || volume === 0 ? <FaVolumeMute className="w-4 h-4" /> : <FaVolumeUp className="w-4 h-4" />}
                        </button>
                        <div className="w-0 group-hover:w-20 transition-all duration-300 overflow-hidden relative h-1 flex items-center bg-white/20 rounded-full cursor-pointer" onClick={(e) => e.stopPropagation()}>
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

                    {/* Time indicator */}
                    <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-medium tabular-nums tracking-wide ml-2">
                        <span ref={timeTextRef} className="text-white">00:00</span>
                        <span className="opacity-50">/</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Right Wing: Settings, Fullscreen */}
                <div className="flex items-center gap-1 md:gap-2">
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
                    />

                    <button
                        onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                        aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                        className="text-zinc-400 hover:text-white transition-colors flex items-center justify-center p-2">
                        {isFullscreen ? <FaCompress className="w-4 h-4" /> : <FaExpand className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </div>
    )
}
