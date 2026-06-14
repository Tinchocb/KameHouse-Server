/* eslint-disable react-hooks/refs */
import React, { useEffect, useRef } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { toast } from "sonner"
import { PlayerTopBar } from "./player-topbar"
import { PlayerBottomBar } from "./player-bottombar"
import { LoadingErrorOverlay, CenterPlayFlash, SkipIntroOverlay, NextEpisodeOverlay, ResumeOverlay } from "./player-overlays"
import type { EpisodeSource } from "@/api/types/unified.types"
import { useGetVideoInsights } from "@/api/hooks/videocore.hooks"
import { useAniSkipTimes } from "@/api/hooks/aniskip.hooks"
import type { PlayerCore, PlayerStats } from "./player-core"
import { useAppStore } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import { DeferredImage } from "@/components/shared/deferred-image"
import { PlayerEpisodesSidebar } from "./player-episodes-sidebar"
import { PlayerQueueSidebar } from "./player-queue-sidebar"
import { PlayerCastModal } from "./player-cast-modal"

function StatsOverlay({ show, data }: { show: boolean, data: PlayerStats }) {
    if (!show || !data) return null
    return (
        <div className="absolute top-24 left-10 z-[100] bg-zinc-950/80 backdrop-blur-2xl p-6 rounded-2xl border border-white/10 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500 space-y-3 pointer-events-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] min-w-[320px]">
            <h4 className="text-white font-black border-b border-white/5 pb-3 mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-orange animate-pulse" />
                    DEEP INSIGHTS
                </span>
                <span className="text-[9px] opacity-40 font-mono tracking-tighter">V2.4.0</span>
            </h4>
            <div className="space-y-2">
                <div className="flex justify-between items-center"><span className="opacity-50">Timeline</span> <span className="text-white font-bold">{data.currentTime} <span className="text-zinc-700">/</span> {data.duration}</span></div>
                <div className="flex justify-between items-center"><span className="opacity-50">Buffer Status</span> <span className="text-green-500 font-bold">{data.buffer}s</span></div>
                <div className="flex justify-between items-center"><span className="opacity-50">Output</span> <span className="text-white font-bold">{data.resolution}</span></div>
                <div className="flex justify-between items-center"><span className="opacity-50">Rate</span> <span className="text-white font-bold">{data.playbackRate}x</span></div>
                <div className="flex justify-between items-center"><span className="opacity-50">Volume</span> <span className="text-white font-bold">{data.volume}%</span></div>
            </div>
            <div className="pt-3 opacity-20 max-w-full truncate font-sans lowercase tracking-normal italic border-t border-white/5 mt-4 text-[9px]">
                {data.source}
            </div>
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
    clientId: string
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
}

export function PlayerUI(props: PlayerUIProps) {
    const {
        title, episodeLabel, onClose, onNextEpisode, playableUrl,
        streamType, episodeSources, onSourceSwitch, core,
        mediaId, episodeNumber, malId,
        episodes, onSelectEpisode, mediaFormat
    } = props

    const {
        domElements,
        state,
        actions
    } = core

    const ambilightCanvasRef = useRef<HTMLCanvasElement>(null)

    const [isEpisodesSidebarOpen, setIsEpisodesSidebarOpen] = React.useState(false)
    const [isCastModalOpen, setIsCastModalOpen] = React.useState(false)
    const [isQueueSidebarOpen, setIsQueueSidebarOpen] = React.useState(false)

    const { playlistQueue, currentQueueIndex } = useAppStore(useShallow(state => ({
        playlistQueue: state.playlistQueue,
        currentQueueIndex: state.currentQueueIndex
    })))

    const controlsVisible = state.controlsVisible || isEpisodesSidebarOpen || isCastModalOpen || isQueueSidebarOpen

    // Force controls visibility if sidebar or cast modal is open
    useEffect(() => {
        if (isEpisodesSidebarOpen || isCastModalOpen || isQueueSidebarOpen) {
            actions.setControlsVisible(true)
        }
    }, [isEpisodesSidebarOpen, isCastModalOpen, isQueueSidebarOpen, actions])

    // Fetch video insights (heatmap)
    const { data: insightsData } = useGetVideoInsights({
        episodeId: (mediaId && episodeNumber) ? `${mediaId}${episodeNumber}` : ""
    }, !!(mediaId && episodeNumber && state.duration > 0))

    const insights = insightsData || []

    // Cinematic Controls Animation Layer
    useGSAP(() => {
        if (controlsVisible) {
            gsap.to(".player-top-bar", { y: 0, scale: 1, opacity: 1, duration: 0.55, ease: "power4.out" })
            gsap.to(".player-bottom-bar", { y: 0, scale: 1, opacity: 1, duration: 0.55, ease: "power4.out" })
            gsap.to(".player-overlays-bg", { opacity: 1, duration: 0.45 })
        } else {
            gsap.to(".player-top-bar", { y: -15, scale: 0.97, opacity: 0, duration: 0.35, ease: "power2.inOut" })
            gsap.to(".player-bottom-bar", { y: 15, scale: 0.97, opacity: 0, duration: 0.35, ease: "power2.inOut" })
            gsap.to(".player-overlays-bg", { opacity: 0, duration: 0.5 })
        }
    }, { dependencies: [controlsVisible], scope: domElements.containerElement })

    useEffect(() => {
        if (!state.ambilightEnabled || !state.isPlaying) return

        let handle: number
        const video = domElements.videoElement.current as any
        const canvas = ambilightCanvasRef.current

        const drawFrame = () => {
            if (video && canvas && !video.paused) {
                const ctx = canvas.getContext("2d")
                if (ctx) {
                    if (canvas.width !== 32) {
                        canvas.width = 32
                        canvas.height = 18
                    }
                    ctx.drawImage(video, 0, 0, 32, 18)
                }
            }
        }

        if (video && "requestVideoFrameCallback" in video) {
            const updateCallback = () => {
                drawFrame()
                handle = video.requestVideoFrameCallback(updateCallback)
            }
            handle = video.requestVideoFrameCallback(updateCallback)
            return () => {
                if (video && "cancelVideoFrameCallback" in video) {
                    video.cancelVideoFrameCallback(handle)
                }
            }
        } else {
            let lastDrawTime = 0
            const renderLoop = () => {
                const now = Date.now()
                if (video && !video.paused && (now - lastDrawTime >= 60)) {
                    drawFrame()
                    lastDrawTime = now
                }
                handle = requestAnimationFrame(renderLoop)
            }
            handle = requestAnimationFrame(renderLoop)
            return () => cancelAnimationFrame(handle)
        }
    }, [state.ambilightEnabled, state.isPlaying, domElements.videoElement])

    return (
        <div
            ref={domElements.containerElement as any}
            onMouseMove={actions.triggerControlsVisibility}
            onMouseLeave={() => actions.setControlsVisible(false)}
            className={cn(
                "fixed inset-0 z-[10000] w-screen h-screen bg-black flex flex-col items-center justify-center overflow-hidden font-sans",
                !controlsVisible && state.isPlaying ? "cursor-none" : "cursor-default"
            )}
            style={{
                viewTransitionName: "video-player"
            } as React.CSSProperties}
        >

            <canvas
                ref={ambilightCanvasRef}
                className={cn(
                    "absolute inset-0 w-full h-full scale-110 blur-3xl opacity-75 z-0 pointer-events-none transition-all duration-700",
                    state.ambilightEnabled && state.isPlaying ? "opacity-75" : "opacity-0"
                )}
                style={{ willChange: "transform, opacity" }}
            />

            <video
                ref={domElements.videoElement as any}
                onClick={actions.togglePlay}
                onPlay={() => actions.setIsPlaying(true)}
                onPause={() => actions.setIsPlaying(false)}
                onDurationChange={(e) => actions.setDuration(e.currentTarget.duration)}
                onTimeUpdate={actions.handleTimeUpdate}
                onWaiting={() => actions.setIsBuffering(true)}
                onPlaying={() => actions.setIsBuffering(false)}
                onEnded={() => {
                    actions.handleTimeUpdate()
                }}
                className="w-full h-full bg-black relative z-10"
                style={{
                    objectFit: state.aspectRatio === "16/9" ? "contain" : 
                               state.aspectRatio === "fill" ? "fill" : 
                               state.aspectRatio === "cover" ? "cover" : "contain"
                }}
                crossOrigin="anonymous"
                playsInline
                preload="metadata"
            />

            <canvas
                ref={domElements.canvasElement as any}
                className={cn(
                    "absolute inset-0 w-full h-full pointer-events-none z-[11]",
                    state.isJassubActive ? "block" : "hidden"
                )}
            />

            <div
                className={cn(
                    "player-overlays-bg absolute inset-0 pointer-events-none transition-opacity duration-300 z-20 opacity-0"
                )}
            >
                <div className="absolute inset-0 z-50 pointer-events-none player-overlays-bg bg-gradient-to-t from-black/80 via-transparent to-black/60" />

                {/* Resume Overlay */}
                <div className="absolute bottom-0 inset-x-0 h-64 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
            </div>

            <LoadingErrorOverlay
                status={state.status}
                errorMsg={state.errorMsg}
                streamType={streamType || "local"}
                isBuffering={state.isBuffering}
                onClose={onClose}
            />

            {/* Auto-Skip Toast */}
            {state.showAutoSkipToast && (
                <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none">
                    <div className="bg-[#0f0f11]/55 backdrop-blur-[64px] border border-white/[0.08] px-6 py-3 shadow-2xl flex items-center gap-3">
                        <svg className="w-4 h-4 text-white animate-pulse" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z"/>
                        </svg>
                        <span className="text-[10px] font-black tracking-[0.25em] text-white uppercase">
                            {state.showAutoSkipToast === "intro" 
                                ? "AUTO-SALTANDO INTRO" 
                                : state.showAutoSkipToast === "outro" 
                                ? "AUTO-SALTANDO ENDING" 
                                : "AUTO-SALTANDO PAUSA/INTERMEDIO"}
                        </span>
                    </div>
                </div>
            )}

            <CenterPlayFlash flash={state.flash} />

            <StatsOverlay show={state.showStats} data={state.statsData!} />

            <SkipIntroOverlay
                show={state.skipMode !== null}
                onSkip={actions.handleSkipIntro}
                skipMode={state.skipMode ?? "intro"}
                remainingSeconds={state.skipRemainingSeconds}
                segmentProgress={state.segmentProgress}
                shortcutKey="S"
            />

            <NextEpisodeOverlay
                show={state.showNextEpisode}
                tvMode={state.tvMode}
                showCountdown={state.showCountdown}
                countdownSeconds={state.countdownSeconds}
                nextEpisodeTitle="Siguiente Episodio"
                nextEpisodeNumber={undefined}
                onNext={onNextEpisode || (() => {})}
                duration={state.duration}
                remainingProgress={state.remainingProgress}
            />

            <ResumeOverlay
                show={state.showResume}
                time={state.resumeTime}
                onResume={actions.handleResume}
                onClose={() => actions.setShowResume(false)}
            />

            <div
                className={cn(
                    "player-top-bar absolute top-0 inset-x-0 z-30 pointer-events-none opacity-0 -translate-y-4"
                )}
            >
                <PlayerTopBar
                    title={title}
                    episodeLabel={episodeLabel}
                    episodeNumber={episodeNumber}
                    onClose={onClose}
                    mediaFormat={mediaFormat}
                />
            </div>

            <div
                className={cn(
                    "player-bottom-bar absolute bottom-0 inset-x-0 z-30 pointer-events-none opacity-0 translate-y-4"
                )}
            >
                <PlayerBottomBar
                    title={title}
                    episodeNumber={episodeNumber}
                    episodeLabel={episodeLabel}
                    mediaFormat={mediaFormat}
                    duration={state.duration}
                    insights={insights}
                    progressBarRef={domElements.progressBarElement as any}
                    progressInputRef={domElements.progressInputElement as any}
                    handleSeek={actions.handleSeek as any}
                    isPlaying={state.isPlaying}
                    togglePlay={actions.togglePlay}
                    skipTime={actions.skipTime}
                    isMuted={state.isMuted}
                    toggleMute={actions.toggleMute}
                    volume={state.volume}
                    handleVolume={actions.handleVolume as any}
                    timeTextRef={domElements.timeTextElement as any}
                    audioTracks={state.audioTracks}
                    activeAudioIndex={state.activeAudioIndex}
                    onSelectAudio={actions.onSelectAudio}
                    subtitleTracks={state.subtitleTracks}
                    activeSubtitleIndex={state.activeSubtitleIndex}
                    onSelectSubtitle={actions.onSelectSubtitle}
                    isJassubLoading={state.isJassubLoading}
                    episodeSources={episodeSources || []}
                    activeStreamUrl={playableUrl}
                    handleSourceSwitch={onSourceSwitch || (() => {})}
                    isFullscreen={state.isFullscreen}
                    toggleFullscreen={actions.toggleFullscreen}
                    settingsOpen={state.isSettingsOpen}
                    onToggleSettings={(open?: boolean) => actions.setIsSettingsOpen(open !== undefined ? open : !state.isSettingsOpen)}
                    onTakeScreenshot={actions.takeScreenshot}
                    onTogglePip={actions.togglePip}
                    playbackRate={state.playbackRate}
                    onPlaybackRateChange={actions.changePlaybackRate}
                    autoSkipIntro={state.autoSkipIntro}
                    onAutoSkipIntroChange={actions.setAutoSkipIntro}
                    autoSkipOutro={state.autoSkipOutro}
                    onAutoSkipOutroChange={actions.setAutoSkipOutro}
                    hlsLevels={state.hlsLevels}
                    activeHlsLevel={state.activeHlsLevel}
                    onHlsLevelChange={actions.setHlsLevel}
                    showHeatmap={state.showHeatmap}
                    onShowHeatmapChange={actions.setShowHeatmap}
                    aspectRatio={state.aspectRatio}
                    onAspectRatioChange={actions.setAspectRatio}
                    subtitleSize={state.subtitleSize}
                    onSubtitleSizeChange={actions.setSubtitleSize}
                    loopEnabled={state.loopEnabled}
                    onLoopEnabledChange={actions.setLoopEnabled}
                    autoDisableSubtitlesWhenDubbed={state.autoDisableSubtitlesWhenDubbed}
                    onAutoDisableSubtitlesWhenDubbedChange={actions.setAutoDisableSubtitlesWhenDubbed}
                    ambilightEnabled={state.ambilightEnabled}
                    onAmbilightChange={actions.setAmbilightEnabled}
                    tvMode={state.tvMode}
                    onTvModeChange={actions.setTvMode}
                    marathonMode={state.marathonMode}
                    onMarathonModeChange={actions.setMarathonMode}
                    onNextEpisode={onNextEpisode}
                    skipTimesOp={state.skipTimesOp}
                    skipTimesEd={state.skipTimesEd}
                    chapters={state.chapters}
                    skipToNextChapter={actions.skipToNextChapter}
                    skipToPrevChapter={actions.skipToPrevChapter}
                    activeChapter={state.activeChapter}
                    isCastSupported={state.isCastSupported}
                    castState={state.castState}
                    onPromptCast={() => setIsCastModalOpen(true)}
                    isEpisodesSidebarOpen={isEpisodesSidebarOpen}
                    onToggleEpisodesSidebar={() => setIsEpisodesSidebarOpen(!isEpisodesSidebarOpen)}
                    hasEpisodes={Boolean(episodes && episodes.length > 0)}
                    isQueueSidebarOpen={isQueueSidebarOpen}
                    onToggleQueueSidebar={() => setIsQueueSidebarOpen(!isQueueSidebarOpen)}
                    hasQueue={playlistQueue.length > 0}
                />
            </div>

            {/* Episodes Sidebar */}
            <PlayerEpisodesSidebar
                isOpen={isEpisodesSidebarOpen}
                onClose={() => setIsEpisodesSidebarOpen(false)}
                episodes={episodes || []}
                currentEpisodeNumber={episodeNumber}
                onSelectEpisode={onSelectEpisode}
            />

            {/* Queue Sidebar */}
            <PlayerQueueSidebar
                isOpen={isQueueSidebarOpen}
                onClose={() => setIsQueueSidebarOpen(false)}
                playlistQueue={playlistQueue}
                currentQueueIndex={currentQueueIndex}
            />

            {/* Casting Modal */}
            <PlayerCastModal
                isOpen={isCastModalOpen}
                onClose={() => setIsCastModalOpen(false)}
                playableUrl={playableUrl}
                title={title}
                serverIPs={state.serverIPs}
                serverPort={state.serverPort}
                absoluteLanUrl={state.absoluteLanUrl}
            />
        </div>
    )
}
