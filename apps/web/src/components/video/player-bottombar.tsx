import React from "react"
import { Play, Pause, ChevronLeft, ChevronRight, Volume2, VolumeX, Maximize, Minimize, SkipForward, Camera, PictureInPicture } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { TimelineHeatmap, type InsightNode } from "@/components/ui/timeline-heatmap"
import { PlayerSettingsMenu } from "@/components/ui/PlayerSettingsMenu"
import type { AudioTrack, SubtitleTrack } from "@/components/ui/track-types"
import type { EpisodeSource } from "@/api/types/unified.types"

const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return "00:00"
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = Math.floor(secs % 60)
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
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

    // Seanime features
    onTakeScreenshot?: () => void
    onTogglePip?: () => void
    playbackRate?: number
    onPlaybackRateChange?: (rate: number) => void
    autoSkipIntro?: boolean
    onAutoSkipIntroChange?: (enabled: boolean) => void
    autoSkipOutro?: boolean
    onAutoSkipOutroChange?: (enabled: boolean) => void

    onNextEpisode?: () => void

    hlsLevels?: { index: number; label: string; height: number }[]
    activeHlsLevel?: number
    onHlsLevelChange?: (level: number) => void

    showHeatmap?: boolean
    onShowHeatmapChange?: (show: boolean) => void

    aspectRatio?: "contain" | "fill" | "cover" | "16/9"
    onAspectRatioChange?: (ratio: "contain" | "fill" | "cover" | "16/9") => void

    subtitleSize?: number
    onSubtitleSizeChange?: (size: number) => void

    loopEnabled?: boolean
    onLoopEnabledChange?: (enabled: boolean) => void

    autoDisableSubtitlesWhenDubbed?: boolean
    onAutoDisableSubtitlesWhenDubbedChange?: (enabled: boolean) => void

    ambilightEnabled?: boolean
    onAmbilightChange?: (enabled: boolean) => void

    marathonMode?: boolean
    onMarathonModeChange?: (enabled: boolean) => void
}

