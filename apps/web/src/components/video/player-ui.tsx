import React, { useEffect, useRef, useState } from "react"
import { m, AnimatePresence, useReducedMotion } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { PlayerTopBar } from "./player-topbar"
import { PlayerBottomBar, type PlayerSettingsPanel } from "./player-bottombar"
import { PlayerCenterControls } from "./player-center-controls"
import { LoadingErrorOverlay, CenterPlayFlash, SkipIntroOverlay, NextEpisodeOverlay, AutoSkipToastOverlay, PlayerHudOverlay } from "./player-overlays"
import { PlayerShortcutsModal } from "./player-shortcuts-modal"
import type { EpisodeSource } from "@/api/types/unified.types"
import type { PlayerCore, PlayerStats } from "./player-core"
import { useAppStore, useQueueStore, type PlaylistItem } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import { PlayerEpisodesSidebar } from "./player-episodes-sidebar"
import { PlayerQueueSidebar } from "./player-queue-sidebar"
import { __isTV__ } from "@/types/constants"
import { useFocusNavigation } from "@/hooks/use-focus-navigation"
import { IconMediaPlay, IconMediaVolume2, IconUiStar } from "@/components/ui/icons"
import { PLAYER_GLASS } from "./player-theme"
import { usePlayerGestures } from "./use-player-gestures"
import { hasFocusedPlayerControls } from "./usePlayerControlsVisibility"


function StatsOverlay({ show, data }: { show: boolean, data?: PlayerStats | null }) {
    if (!show || !data) return null
    return (
        <div className={cn("absolute top-24 left-3 sm:left-6 z-player-ui w-64 max-w-[calc(100vw-1.5rem)] p-4 rounded-2xl text-xs text-label-2 pointer-events-none", PLAYER_GLASS)}>
            <div className="mb-2.5 text-sm font-semibold text-brand-accent-readable">Estadísticas</div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 tabular-nums">
                <dt>Tiempo</dt><dd className="text-right text-label-1">{data.currentTime} / {data.duration}</dd>
                <dt>Búfer</dt><dd className="text-right text-label-1">{data.buffer}s</dd>
                <dt>Resolución</dt><dd className="text-right text-label-1">{data.resolution}</dd>
                <dt>Velocidad</dt><dd className="text-right text-label-1">{data.playbackRate}x</dd>
                <dt>Volumen</dt><dd className="text-right text-label-1">{data.volume}%</dd>
            </dl>
            <div className="mt-2.5 pt-2.5 border-t border-[var(--neutral-separator)] truncate text-label-2">{data.source}</div>
        </div>
    )
}

interface PlayerUIProps {
    title?: string
    episodeLabel?: string
    onClose: () => void
    onNextEpisode?: () => void
    playableUrl: string
    streamType: "local" | "online" | "direct" | "transcode" | "optimized"
    episodeSources: EpisodeSource[]
    onSourceSwitch: (source: EpisodeSource) => void
    core: PlayerCore
    mediaId?: number
    episodeNumber?: number
    malId?: number | null
    episodes?: {
        title?: string
        episodeNumber: number
        absoluteEpisodeNumber?: number
        thumbnail?: string
        watched?: boolean
    }[]
    onSelectEpisode?: (episodeNumber: number) => void
    mediaFormat?: string | null
    nextEpisodeTitle?: string
    nextEpisodeNumber?: number
    nextEpisodeImage?: string
    /** Presente solo en la app de escritorio con mpv disponible: hace handoff de la reproducción a mpv. */
    onOpenInMpv?: () => void
    mpvPending?: boolean
    isEpisodesSidebarOpen?: boolean
    onToggleEpisodesSidebar?: () => void
    setIsEpisodesSidebarOpen?: React.Dispatch<React.SetStateAction<boolean>>
    isQueueSidebarOpen?: boolean
    onToggleQueueSidebar?: () => void
    setIsQueueSidebarOpen?: React.Dispatch<React.SetStateAction<boolean>>
    momentKey?: string
    momentTitle?: string
}

