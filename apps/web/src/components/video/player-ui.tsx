/* eslint-disable react-hooks/refs */
import React, { useEffect, useRef, useState } from "react"
import { cn } from "@/components/ui/core/styling"
import { PlayerTopBar } from "./player-topbar"
import { PlayerBottomBar } from "./player-bottombar"
import { LoadingErrorOverlay, CenterPlayFlash, SkipIntroOverlay, NextEpisodeOverlay, AutoSkipToastOverlay } from "./player-overlays"
import { PlayerShortcutsModal } from "./player-shortcuts-modal"
import type { EpisodeSource } from "@/api/types/unified.types"
import { useGetVideoInsights } from "@/api/hooks/videocore.hooks"
import type { PlayerCore, PlayerStats } from "./player-core"
import { useAppStore, useQueueStore, type PlaylistItem } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import { PlayerEpisodesSidebar } from "./player-episodes-sidebar"
import { PlayerQueueSidebar } from "./player-queue-sidebar"
import { PlayerAmbientBackdrop } from "./player-ambient"
import { __isTV__ } from "@/types/constants"
import { useFocusNavigation } from "@/hooks/use-focus-navigation"
import { IconMediaPlay, IconMediaVolume2, IconUiStar } from "@/components/ui/icons";
import { PLAYER_GLASS } from "./player-theme"


function StatsOverlay({ show, data }: { show: boolean, data?: PlayerStats | null }) {
    if (!show || !data) return null
    return (
        <div className={cn("absolute top-24 left-3 sm:left-6 z-player-ui w-64 max-w-[calc(100vw-1.5rem)] p-4 rounded-2xl text-xs text-on-surface-variant pointer-events-none", PLAYER_GLASS)}>
            <div className="mb-2.5 text-2xs font-semibold uppercase tracking-widest text-brand-accent">Estadísticas</div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 tabular-nums">
                <dt>Tiempo</dt><dd className="text-right text-white">{data.currentTime} / {data.duration}</dd>
                <dt>Buffer</dt><dd className="text-right text-white">{data.buffer}s</dd>
                <dt>Resolución</dt><dd className="text-right text-white">{data.resolution}</dd>
                <dt>Velocidad</dt><dd className="text-right text-white">{data.playbackRate}x</dd>
                <dt>Volumen</dt><dd className="text-right text-white">{data.volume}%</dd>
            </dl>
            <div className="mt-2.5 pt-2.5 border-t border-white/10 truncate opacity-60">{data.source}</div>
        </div>
    )
}