export function PlayerBottomBar({
    duration, insights, progressInputRef, handleSeek,
    isPlaying, togglePlay, skipTime,
    isMuted, toggleMute, volume, handleVolume,
    timeTextRef,
    audioTracks, activeAudioIndex, onSelectAudio,
    subtitleTracks, activeSubtitleIndex, onSelectSubtitle,
    isJassubLoading, episodeSources, activeStreamUrl, handleSourceSwitch,
    isFullscreen, toggleFullscreen,
    settingsOpen, onToggleSettings,
    onTakeScreenshot, onTogglePip,
    playbackRate = 1, onPlaybackRateChange,
    autoSkipIntro = false, onAutoSkipIntroChange,
    autoSkipOutro = false, onAutoSkipOutroChange,
    onNextEpisode,
    hlsLevels = [], activeHlsLevel = -1, onHlsLevelChange,
    showHeatmap = true, onShowHeatmapChange,
    aspectRatio = "contain", onAspectRatioChange,
    subtitleSize = 100, onSubtitleSizeChange,
    loopEnabled = false, onLoopEnabledChange,
    autoDisableSubtitlesWhenDubbed = true, onAutoDisableSubtitlesWhenDubbedChange,
    ambilightEnabled = true, onAmbilightChange,
    marathonMode = true, onMarathonModeChange,
}: PlayerBottomBarProps) {

    return (
        <div className={cn(
            "absolute bottom-0 inset-x-0 w-full flex flex-col pointer-events-auto select-none transition-all duration-500",
            "bg-zinc-950/40 backdrop-blur-2xl border-t border-white/[0.03] pt-12 pb-6 px-8",
        )}>

            {/* Progress Timeline */}
            <div className="relative group/progress flex items-center mb-3" style={{ height: 20 }}>
                {showHeatmap && (
                    <TimelineHeatmap
                        duration={duration}
                        insights={insights}
                        className="absolute bottom-0 inset-x-0 w-full h-6 opacity-30 pointer-events-none group-hover/progress:opacity-60 transition-all duration-300"
                    />
                )}
                {/* Track background */}
                <div className="absolute inset-x-0 h-[2px] group-hover/progress:h-[4px] bg-white/10 rounded-full transition-all duration-300" style={{ bottom: 8 }}>
                    <div 
                        ref={progressBarRef}
                        className="h-full bg-brand-orange shadow-[0_0_15px_rgba(255,110,58,0.5)] rounded-full transition-all duration-200"
                        style={{ width: '0%' }}
                    />
                </div>
                <input
                    ref={progressInputRef}
                    type="range"
                    min={0}
                    max={duration || 0}
                    step="any"
                    onChange={handleSeek}
                    className="absolute inset-x-0 w-full cursor-pointer opacity-0 z-10"
                    style={{ height: 20, bottom: 0 }}
                />
            </div>

            {/* Bottom Controls Row */}
            <div className="flex items-center justify-between w-full">

                {/* Left Wing */}
                <div className="flex items-center gap-4">

                    {/* Play/Pause */}
                    <button
                        onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                        aria-label={isPlaying ? "Pausar" : "Reproducir"}
                        className="text-white hover:text-brand-orange transition-all duration-300 flex items-center justify-center w-10 h-10 bg-white/5 rounded-full hover:bg-white/10">
                        {isPlaying
                            ? <Pause className="w-4 h-4 fill-current" />
                            : <Play className="w-4 h-4 fill-current ml-0.5" />
                        }
                    </button>

                    {/* Skip backward/forward */}
                    <button
                        onClick={(e) => { e.stopPropagation(); skipTime(-10); }}
                        aria-label="Retroceder 10 segundos"
                        className="text-zinc-400 hover:text-white transition-all flex items-center justify-center w-8 h-8">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); skipTime(10); }}
                        aria-label="Adelantar 10 segundos"
                        className="text-zinc-400 hover:text-white transition-all flex items-center justify-center w-8 h-8">
                        <ChevronRight className="w-5 h-5" />
                    </button>

                    {/* Volume Control */}
                    <div className="hidden md:flex items-center gap-2 group/volume">
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                            aria-label={isMuted || volume === 0 ? "Activar sonido" : "Silenciar"}
                            className="text-zinc-500 hover:text-white transition-all flex items-center justify-center w-8 h-8">
                            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                        <div className="w-0 overflow-hidden group-hover/volume:w-20 transition-all duration-300 flex items-center">
                            <div className="w-full h-[3px] bg-white/20 relative rounded-full">
                                <div
                                    className="absolute left-0 h-full bg-brand-orange rounded-full transition-all"
                                    style={{ width: `${isMuted ? 0 : volume * 100}%` }}
                                />
                                <input
                                    type="range"
                                    min={0} max={1} step={0.02}
                                    value={isMuted ? 0 : volume}
                                    onChange={(e) => { e.stopPropagation(); handleVolume(e); }}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer touch-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Time indicator */}
                    <div className="flex items-center gap-1.5 text-[13px] font-medium tracking-wide tabular-nums">
                        <span ref={timeTextRef} className="text-white">00:00</span>
                        <span className="text-zinc-600">/</span>
                        <span className="text-zinc-400">{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Right Wing */}
                <div className="flex items-center gap-1">

                    {/* Screenshot */}
                    {onTakeScreenshot && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onTakeScreenshot(); }}
                            aria-label="Captura de pantalla [G]"
                            title="Captura de pantalla [G]"
                            className="text-zinc-400 hover:text-white transition-all flex items-center justify-center w-9 h-9">
                            <Camera className="w-4 h-4" />
                        </button>
                    )}

                    {/* PiP */}
                    {onTogglePip && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onTogglePip(); }}
                            aria-label="Picture in Picture [I]"
                            title="Picture in Picture [I]"
                            className="text-zinc-400 hover:text-white transition-all flex items-center justify-center w-9 h-9">
                            <PictureInPicture className="w-4 h-4" />
                        </button>
                    )}

                    {/* Next episode */}
                    {onNextEpisode && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onNextEpisode(); }}
                            aria-label="Siguiente episodio [N]"
                            title="Siguiente episodio [N]"
                            className="text-zinc-400 hover:text-white transition-all flex items-center justify-center w-9 h-9">
                            <SkipForward className="w-4 h-4" />
                        </button>
                    )}

                    {/* Settings gear */}
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
                        autoSkipOutro={autoSkipOutro}
                        onAutoSkipOutroChange={onAutoSkipOutroChange}
                        hlsLevels={hlsLevels}
                        activeHlsLevel={activeHlsLevel}
                        onHlsLevelChange={onHlsLevelChange}
                        showHeatmap={showHeatmap}
                        onShowHeatmapChange={onShowHeatmapChange}
                        aspectRatio={aspectRatio}
                        onAspectRatioChange={onAspectRatioChange}
                        subtitleSize={subtitleSize}
                        onSubtitleSizeChange={onSubtitleSizeChange}
                        loopEnabled={loopEnabled}
                        onLoopEnabledChange={onLoopEnabledChange}
                        autoDisableSubtitlesWhenDubbed={autoDisableSubtitlesWhenDubbed}
                        onAutoDisableSubtitlesWhenDubbedChange={onAutoDisableSubtitlesWhenDubbedChange}
                        ambilightEnabled={ambilightEnabled}
                        onAmbilightChange={onAmbilightChange}
                        marathonMode={marathonMode}
                        onMarathonModeChange={onMarathonModeChange}
                    />

                    {/* Fullscreen */}
                    <button
                        onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                        aria-label={isFullscreen ? "Salir de pantalla completa [F]" : "Pantalla completa [F]"}
                        title={isFullscreen ? "Salir de pantalla completa [F]" : "Pantalla completa [F]"}
                        className="text-zinc-400 hover:text-white transition-all flex items-center justify-center w-9 h-9">
                        {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </div>
    )
}
