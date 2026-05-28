/* eslint-disable react-hooks/refs */
import React, { useEffect, useRef } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { Tv, X, RefreshCw, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { buildSeaQuery } from "@/api/client/requests"
import { PlayerTopBar } from "./player-topbar"
import { PlayerBottomBar } from "./player-bottombar"
import { LoadingErrorOverlay, CenterPlayFlash, SkipIntroOverlay, NextEpisodeOverlay, ResumeOverlay } from "./player-overlays"
import type { EpisodeSource } from "@/api/types/unified.types"
import { useGetVideoInsights } from "@/api/hooks/videocore.hooks"
import { useAniSkipTimes } from "@/api/hooks/aniskip.hooks"
import type { PlayerCore, PlayerStats } from "./player-core"
import { useAppStore } from "@/lib/store"
import { DeferredImage } from "@/components/shared/deferred-image"

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
    const [isQueueSidebarOpen, setIsQueueSidebarOpen] = React.useState(false)
    const [discoveredTvs, setDiscoveredTvs] = React.useState<{ ip: string; name: string }[]>([])
    const [pairedTvs, setPairedTvs] = React.useState<{ ip: string; name: string; wifi_mac?: string; ethernet_mac?: string }[]>([])
    const [isDiscovering, setIsDiscovering] = React.useState(false)
    const [castingTvIp, setCastingTvIp] = React.useState<string | null>(null)

    const playlistQueue = useAppStore(state => state.playlistQueue)
    const currentQueueIndex = useAppStore(state => state.currentQueueIndex)

    const controlsVisible = state.controlsVisible || isEpisodesSidebarOpen || isCastModalOpen || isQueueSidebarOpen

    // Force controls visibility if sidebar or cast modal is open
    useEffect(() => {
        if (isEpisodesSidebarOpen || isCastModalOpen || isQueueSidebarOpen) {
            actions.setControlsVisible(true)
        }
    }, [isEpisodesSidebarOpen, isCastModalOpen, isQueueSidebarOpen, actions])

    const localServerUrl = React.useMemo(() => {
        if (typeof window === "undefined") return "http://localhost:43211"

        // Prefer backend IPs and Port provided by the server status
        if (state.serverIPs && state.serverIPs.length > 0) {
            const lanIp = state.serverIPs.find(ip =>
                ip.startsWith("192.168.") ||
                ip.startsWith("10.") ||
                ip.startsWith("172.")
            ) || state.serverIPs[0]
            const port = state.serverPort || 43211
            return `http://${lanIp}:${port}`
        }

        const hostname = window.location.hostname
        const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"

        // Si ya se accede desde una IP de red local, usar esa URL directamente.
        if (!isLocalhost) {
            return window.location.origin
        }

        // Último recurso
        return "http://localhost:43211"
    }, [state.serverIPs, state.serverPort])

    const fetchPairedTvs = React.useCallback(async () => {
        try {
            const result = await buildSeaQuery<{ ip: string; name: string; wifi_mac?: string; ethernet_mac?: string }[]>({
                endpoint: "/api/v1/cast/samsung/paired",
                method: "GET",
            })
            setPairedTvs(result || [])
        } catch (err) {
            console.error("Error fetching paired TVs:", err)
        }
    }, [])

    const discoverTvs = React.useCallback(async () => {
        setIsDiscovering(true)
        try {
            await fetchPairedTvs()
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
    }, [fetchPairedTvs])

    const allTvs = React.useMemo(() => {
        const list: { ip: string; name: string; isOnline: boolean }[] = []
        discoveredTvs.forEach(tv => {
            list.push({ ip: tv.ip, name: tv.name, isOnline: true })
        })
        pairedTvs.forEach(ptv => {
            if (!list.some(tv => tv.ip === ptv.ip)) {
                list.push({ ip: ptv.ip, name: ptv.name, isOnline: false })
            }
        })
        return list
    }, [discoveredTvs, pairedTvs])

    const handleCastToSamsung = async (ip: string, name: string) => {
        setCastingTvIp(ip)
        try {
            const absoluteStreamUrl = state.absoluteLanUrl || (playableUrl.startsWith("http")
                ? playableUrl
                : `${localServerUrl}${playableUrl}`)
            const castUrl = `${localServerUrl}/api/v1/cast/player?url=${encodeURIComponent(absoluteStreamUrl)}&title=${encodeURIComponent(title || "KameHouse")}`

            console.log("[CAST DEBUG] Sending cast URL to Samsung TV:", castUrl)

            const result = await buildSeaQuery<{ success: boolean }, { ip: string; url: string }>({
                endpoint: "/api/v1/cast/samsung/launch",
                method: "POST",
                data: {
                    ip,
                    url: castUrl,
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
                    isQueueSidebarOpen={isQueueSidebarOpen}
                    onToggleQueueSidebar={() => setIsQueueSidebarOpen(!isQueueSidebarOpen)}
                    hasQueue={playlistQueue.length > 0}
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
                                                    <DeferredImage
                                                        src={ep.thumbnail}
                                                        alt={ep.title || `Episodio ${epNum}`}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                        showSkeleton={false}
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

            {/* Queue Sidebar */}
            <AnimatePresence>
                {isQueueSidebarOpen && (
                    <>
                        {/* Backdrop overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsQueueSidebarOpen(false)}
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
                                    COLA DE REPRODUCCIÓN
                                </h3>
                                <button
                                    onClick={() => setIsQueueSidebarOpen(false)}
                                    className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-full transition-all"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Queue Items List */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                                {playlistQueue.map((item, idx) => {
                                    const isCurrent = idx === currentQueueIndex

                                    return (
                                        <div
                                            key={`${item.id}_${idx}`}
                                            className={cn(
                                                "w-full text-left flex gap-4 p-3 rounded-xl border transition-all duration-300 group relative",
                                                isCurrent
                                                    ? "bg-brand-orange/10 border-brand-orange/30 text-white shadow-[0_0_15px_rgba(255,110,58,0.1)]"
                                                    : "bg-white/[0.02] border-white/5 text-zinc-400 hover:text-white hover:bg-white/[0.04] hover:border-white/10"
                                            )}
                                        >
                                            {/* Clickable Area to play */}
                                            <div 
                                                onClick={() => {
                                                    useAppStore.getState().setCurrentQueueIndex(idx);
                                                }}
                                                className="flex-1 flex gap-4 cursor-pointer"
                                            >
                                                {/* Thumbnail */}
                                                <div className="relative w-28 aspect-video bg-zinc-900 border border-white/5 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                                                    {item.thumbnail ? (
                                                        <DeferredImage
                                                            src={item.thumbnail}
                                                            alt={item.title}
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                            showSkeleton={false}
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
                                                    {item.subtitle && (
                                                        <span className={cn(
                                                            "text-[9px] font-black tracking-widest mb-0.5",
                                                            isCurrent ? "text-brand-orange" : "text-zinc-500"
                                                        )}>
                                                            {item.subtitle.toUpperCase()}
                                                        </span>
                                                    )}
                                                    <h4 className={cn(
                                                        "text-[11px] font-black uppercase tracking-wider truncate leading-tight transition-colors",
                                                        isCurrent ? "text-white" : "text-zinc-300 group-hover:text-white"
                                                    )}>
                                                        {item.title}
                                                    </h4>
                                                </div>
                                            </div>

                                            {/* Remove button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    useAppStore.getState().removeFromQueue(idx);
                                                }}
                                                className="p-1.5 text-zinc-500 hover:text-red-400 self-center hover:bg-white/5 rounded-full transition-all duration-200 z-10"
                                                title="Eliminar de la cola"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )
                                })}
                                
                                {playlistQueue.length === 0 && (
                                    <div className="py-20 flex flex-col items-center justify-center text-center gap-3">
                                        <p className="text-[10px] text-zinc-500 font-sans tracking-normal uppercase font-bold">
                                            La cola está vacía
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Footer / Actions */}
                            {playlistQueue.length > 0 && (
                                <div className="p-6 border-t border-white/5 shrink-0 flex justify-between gap-4">
                                    <button
                                        onClick={() => {
                                            useAppStore.getState().clearQueue();
                                            setIsQueueSidebarOpen(false);
                                        }}
                                        className="w-full py-3 border border-white/10 hover:border-red-500/30 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all duration-300"
                                    >
                                        Vaciar Cola
                                    </button>
                                </div>
                            )}
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
                                    ) : allTvs.length > 0 ? (
                                        <div className="space-y-2">
                                            {allTvs.map((tv) => (
                                                <div
                                                    key={tv.ip}
                                                    onClick={() => castingTvIp === null && handleCastToSamsung(tv.ip, tv.name)}
                                                    className={cn(
                                                        "p-3.5 rounded-xl border transition-all duration-300 flex justify-between items-center group cursor-pointer",
                                                        castingTvIp === tv.ip
                                                            ? "bg-brand-orange/10 border-brand-orange/40 text-brand-orange"
                                                            : tv.isOnline
                                                                ? "bg-zinc-950/40 border-white/5 hover:border-brand-orange/30 hover:bg-brand-orange/[0.02] text-white"
                                                                : "bg-zinc-950/10 border-white/[0.03] opacity-60 hover:opacity-100 hover:border-brand-orange/20 hover:bg-brand-orange/[0.01] text-zinc-400 hover:text-white"
                                                    )}
                                                >
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold tracking-wide">{tv.name}</span>
                                                            <span className={cn(
                                                                "w-1.5 h-1.5 rounded-full shrink-0",
                                                                tv.isOnline ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"
                                                            )} />
                                                        </div>
                                                        <span className="text-[9px] text-zinc-500 font-mono tracking-tight">
                                                            {tv.ip} {!tv.isOnline && "· En espera (WoL)"}
                                                        </span>
                                                    </div>
                                                    {castingTvIp === tv.ip ? (
                                                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-brand-orange">
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            {tv.isOnline ? "Transmitiendo..." : "Encendiendo TV..."}
                                                        </div>
                                                    ) : (
                                                        <div className={cn(
                                                            "px-2.5 py-1 rounded-md transition-all text-[9px] font-black uppercase tracking-wider border",
                                                            tv.isOnline
                                                                ? "bg-zinc-900 border-white/10 group-hover:border-brand-orange/30 group-hover:bg-brand-orange/10 text-zinc-400 group-hover:text-brand-orange"
                                                                : "bg-zinc-900/50 border-white/5 group-hover:border-brand-orange/20 group-hover:bg-brand-orange/5 text-zinc-500 group-hover:text-zinc-300"
                                                        )}>
                                                            {tv.isOnline ? "Transmitir" : "Encender"}
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

                                {/* Option 3: Manual Alternative Casting */}
                                <div className="p-5 rounded-2xl bg-zinc-950/40 border border-white/5 transition-all duration-300 flex flex-col gap-4">
                                    <div className="flex gap-3 items-center border-b border-white/5 pb-3">
                                        <Tv className="w-4 h-4 text-zinc-400" />
                                        <h4 className="text-xs font-bold text-white tracking-wider uppercase">
                                            Método Alternativo (Cualquier TV)
                                        </h4>
                                    </div>
                                    <p className="text-[10px] text-zinc-400 leading-relaxed font-sans normal-case tracking-normal">
                                        Si la transmisión automática falla o usas otra marca de Smart TV:
                                    </p>
                                    <ol className="list-decimal pl-4 space-y-1.5 text-[10px] text-zinc-400 font-sans normal-case tracking-normal">
                                        <li>Abre el navegador web de tu Smart TV.</li>
                                        <li>Escribe la siguiente dirección directamente:</li>
                                    </ol>
                                    <div className="p-3.5 bg-zinc-950/60 border border-white/5 rounded-xl flex items-center justify-between gap-3 font-mono text-[11px] text-brand-orange select-all font-bold">
                                        <span>{localServerUrl}/go</span>
                                    </div>
                                    <p className="text-[9px] text-zinc-500 leading-relaxed font-sans normal-case tracking-normal italic border-t border-white/5 pt-2">
                                        Tip: Guarda esta dirección en los favoritos del navegador de tu TV. La próxima vez, solo inicia la reproducción de un video, abre el favorito en la TV y se reproducirá al instante.
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
