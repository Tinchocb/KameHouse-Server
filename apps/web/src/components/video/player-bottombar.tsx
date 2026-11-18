import React from "react"
import {
    IconMediaPlay,
    IconMediaPause,
    IconMediaVolumeX,
    IconMediaVolume2,
    IconNavigationList,
    IconMediaQueue,
    IconMediaSkipNext,
    IconMediaMinimize,
    IconMediaMaximize,
    IconStatusZap,
} from "@/components/ui/icons";
import { cn } from "@/components/ui/core/styling"

import { AnimatedTooltip } from "@/components/ui/kinetics/animated-tooltip"
import { IconSwap } from "@/components/ui/kinetics"
import { PlayerSettingsMenu } from "@/components/ui/PlayerSettingsMenu"
import { SkipTenIcon } from "./skip-ten-icon"
import { SeekBar } from "./seek-bar"
import { PLAYER_GLASS, PLAYER_ICON_BTN, PLAYER_ICON_BTN_ACTIVE } from "./player-theme"
import type { AudioTrack, SubtitleTrack } from "@/components/ui/track-types"
import type { PlayerPreviewManager } from "./player-preview"
import type { EpisodeSource } from "@/api/types/unified.types"
import type { Chapter } from "./skip-windows"
import { formatPlaybackTime } from "./format-playback-time"
import { useIsMinimalistMode } from "@/lib/theme/use-classic-mode"

interface PlayerBottomBarProps {
    mediaFormat?: string | null
    duration: number
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

    // Opciones de reproducción
    playbackRate?: number
    onPlaybackRateChange?: (rate: number) => void
    autoSkipIntro?: boolean
    onAutoSkipIntroChange?: (enabled: boolean) => void
    autoSkipOutro?: boolean
    onAutoSkipOutroChange?: (enabled: boolean) => void

    onNextEpisode?: () => void
    hasNextEpisode?: boolean

    hlsLevels?: { index: number; label: string; height: number }[]
    activeHlsLevel?: number
    onHlsLevelChange?: (level: number) => void

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

    /** AniSkip intervals for rendering visual markers on the timeline */
    skipTimesOp?: { startTime: number; endTime: number; source?: string }
    skipTimesEd?: { startTime: number; endTime: number; source?: string }

    // Chapters
    chapters?: Chapter[]
    activeChapter?: string | null

    // Episode Selector
    isEpisodesSidebarOpen?: boolean
    onToggleEpisodesSidebar?: () => void
    hasEpisodes?: boolean

    // Queue Selector
    isQueueSidebarOpen?: boolean
    onToggleQueueSidebar?: () => void
    hasQueue?: boolean

    mediaId?: number

    previewManager?: PlayerPreviewManager | null

    /** <video> real, para calcular el tiempo restante sin re-renderizar toda la barra. */
    mediaElementRef?: React.RefObject<HTMLVideoElement | null>
    onOpenInMpv?: () => void
    mpvPending?: boolean
}

const CONTROL_BTN = PLAYER_ICON_BTN
const CONTROL_BTN_ACTIVE = PLAYER_ICON_BTN_ACTIVE
const TIME_LABEL = "shrink-0 min-w-[3.25rem] text-xs font-semibold tracking-wide tabular-nums [text-shadow:0_1px_4px_rgba(0,0,0,0.7)]"

/** Tiempo restante ("-12:34") como en AVKit. Escucha al <video> directamente y solo
 * re-renderiza cuando cambia el segundo mostrado. */
function RemainingTime({ mediaElementRef, duration }: { mediaElementRef?: React.RefObject<HTMLVideoElement | null>; duration: number }) {
    const [current, setCurrent] = React.useState(0)
    React.useEffect(() => {
        const video = mediaElementRef?.current
        if (!video) return
        const sync = () => setCurrent(Math.floor(video.currentTime || 0))
        sync()
        const events = ["timeupdate", "seeking", "seeked", "loadedmetadata", "durationchange"] as const
        events.forEach((ev) => video.addEventListener(ev, sync))
        return () => events.forEach((ev) => video.removeEventListener(ev, sync))
    }, [mediaElementRef])
    const remaining = Math.max(0, Math.floor(duration) - current)
    return (
        <span className={cn(TIME_LABEL, "text-right text-label-1")} aria-label={`Quedan ${formatPlaybackTime(remaining)}`}>
            -{formatPlaybackTime(remaining)}
        </span>
    )
}

