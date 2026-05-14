import React from "react"
import { cn } from "@/components/ui/core/styling"
import { PlayerTopBar } from "./player-topbar"
import { PlayerBottomBar } from "./player-bottombar"
import { LoadingErrorOverlay, CenterPlayFlash, SkipIntroOverlay, NextEpisodeOverlay, ResumeOverlay } from "./player-overlays"
import type { EpisodeSource } from "@/api/types/unified.types"

function StatsOverlay({ show, data }: { show: boolean, data: any }) {
    if (!show || !data) return null
    return (
        <div className="absolute top-20 left-10 z-50 bg-black/95 backdrop-blur-xl p-6 rounded-none border border-white/20 text-[10px] font-mono uppercase tracking-widest text-zinc-400 space-y-2 pointer-events-none shadow-2xl">
            <h4 className="text-white font-bold border-b border-white/10 pb-2 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-brand-orange animate-pulse" />
                STATS FOR NERDS
            </h4>
            <div className="flex justify-between gap-16"><span>Current Time:</span> <span className="text-white">{data.currentTime} / {data.duration}</span></div>
            <div className="flex justify-between gap-16"><span>Buffer Health:</span> <span className="text-white">{data.buffer}s</span></div>
            <div className="flex justify-between gap-16"><span>Resolution:</span> <span className="text-white">{data.resolution}</span></div>
            <div className="flex justify-between gap-16"><span>Playback Rate:</span> <span className="text-white">{data.playbackRate}x</span></div>
            <div className="flex justify-between gap-16"><span>Volume Level:</span> <span className="text-white">{data.volume}%</span></div>
            <div className="pt-2 opacity-40 max-w-[240px] truncate font-sans lowercase tracking-normal italic border-t border-white/5 mt-2">
                {data.source}
            </div>
        </div>
    )
}

export function PlayerUI({
    title,
    episodeLabel,
    onClose,
    onNextEpisode,
    playableUrl,
    streamType,
    episodeSources,
    core,
}: any) {
    const { refs, state, actions } = core

    return (
        <div
            ref={refs.containerRef}
            onMouseMove={actions.triggerControlsVisibility}
            onMouseLeave={() => actions.setControlsVisible(false)}
            className={cn(
                "fixed inset-0 z-[10000] w-screen h-screen bg-black flex flex-col items-center justify-center overflow-hidden font-sans",
                !state.controlsVisible && state.isPlaying ? "cursor-none" : "cursor-default"
            )}
        >
            <video
                ref={refs.videoRef}
                onClick={actions.togglePlay}
                onPlay={() => actions.setIsPlaying(true)}
                onPause={() => actions.setIsPlaying(false)}
                onDurationChange={() => actions.setDuration(refs.videoRef.current?.duration || 0)}
                onTimeUpdate={actions.handleTimeUpdate}
                onWaiting={() => actions.setIsBuffering(true)}
                onPlaying={() => actions.setIsBuffering(false)}
                className={cn(
                    "w-full h-full object-contain bg-black z-0",
                    state.isJassubActive ? "opacity-100" : ""
                )}
                playsInline
            />

            <canvas
                ref={refs.canvasRef}
                className={cn(
                    "absolute inset-0 w-full h-full pointer-events-none z-[1]",
                    state.isJassubActive ? "block" : "hidden"
                )}
            />

            <div
                className={cn(
                    "absolute inset-0 pointer-events-none transition-opacity duration-300 z-10",
                    state.controlsVisible ? "opacity-100" : "opacity-0"
                )}
            >
                <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-black/80 to-transparent" />
                <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            </div>

            <LoadingErrorOverlay
                status={state.status}
                errorMsg={state.errorMsg}
                streamType={streamType || "local"}
                isBuffering={state.isBuffering}
                onClose={onClose}
            />

            <CenterPlayFlash flash={state.flash} />

            <StatsOverlay show={state.showStats} data={state.statsData} />

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
                nextEpisodeNumber={undefined} // Since we removed episodeNumber prop from PlayerUI directly for simplicity, but could be passed if needed
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
                    "absolute top-0 inset-x-0 z-20 pointer-events-none transition-all duration-300",
                    state.controlsVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
                )}
            >
                <PlayerTopBar
                    title={title}
                    episodeLabel={episodeLabel}
                    onClose={onClose}
                />
            </div>

            <div
                className={cn(
                    "absolute bottom-0 inset-x-0 z-20 pointer-events-none transition-all duration-300",
                    state.controlsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                )}
            >
                <PlayerBottomBar
                    duration={state.duration}
                    insights={[]}
                    progressBarRef={refs.progressBarRef}
                    progressInputRef={refs.progressInputRef}
                    handleSeek={actions.handleSeek}
                    isPlaying={state.isPlaying}
                    togglePlay={actions.togglePlay}
                    skipTime={actions.skipTime}
                    isMuted={state.isMuted}
                    toggleMute={actions.toggleMute}
                    volume={state.volume}
                    handleVolume={actions.handleVolume}
                    timeTextRef={refs.timeTextRef}
                    audioTracks={state.audioTracks}
                    activeAudioIndex={state.activeAudioIndex}
                    onSelectAudio={actions.onSelectAudio}
                    subtitleTracks={state.subtitleTracks}
                    activeSubtitleIndex={state.activeSubtitleIndex}
                    onSelectSubtitle={actions.onSelectSubtitle}
                    isJassubLoading={state.isJassubLoading}
                    episodeSources={episodeSources}
                    activeStreamUrl={playableUrl}
                    handleSourceSwitch={() => {}}
                    isFullscreen={state.isFullscreen}
                    toggleFullscreen={actions.toggleFullscreen}
                    settingsOpen={state.isSettingsOpen}
                    onToggleSettings={(open?: boolean) => actions.setIsSettingsOpen(open !== undefined ? open : (v: boolean) => !v)}
                    
                    onTakeScreenshot={actions.takeScreenshot}
                    onTogglePip={actions.togglePip}
                    playbackRate={state.playbackRate}
                    onPlaybackRateChange={actions.changePlaybackRate}
                    autoSkipIntro={state.autoSkipIntro}
                    onAutoSkipIntroChange={actions.setAutoSkipIntro}
                    onNextEpisode={onNextEpisode || (() => {})}
                />
            </div>
        </div>
    )
}
