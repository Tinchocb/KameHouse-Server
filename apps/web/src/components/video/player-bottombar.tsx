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
            "absolute bottom-0 inset-x-0 w-full flex flex-col pointer-events-auto select-none",
            "bg-black border-t border-white/10",
            "transition-all duration-300 ease-out",
            "opacity-100 translate-y-0"
        )}>
            
            {/* Rigid Progress Timeline */}
            <div className="relative w-full h-2 bg-white/5 group cursor-pointer flex items-center" onClick={(e) => { e.stopPropagation() }}>
                
                <TimelineHeatmap duration={duration} insights={insights} />

                <div
                    ref={progressBarRef}
                    className="h-full bg-white relative z-10"
                    style={{ width: "0%" }}
                >
                    {/* Hover Thumb Component (Square) */}
                    <div
                        className="absolute right-0 top-0 w-2 h-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.4)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
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
            <div className="flex items-center justify-between w-full px-8 py-4">

                {/* Left Wing */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                        aria-label={isPlaying ? "Pausar" : "Reproducir"}
                        className="text-white hover:bg-white/10 transition-all flex items-center justify-center p-3 border border-white/10">
                        {isPlaying ? <FaPause className="w-5 h-5" /> : <FaPlay className="w-5 h-5 pl-0.5" />}
                    </button>

                    <div className="flex items-center border border-white/10">
                        <button
                            onClick={(e) => { e.stopPropagation(); skipTime(-10); }}
                            aria-label="Retroceder 10 segundos"
                            className="text-zinc-500 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center p-3 border-r border-white/10">
                            <FaBackward className="w-4 h-4" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); skipTime(10); }}
                            aria-label="Adelantar 10 segundos"
                            className="text-zinc-500 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center p-3">
                            <FaForward className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Volume Control */}
                    <div className="hidden md:flex items-center group border border-white/10">
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                            aria-label={isMuted || volume === 0 ? "Activar sonido" : "Silenciar"}
                            className="text-zinc-500 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center p-3 border-r border-white/10">
                            {isMuted || volume === 0 ? <FaVolumeMute className="w-4 h-4" /> : <FaVolumeUp className="w-4 h-4" />}
                        </button>
                        <div className="w-24 px-4 flex items-center relative h-full bg-black">
                            <div className="w-full h-[2px] bg-white/20 relative">
                                <div className="absolute left-0 h-full bg-white" style={{ width: `${isMuted ? 0 : volume * 100}%` }} />
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
                    <div className="flex items-center gap-3 px-4 h-12 border border-white/10 text-[11px] font-black uppercase tracking-[0.2em] tabular-nums">
                        <span ref={timeTextRef} className="text-white">00:00</span>
                        <span className="text-zinc-800">/</span>
                        <span className="text-zinc-500">{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Right Wing: Settings, Fullscreen */}
                <div className="flex items-center gap-4">
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
                        className="text-zinc-500 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center p-3 border border-white/10 h-12 w-12">
                        {isFullscreen ? <FaCompress className="w-5 h-5" /> : <FaExpand className="w-5 h-5" />}
                    </button>
                </div>
            </div>
        </div>
    )
}
