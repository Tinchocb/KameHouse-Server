import React from "react"
import { cn } from "@/components/ui/core/styling"
import { PlayerTopBar } from "./player-topbar"
import { PlayerBottomBar } from "./player-bottombar"
import { LoadingErrorOverlay, CenterPlayFlash, SkipIntroOverlay, NextEpisodeOverlay } from "./player-overlays"
import type { EpisodeSource } from "@/api/types/unified.types"

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
                    onToggleSettings={() => actions.setIsSettingsOpen((v: boolean) => !v)}
                />
            </div>
        </div>
    )
}
