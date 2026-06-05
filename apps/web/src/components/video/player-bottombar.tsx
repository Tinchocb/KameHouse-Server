import React from "react"
import { Play, Pause, ChevronLeft, ChevronRight, Volume2, VolumeX, Maximize, Minimize, SkipForward, SkipBack, ListVideo, Tv } from "lucide-react"
import { cn } from "@/components/ui/core/styling"

const CastIcon = ({ className }: { className?: string }) => (
    <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
        <path d="M2 12a9 9 0 0 1 8 8" />
        <path d="M2 16a5 5 0 0 1 4 4" />
        <line x1="2" x2="2.01" y1="20" y2="20" />
    </svg>
)
import { TimelineHeatmap, type InsightNode } from "@/components/ui/timeline-heatmap"
import { PlayerSettingsMenu } from "@/components/ui/PlayerSettingsMenu"
import type { AudioTrack, SubtitleTrack } from "@/components/ui/track-types"
import type { EpisodeSource } from "@/api/types/unified.types"

export interface Chapter {
    startTime: number
    endTime: number
    name: string
    type?: string
}

const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return "00:00"
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = Math.floor(secs % 60)
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export interface PlayerBottomBarProps {
    episodeNumber?: number
    episodeLabel?: string
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


    tvMode?: boolean
    onTvModeChange?: (enabled: boolean) => void
    marathonMode?: boolean
    onMarathonModeChange?: (enabled: boolean) => void

    /** AniSkip intervals for rendering visual markers on the timeline */
    skipTimesOp?: { startTime: number; endTime: number }
    skipTimesEd?: { startTime: number; endTime: number }

    // Chapters
    chapters?: Chapter[]
    skipToNextChapter?: () => void
    skipToPrevChapter?: () => void
    activeChapter?: string | null

    // Casting
    isCastSupported?: boolean
    castState?: "disconnected" | "connecting" | "connected"
    onPromptCast?: () => void

    // Episode Selector
    isEpisodesSidebarOpen?: boolean
    onToggleEpisodesSidebar?: () => void
    hasEpisodes?: boolean

    // Queue Selector
    isQueueSidebarOpen?: boolean
    onToggleQueueSidebar?: () => void
    hasQueue?: boolean
}

const SkipNextChapterIcon = () => (
    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="fill-current">
        <polygon points="5 4 15 12 5 20 5 4" fill="currentColor"/>
        <line x1="19" y1="5" x2="19" y2="19" />
    </svg>
)