export function PlayerUI(props: PlayerUIProps) {
    const {
        title, episodeLabel, onClose, onNextEpisode, playableUrl,
        streamType, episodeSources, onSourceSwitch, core,
        mediaId, episodeNumber, malId,
        episodes, onSelectEpisode, mediaFormat,
        nextEpisodeTitle, nextEpisodeNumber, nextEpisodeImage,
        onOpenInMpv,
        mpvPending,
        momentKey,
        momentTitle,
    } = props

    const {
        domElements,
        state,
        actions
    } = core
    // Los refs del core, con nombre de ref: se pasan como `ref`/props, nunca
    // se lee .current durante el render.
    const {
        videoElement: videoRef,
        containerElement: containerRef,
        progressBarElement: progressBarRef,
        thumbElement: thumbRef,
        progressInputElement: progressInputRef,
        timeTextElement: timeTextRef,
    } = domElements

    const [localEpisodesSidebarOpen, setLocalEpisodesSidebarOpen] = React.useState(false)
    const [localQueueSidebarOpen, setLocalQueueSidebarOpen] = React.useState(false)

    const isEpisodesSidebarOpen = props.isEpisodesSidebarOpen !== undefined ? props.isEpisodesSidebarOpen : localEpisodesSidebarOpen
    const setIsEpisodesSidebarOpen = props.setIsEpisodesSidebarOpen || setLocalEpisodesSidebarOpen
    const handleToggleEpisodesSidebar = props.onToggleEpisodesSidebar || (() => setIsEpisodesSidebarOpen(v => !v))

    const isQueueSidebarOpen = props.isQueueSidebarOpen !== undefined ? props.isQueueSidebarOpen : localQueueSidebarOpen
    const setIsQueueSidebarOpen = props.setIsQueueSidebarOpen || setLocalQueueSidebarOpen
    const handleToggleQueueSidebar = props.onToggleQueueSidebar || (() => setIsQueueSidebarOpen(v => !v))

    const handleQueueSelectItem = React.useCallback((item: PlaylistItem, idx: number) => {
        useQueueStore.getState().setCurrentQueueIndex(idx)
        if (item.mediaId === mediaId && item.episodeNumber !== undefined && onSelectEpisode) {
            onSelectEpisode(item.episodeNumber)
        }
        setIsQueueSidebarOpen(false)
    }, [mediaId, onSelectEpisode, setIsQueueSidebarOpen])

    const prefersReducedMotion = useReducedMotion()
    const {
        isHoldSpeedActive,
        brightness,
        swipeIndicator,
        skipFlash,
        hudData,
        startHold,
        endHold,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        handleInteractionClick,
        handleDoubleClick,
        handlePointerDown,
    } = usePlayerGestures({
        videoRef,
        state,
        actions,
    })

    const triggerControlsRef = useRef(actions.triggerControlsVisibility)
    useEffect(() => {
        triggerControlsRef.current = actions.triggerControlsVisibility
    }, [actions.triggerControlsVisibility])

    useEffect(() => {
        const handleGlobalKeyDown = () => {
            triggerControlsRef.current()
        }
        window.addEventListener("keydown", handleGlobalKeyDown, { capture: true })
        return () => {
            window.removeEventListener("keydown", handleGlobalKeyDown, { capture: true })
        }
    }, [])

    const { playlistQueue, currentQueueIndex } = useAppStore(useShallow(state => ({
        playlistQueue: state.playlistQueue,
        currentQueueIndex: state.currentQueueIndex
    })))

    const controlsVisible = state.controlsVisible || isEpisodesSidebarOpen || isQueueSidebarOpen

    // Dos menús agrupados ("Audio y subtítulos" y "Más") comparten isSettingsOpen del
    // core; esto solo decide cuál se muestra. Al cerrar vuelve a "Más" (atajo O).
    const [settingsPanel, setSettingsPanel] = useState<PlayerSettingsPanel>("more")
    const handleOpenSettingsPanel = React.useCallback((panel: PlayerSettingsPanel) => {
        setSettingsPanel(panel)
        actions.setIsSettingsOpen(true)
    }, [actions])
    const handleToggleSettings = React.useCallback((open?: boolean) => {
        const next = open !== undefined ? open : !state.isSettingsOpen
        if (!next) setSettingsPanel("more")
        actions.setIsSettingsOpen(next)
    }, [actions, state.isSettingsOpen])

    const anyPanelOpen = state.isSettingsOpen || isEpisodesSidebarOpen || isQueueSidebarOpen

    // Force controls visibility if sidebar is open
    useEffect(() => {
        if (isEpisodesSidebarOpen || isQueueSidebarOpen) {
            actions.setControlsVisible(true)
        }
    }, [isEpisodesSidebarOpen, isQueueSidebarOpen, actions])

    // D-pad navigation for TV remote control
    const handleEscape = React.useCallback(() => {
        if (isEpisodesSidebarOpen) {
            setIsEpisodesSidebarOpen(false)
        } else if (isQueueSidebarOpen) {
            setIsQueueSidebarOpen(false)
        } else if (state.isSettingsOpen) {
            actions.setIsSettingsOpen(false)
        } else if (state.isFullscreen) {
            actions.toggleFullscreen()
        } else {
            onClose()
        }
    }, [isEpisodesSidebarOpen, isQueueSidebarOpen, state.isSettingsOpen, state.isFullscreen, actions, onClose, setIsEpisodesSidebarOpen, setIsQueueSidebarOpen])

    useFocusNavigation({
        containerRef,
        enabled: controlsVisible,
        onEscape: handleEscape,
    })

    // Auto-enter fullscreen on TV platforms
    React.useEffect(() => {
        if (__isTV__ && !state.isFullscreen) {
            // Small delay to ensure player is mounted
            const timer = setTimeout(() => {
                actions.toggleFullscreen()
            }, 500)
            return () => clearTimeout(timer)
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div
            role="region"
            aria-label="Reproductor de video"
            ref={containerRef}
            onMouseMove={actions.triggerControlsVisibility}
            onMouseLeave={() => {
                // Bug 2 fix: do not close the settings panel on mouse leave.
                // The panel renders inside .player-bottom-bar; closing it here
                // would dismiss settings whenever the cursor briefly leaves the
                // player container (e.g. moving to a sub-menu item).
                if (!state.isSettingsOpen && !hasFocusedPlayerControls()) {
                    actions.setControlsVisible(false)
                }
            }}
            className={cn(
                "fixed inset-0 z-player w-screen h-dvh bg-black flex flex-col items-center justify-center overflow-hidden font-sans",
                !controlsVisible && state.isPlaying ? "cursor-none" : "cursor-default"
            )}
            style={{
                viewTransitionName: "video-player"
            } as React.CSSProperties}
        >
              <video
                ref={videoRef}
                onPlay={() => actions.setIsPlaying(true)}
                onPause={() => {
                    actions.setIsPlaying(false)
                    actions.flushProgressSync()
                }}
                onDurationChange={(e) => actions.setDuration(e.currentTarget.duration)}
                onTimeUpdate={actions.handleTimeUpdate}
                onWaiting={() => actions.setIsBuffering(true)}
                onPlaying={() => { actions.setIsBuffering(false); actions.setIsSeeking(false) }}
                onSeeked={() => actions.setIsSeeking(false)}
                onError={() => {
                    actions.setIsBuffering(false)
                    actions.setIsSeeking(false)
                }}
                onEnded={() => {
                    actions.flushProgressSync()
                    actions.handleTimeUpdate()
                }}
                className={cn(
                    "absolute inset-0 m-auto z-10",
                    state.aspectRatio === "21/9" ? "w-full h-auto aspect-[21/9] max-h-full max-w-full" :
                    state.aspectRatio === "16/9" ? "w-full h-auto aspect-[16/9] max-h-full max-w-full" :
                    "w-full h-full"
                )}
                style={{
                    objectFit: state.aspectRatio === "cover" || state.aspectRatio === "21/9" || state.aspectRatio === "16/9"
                        ? "cover"
                        : state.aspectRatio === "fill"
                        ? "fill"
                        : "contain",
                    filter: `brightness(${brightness})`
                }}
                crossOrigin="anonymous"
                playsInline
                preload="metadata"
            />

            {/* Gesture Interaction Overlay — z-player (base) para quedar DEBAJO de
                barras (z-player-ui) y overlays (z-player-overlay). Antes en z-player-ui
                con wrappers de barras en z-30, el overlay interceptaba clicks de
                REINTENTAR/REGRESAR y botones de la bottom-bar.
                Superficie solo de puntero: sin foco ni onKeyDown propio. Si tomaba
                el foco al clickear, Espacio alternaba acá y otra vez en el atajo
                global de usePlayerShortcuts (doble toggle = no pasaba nada). */}
            <div
                aria-hidden="true"
                onPointerDown={handlePointerDown}
                onMouseDown={(e) => {
                    if (e.button === 0) startHold()
                }}
                onMouseUp={endHold}
                onMouseLeave={endHold}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                onClick={handleInteractionClick}
                onDoubleClick={handleDoubleClick}
                className={cn(
                    "absolute inset-0 z-player select-none",
                    !controlsVisible && state.isPlaying ? "cursor-none" : "cursor-pointer"
                )}
            />

            {/* Indicador de gesto (swipe) — fade-in/out con escala */}
            <AnimatePresence>
                {swipeIndicator && (
                    <m.div
                        key="swipe-indicator"
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.92 }}
                        transition={{ duration: 0.12 }}
                        className="absolute inset-0 z-player-overlay pointer-events-none flex items-center justify-center"
                    >
                        <div className={cn("flex items-center gap-2 h-11 px-4 rounded-full text-white text-xs font-semibold tracking-wide tabular-nums", PLAYER_GLASS)}>
                            {swipeIndicator.type === "seek" && <IconMediaPlay className="w-4 h-4 fill-current shrink-0 text-brand-accent" />}
                            {swipeIndicator.type === "volume" && <IconMediaVolume2 className="w-4 h-4 shrink-0 text-brand-accent" />}
                            {swipeIndicator.type === "brightness" && <IconUiStar className="w-4 h-4 shrink-0 text-brand-accent" />}
                            <span>{swipeIndicator.value}</span>
                        </div>
                    </m.div>
                )}
            </AnimatePresence>

            {/* Indicadores de ±10s: entrada/salida con spring, idéntico a CenterPlayFlash */}
            <AnimatePresence>
                {(["left", "right"] as const).map((side) =>
                    skipFlash === side ? (
                        <m.div
                            key={`skip-${side}`}
                            initial={prefersReducedMotion ? { opacity: 0, y: "-50%" } : { opacity: 0, scale: 0.8, y: "-50%" }}
                            animate={prefersReducedMotion ? { opacity: 1, y: "-50%" } : { opacity: 1, scale: 1, y: "-50%" }}
                            exit={prefersReducedMotion ? { opacity: 0, y: "-50%" } : { opacity: 0, scale: 1.15, y: "-50%" }}
                            // El centrado va en `y` de Framer: con la clase -translate-y-1/2 (Tailwind 3)
                            // el transform inline de la animación la pisaba y el círculo quedaba corrido.
                            transition={{ duration: prefersReducedMotion ? 0.1 : 0.22, ease: [0.23, 1, 0.32, 1] }}
                            className={cn(
                                `skip-indicator-${side} absolute top-1/2 z-player-overlay pointer-events-none`,
                                side === "left" ? "left-[15%]" : "right-[15%]"
                            )}
                        >
                            <div className={cn("flex flex-col items-center justify-center w-20 h-20 rounded-full text-white", PLAYER_GLASS)}>
                                <svg className={cn("w-6 h-6 fill-current", side === "left" && "rotate-180")} viewBox="0 0 24 24">
                                    <path d="M5 5.5v13a1 1 0 0 0 1.53.85L15.5 13.1V18a1 1 0 0 0 2 0V6a1 1 0 0 0-2 0v4.9L6.53 4.65A1 1 0 0 0 5 5.5z" />
                                </svg>
                                <span className="text-2xs font-semibold tracking-wide tabular-nums mt-0.5">{side === "left" ? "-10s" : "+10s"}</span>
                            </div>
                        </m.div>
                    ) : null
                )}
            </AnimatePresence>

            {/* Velocidad 2x mientras se mantiene presionado — con exit animation */}
            <AnimatePresence>
                {isHoldSpeedActive && (
                    <m.div
                        key="hold-speed"
                        initial={{ opacity: 0, y: -8, scale: 0.9, x: "-50%" }}
                        animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
                        exit={{ opacity: 0, y: -6, scale: 0.95, x: "-50%" }}
                        // Centrado en `x` de Framer, no con -translate-x-1/2 (el transform inline lo pisaba).
                        transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                        className="absolute top-20 left-1/2 z-player-overlay pointer-events-none"
                    >
                        <div className={cn("h-9 px-4 flex items-center gap-1.5 rounded-full text-white text-xs font-semibold tracking-wide tabular-nums", PLAYER_GLASS)}>
                            <span className="text-brand-accent-readable">2x</span> Velocidad
                        </div>
                    </m.div>
                )}
            </AnimatePresence>

            <LoadingErrorOverlay
                status={state.status}
                errorMsg={state.errorMsg}
                streamType={streamType || "local"}
                isBuffering={state.isBuffering}
                isSeeking={state.isSeeking}
                isStreamSwitching={state.isStreamSwitching}
                streamSwitchReason={state.streamSwitchReason}
                onClose={onClose}
                onRetry={actions.retryStream}
            />


            <CenterPlayFlash flash={state.flash} />

            {/* HUD flotante estilo OS (volumen y velocidad con spring physics) */}
            <PlayerHudOverlay hud={hudData} />

            <StatsOverlay show={state.showStats} data={state.statsData} />

            <SkipIntroOverlay
                // Se oculta mientras hay otro panel abierto en esa zona (ajustes, episodios, cola)
                // En modo TV la tarjeta de siguiente episodio lo cubre; en modo normal el botón se apila encima de ella. El atajo S sigue funcionando.
                show={state.skipMode !== null && !(state.showNextEpisode && state.tvMode) && !state.isSettingsOpen && !isEpisodesSidebarOpen && !isQueueSidebarOpen}
                onSkip={actions.handleSkipIntro}
                skipMode={state.skipMode ?? "intro"}
                remainingSeconds={state.skipRemainingSeconds}
                segmentProgress={state.segmentProgress}
                shortcutKey="S"
                stackAbove={state.showNextEpisode}
                controlsVisible={controlsVisible}
            />

            <AutoSkipToastOverlay
                showType={state.showAutoSkipToast}
                onUndo={actions.undoSkip}
                controlsVisible={controlsVisible}
            />

            <NextEpisodeOverlay
                show={state.showNextEpisode}
                tvMode={state.tvMode}
                marathonMode={state.marathonMode}
                showCountdown={state.showCountdown}
                countdownSeconds={state.countdownSeconds}
                nextEpisodeTitle={nextEpisodeTitle || "Siguiente Episodio"}
                nextEpisodeNumber={nextEpisodeNumber}
                nextEpisodeImage={nextEpisodeImage}
                onNext={onNextEpisode || (() => { })}
                duration={state.duration}
                remainingProgress={state.remainingProgress}
                controlsVisible={controlsVisible}
            />

            {/* Centro: solo visible en modo TV (D-pad). En web/escritorio los controles
                de reproducción viven unificados en la barra inferior para dejar el fotograma 100% limpio. */}
            <PlayerCenterControls
                visible={Boolean(state.tvMode) && controlsVisible && !anyPanelOpen && state.status === "ready" && !state.isBuffering}
                isPlaying={state.isPlaying}
                onTogglePlay={actions.togglePlay}
                onSkip={(amount) => {
                    actions.skipTime(amount)
                    actions.triggerControlsVisibility()
                }}
            />

            <PlayerShortcutsModal
                isOpen={state.showShortcuts}
                onClose={() => actions.setShowShortcuts(false)}
            />

            <div
                inert={!controlsVisible}
                aria-hidden={!controlsVisible}
                onFocusCapture={actions.triggerControlsVisibility}
                onBlurCapture={actions.triggerControlsVisibility}
                className={cn(
                    // Asimétrico: al mover el mouse aparecen enseguida; al quedar quieto se
                    // retiran despacio, porque ese momento no lo decide la persona.
                    // Solo opacidad (AVKit): nada se desplaza al ocultarse.
                    "player-top-bar absolute top-0 inset-x-0 z-player-ui pointer-events-none transition-opacity ease-out-strong",
                    controlsVisible
                        ? "opacity-100 duration-fast"
                        : "opacity-0 pointer-events-none duration-slow"
                )}
            >
                <PlayerTopBar
                    title={title}
                    episodeLabel={episodeLabel}
                    episodeNumber={episodeNumber}
                    onClose={onClose}
                    mediaFormat={mediaFormat}
                    onOpenInMpv={onOpenInMpv}
                    mpvPending={mpvPending}
                    momentKey={momentKey}
                    momentTitle={momentTitle}
                    currentTime={state.currentTime}
                />
            </div>

            <div
                inert={!controlsVisible}
                aria-hidden={!controlsVisible}
                onFocusCapture={actions.triggerControlsVisibility}
                onBlurCapture={actions.triggerControlsVisibility}
                className={cn(
                    "player-bottom-bar absolute bottom-0 inset-x-0 pointer-events-none transition-opacity ease-out-strong",
                    // Con ajustes abiertos la barra sube de capa para que el panel quede sobre los overlays
                    state.isSettingsOpen ? "z-player-settings" : "z-player-ui",
                    controlsVisible ? "opacity-100 duration-fast" : "opacity-0 pointer-events-none duration-slow"
                )}
            >
                <PlayerBottomBar
                    title={title}
                    episodeNumber={episodeNumber}
                    episodeLabel={episodeLabel}
                    mediaFormat={mediaFormat}
                    duration={state.duration}
                    progressBarRef={progressBarRef}
                    thumbRef={thumbRef}
                    progressInputRef={progressInputRef}
                    handleSeek={actions.handleSeek}
                    handleSeekStart={actions.handleSeekStart}
                    handleSeekEnd={actions.handleSeekEnd}
                    isPlaying={state.isPlaying}
                    togglePlay={actions.togglePlay}
                    skipTime={actions.skipTime}
                    isMuted={state.isMuted}
                    toggleMute={actions.toggleMute}
                    volume={state.volume}
                    handleVolume={actions.handleVolume}
                    timeTextRef={timeTextRef}
                    audioTracks={state.audioTracks}
                    activeAudioIndex={state.activeAudioIndex}
                    onSelectAudio={actions.onSelectAudio}
                    subtitleTracks={state.subtitleTracks}
                    activeSubtitleIndex={state.activeSubtitleIndex}
                    onSelectSubtitle={actions.onSelectSubtitle}
                    isJassubLoading={state.isJassubLoading || state.isPgsLoading}
                    episodeSources={episodeSources || []}
                    activeStreamUrl={playableUrl}
                    currentSourceType={streamType}
                    handleSourceSwitch={onSourceSwitch || (() => { })}
                    isFullscreen={state.isFullscreen}
                    toggleFullscreen={actions.toggleFullscreen}
                    settingsOpen={state.isSettingsOpen}
                    onToggleSettings={handleToggleSettings}
                    settingsPanel={settingsPanel}
                    onOpenSettingsPanel={handleOpenSettingsPanel}
                    mediaElementRef={videoRef}
                    videoRef={videoRef}
                    malId={malId}
                    mediaId={mediaId}
                    playbackRate={state.playbackRate}
                    onPlaybackRateChange={actions.changePlaybackRate}
                    autoSkipIntro={state.autoSkipIntro}
                    onAutoSkipIntroChange={actions.setAutoSkipIntro}
                    autoSkipOutro={state.autoSkipOutro}
                    onAutoSkipOutroChange={actions.setAutoSkipOutro}
                    hlsLevels={state.hlsLevels}
                    activeHlsLevel={state.activeHlsLevel}
                    onHlsLevelChange={actions.setHlsLevel}
                    aspectRatio={state.aspectRatio}
                    onAspectRatioChange={(r) => actions.setAspectRatio(r)}
                    subtitleSize={state.subtitleSize}
                    onSubtitleSizeChange={actions.setSubtitleSize}
                    loopEnabled={state.loopEnabled}
                    onLoopEnabledChange={actions.setLoopEnabled}
                    autoDisableSubtitlesWhenDubbed={state.autoDisableSubtitlesWhenDubbed}
                    onAutoDisableSubtitlesWhenDubbedChange={actions.setAutoDisableSubtitlesWhenDubbed}
                    tvMode={state.tvMode}
                    onTvModeChange={actions.setTvMode}
                    marathonMode={state.marathonMode}
                    onMarathonModeChange={actions.setMarathonMode}
                    onNextEpisode={onNextEpisode}
                    hasNextEpisode={state.hasNextEpisode}
                    skipTimesOp={state.skipTimesOp}
                    skipTimesEd={state.skipTimesEd}
                    chapters={state.chapters}
                    skipToNextChapter={actions.skipToNextChapter}
                    skipToPrevChapter={actions.skipToPrevChapter}
                    activeChapter={state.activeChapter}
                    isEpisodesSidebarOpen={isEpisodesSidebarOpen}
                    onToggleEpisodesSidebar={handleToggleEpisodesSidebar}
                    hasEpisodes={Boolean(episodes && episodes.length > 0)}
                    isQueueSidebarOpen={isQueueSidebarOpen}
                    onToggleQueueSidebar={handleToggleQueueSidebar}
                    hasQueue={playlistQueue.length > 0}
                    previewManager={state.previewManager}
                />
            </div>

            {/* Episodes Sidebar */}
            <PlayerEpisodesSidebar
                isOpen={isEpisodesSidebarOpen}
                onClose={() => setIsEpisodesSidebarOpen(false)}
                episodes={episodes || []}
                currentEpisodeNumber={episodeNumber}
                onSelectEpisode={onSelectEpisode}
                marathonMode={state.marathonMode}
                onMarathonModeChange={actions.setMarathonMode}
            />

            {/* Queue Sidebar */}
            <PlayerQueueSidebar
                isOpen={isQueueSidebarOpen}
                onClose={() => setIsQueueSidebarOpen(false)}
                playlistQueue={playlistQueue}
                currentQueueIndex={currentQueueIndex}
                onSelectItem={handleQueueSelectItem}
            />
        </div>
    )
}
