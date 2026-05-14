import React from "react"
import { Play, Pause, ChevronLeft, ChevronRight, Volume2, VolumeX, Maximize, Minimize, ChevronUp, Subtitles, Camera, PictureInPicture, Monitor } from "lucide-react"
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
    settingsOpen?: boolean
    onToggleSettings?: (open?: boolean) => void

    // New Seanime features
    onTakeScreenshot?: () => void
    onTogglePip?: () => void
    playbackRate?: number
    onPlaybackRateChange?: (rate: number) => void
    autoSkipIntro?: boolean
    onAutoSkipIntroChange?: (enabled: boolean) => void

    onNextEpisode?: () => void
    
    hlsLevels?: any[]
    activeHlsLevel?: number
    onHlsLevelChange?: (level: number) => void
}

export function PlayerBottomBar({
    duration, insights, progressBarRef, progressInputRef, handleSeek,
    isPlaying, togglePlay, skipTime,
    isMuted, toggleMute, volume, handleVolume,
    timeTextRef,
    audioTracks, activeAudioIndex, onSelectAudio,
    subtitleTracks, activeSubtitleIndex, onSelectSubtitle,
    isJassubLoading, episodeSources, activeStreamUrl, handleSourceSwitch,
    isFullscreen, toggleFullscreen,
    settingsOpen, onToggleSettings,
    onTakeScreenshot, onTogglePip,
    playbackRate, onPlaybackRateChange,
    autoSkipIntro, onAutoSkipIntroChange,
    onNextEpisode,
    hlsLevels, activeHlsLevel, onHlsLevelChange
}: PlayerBottomBarProps) {
    const [showHeatmap, setShowHeatmap] = React.useState(true)
    
    // Mock Heatmap Data (replace with real data later)
    const heatmapData = React.useMemo(() => {
        return Array.from({ length: 60 }, (_, i) => {
            const base = Math.sin(i * 0.2) * 0.5 + 0.5
            const noise = Math.random() * 0.2
            return Math.min(1, Math.max(0, base + noise))
        })
    }, [])

    return (
        <div className={cn(
            "absolute bottom-0 inset-x-0 w-full flex flex-col pointer-events-auto select-none",
            "bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-12 pb-6 px-6",
            "transition-all duration-300 ease-out",
            "opacity-100 translate-y-0"
        )}>
            
            {/* Sleek Progress Timeline */}
            <div className="relative group/progress h-6 flex items-center mb-1">
                {showHeatmap && (
                    <TimelineHeatmap 
                        duration={duration} 
                        data={heatmapData} 
                        className="absolute bottom-0 inset-x-0 w-full h-8 opacity-40 pointer-events-none mb-1 group-hover/progress:h-12 transition-all duration-300"
                    />
                )}
                <input
                    ref={progressInputRef}
                    type="range"
                    min={0}
                    max={duration || 0}
                    step="any"
                    onChange={handleSeek}
                    className="absolute inset-0 w-full h-1.5 bg-white/10 appearance-none cursor-pointer group-hover/progress:h-2.5 transition-all z-10"
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
                        onClick={(e) => { e.stopPropagation(); onTakeScreenshot?.(); }}
                        aria-label="Captura de pantalla (G)"
                        className="text-zinc-400 hover:text-white transition-all flex items-center justify-center">
                        <Camera className="w-5 h-5" />
                    </button>

                    <button
                        onClick={(e) => { e.stopPropagation(); onTogglePip?.(); }}
                        aria-label="Picture in Picture (I)"
                        className="text-zinc-400 hover:text-white transition-all flex items-center justify-center">
                        <PictureInPicture className="w-5 h-5" />
                    </button>

                    <button
                        onClick={(e) => { e.stopPropagation(); onNextEpisode?.(); }}
                        aria-label="Siguiente Episodio (N)"
                        className="text-zinc-400 hover:text-white transition-all flex items-center justify-center">
                        <ChevronUp className="w-5 h-5" />
                    </button>
                    
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleSettings?.() }}
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
                        open={settingsOpen}
                        onOpenChange={onToggleSettings}
                        playbackRate={playbackRate}
                        onPlaybackRateChange={onPlaybackRateChange}
                        autoSkipIntro={autoSkipIntro}
                        onAutoSkipIntroChange={onAutoSkipIntroChange}
                        hlsLevels={state.hlsLevels}
                        activeHlsLevel={state.activeHlsLevel}
                        onHlsLevelChange={actions.setHlsLevel}
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