export const PlayerBottomBar = React.memo(function PlayerBottomBar({
    episodeNumber, episodeLabel,
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
    tvMode = false, onTvModeChange,
    marathonMode = false, onMarathonModeChange,
    skipTimesOp,
    skipTimesEd,
    chapters = [],
    skipToNextChapter,
    skipToPrevChapter,
    activeChapter,
    isCastSupported = false,
    castState = "disconnected",
    onPromptCast,
    isEpisodesSidebarOpen,
    onToggleEpisodesSidebar,
    hasEpisodes,
    isQueueSidebarOpen,
    onToggleQueueSidebar,
    hasQueue,
}: PlayerBottomBarProps) {

    return (
        <div className={cn(
            "absolute bottom-4 inset-x-4 md:bottom-6 md:inset-x-6 flex flex-col pointer-events-auto select-none",
            "bg-zinc-950/55 backdrop-blur-[32px] border border-white/[0.08] rounded-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] px-5 py-3.5 z-30",
        )}>

            {/* Progress Timeline */}
            <div className="relative group/progress flex items-center h-3 cursor-pointer w-full mb-2">
                {showHeatmap && (
                    <TimelineHeatmap
                        duration={duration}
                        insights={insights}
                        className="absolute bottom-0 inset-x-0 w-full h-3 opacity-15 pointer-events-none group-hover/progress:opacity-35 transition-all duration-300"
                    />
                )}
                {/* Track background */}
                <div className="w-full h-[2.5px] group-hover/progress:h-[4px] bg-white/10 rounded-full transition-all duration-200 relative flex items-center">

                    {/* Skip segment markers — rendered behind the playback bar */}
                    {duration > 0 && skipTimesOp && (
                        <div
                            className="absolute top-0 bottom-0 bg-brand-orange/25 pointer-events-none rounded-sm"
                            title={`Intro: ${Math.round(skipTimesOp.startTime)}s – ${Math.round(skipTimesOp.endTime)}s`}
                            style={{
                                left: `${(skipTimesOp.startTime / duration) * 100}%`,
                                width: `${((skipTimesOp.endTime - skipTimesOp.startTime) / duration) * 100}%`,
                            }}
                        />
                    )}
                    {duration > 0 && skipTimesEd && (
                        <div
                            className="absolute top-0 bottom-0 bg-purple-400/25 pointer-events-none rounded-sm"
                            title={`Outro: ${Math.round(skipTimesEd.startTime)}s – ${Math.round(skipTimesEd.endTime)}s`}
                            style={{
                                left: `${(skipTimesEd.startTime / duration) * 100}%`,
                                width: `${((skipTimesEd.endTime - skipTimesEd.startTime) / duration) * 100}%`,
                            }}
                        />
                    )}

                    {/* Chapter tick markers */}
                    {duration > 0 && chapters && chapters.map((chapter, idx) => {
                        if (chapter.startTime <= 0 || chapter.startTime >= duration) return null;
                        return (
                            <div
                                key={idx}
                                className="absolute top-0 bottom-0 w-[2px] bg-zinc-950 pointer-events-none z-20"
                                style={{
                                    left: `${(chapter.startTime / duration) * 100}%`,
                                }}
                                title={chapter.name}
                            />
                        )
                    })}

                    <div 
                        ref={progressBarRef}
                        className="h-full bg-brand-orange rounded-full transition-all duration-100 relative"
                        style={{ width: '0%' }}
                    >
                        {/* Thumb indicator - sleek and shows on hover with scale transition */}
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 rounded-full bg-brand-orange border-2 border-white opacity-0 group-hover/progress:opacity-100 scale-90 group-hover/progress:scale-100 transition-all duration-200 shadow-md ring-2 ring-zinc-950/40 pointer-events-none" />
                    </div>
                </div>
                <input
                    ref={progressInputRef}
                    type="range"
                    min={0}
                    max={duration || 0}
                    step="any"
                    onChange={handleSeek}
                    className="absolute inset-0 w-full h-full cursor-pointer opacity-0 z-10"
                />
            </div>

            {/* Bottom Controls Row */}
            <div className="flex items-center justify-between w-full">

                {/* Left Wing */}
                <div className="flex items-center gap-2.5">

                    {/* Play/Pause */}
                    <button
                        onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                        aria-label={isPlaying ? "Pausar" : "Reproducir"}
                        className="text-white hover:text-brand-orange transition-all duration-300 flex items-center justify-center w-8 h-8 bg-white/5 rounded-full hover:bg-white/10 active:scale-90">
                        {isPlaying
                            ? <Pause className="w-3.5 h-3.5 fill-current" />
                            : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        }
                    </button>

                    {/* Skip backward/forward */}
                    <button
                        onClick={(e) => { e.stopPropagation(); skipTime(-10); }}
                        aria-label="Retroceder 10 segundos"
                        className="text-zinc-500 hover:text-white transition-all flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/5 active:scale-90 duration-300">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); skipTime(10); }}
                        aria-label="Adelantar 10 segundos"
                        className="text-zinc-500 hover:text-white transition-all flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/5 active:scale-90 duration-300">
                        <ChevronRight className="w-4 h-4" />
                    </button>

                    {/* Chapter Prev/Next navigation */}
                    {chapters && chapters.length > 0 && (
                        <div className="flex items-center gap-0.5 border-l border-white/10 pl-2 ml-1">
                            <button
                                onClick={(e) => { e.stopPropagation(); skipToPrevChapter?.(); }}
                                aria-label="Capítulo anterior"
                                title="Capítulo anterior [[ ]"
                                className="text-zinc-500 hover:text-white transition-all flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/5 active:scale-90 duration-300">
                                <SkipBack className="w-3.5 h-3.5 fill-current" />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); skipToNextChapter?.(); }}
                                aria-label="Siguiente capítulo"
                                title="Siguiente capítulo [ ] ]"
                                className="text-zinc-500 hover:text-white transition-all flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/5 active:scale-90 duration-300">
                                <SkipNextChapterIcon />
                            </button>
                        </div>
                    )}

                    {/* Volume Control */}
                    <div className="hidden md:flex items-center gap-1 group/volume">
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                            aria-label={isMuted || volume === 0 ? "Activar sonido" : "Silenciar"}
                            className="text-zinc-500 hover:text-white transition-all flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/5 active:scale-90 duration-300">
                            {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                        </button>
                        <div className="w-0 overflow-hidden group-hover/volume:w-16 transition-all duration-300 flex items-center h-5 pl-1">
                            <div className="w-full h-[3px] bg-white/20 relative rounded-full flex items-center">
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
                    <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide tabular-nums text-zinc-400 font-sans">
                        <span ref={timeTextRef} className="text-zinc-200">00:00</span>
                        <span className="text-zinc-600">/</span>
                        <span className="text-zinc-400">{formatTime(duration)}</span>
                        {activeChapter && (
                            <>
                                <span className="text-zinc-600 ml-1">•</span>
                                <span className="text-brand-orange font-bold uppercase tracking-wider text-[10px] ml-1 truncate max-w-[150px] md:max-w-[240px]" title={activeChapter}>
                                    {activeChapter}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Middle Area: Episode Title & Number */}
                <div className="flex flex-col items-center justify-center text-center max-w-[35%] select-none px-4 flex-1 min-w-0">
                    <span className="text-[10px] font-black text-brand-orange uppercase tracking-[0.25em] font-mono leading-none">
                        {episodeNumber ? `Episodio ${episodeNumber}` : ""}
                    </span>
                    <span className="text-xs font-bold text-white tracking-wide truncate max-w-full mt-1.5" title={episodeLabel}>
                        {episodeLabel || ""}
                    </span>
                </div>

                {/* Right Wing */}
                <div className="flex items-center gap-0.5">

                    {/* Casting to TV */}
                    {onPromptCast && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onPromptCast?.(); }}
                            aria-label="Transmitir a TV"
                            title="Transmitir a TV"
                            className={cn(
                                "transition-all duration-300 flex items-center justify-center w-8 h-8 rounded-full active:scale-90",
                                castState === "connected"
                                    ? "text-brand-orange bg-brand-orange/10 shadow-[0_0_12px_rgba(249,115,22,0.4)] animate-pulse"
                                    : castState === "connecting"
                                    ? "text-brand-orange animate-bounce"
                                    : "text-zinc-500 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <CastIcon className="w-3.5 h-3.5" />
                        </button>
                    )}

                    {/* Queue Button */}
                    {hasQueue && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleQueueSidebar?.(); }}
                            aria-label="Ver cola de reproducción"
                            title="Ver cola de reproducción"
                            className={cn(
                                "transition-all duration-300 flex items-center justify-center w-8 h-8 rounded-full active:scale-90",
                                isQueueSidebarOpen
                                    ? "text-brand-orange bg-brand-orange/10 shadow-[0_0_12px_rgba(249,115,22,0.4)] animate-pulse"
                                    : "text-zinc-500 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <ListVideo className="w-3.5 h-3.5" />
                        </button>
                    )}

                    {/* Next episode */}
                    {onNextEpisode && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onNextEpisode(); }}
                            aria-label="Siguiente episodio [N]"
                            title="Siguiente episodio [N]"
                            className="text-zinc-500 hover:text-white transition-all flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/5 active:scale-90 duration-300">
                            <SkipForward className="w-3.5 h-3.5" />
                        </button>
                    )}

                    {/* TV Mode Button */}
                    {onTvModeChange && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onTvModeChange(!tvMode); }}
                            aria-label="Alternar Modo TV / Maratón"
                            title="Modo TV / Maratón"
                            className={cn(
                                "transition-all duration-300 flex items-center justify-center w-8 h-8 rounded-full active:scale-90",
                                tvMode
                                    ? "text-brand-orange bg-brand-orange/10"
                                    : "text-zinc-500 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <Tv className="w-3.5 h-3.5" fill={tvMode ? "currentColor" : "none"} />
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
                        tvMode={tvMode}
                        onTvModeChange={onTvModeChange}
                        marathonMode={marathonMode}
                        onMarathonModeChange={onMarathonModeChange}
                    />

                    {/* Fullscreen */}
                    <button
                        onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                        aria-label={isFullscreen ? "Salir de pantalla completa [F]" : "Pantalla completa [F]"}
                        title={isFullscreen ? "Salir de pantalla completa [F]" : "Pantalla completa [F]"}
                        className="text-zinc-500 hover:text-white transition-all flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/5 active:scale-90 duration-300">
                        {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </div>
        </div>
    )
})
PlayerBottomBar.displayName = "PlayerBottomBar"
