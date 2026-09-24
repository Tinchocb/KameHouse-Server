import React from "react"
import { IconMediaPause, IconMediaPlay, IconMediaSkipPrevious, IconMediaVolumeX, IconMediaVolume2, IconNavigationList, IconMediaQueue, IconMediaSkipNext, IconMediaMinimize, IconMediaMaximize } from "@/components/ui/icons";
import { cn } from "@/components/ui/core/styling"

import type { InsightNode } from "@/components/ui/timeline-heatmap"
import { AnimatedTooltip } from "@/components/ui/kinetics/animated-tooltip"
import { PlayerSettingsMenu } from "@/components/ui/PlayerSettingsMenu"
import { SeekBar } from "./seek-bar"
import { PLAYER_GLASS, PLAYER_ICON_BTN, PLAYER_ICON_BTN_ACTIVE, PLAYER_PLAY_BTN } from "./player-theme"
import type { AudioTrack, SubtitleTrack } from "@/components/ui/track-types"
import type { PlayerPreviewManager } from "./player-preview"
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
    title?: string
    episodeNumber?: number
    episodeLabel?: string
    mediaFormat?: string | null
    duration: number
    insights: InsightNode[]
    progressBarRef: React.RefObject<HTMLDivElement>
    thumbRef: React.RefObject<HTMLDivElement>
    progressInputRef: React.RefObject<HTMLInputElement>
    handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void
    handleSeekStart?: () => void
    handleSeekEnd?: (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>) => void
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
    onSelectSubtitle: (track: SubtitleTrack | null, opts?: { auto?: boolean }) => void
    isJassubLoading: boolean
    episodeSources: EpisodeSource[]
    activeStreamUrl: string
    currentSourceType?: string
    handleSourceSwitch: (source: EpisodeSource) => void

    isFullscreen: boolean
    toggleFullscreen: () => void
    settingsOpen?: boolean
    onToggleSettings?: (open?: boolean) => void

    // Seanime features
    playbackRate?: number
    onPlaybackRateChange?: (rate: number) => void
    autoSkipIntro?: boolean
    onAutoSkipIntroChange?: (enabled: boolean) => void
    autoSkipOutro?: boolean
    onAutoSkipOutroChange?: (enabled: boolean) => void
    autoSkipFiller?: boolean
    onAutoSkipFillerChange?: (enabled: boolean) => void
    skipStepSeconds?: number
    onSkipStepSecondsChange?: (seconds: number) => void

    onNextEpisode?: () => void
    hasNextEpisode?: boolean

    hlsLevels?: { index: number; label: string; height: number }[]
    activeHlsLevel?: number
    onHlsLevelChange?: (level: number) => void

    showHeatmap?: boolean
    onShowHeatmapChange?: (show: boolean) => void

    aspectRatio?: "contain" | "fill" | "cover" | "16/9" | "21/9"
    onAspectRatioChange?: (ratio: "contain" | "fill" | "cover" | "16/9" | "21/9") => void

    subtitleSize?: number
    onSubtitleSizeChange?: (size: number) => void

    loopEnabled?: boolean
    onLoopEnabledChange?: (enabled: boolean) => void

    autoDisableSubtitlesWhenDubbed?: boolean
    onAutoDisableSubtitlesWhenDubbedChange?: (enabled: boolean) => void

    marathonMode?: boolean
    onMarathonModeChange?: (enabled: boolean) => void
    tvMode?: boolean
    onTvModeChange?: (enabled: boolean) => void
    ambientModeEnabled?: boolean
    onAmbientModeEnabledChange?: (enabled: boolean) => void

    /** AniSkip intervals for rendering visual markers on the timeline */
    skipTimesOp?: { startTime: number; endTime: number; source?: string }
    skipTimesEd?: { startTime: number; endTime: number; source?: string }

    // Chapters
    chapters?: Chapter[]
    skipToNextChapter?: () => void
    skipToPrevChapter?: () => void
    activeChapter?: string | null

    // Episode Selector
    isEpisodesSidebarOpen?: boolean
    onToggleEpisodesSidebar?: () => void
    hasEpisodes?: boolean

    // Queue Selector
    isQueueSidebarOpen?: boolean
    onToggleQueueSidebar?: () => void
    hasQueue?: boolean

    videoRef?: React.RefObject<HTMLVideoElement | null>
    malId?: number | null
    mediaId?: number

    previewManager?: PlayerPreviewManager | null
}