export const PlayerBottomBar = React.memo(function PlayerBottomBar({
    mediaFormat,
    duration, progressBarRef, thumbRef, progressInputRef, handleSeek, handleSeekStart, handleSeekEnd,
    isPlaying, togglePlay, skipTime,
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
    onNextEpisode,
    hasNextEpisode,
    hlsLevels = [], activeHlsLevel = -1, onHlsLevelChange,
    aspectRatio = "contain", onAspectRatioChange,
    subtitleSize = 100, onSubtitleSizeChange,
    loopEnabled = false, onLoopEnabledChange,
    autoDisableSubtitlesWhenDubbed = true, onAutoDisableSubtitlesWhenDubbedChange,
    marathonMode = false, onMarathonModeChange,
    skipTimesOp,
    skipTimesEd,
    chapters = [],
    activeChapter,
    isEpisodesSidebarOpen,
    onToggleEpisodesSidebar,
    hasEpisodes,
    isQueueSidebarOpen,
    onToggleQueueSidebar,
    hasQueue,
    mediaId,
    previewManager,
    mediaElementRef,
    onOpenInMpv,
    mpvPending,
}: PlayerBottomBarProps) {
    const isMinimalist = useIsMinimalistMode()
    const isMovie = React.useMemo(() => {
        const formatUpper = mediaFormat?.toUpperCase()
        return formatUpper === "MOVIE" || formatUpper === "SPECIAL" || formatUpper === "OVA"
    }, [mediaFormat])

    const [isVolumeOpen, setIsVolumeOpen] = React.useState(false)

    const volumeExpanded = isVolumeOpen
    // Ancla de los paneles: vive fuera de las cápsulas de vidrio (ver PlayerSettingsMenuProps.panelContainer)
    const [settingsPanelHost, setSettingsPanelHost] = React.useState<HTMLDivElement | null>(null)

    const hasChapters = !isMovie && chapters.length > 0

    const sharedMenuProps = {
        panelContainer: settingsPanelHost,
        audioTracks, activeAudioIndex, onSelectAudio,
        subtitleTracks, activeSubtitleIndex, onSelectSubtitle,
        isLoadingSubtitle: isJassubLoading,
        sources: episodeSources,
        currentSourceUrl: activeStreamUrl,
        currentSourceType,
        onSourceChange: handleSourceSwitch,
        playbackRate, onPlaybackRateChange,
        autoSkipIntro, onAutoSkipIntroChange,
        autoSkipOutro, onAutoSkipOutroChange,
        hlsLevels, activeHlsLevel, onHlsLevelChange,
        aspectRatio, onAspectRatioChange,
        subtitleSize, onSubtitleSizeChange,
        loopEnabled, onLoopEnabledChange,
        autoDisableSubtitlesWhenDubbed, onAutoDisableSubtitlesWhenDubbedChange,
        marathonMode, onMarathonModeChange,
        mediaId, mediaFormat,
    }

    return (
        <div className="absolute inset-x-0 bottom-0 z-player-ui pointer-events-auto select-none">
            {/* Scrim: gradiente suave y más corto para mantener la pureza del vídeo */}
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-40 -z-10 pointer-events-none bg-gradient-to-t from-black/80 via-black/35 to-transparent" />

            <div ref={setSettingsPanelHost} className="absolute right-3 sm:right-8 bottom-full mb-1" />

            <div className="player-bar-fg relative flex flex-col w-full px-4 sm:px-8 pb-3 sm:pb-5">

            {/* Línea de tiempo amplia: transcurrido · barra · restante */}
            <div className="flex items-center gap-3 w-full">
                <span ref={timeTextRef} className={cn(TIME_LABEL, "text-label-1")}>00:00</span>
                <SeekBar
                    className="flex-1 min-w-0"
                    duration={duration}
                    progressBarRef={progressBarRef}
                    thumbRef={thumbRef}
                    progressInputRef={progressInputRef}
                    handleSeek={handleSeek}
                    handleSeekStart={handleSeekStart}
                    handleSeekEnd={handleSeekEnd}
                    skipTimesOp={skipTimesOp}
                    skipTimesEd={skipTimesEd}
                    chapters={chapters}
                    isMovie={isMovie}
                    previewManager={previewManager}
                />
                <RemainingTime mediaElementRef={mediaElementRef} duration={duration} />
            </div>

            {/* Fila de controles agrupados */}
            <div className="flex items-center justify-between gap-2 sm:gap-3 w-full mt-2">

                {/* Izquierda: controles de reproducción y volumen unificados */}
                <div className="flex items-center min-w-0 gap-2">
                    <div
                        role="group"
                        aria-label="Controles de reproducción y volumen"
                        className={cn("flex items-center p-1 rounded-full", PLAYER_GLASS)}
                    >
                        {/* Play / Pausa */}
                        <AnimatedTooltip side="top" content={isPlaying ? "Pausar [Espacio]" : "Reproducir [Espacio]"}>
                            <button
                                type="button"
                                tabIndex={0}
                                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                                aria-label={isPlaying ? "Pausar [Espacio]" : "Reproducir [Espacio]"}
                                className={CONTROL_BTN}
                            >
                                <IconSwap subtle swapKey={isPlaying ? "pause" : "play"}>
                                    {isPlaying
                                        ? <IconMediaPause className="w-4 h-4 fill-current" />
                                        : <IconMediaPlay className="w-4 h-4 fill-current ml-0.5" />}
                                </IconSwap>
                            </button>
                        </AnimatedTooltip>

                        {/* Retroceder 10s (oculto en modo minimalista) */}
                        {!isMinimalist && (
                            <AnimatedTooltip side="top" content="Retroceder 10s [J / ←]">
                                <button
                                    type="button"
                                    tabIndex={0}
                                    onClick={(e) => { e.stopPropagation(); skipTime(-10); }}
                                    aria-label="Retroceder 10s [←]"
                                    className={cn(CONTROL_BTN, "player-skip-back-btn")}
                                >
                                    <div className="w-4 h-4">
                                        <SkipTenIcon direction="back" />
                                    </div>
                                </button>
                            </AnimatedTooltip>
                        )}

                        {/* Avanzar 10s (oculto en modo minimalista) */}
                        {!isMinimalist && (
                            <AnimatedTooltip side="top" content="Avanzar 10s [L / →]">
                                <button
                                    type="button"
                                    tabIndex={0}
                                    onClick={(e) => { e.stopPropagation(); skipTime(10); }}
                                    aria-label="Avanzar 10s [→]"
                                    className={cn(CONTROL_BTN, "player-skip-fwd-btn")}
                                >
                                    <div className="w-4 h-4">
                                        <SkipTenIcon direction="forward" />
                                    </div>
                                </button>
                            </AnimatedTooltip>
                        )}

                        {/* Separador vertical fino (oculto en modo minimalista) */}
                        {!isMinimalist && <div className="player-skip-separator hidden sm:block h-4 w-px bg-white/15 mx-0.5" />}

                        {/* Volumen */}
                        <div
                            role="group"
                            aria-label="Control de volumen"
                            className="hidden sm:flex items-center"
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
                                type="button"
                                tabIndex={0}
                                onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                                aria-label={isMuted || volume === 0 ? "Activar sonido [M]" : "Silenciar [M]"}
                                title={isMuted || volume === 0 ? "Activar sonido [M]" : "Silenciar [M]"}
                                className={CONTROL_BTN}
                            >
                                <IconSwap subtle swapKey={isMuted || volume === 0 ? "muted" : "unmuted"}>
                                    {isMuted || volume === 0
                                        ? <IconMediaVolumeX className="w-4 h-4" />
                                        : <IconMediaVolume2 className="w-4 h-4" />}
                                </IconSwap>
                            </button>

                            <div
                                className={cn(
                                    "h-10 flex items-center overflow-hidden transition-[width,opacity] duration-fast ease-smooth-out",
                                    volumeExpanded ? "w-[92px] opacity-100" : "w-0 opacity-0"
                                )}
                            >
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
                                    className="shrink-0 w-[80px] mx-1.5 h-1 cursor-pointer accent-[hsl(var(--brand-accent))] outline-none focus-visible:ring-2 focus-visible:ring-brand-accent rounded"
                                />
                            </div>
                        </div>
                    </div>

                    {hasChapters && activeChapter && (
                        <span className="min-w-0 truncate max-w-[30vw] md:max-w-[240px] text-xs font-semibold tracking-wide text-label-2 [text-shadow:0_1px_4px_rgba(0,0,0,0.7)] ml-2" title={activeChapter}>
                            {activeChapter}
                        </span>
                    )}
                </div>

                {/* Derecha: controles unificados en una sola cápsula limpia */}
                <div className={cn("flex items-center shrink-0 gap-0.5 p-1 rounded-full", PLAYER_GLASS)}>
                    {!isMinimalist && hasEpisodes && (
                        <AnimatedTooltip side="top" content="Episodios [E]">
                            <button
                                type="button"
                                tabIndex={0}
                                onClick={(e) => { e.stopPropagation(); onToggleEpisodesSidebar?.(); }}
                                aria-label="Episodios [E]"
                                aria-expanded={isEpisodesSidebarOpen}
                                className={cn(CONTROL_BTN, isEpisodesSidebarOpen && CONTROL_BTN_ACTIVE)}
                            >
                                <IconNavigationList className="w-4 h-4" />
                            </button>
                        </AnimatedTooltip>
                    )}

                    {!isMinimalist && hasQueue && (
                        <AnimatedTooltip side="top" content="Mi Lista [Q]">
                            <button
                                type="button"
                                tabIndex={0}
                                onClick={(e) => { e.stopPropagation(); onToggleQueueSidebar?.(); }}
                                aria-label="Mi Lista [Q]"
                                aria-expanded={isQueueSidebarOpen}
                                className={cn(CONTROL_BTN, "player-queue-btn", isQueueSidebarOpen && CONTROL_BTN_ACTIVE)}
                            >
                                <IconMediaQueue className="w-4 h-4" />
                            </button>
                        </AnimatedTooltip>
                    )}

                    {onMarathonModeChange && (
                        <AnimatedTooltip side="top" content={marathonMode ? "Maratón activo (salto continuo)" : "Activar modo Maratón"}>
                            <button
                                type="button"
                                tabIndex={0}
                                onClick={(e) => { e.stopPropagation(); onMarathonModeChange(!marathonMode); }}
                                aria-label={marathonMode ? "Desactivar modo Maratón" : "Activar modo Maratón"}
                                aria-pressed={marathonMode}
                                className={cn(CONTROL_BTN, "player-marathon-btn", marathonMode && CONTROL_BTN_ACTIVE)}
                            >
                                <IconStatusZap className="w-4 h-4" />
                            </button>
                        </AnimatedTooltip>
                    )}

                    {onNextEpisode && hasNextEpisode && (
                        <AnimatedTooltip side="top" content="Siguiente episodio [N]">
                            <button
                                type="button"
                                tabIndex={0}
                                onClick={(e) => { e.stopPropagation(); onNextEpisode(); }}
                                aria-label="Siguiente episodio [N]"
                                className={CONTROL_BTN}>
                                <IconMediaSkipNext className="w-4 h-4" />
                            </button>
                        </AnimatedTooltip>
                    )}

                    {/* Menú de Configuración Unificado (Audio, Subtítulos, Calidad, Imagen y Reproducción) */}
                    <PlayerSettingsMenu
                        {...sharedMenuProps}
                        variant="all"
                        title={isMinimalist ? "Más opciones" : undefined}
                        onOpenQueue={isMinimalist && hasQueue ? onToggleQueueSidebar : undefined}
                        onOpenInMpv={isMinimalist ? onOpenInMpv : undefined}
                        mpvPending={mpvPending}
                        open={Boolean(settingsOpen)}
                        onOpenChange={(open) => onToggleSettings?.(open)}
                    />

                    <AnimatedTooltip side="top" content={isFullscreen ? "Salir de pantalla completa [F]" : "Pantalla completa [F]"}>
                        <button
                            type="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                            aria-label={isFullscreen ? "Salir de pantalla completa [F]" : "Pantalla completa [F]"}
                            className={CONTROL_BTN}>
                            <IconSwap subtle swapKey={isFullscreen ? "minimize" : "maximize"}>
                                {isFullscreen
                                    ? <IconMediaMinimize className="w-4 h-4" />
                                    : <IconMediaMaximize className="w-4 h-4" />}
                            </IconSwap>
                        </button>
                    </AnimatedTooltip>
                </div>
            </div>{/* end Bottom Controls Row */}
            </div>{/* end player-bar-fg */}
        </div>
    )
})
PlayerBottomBar.displayName = "PlayerBottomBar"
