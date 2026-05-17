/* eslint-disable react-hooks/refs */
import React, { useEffect, useRef } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { cn } from "@/components/ui/core/styling"
import { PlayerTopBar } from "./player-topbar"
import { PlayerBottomBar } from "./player-bottombar"
import { LoadingErrorOverlay, CenterPlayFlash, SkipIntroOverlay, NextEpisodeOverlay, ResumeOverlay } from "./player-overlays"
import type { EpisodeSource } from "@/api/types/unified.types"
import { useGetVideoInsights } from "@/api/hooks/videocore.hooks"
import { useAniSkipTimes } from "@/api/hooks/aniskip.hooks"
import type { PlayerCore, PlayerStats } from "./player-core"

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
}

export function PlayerUI(props: PlayerUIProps) {
    const {
        title, episodeLabel, onClose, onNextEpisode, playableUrl,
        streamType, episodeSources, onSourceSwitch, core,
        mediaId, episodeNumber, malId
    } = props

    const {
        domElements,
        state,
        actions
    } = core

    const ambilightCanvasRef = useRef<HTMLCanvasElement>(null)

    // Fetch video insights (heatmap)
    const { data: insightsData } = useGetVideoInsights({
        episodeId: (mediaId && episodeNumber) ? Number(`${mediaId}${episodeNumber}`) : 0
    }, !!(mediaId && episodeNumber && state.duration > 0))

    const insights = insightsData || []

    // Cinematic Controls Animation Layer
    useGSAP(() => {
        if (state.controlsVisible) {
            gsap.to(".player-top-bar", { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" })
            gsap.to(".player-bottom-bar", { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" })
            gsap.to(".player-overlays-bg", { opacity: 1, duration: 0.4 })
        } else {
            gsap.to(".player-top-bar", { y: -20, opacity: 0, duration: 0.4, ease: "power3.in" })
            gsap.to(".player-bottom-bar", { y: 20, opacity: 0, duration: 0.4, ease: "power3.in" })
            gsap.to(".player-overlays-bg", { opacity: 0, duration: 0.6 })
        }
    }, { dependencies: [state.controlsVisible], scope: domElements.containerElement })

    useEffect(() => {
        if (!state.ambilightEnabled || !state.isPlaying) return

        let animId: number
        const video = domElements.videoElement.current
        const canvas = ambilightCanvasRef.current

        const renderAmbilight = () => {
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
            animId = requestAnimationFrame(renderAmbilight)
        }

        animId = requestAnimationFrame(renderAmbilight)
        return () => cancelAnimationFrame(animId)
    }, [state.ambilightEnabled, state.isPlaying, domElements.videoElement])

    return (
        <div
            ref={domElements.containerElement as any}
            onMouseMove={actions.triggerControlsVisibility}
            onMouseLeave={() => actions.setControlsVisible(false)}
            className={cn(
                "fixed inset-0 z-[10000] w-screen h-screen bg-black flex flex-col items-center justify-center overflow-hidden font-sans",
                !state.controlsVisible && state.isPlaying ? "cursor-none" : "cursor-default"
            )}
        >

            <canvas
                ref={ambilightCanvasRef}
                className={cn(
                    "absolute inset-0 w-full h-full scale-110 blur-3xl opacity-75 z-0 pointer-events-none transition-all duration-700",
                    state.ambilightEnabled && state.isPlaying ? "opacity-75" : "opacity-0"
                )}
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
                    if (state.marathonMode && onNextEpisode) {
                        onNextEpisode()
                    }
                }}
                className="w-full h-full bg-black relative z-10"
                style={{
                    objectFit: state.aspectRatio === "16/9" ? "contain" : 
                               state.aspectRatio === "fill" ? "fill" : 
                               state.aspectRatio === "cover" ? "cover" : "contain"
                }}
                crossOrigin="anonymous"
                playsInline
                preload="auto"
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

            <CenterPlayFlash flash={state.flash} />

            <StatsOverlay show={state.showStats} data={state.statsData!} />

            <SkipIntroOverlay
                show={state.showSkipIntro}
                onSkip={actions.handleSkipIntro}
                skipLabel={state.skipLabel}
                remainingSeconds={state.skipRemainingSeconds}
                shortcutKey="S"
            />

            <NextEpisodeOverlay
                show={state.showNextEpisode}
                marathonMode={state.marathonMode}
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
                />
            </div>

            <div
                className={cn(
                    "player-bottom-bar absolute bottom-0 inset-x-0 z-30 pointer-events-none opacity-0 translate-y-4"
                )}
            >
                <PlayerBottomBar
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
                    marathonMode={state.marathonMode}
                    onMarathonModeChange={actions.setMarathonMode}
                    onNextEpisode={onNextEpisode}
                />
            </div>
        </div>
    )
}