const CONTROL_BTN = PLAYER_ICON_BTN
const CONTROL_BTN_ACTIVE = PLAYER_ICON_BTN_ACTIVE

export const PlayerBottomBar = React.memo(function PlayerBottomBar({
    title: _title, episodeNumber, episodeLabel: _episodeLabel, mediaFormat,
    duration, insights, progressBarRef, thumbRef, progressInputRef, handleSeek, handleSeekStart, handleSeekEnd,
    isPlaying, togglePlay, skipTime: _skipTime,
    isMuted, toggleMute, volume, handleVolume,
    timeTextRef,
    audioTracks, activeAudioIndex, onSelectAudio,
    subtitleTracks, activeSubtitleIndex, onSelectSubtitle,
    isJassubLoading, episodeSources, activeStreamUrl, currentSourceType, handleSourceSwitch,
    isFullscreen, toggleFullscreen,
    settingsOpen, onToggleSettings,
    playbackRate = 1, onPlaybackRateChange,
    autoSkipIntro = false, onAutoSkipIntroChange,
    autoSkipOutro = false, onAutoSkipOutroChange,
    autoSkipFiller = false, onAutoSkipFillerChange,
    skipStepSeconds = 85, onSkipStepSecondsChange,
    onNextEpisode,
    hasNextEpisode,
    hlsLevels = [], activeHlsLevel = -1, onHlsLevelChange,
    showHeatmap = true, onShowHeatmapChange,
    aspectRatio = "contain", onAspectRatioChange,
    subtitleSize = 100, onSubtitleSizeChange,
    loopEnabled = false, onLoopEnabledChange,
    autoDisableSubtitlesWhenDubbed = true, onAutoDisableSubtitlesWhenDubbedChange,
    marathonMode = false, onMarathonModeChange,
    tvMode = false, onTvModeChange,
    ambientModeEnabled = true, onAmbientModeEnabledChange,
    skipTimesOp,
    skipTimesEd,
    chapters = [],
    skipToNextChapter,
    skipToPrevChapter,
    activeChapter,
    isEpisodesSidebarOpen,
    onToggleEpisodesSidebar,
    hasEpisodes,
    isQueueSidebarOpen,
    onToggleQueueSidebar,
    hasQueue,
    videoRef,
    malId,
    mediaId,
    previewManager,
}: PlayerBottomBarProps) {
    const isMovie = React.useMemo(() => {
        const formatUpper = mediaFormat?.toUpperCase()
        return formatUpper === "MOVIE" || formatUpper === "SPECIAL" || formatUpper === "OVA"
    }, [mediaFormat])

    const [isVolumeOpen, setIsVolumeOpen] = React.useState(false)

    const volumeExpanded = isVolumeOpen || tvMode
    // Ancla del panel de ajustes: vive fuera de las cápsulas de vidrio (ver PlayerSettingsMenuProps.panelContainer)
    const [settingsPanelHost, setSettingsPanelHost] = React.useState<HTMLDivElement | null>(null)

    return (
        <div className="absolute inset-x-0 bottom-0 z-player-ui pointer-events-auto select-none pb-[max(0.25rem,env(safe-area-inset-bottom,0px))]">
            {/* Scrim: gradiente plano, sin vidrio ni bordes */}
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-44 -z-10 pointer-events-none bg-gradient-to-t from-black/80 via-black/35 to-transparent" />

            <div ref={setSettingsPanelHost} className="absolute right-3 sm:right-6 bottom-full mb-1" />

            <div className="player-bar-fg relative flex flex-col w-full px-3 sm:px-6 pb-2 sm:pb-3">

            <SeekBar
                duration={duration}
                progressBarRef={progressBarRef}
                thumbRef={thumbRef}
                progressInputRef={progressInputRef}
                handleSeek={handleSeek}
                handleSeekStart={handleSeekStart}
                handleSeekEnd={handleSeekEnd}
                showHeatmap={showHeatmap}
                insights={insights}
                skipTimesOp={skipTimesOp}
                skipTimesEd={skipTimesEd}
                chapters={chapters}
                isMovie={isMovie}
                previewManager={previewManager}
            />

            {/* Bottom Controls Row */}
            <div className="flex items-center justify-between gap-2 sm:gap-3 w-full mt-1.5">

                {/* Left Wing — cápsula de vidrio como la navbar de la plataforma */}
                <div className={cn("flex items-center min-w-0 gap-1 p-1 rounded-full", PLAYER_GLASS)}>

                    <AnimatedTooltip side="top" content={isPlaying ? "Pausar [K]" : "Reproducir [K]"}>
                        <button
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                            aria-label={isPlaying ? "Pausar" : "Reproducir"}
                            className={PLAYER_PLAY_BTN}>
                            {isPlaying
                                ? <IconMediaPause className="fill-current" />
                                : <IconMediaPlay className="fill-current ml-0.5" />}
                        </button>
                    </AnimatedTooltip>

                    {!isMovie && chapters && chapters.length > 0 && (
                        <>
                            <AnimatedTooltip side="top" content="Capítulo anterior [[ ]">
                                <button
                                    tabIndex={0}
                                    onClick={(e) => { e.stopPropagation(); skipToPrevChapter?.(); }}
                                    aria-label="Capítulo anterior"
                                    className={cn(CONTROL_BTN, "hidden md:flex")}>
                                    <IconMediaSkipPrevious className="w-4 h-4 fill-current" />
                                </button>
                            </AnimatedTooltip>
                            <AnimatedTooltip side="top" content="Siguiente capítulo [ ] ]">
                                <button
                                    tabIndex={0}
                                    onClick={(e) => { e.stopPropagation(); skipToNextChapter?.(); }}
                                    aria-label="Siguiente capítulo"
                                    className={cn(CONTROL_BTN, "hidden md:flex")}>
                                    <IconMediaSkipNext className="w-4 h-4 fill-current" />
                                </button>
                            </AnimatedTooltip>
                        </>
                    )}

                    {/* Volumen: slider inline que se despliega al hover/foco, nada flota encima */}
                    <div
                        role="group"
                        aria-label="Control de volumen"
                        className="hidden md:flex items-center"
                        onMouseEnter={() => setIsVolumeOpen(true)}
                        onMouseLeave={() => setIsVolumeOpen(false)}
                        onFocus={() => setIsVolumeOpen(true)}
                        onBlur={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                setIsVolumeOpen(false)
                            }
                        }}
                    >
                        <button
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                            aria-label={isMuted || volume === 0 ? "Activar sonido [M]" : "Silenciar [M]"}
                            title={isMuted || volume === 0 ? "Activar sonido [M]" : "Silenciar [M]"}
                            aria-expanded={volumeExpanded}
                            className={CONTROL_BTN}
                        >
                            {isMuted || volume === 0 ? <IconMediaVolumeX className="w-4 h-4" /> : <IconMediaVolume2 className="w-4 h-4" />}
                        </button>

                        <div
                            className={cn(
                                "h-10 flex items-center overflow-hidden transition-[width,opacity] duration-200 ease-out",
                                volumeExpanded ? "w-[92px] opacity-100" : "w-0 opacity-0"
                            )}
                        >
                            {/* Range nativo visible: el drag funciona sin trucos de inputs invisibles */}
                            <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.02}
                                value={isMuted ? 0 : volume}
                                tabIndex={volumeExpanded ? 0 : -1}
                                aria-label="Volumen"
                                aria-valuetext={`${Math.round((isMuted ? 0 : volume) * 100)}%`}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => { e.stopPropagation(); handleVolume(e); }}
                                className="shrink-0 w-[80px] mx-1.5 h-1 cursor-pointer accent-[hsl(var(--brand-accent))]"
                            />
                        </div>
                    </div>

                    {/* Tiempo */}
                    <div className="flex items-center min-w-0 overflow-hidden pl-1.5 pr-3 text-xs font-semibold tracking-wide tabular-nums text-white/55 whitespace-nowrap">
                        <span ref={timeTextRef} className="text-white">00:00</span>
                        <span className="mx-1 opacity-50">/</span>
                        <span>{formatTime(duration)}</span>
                        {!isMovie && activeChapter && (
                            <span className="hidden sm:inline ml-2.5 pl-2.5 border-l border-white/15 text-brand-accent truncate max-w-[150px] md:max-w-[240px]" title={activeChapter}>
                                {activeChapter}
                            </span>
                        )}
                    </div>
                </div>

                {/* Right Wing */}
                <div className={cn("flex items-center shrink-0 gap-0.5 p-1 rounded-full", PLAYER_GLASS)}>

                    {hasEpisodes && (
                        <AnimatedTooltip side="top" content="Lista de episodios [E]">
                            <button
                                tabIndex={0}
                                onClick={(e) => { e.stopPropagation(); onToggleEpisodesSidebar?.(); }}
                                aria-label="Lista de episodios [E]"
                                aria-expanded={isEpisodesSidebarOpen}
                                className={cn(CONTROL_BTN, isEpisodesSidebarOpen && CONTROL_BTN_ACTIVE)}
                            >
                                <IconNavigationList className="w-4 h-4" />
                            </button>
                        </AnimatedTooltip>
                    )}

                    {hasQueue && (
                        <AnimatedTooltip side="top" content="Ver cola de reproducción [Q]">
                            <button
                                tabIndex={0}
                                onClick={(e) => { e.stopPropagation(); onToggleQueueSidebar?.(); }}
                                aria-label="Ver cola de reproducción [Q]"
                                aria-expanded={isQueueSidebarOpen}
                                className={cn(CONTROL_BTN, isQueueSidebarOpen && CONTROL_BTN_ACTIVE)}
                            >
                                <IconMediaQueue className="w-4 h-4" />
                            </button>
                        </AnimatedTooltip>
                    )}

                    {onNextEpisode && hasNextEpisode && (
                        <AnimatedTooltip side="top" content="Siguiente episodio [N]">
                            <button
                                tabIndex={0}
                                onClick={(e) => { e.stopPropagation(); onNextEpisode(); }}
                                aria-label="Siguiente episodio [N]"
                                className={CONTROL_BTN}>
                                <IconMediaSkipNext className="w-4 h-4" />
                            </button>
                        </AnimatedTooltip>
                    )}

                    {/* Modo Maratón vive en Ajustes → Reproducción */}
                    <PlayerSettingsMenu
                        panelContainer={settingsPanelHost}
                        audioTracks={audioTracks}
                        activeAudioIndex={activeAudioIndex}
                        onSelectAudio={onSelectAudio}
                        subtitleTracks={subtitleTracks}
                        activeSubtitleIndex={activeSubtitleIndex}
                        onSelectSubtitle={onSelectSubtitle}
                        isLoadingSubtitle={isJassubLoading}
                        sources={episodeSources}
                        currentSourceUrl={activeStreamUrl}
                        currentSourceType={currentSourceType}
                        onSourceChange={handleSourceSwitch}
                        open={settingsOpen}
                        onOpenChange={onToggleSettings}
                        playbackRate={playbackRate}
                        onPlaybackRateChange={onPlaybackRateChange}
                        autoSkipIntro={autoSkipIntro}
                        onAutoSkipIntroChange={onAutoSkipIntroChange}
                        autoSkipOutro={autoSkipOutro}
                        onAutoSkipOutroChange={onAutoSkipOutroChange}
                        autoSkipFiller={autoSkipFiller}
                        onAutoSkipFillerChange={onAutoSkipFillerChange}
                        skipStepSeconds={skipStepSeconds}
                        onSkipStepSecondsChange={onSkipStepSecondsChange}
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
                        marathonMode={marathonMode}
                        onMarathonModeChange={onMarathonModeChange}
                        tvMode={tvMode}
                        onTvModeChange={onTvModeChange}
                        ambientModeEnabled={ambientModeEnabled}
                        onAmbientModeEnabledChange={onAmbientModeEnabledChange}
                        videoRef={videoRef}
                        malId={malId}
                        mediaId={mediaId}
                        episodeNumber={episodeNumber}
                        duration={duration}
                        mediaFormat={mediaFormat}
                    />

                    <AnimatedTooltip side="top" content={isFullscreen ? "Salir de pantalla completa [F]" : "Pantalla completa [F]"}>
                        <button
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                            aria-label={isFullscreen ? "Salir de pantalla completa [F]" : "Pantalla completa [F]"}
                            className={CONTROL_BTN}>
                            {isFullscreen ? <IconMediaMinimize className="w-4 h-4" /> : <IconMediaMaximize className="w-4 h-4" />}
                        </button>
                    </AnimatedTooltip>
                </div>
            </div>{/* end Bottom Controls Row */}
            </div>{/* end player-bar-fg */}
        </div>
    )
})
PlayerBottomBar.displayName = "PlayerBottomBar"
