/* eslint-disable react-hooks/refs */
import React, { useEffect, useRef } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { Tv, Copy, Check, X, Info, RefreshCw, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { buildSeaQuery } from "@/api/client/requests"
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
    episodes?: {
        title?: string
        episodeNumber: number
        absoluteEpisodeNumber?: number
        thumbnail?: string
        watched?: boolean
    }[]
    onSelectEpisode?: (episodeNumber: number) => void
}

export function PlayerUI(props: PlayerUIProps) {
    const {
        title, episodeLabel, onClose, onNextEpisode, playableUrl,
        streamType, episodeSources, onSourceSwitch, core,
        mediaId, episodeNumber, malId,
        episodes, onSelectEpisode
    } = props

    const {
        domElements,
        state,
        actions
    } = core

    const ambilightCanvasRef = useRef<HTMLCanvasElement>(null)

    const [isEpisodesSidebarOpen, setIsEpisodesSidebarOpen] = React.useState(false)
    const [isCastModalOpen, setIsCastModalOpen] = React.useState(false)
    const [isCopied, setIsCopied] = React.useState(false)
    const [discoveredTvs, setDiscoveredTvs] = React.useState<{ ip: string; name: string }[]>([])
    const [isDiscovering, setIsDiscovering] = React.useState(false)
    const [castingTvIp, setCastingTvIp] = React.useState<string | null>(null)

    const controlsVisible = state.controlsVisible || isEpisodesSidebarOpen || isCastModalOpen

    // Force controls visibility if sidebar or cast modal is open
    useEffect(() => {
        if (isEpisodesSidebarOpen || isCastModalOpen) {
            actions.setControlsVisible(true)
        }
    }, [isEpisodesSidebarOpen, isCastModalOpen, actions])

    const localServerUrl = React.useMemo(() => {
        if (typeof window === "undefined") return "http://localhost:43210"

        const hostname = window.location.hostname
        const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"

        // Si ya se accede desde una IP de red local, usar esa URL directamente.
        // La TV solo necesita abrir la misma URL que ya está funcionando en este navegador.
        if (!isLocalhost) {
            return window.location.origin
        }

        // Fallback: si estamos en localhost, intentar con las IPs del backend
        if (state.serverIPs && state.serverIPs.length > 0) {
            const lanIp = state.serverIPs.find(ip =>
                ip.startsWith("192.168.") ||
                ip.startsWith("10.") ||
                ip.startsWith("172.")
            ) || state.serverIPs[0]
            const port = window.location.port || "43210"
            return `http://${lanIp}:${port}`
        }

        // Último recurso
        return window.location.origin
    }, [state.serverIPs])

    const handleCopyUrl = async () => {
        try {
            await navigator.clipboard.writeText(localServerUrl)
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
        } catch (err) {
            console.error("Failed to copy URL:", err)
        }
    }

    const discoverTvs = React.useCallback(async () => {
        setIsDiscovering(true)
        try {
            const result = await buildSeaQuery<{ ip: string; name: string }[]>({
                endpoint: "/api/v1/cast/samsung/discover",
                method: "GET",
            })
            setDiscoveredTvs(result || [])
        } catch (err) {
            console.error("Error discovering TVs:", err)
            toast.error("Error al buscar Smart TVs en la red")
        } finally {
            setIsDiscovering(false)
        }
    }, [])

    const handleCastToSamsung = async (ip: string, name: string) => {
        setCastingTvIp(ip)
        try {
            const result = await buildSeaQuery<{ success: boolean }, { ip: string; url: string }>({
                endpoint: "/api/v1/cast/samsung/launch",
                method: "POST",
                data: {
                    ip,
                    url: localServerUrl,
                },
            })
            if (result?.success) {
                toast.success(`Transmitiendo a ${name}`)
            } else {
                toast.error(`No se pudo iniciar la transmisión en ${name}`)
            }
        } catch (err: any) {
            console.error("Error casting to Samsung TV:", err)
            toast.error(err?.message || `Error al transmitir a ${name}`)
        } finally {
            setCastingTvIp(null)
        }
    }

    useEffect(() => {
        if (isCastModalOpen) {
            discoverTvs()
        }
    }, [isCastModalOpen, discoverTvs])

    // Fetch video insights (heatmap)
    const { data: insightsData } = useGetVideoInsights({
        episodeId: (mediaId && episodeNumber) ? Number(`${mediaId}${episodeNumber}`) : 0
    }, !!(mediaId && episodeNumber && state.duration > 0))

    const insights = insightsData || []

    // Cinematic Controls Animation Layer
    useGSAP(() => {
        if (controlsVisible) {
            gsap.to(".player-top-bar", { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" })
            gsap.to(".player-bottom-bar", { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" })
            gsap.to(".player-overlays-bg", { opacity: 1, duration: 0.4 })
        } else {
            gsap.to(".player-top-bar", { y: -20, opacity: 0, duration: 0.4, ease: "power3.in" })
            gsap.to(".player-bottom-bar", { y: 20, opacity: 0, duration: 0.4, ease: "power3.in" })
            gsap.to(".player-overlays-bg", { opacity: 0, duration: 0.6 })
        }
    }, { dependencies: [controlsVisible], scope: domElements.containerElement })

    useEffect(() => {
        if (!state.ambilightEnabled || !state.isPlaying) return

        let animId: number
        const video = domElements.videoElement.current
        const canvas = ambilightCanvasRef.current
        let lastDrawTime = 0

        const renderAmbilight = () => {
            const now = Date.now()
            if (video && canvas && !video.paused && (now - lastDrawTime >= 60)) {
                const ctx = canvas.getContext("2d")
                if (ctx) {
                    if (canvas.width !== 32) {
                        canvas.width = 32
                        canvas.height = 18
                    }
                    ctx.drawImage(video, 0, 0, 32, 18)
                }
                lastDrawTime = now
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
                !controlsVisible && state.isPlaying ? "cursor-none" : "cursor-default"
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
                            {state.showAutoSkipToast === "intro" ? "AUTO-SALTANDO INTRO" : "AUTO-SALTANDO ENDING"}
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
                    tvMode={state.tvMode}
                    onTvModeChange={actions.setTvMode}
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
                />
            </div>

            {/* Episodes Sidebar */}
            <AnimatePresence>
                {isEpisodesSidebarOpen && episodes && episodes.length > 0 && (
                    <>
                        {/* Backdrop overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsEpisodesSidebarOpen(false)}
                            className="absolute inset-0 z-[150] bg-black/60 backdrop-blur-sm pointer-events-auto"
                        />

                        {/* Sidebar Panel */}
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            className="absolute right-0 top-0 bottom-0 w-full sm:w-[400px] z-[160] bg-zinc-950/85 backdrop-blur-3xl border-l border-white/10 flex flex-col shadow-2xl pointer-events-auto select-none"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0">
                                <h3 className="text-sm font-black tracking-[0.25em] text-white uppercase flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-brand-orange animate-pulse" />
                                    EPISODIOS
                                </h3>
                                <button
                                    onClick={() => setIsEpisodesSidebarOpen(false)}
                                    className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-full transition-all"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Episodes List */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                                {episodes.map((ep) => {
                                    const epNum = ep.absoluteEpisodeNumber ?? ep.episodeNumber
                                    const isCurrent = epNum === episodeNumber

                                    return (
                                        <button
                                            key={epNum}
                                            onClick={() => {
                                                if (onSelectEpisode) {
                                                    onSelectEpisode(epNum)
                                                }
                                                setIsEpisodesSidebarOpen(false)
                                            }}
                                            className={cn(
                                                "w-full text-left flex gap-4 p-3 rounded-xl border transition-all duration-300 group",
                                                isCurrent
                                                    ? "bg-brand-orange/10 border-brand-orange/30 text-white shadow-[0_0_15px_rgba(255,110,58,0.1)]"
                                                    : "bg-white/[0.02] border-white/5 text-zinc-400 hover:text-white hover:bg-white/[0.04] hover:border-white/10"
                                            )}
                                        >
                                            {/* Thumbnail / Image container */}
                                            <div className="relative w-28 aspect-video bg-zinc-900 border border-white/5 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                                                {ep.thumbnail ? (
                                                    <img
                                                        src={ep.thumbnail}
                                                        alt={ep.title || `Episodio ${epNum}`}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <span className="text-[10px] font-black text-zinc-700">SIN IMAGEN</span>
                                                )}

                                                {/* Dark overlay */}
                                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors duration-300" />

                                                {/* Play overlay for current or hover */}
                                                <div className={cn(
                                                    "absolute inset-0 flex items-center justify-center transition-all duration-300",
                                                    isCurrent ? "opacity-100 bg-brand-orange/10" : "opacity-0 group-hover:opacity-100 bg-black/40"
                                                )}>
                                                    <svg className={cn(
                                                        "w-5 h-5 drop-shadow-md transition-transform duration-300",
                                                        isCurrent ? "text-brand-orange scale-110" : "text-white scale-90 group-hover:scale-100"
                                                    )} fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M8 5v14l11-7z" />
                                                    </svg>
                                                </div>
                                            </div>

                                            {/* Meta content */}
                                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={cn(
                                                        "text-[9px] font-black tracking-widest",
                                                        isCurrent ? "text-brand-orange" : "text-zinc-500"
                                                    )}>
                                                        EPISODIO {epNum}
                                                    </span>

                                                    {ep.watched && (
                                                        <span className="flex items-center justify-center w-3 h-3 rounded-full bg-green-500/20 text-green-500 border border-green-500/30">
                                                            <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        </span>
                                                    )}
                                                </div>
                                                <h4 className={cn(
                                                    "text-[11px] font-black uppercase tracking-wider truncate leading-tight transition-colors",
                                                    isCurrent ? "text-white" : "text-zinc-300 group-hover:text-white"
                                                )}>
                                                    {ep.title || `Episodio ${epNum}`}
                                                </h4>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Casting Modal */}
            <AnimatePresence>
                {isCastModalOpen && (
                    <>
                        {/* Backdrop overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsCastModalOpen(false)}
                            className="absolute inset-0 z-[200] bg-black/80 backdrop-blur-md pointer-events-auto"
                        />

                        {/* Modal container */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: "spring", duration: 0.5 }}
                            className="absolute inset-0 m-auto w-full max-w-lg h-fit max-h-[90vh] overflow-y-auto z-[210] bg-zinc-900/95 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] pointer-events-auto select-none flex flex-col gap-6 text-left"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-white/5 pb-4 shrink-0">
                                <h3 className="text-sm font-black tracking-[0.25em] text-white uppercase flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-brand-orange animate-pulse" />
                                    TRANSMITIR A PANTALLA
                                </h3>
                                <button
                                    onClick={() => setIsCastModalOpen(false)}
                                    className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-full transition-all"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Content options */}
                            <div className="space-y-5">
                                {/* Option 1: Native casting */}
                                <div 
                                    onClick={() => {
                                        actions.promptCast();
                                        setIsCastModalOpen(false);
                                    }}
                                    className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-brand-orange/30 hover:bg-brand-orange/[0.02] transition-all duration-300 group cursor-pointer flex gap-4 items-start"
                                >
                                    <div className="p-3 bg-zinc-800/80 rounded-xl text-zinc-400 group-hover:text-brand-orange group-hover:bg-brand-orange/10 transition-all shrink-0">
                                        <svg
                                            viewBox="0 0 24 24"
                                            width="20"
                                            height="20"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                            fill="none"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
                                            <path d="M2 12a9 9 0 0 1 8 8" />
                                            <path d="M2 16a5 5 0 0 1 4 4" />
                                            <line x1="2" x2="2.01" y1="20" y2="20" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-xs font-bold text-white tracking-wider uppercase mb-1 flex items-center gap-2">
                                            Transmisión Directa
                                        </h4>
                                        <p className="text-[10px] text-zinc-400 leading-relaxed font-sans normal-case tracking-normal">
                                            Utiliza la transmisión nativa del navegador (Google Cast / AirPlay). Recomendado si tienes un Chromecast o Apple TV conectado en tu misma red.
                                        </p>
                                    </div>
                                </div>

                                {/* Option 2: Automatic Samsung TV Casting */}
                                <div className="p-5 rounded-2xl bg-brand-orange/[0.02] border border-brand-orange/20 transition-all duration-300 flex flex-col gap-4">
                                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                        <div className="flex gap-3 items-center">
                                            <Tv className="w-4 h-4 text-brand-orange" />
                                            <h4 className="text-xs font-bold text-white tracking-wider uppercase">
                                                Samsung Smart TV
                                            </h4>
                                        </div>
                                        <button
                                            onClick={() => discoverTvs()}
                                            disabled={isDiscovering}
                                            className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-all disabled:opacity-50 cursor-pointer"
                                            title="Buscar de nuevo"
                                        >
                                            <RefreshCw className={cn("w-3.5 h-3.5", isDiscovering && "animate-spin text-brand-orange")} />
                                        </button>
                                    </div>

                                    {isDiscovering ? (
                                        <div className="py-6 flex flex-col items-center justify-center gap-3">
                                            <Loader2 className="w-6 h-6 text-brand-orange animate-spin" />
                                            <p className="text-[10px] text-zinc-400 font-sans tracking-normal normal-case">
                                                Buscando Smart TVs en la red local...
                                            </p>
                                        </div>
                                    ) : discoveredTvs.length > 0 ? (
                                        <div className="space-y-2">
                                            {discoveredTvs.map((tv) => (
                                                <div
                                                    key={tv.ip}
                                                    onClick={() => castingTvIp === null && handleCastToSamsung(tv.ip, tv.name)}
                                                    className={cn(
                                                        "p-3.5 rounded-xl border transition-all duration-300 flex justify-between items-center group cursor-pointer",
                                                        castingTvIp === tv.ip
                                                            ? "bg-brand-orange/10 border-brand-orange/40 text-brand-orange"
                                                            : "bg-zinc-950/40 border-white/5 hover:border-brand-orange/30 hover:bg-brand-orange/[0.02] text-white"
                                                    )}
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold tracking-wide">{tv.name}</span>
                                                        <span className="text-[9px] text-zinc-500 font-mono tracking-tight">{tv.ip}</span>
                                                    </div>
                                                    {castingTvIp === tv.ip ? (
                                                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-brand-orange">
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            Transmitiendo...
                                                        </div>
                                                    ) : (
                                                        <div className="px-2.5 py-1 bg-zinc-900 border border-white/10 group-hover:border-brand-orange/30 group-hover:bg-brand-orange/10 text-zinc-400 group-hover:text-brand-orange rounded-md transition-all text-[9px] font-black uppercase tracking-wider">
                                                            Transmitir
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-[10px] text-zinc-500 leading-relaxed font-sans normal-case tracking-normal">
                                            No se detectaron Smart TVs Samsung automáticamente. Asegúrate de que estén encendidos y conectados a la misma red Wi-Fi.
                                        </p>
                                    )}
                                </div>

                                {/* Option 3: Manual Connection Fallback */}
                                <div className="p-5 rounded-2xl bg-white/[0.01] border border-white/5 transition-all duration-300 flex flex-col gap-4">
                                    <div className="flex gap-4 items-start">
                                        <div className="p-3 bg-zinc-800/80 rounded-xl text-zinc-400 shrink-0">
                                            <Tv className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-xs font-bold text-white tracking-wider uppercase mb-1">
                                                Conexión Manual (Otras TVs / Fallback)
                                            </h4>
                                            <p className="text-[10px] text-zinc-400 leading-relaxed font-sans normal-case tracking-normal">
                                                Si tienes otra marca (LG webOS, Sony, etc.) o falla el descubrimiento, abre el navegador de tu TV e introduce:
                                            </p>
                                        </div>
                                    </div>

                                    {/* URL Display and copy — protocolo destacado */}
                                    <div className="flex items-center gap-2 bg-zinc-950/80 border border-white/5 rounded-xl p-3 shrink-0">
                                        <code className="flex-1 font-mono text-[11px] break-all select-all font-bold tracking-tight px-1 flex items-center flex-wrap gap-0">
                                            <span className="text-amber-400 shrink-0">{localServerUrl.split("://")[0]}://</span>
                                            <span className="text-white">{localServerUrl.split("://")[1]}</span>
                                        </code>
                                        <button
                                            onClick={handleCopyUrl}
                                            className="px-3 py-2 bg-zinc-900 border border-white/10 hover:border-brand-orange/30 hover:bg-brand-orange/10 text-zinc-400 hover:text-brand-orange rounded-lg transition-all text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shrink-0"
                                        >
                                            {isCopied ? (
                                                <>
                                                    <Check className="w-3.5 h-3.5" />
                                                    Copiado
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-3.5 h-3.5" />
                                                    Copiar
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Advertencia HTTPS */}
                                    <div className="flex gap-2.5 items-start bg-amber-500/10 border border-amber-500/25 rounded-xl px-3.5 py-3">
                                        <svg className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                                        </svg>
                                        <p className="text-[9px] text-amber-300/80 leading-relaxed font-sans normal-case tracking-normal">
                                            <strong className="text-amber-300">¡Importante!</strong> Las TVs de Samsung pueden forzar <code className="text-red-400 font-mono">https://</code>. Asegúrate de usar <code className="text-amber-300 font-mono">http://</code> (sin la «s»).
                                        </p>
                                    </div>

                                    {/* Quick Guide */}
                                    <div className="pt-2 border-t border-white/5 flex gap-2.5 items-start">
                                        <Info className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                                        <div className="space-y-1 text-[9px] text-zinc-500 leading-relaxed font-sans normal-case tracking-normal">
                                            <p>1. Asegúrate de que el televisor esté conectado al mismo Wi-Fi que este ordenador.</p>
                                            <p>2. Abre el navegador de tu Smart TV, borra la barra de direcciones y escribe la URL de arriba empezando siempre por <span className="text-amber-400 font-mono font-bold">http://</span></p>
                                            <p>3. ¡Listo! Podrás explorar y reproducir todo tu catálogo directamente en pantalla grande.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