export interface PlayerUIProps {
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
        momentKey,
        momentTitle,
    } = props

    const {
        domElements,
        state,
        actions
    } = core

    const localVideoRef = useRef<HTMLVideoElement | null>(null)

    useEffect(() => {
        localVideoRef.current = domElements.videoElement.current
    }, [domElements.videoElement])

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

    // Gesture tracking for double tap to skip and hold for 2x speed
    const [isHoldSpeedActive, setIsHoldSpeedActive] = React.useState(false)
    const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const isHoldingRef = useRef<boolean>(false)
    const wasHoldingRef = useRef<boolean>(false)
    const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const lastClickTimeRef = useRef<number>(0)

    const startHold = () => {
        wasHoldingRef.current = false
        if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current)
        holdTimeoutRef.current = setTimeout(() => {
            isHoldingRef.current = true
            wasHoldingRef.current = true
            const video = localVideoRef.current
            if (video) {
                video.playbackRate = 2.0
            }
            setIsHoldSpeedActive(true)
        }, 500)
    }

    const endHold = () => {
        if (holdTimeoutRef.current) {
            clearTimeout(holdTimeoutRef.current)
            holdTimeoutRef.current = null
        }
        if (isHoldingRef.current) {
            isHoldingRef.current = false
            setIsHoldSpeedActive(false)
            const video = localVideoRef.current
            if (video) {
                video.playbackRate = state.playbackRate
            }
            // Delay resetting wasHoldingRef to absorb synthetic trailing clicks
            setTimeout(() => {
                wasHoldingRef.current = false
            }, 400)
        }
    }

    // Gestures for swipe-seek, volume, and brightness
    const [brightness, setBrightness] = React.useState(1.0)
    const [swipeIndicator, setSwipeIndicator] = React.useState<{
        type: "seek" | "volume" | "brightness"
        value: string
    } | null>(null)
    const [skipFlash, setSkipFlash] = useState<"left" | "right" | null>(null)
    const skipFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const touchStartRef = useRef<{ x: number, y: number } | null>(null)
    const isSwipingRef = useRef<boolean>(false)
    const swipeDirectionRef = useRef<"horizontal" | "vertical" | null>(null)
    const swipeSideRef = useRef<"left" | "right" | null>(null)
    const initialVolumeRef = useRef<number>(1.0)
    const initialBrightnessRef = useRef<number>(1.0)
    const initialTimeRef = useRef<number>(0)

    const formatTime = (secs: number) => {
        if (!secs || isNaN(secs)) return "00:00"
        const h = Math.floor(secs / 3600)
        const m = Math.floor((secs % 3600) / 60)
        const s = Math.floor(secs % 60)
        const mm = m.toString().padStart(2, '0')
        const ss = s.toString().padStart(2, '0')
        return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
    }

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        const touch = e.touches[0]
        if (!touch) return
        
        touchStartRef.current = { x: touch.clientX, y: touch.clientY }
        isSwipingRef.current = false
        swipeDirectionRef.current = null
        
        const video = localVideoRef.current
        if (video) {
            initialTimeRef.current = video.currentTime
            initialVolumeRef.current = video.volume
        }
        initialBrightnessRef.current = brightness
        
        // Determine touch side (left/right)
        const rect = e.currentTarget.getBoundingClientRect()
        const relativeX = touch.clientX - rect.left
        swipeSideRef.current = relativeX < rect.width / 2 ? "left" : "right"
        
        // Also trigger controls visibility
        actions.triggerControlsVisibility()
        
        // Trigger startHold for 2x speed if hold continues
        startHold()
    }

    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        if (!touchStartRef.current) return
        const touch = e.touches[0]
        if (!touch) return

        const deltaX = touch.clientX - touchStartRef.current.x
        const deltaY = touch.clientY - touchStartRef.current.y
        const absX = Math.abs(deltaX)
        const absY = Math.abs(deltaY)

        // Cancel speed hold if user moves their finger (swiping)
        if (absX > 15 || absY > 15) {
            if (holdTimeoutRef.current) {
                clearTimeout(holdTimeoutRef.current)
                holdTimeoutRef.current = null
            }
        }

        if (!isSwipingRef.current) {
            // Check if threshold is met
            if (absX > 15 || absY > 15) {
                isSwipingRef.current = true
                swipeDirectionRef.current = absX > absY ? "horizontal" : "vertical"
            }
        }

        if (isSwipingRef.current && swipeDirectionRef.current) {
            e.preventDefault()
            
            if (swipeDirectionRef.current === "horizontal") {
                // Seek gesture: 1px = 0.15s of video seek
                const seekMultiplier = 0.15
                const secondsDelta = deltaX * seekMultiplier
                const newTime = Math.max(0, Math.min(state.duration, initialTimeRef.current + secondsDelta))
                
                const timeDiff = newTime - initialTimeRef.current
                const prefix = timeDiff >= 0 ? ">>" : "<<"
                const formattedDiff = `${prefix} ${Math.abs(Math.round(timeDiff))}s`
                const formattedNewTime = formatTime(newTime)
                
                setSwipeIndicator({
                    type: "seek",
                    value: `[${formattedDiff}] ${formattedNewTime}`
                })
                
                const video = localVideoRef.current
                if (video) {
                    video.currentTime = newTime
                }
            } else {
                // Vertical swipe: volume on right side, brightness on left side
                const verticalMultiplier = -0.005
                const deltaValue = deltaY * verticalMultiplier
                
                if (swipeSideRef.current === "right") {
                    // Volume control — centralizado en handleVolume (evita doble escritura)
                    const newVolume = Math.max(0, Math.min(1, initialVolumeRef.current + deltaValue))
                    actions.handleVolume({ target: { value: String(newVolume) } } as unknown as React.ChangeEvent<HTMLInputElement>)
                    setSwipeIndicator({
                        type: "volume",
                        value: `VOL: ${(newVolume * 100).toFixed(0)}%`
                    })
                } else {
                    // Brightness control
                    const newBrightness = Math.max(0.2, Math.min(1.8, initialBrightnessRef.current + deltaValue))
                    setBrightness(newBrightness)
                    setSwipeIndicator({
                        type: "brightness",
                        value: `BRIG: ${(newBrightness * 100).toFixed(0)}%`
                    })
                }
            }
        }
    }

    const handleTouchEnd = () => {
        touchStartRef.current = null
        setSwipeIndicator(null)
        endHold()
        
        if (isSwipingRef.current) {
            isSwipingRef.current = false
            swipeDirectionRef.current = null
            // Swiped, do not trigger play/pause click
            wasHoldingRef.current = true
            setTimeout(() => {
                wasHoldingRef.current = false
            }, 400)
        }
    }

    const playSkipAnimation = (side: "left" | "right") => {
        setSkipFlash(side)
        if (skipFlashTimerRef.current) clearTimeout(skipFlashTimerRef.current)
        skipFlashTimerRef.current = setTimeout(() => {
            setSkipFlash(null)
            skipFlashTimerRef.current = null
        }, 550)
    }

    const handleInteractionClick = (e: React.MouseEvent<HTMLDivElement>) => {
        actions.triggerControlsVisibility()
        if (wasHoldingRef.current) {
            wasHoldingRef.current = false
            return
        }

        const isTouch = (e.nativeEvent as PointerEvent)?.pointerType === "touch" || isHoldingRef.current

        // On desktop mouse clicks, toggle play/pause immediately without artificial 300ms latency.
        // Fullscreen toggle on desktop is handled via onDoubleClick.
        if (!isTouch) {
            actions.togglePlay()
            return
        }

        const rect = e.currentTarget.getBoundingClientRect()
        const clickX = e.clientX - rect.left
        const isLeftSide = clickX < rect.width / 2

        const now = Date.now()
        const DOUBLE_CLICK_DELAY = 300

        if (now - lastClickTimeRef.current < DOUBLE_CLICK_DELAY) {
            if (clickTimeoutRef.current) {
                clearTimeout(clickTimeoutRef.current)
                clickTimeoutRef.current = null
            }
            if (isLeftSide) {
                actions.skipTime(-10)
                playSkipAnimation("left")
            } else {
                actions.skipTime(10)
                playSkipAnimation("right")
            }
            lastClickTimeRef.current = 0
        } else {
            lastClickTimeRef.current = now
            if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current)
            clickTimeoutRef.current = setTimeout(() => {
                if (!isHoldingRef.current) {
                    actions.togglePlay()
                }
                clickTimeoutRef.current = null
            }, DOUBLE_CLICK_DELAY)
        }
    }

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
            if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current)
            if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current)
            window.removeEventListener("keydown", handleGlobalKeyDown, { capture: true })
        }
    }, [])

    const { playlistQueue, currentQueueIndex } = useAppStore(useShallow(state => ({
        playlistQueue: state.playlistQueue,
        currentQueueIndex: state.currentQueueIndex
    })))

    const controlsVisible = state.controlsVisible || isEpisodesSidebarOpen || isQueueSidebarOpen

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
        containerRef: domElements.containerElement,
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

    // Fetch video insights (heatmap)
    const { data: insightsData } = useGetVideoInsights({
        episodeId: (mediaId && episodeNumber) ? `${mediaId}${episodeNumber}` : ""
    }, !!(mediaId && episodeNumber && state.duration > 0))

    const insights = insightsData || []





    return (
        <div
            role="region"
            aria-label="Reproductor de video"
            ref={domElements.containerElement}
            onMouseMove={actions.triggerControlsVisibility}
            onMouseLeave={() => {
                // Bug 2 fix: do not close the settings panel on mouse leave.
                // The panel renders inside .player-bottom-bar; closing it here
                // would dismiss settings whenever the cursor briefly leaves the
                // player container (e.g. moving to a sub-menu item).
                if (!state.isSettingsOpen) {
                    actions.setControlsVisible(false)
                }
            }}
            className={cn(
                "fixed inset-0 z-player w-screen h-screen bg-black flex flex-col items-center justify-center overflow-hidden font-sans",
                !controlsVisible && state.isPlaying ? "cursor-none" : "cursor-default"
            )}
            style={{
                viewTransitionName: "video-player"
            } as React.CSSProperties}
        >

            <PlayerAmbientBackdrop 
                videoRef={localVideoRef} 
                enabled={state.ambientModeEnabled && !state.tvMode} // Usually ambient mode isn't great for TVs or we can just leave it enabled for both
            />
              <video
                ref={domElements.videoElement}
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
                onDoubleClick={(e) => {
                    if ((e.nativeEvent as PointerEvent)?.pointerType !== "touch") {
                        actions.toggleFullscreen()
                    }
                }}
                className={cn(
                    "absolute inset-0 z-player select-none",
                    !controlsVisible && state.isPlaying ? "cursor-none" : "cursor-pointer"
                )}
            />

            {/* Indicador de gesto (swipe) */}
            {swipeIndicator && (
                <div className="absolute inset-0 z-player-overlay pointer-events-none flex items-center justify-center animate-in fade-in duration-100">
                    <div className={cn("flex items-center gap-2 h-11 px-4 rounded-full text-white text-xs font-semibold tracking-wide tabular-nums", PLAYER_GLASS)}>
                        {swipeIndicator.type === "seek" && <IconMediaPlay className="w-4 h-4 fill-current shrink-0 text-brand-accent" />}
                        {swipeIndicator.type === "volume" && <IconMediaVolume2 className="w-4 h-4 shrink-0 text-brand-accent" />}
                        {swipeIndicator.type === "brightness" && <IconUiStar className="w-4 h-4 shrink-0 text-brand-accent" />}
                        <span>{swipeIndicator.value}</span>
                    </div>
                </div>
            )}

            {/* Indicadores de ±10s: círculo simple a cada lado */}
            {(["left", "right"] as const).map((side) => (
                <div
                    key={side}
                    className={cn(
                        `skip-indicator-${side} absolute top-1/2 -translate-y-1/2 z-player-overlay pointer-events-none transition-opacity duration-200 ease-out`,
                        side === "left" ? "left-[15%]" : "right-[15%]",
                        skipFlash === side ? "opacity-100" : "opacity-0"
                    )}
                >
                    <div className={cn("flex flex-col items-center justify-center w-20 h-20 rounded-full text-white", PLAYER_GLASS)}>
                        <svg className={cn("w-6 h-6 fill-current", side === "left" && "rotate-180")} viewBox="0 0 24 24">
                            <path d="M5 5.5v13a1 1 0 0 0 1.53.85L15.5 13.1V18a1 1 0 0 0 2 0V6a1 1 0 0 0-2 0v4.9L6.53 4.65A1 1 0 0 0 5 5.5z" />
                        </svg>
                        <span className="text-2xs font-semibold tracking-wide tabular-nums mt-0.5">{side === "left" ? "-10s" : "+10s"}</span>
                    </div>
                </div>
            ))}

            {/* Velocidad 2x mientras se mantiene presionado */}
            {isHoldSpeedActive && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-player-overlay pointer-events-none animate-in fade-in duration-150">
                    <div className={cn("h-9 px-4 flex items-center gap-1.5 rounded-full text-white text-xs font-semibold tracking-wide tabular-nums", PLAYER_GLASS)}>
                        <span className="text-brand-accent">2x</span> Velocidad
                    </div>
                </div>
            )}

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

            <StatsOverlay show={state.showStats} data={state.statsData} />

            <SkipIntroOverlay
                // Se oculta mientras hay otro panel abierto en esa zona (ajustes, episodios, cola)
                // o la tarjeta de siguiente episodio, que ya cubre "saltar outro". El atajo S sigue funcionando.
                show={state.skipMode !== null && !state.showNextEpisode && !state.isSettingsOpen && !isEpisodesSidebarOpen && !isQueueSidebarOpen}
                onSkip={actions.handleSkipIntro}
                skipMode={state.skipMode ?? "intro"}
                remainingSeconds={state.skipRemainingSeconds}
                segmentProgress={state.segmentProgress}
                shortcutKey="S"
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
            />

            <PlayerShortcutsModal
                isOpen={state.showShortcuts}
                onClose={() => actions.setShowShortcuts(false)}
            />

            <div
                className={cn(
                    // Asimétrico: al mover el mouse aparecen enseguida; al quedar quieto se
                    // retiran despacio, porque ese momento no lo decide la persona.
                    "player-top-bar absolute top-0 inset-x-0 z-player-ui pointer-events-none transition-[opacity,transform] ease-out-strong",
                    controlsVisible
                        ? "opacity-100 translate-y-0 duration-150"
                        : "opacity-0 -translate-y-3 pointer-events-none duration-500"
                )}
            >
                <PlayerTopBar
                    title={title}
                    episodeLabel={episodeLabel}
                    episodeNumber={episodeNumber}
                    onClose={onClose}
                    mediaFormat={mediaFormat}
                    onOpenInMpv={onOpenInMpv}
                    momentKey={momentKey}
                    momentTitle={momentTitle}
                    currentTime={state.currentTime}
                />
            </div>

            <div
                className={cn(
                    "player-bottom-bar absolute bottom-0 inset-x-0 pointer-events-none transition-opacity ease-out-strong",
                    // Con ajustes abiertos la barra sube de capa para que el panel quede sobre los overlays
                    state.isSettingsOpen ? "z-player-settings" : "z-player-ui",
                    controlsVisible ? "opacity-100 duration-150" : "opacity-0 pointer-events-none duration-500"
                )}
            >
                <PlayerBottomBar
                    title={title}
                    episodeNumber={episodeNumber}
                    episodeLabel={episodeLabel}
                    mediaFormat={mediaFormat}
                    duration={state.duration}
                    insights={insights}
                    progressBarRef={domElements.progressBarElement}
                    thumbRef={domElements.thumbElement}
                    progressInputRef={domElements.progressInputElement}
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
                    timeTextRef={domElements.timeTextElement}
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
                    onToggleSettings={(open?: boolean) => actions.setIsSettingsOpen(open !== undefined ? open : !state.isSettingsOpen)}
                    videoRef={localVideoRef}
                    malId={malId}
                    mediaId={mediaId}
                    playbackRate={state.playbackRate}
                    onPlaybackRateChange={actions.changePlaybackRate}
                    autoSkipIntro={state.autoSkipIntro}
                    onAutoSkipIntroChange={actions.setAutoSkipIntro}
                    autoSkipOutro={state.autoSkipOutro}
                    onAutoSkipOutroChange={actions.setAutoSkipOutro}
                    autoSkipFiller={state.autoSkipFiller}
                    onAutoSkipFillerChange={actions.setAutoSkipFiller}
                    skipStepSeconds={state.skipStepSeconds}
                    onSkipStepSecondsChange={actions.setSkipStepSeconds}
                    hlsLevels={state.hlsLevels}
                    activeHlsLevel={state.activeHlsLevel}
                    onHlsLevelChange={actions.setHlsLevel}
                    showHeatmap={state.showHeatmap}
                    onShowHeatmapChange={actions.setShowHeatmap}
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
                    ambientModeEnabled={state.ambientModeEnabled}
                    onAmbientModeEnabledChange={actions.setAmbientModeEnabled}
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
