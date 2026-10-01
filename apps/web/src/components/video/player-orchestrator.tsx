import React, { useMemo, useState, useEffect, useCallback } from "react"
import { useRequestMediastreamMediaContainer, usePreloadMediastreamMediaContainer } from "@/api/hooks/mediastream.hooks"
import { usePlayerCore } from "./player-core"
import { PlayerUI } from "./player-ui"
import { useMpvPlayer } from "./use-mpv-player"
import { MpvOverlay } from "./mpv-overlay"
import { getClientCapabilities, isAudioCodecNativelyPlayable, supportsNativeAudioTracks } from "./client-capabilities"
import { STREAM_FILE_MISSING_MSG } from "./player-overlays"
import type { EpisodeSource } from "@/api/types/unified.types"
import type { Mediastream_StreamType, Audio, Subtitle } from "@/api/generated/types"
import type { VideoPlayerProps } from "./player"
import { useAppStore } from "@/lib/store"
import { toast } from "sonner"

export interface OrchestratorProps extends VideoPlayerProps {
    playableUrl?: string
}

export function VideoPlayerOrchestrator(props: OrchestratorProps) {
    const [streamType, setStreamType] = useState<string>(props.streamType || "direct")
    // force:true acompaña un cambio manual a transcode (ej. cambio de pista de audio en
    // direct play) para que el backend inicialice el transcoder aunque el toggle global
    // esté apagado. Se resetea en cualquier otra transición de stream.
    const [forceTranscode, setForceTranscode] = useState(false)
    const [clientId] = useState(() => Math.random().toString(36).substring(2, 11))

    // Wrapper que resetea force por defecto: solo las llamadas que pasan {force:true}
    // (cambio manual de audio) lo activan.
    const requestStreamType = useCallback((type: string, opts?: { force?: boolean }) => {
        setForceTranscode(!!opts?.force)
        setStreamType(type)
    }, [])

    const currentStreamKey = `${props.streamUrl}_${props.episodeNumber}_${props.streamType}`
    const [prevStreamKey, setPrevStreamKey] = useState(currentStreamKey)
    if (currentStreamKey !== prevStreamKey) {
        setPrevStreamKey(currentStreamKey)
        setForceTranscode(false)
        setStreamType(props.streamType || "direct")
    }

    const isLocal = Boolean(props.streamUrl) && streamType !== "online"

    // Let the backend decide the stream type based on codec compatibility.
    // The backend evaluates video/audio codec support and decides whether to transcode
    // or use direct play. We send the requested type and the backend responds with
    // data.streamType indicating what it actually decided.
    // Real decoding capabilities of this browser so the backend decides
    // direct-vs-transcode against the actual client (HEVC/AC3/MKV support varies
    // between Chromium, Firefox and hardware).
    const clientCapabilities = useMemo(() => getClientCapabilities(), [])

    const { data, error: streamRequestFailure } = useRequestMediastreamMediaContainer({
        path: props.streamUrl,
        streamType: streamType as Mediastream_StreamType,
        clientID: clientId,
        force: forceTranscode,
        clientCapabilities,
    }, isLocal)

    // Traduce el rechazo del servidor a un mensaje claro para el overlay de error.
    const streamRequestError = useMemo(() => {
        if (!streamRequestFailure) return null
        const serverMsg = streamRequestFailure.message?.toLowerCase() || ""
        if (serverMsg.includes("transcoder not initialized") || serverMsg.includes("transcoder could not be initialized")) {
            return "La transcodificación no está habilitada o FFmpeg no está disponible en el servidor. Podés activarla en Ajustes → Streaming."
        }
        switch (streamRequestFailure.status) {
            case 404:
                return STREAM_FILE_MISSING_MSG
            case 403:
                return "Este archivo está fuera de las carpetas de tu biblioteca."
            case 503:
                return "La biblioteca no está disponible en este momento. Probá de nuevo en unos segundos."
            default:
                return "No pudimos preparar la reproducción de este episodio. Probá de nuevo en unos segundos."
        }
    }, [streamRequestFailure])

    const playableUrl = useMemo(() => {
        if (!isLocal) return props.playableUrl || props.streamUrl
        return data?.streamUrl || ""
    }, [isLocal, props.playableUrl, props.streamUrl, data?.streamUrl])

    const backendTracks = useMemo(() => {
        if (!data?.mediaInfo) return undefined
        return {
            audioTracks: data.mediaInfo.audios?.map((a: Audio, i: number) => ({
                index: a.index ?? i,
                language: a.language ?? "und",
                title: a.title || a.language || `Audio ${i + 1}`,
                codec: a.codec,
                channels: a.channels,
                default: a.isDefault
            })) || [],
            subtitleTracks: data.mediaInfo.subtitles?.map((s: Subtitle, i: number) => {
                const trackIdx = s.index ?? i
                const isImageBased = s.isImageBased ?? false
                const endpoint = isImageBased ? "/api/v1/mediastream/subs/pgs" : "/api/v1/mediastream/subtitles"
                return {
                    index: trackIdx,
                    language: s.language ?? "und",
                    title: s.title || s.language || `Subtitle ${i + 1}`,
                    codec: s.codec,
                    default: s.isDefault,
                    forced: s.isForced,
                    isImageBased,
                    url: `${endpoint}?path=${encodeURIComponent(props.streamUrl)}&trackIndex=${trackIdx}&clientId=${clientId}`
                }
            }) || [],

            chapters: data.mediaInfo.chapters?.map((c: { startTime?: number; endTime?: number; name?: string; type?: string }) => ({
                startTime: c.startTime || 0,
                endTime: c.endTime || 0,
                name: c.name || "",
                type: c.type
            })) || [],
            fontUrls: data.mediaInfo.fonts?.map((font: string) => `/api/v1/mediastream/att/${encodeURIComponent(font)}?clientId=${clientId}`) || []
        }
    }, [data, props.streamUrl, clientId])

    const activeStreamType = (data?.streamType && ["local", "online", "direct", "transcode", "optimized"].includes(data.streamType) ? data.streamType : streamType || "direct") as "local" | "online" | "direct" | "transcode" | "optimized"

    const { mutate: preloadTranscode } = usePreloadMediastreamMediaContainer()

    // Warm-up: en direct play con pistas que el motor no puede cambiar nativamente
    // (sin flag AudioVideoTracks, o codecs como AC3 en Chromium), preparamos en el
    // servidor la sesión HLS (media info + keyframes, lo lento en frío: >1 min en
    // un archivo pesado de Drive) sin codificar nada. Así el cambio de pista que
    // obliga a pasar a HLS arranca al instante. Sin condición de transcodeEnabled:
    // ese cambio fuerza el transcoder igual.
    const needsTranscodeForAudioSwitch = useMemo(() => {
        const audios = data?.mediaInfo?.audios ?? []
        if (audios.length < 2) return false
        if (!supportsNativeAudioTracks()) return true
        return audios.some((a: Audio) => !isAudioCodecNativelyPlayable(a.codec))
    }, [data?.mediaInfo?.audios])
    useEffect(() => {
        if (activeStreamType !== "direct" || !needsTranscodeForAudioSwitch || !isLocal || !props.streamUrl) return
        const path = props.streamUrl
        // Tras el arranque: no competir con el buffer inicial del direct play.
        const timer = setTimeout(() => {
            preloadTranscode(
                {
                    path,
                    streamType: "transcode",
                    audioStreamIndex: 0,
                    preferredAudioLang: useAppStore.getState().preferredAudioLang || "",
                    warmOnly: true,
                },
                { onError: (err) => console.warn("[orchestrator] warm-up de la sesión HLS falló (silencioso):", err) }
            )
        }, 5000)
        return () => clearTimeout(timer)
    }, [activeStreamType, needsTranscodeForAudioSwitch, preloadTranscode, props.streamUrl, isLocal])

    // El direct play falló en el cliente (error nativo del <video>): pedir HLS con
    // force. Sin force el servidor recibe las capacidades del cliente, ve que "puede"
    // decodificar el archivo y lo devuelve otra vez a direct play con la misma URL:
    // el reproductor quedaba para siempre en "Preparando el video". force también
    // inicializa el transcoder aunque el toggle global esté apagado — mejor que
    // un error, igual que en el cambio manual de pista.
    const handleDirectPlayFailed = useCallback(() => {
        requestStreamType("transcode", { force: true })
        return true
    }, [requestStreamType])

    const [isEpisodesSidebarOpen, setIsEpisodesSidebarOpen] = useState(false)
    const [isQueueSidebarOpen, setIsQueueSidebarOpen] = useState(false)
    const handleToggleEpisodesSidebar = useCallback(() => {
        setIsEpisodesSidebarOpen(prev => !prev)
    }, [])
    const handleToggleQueueSidebar = useCallback(() => {
        setIsQueueSidebarOpen(prev => !prev)
    }, [])

    const handleEscapeRef = React.useRef<() => void>(() => {})

    const core = usePlayerCore({
        ...props,
        streamType: activeStreamType,
        playableUrl,
        backendTracks,
        clientId,
        mediaFormat: props.mediaFormat,
        onRequestStreamTypeChange: requestStreamType,
        onDirectPlayFailed: handleDirectPlayFailed,
        streamRequestError,
        metadataDuration: data?.mediaInfo?.duration,
        onToggleEpisodesSidebar: handleToggleEpisodesSidebar,
        onToggleQueueSidebar: handleToggleQueueSidebar,
        onEscape: () => handleEscapeRef.current?.(),
    })

    useEffect(() => {
        handleEscapeRef.current = () => {
            if (isEpisodesSidebarOpen) {
                setIsEpisodesSidebarOpen(false)
            } else if (isQueueSidebarOpen) {
                setIsQueueSidebarOpen(false)
            } else if (core.state.isSettingsOpen) {
                core.actions.setIsSettingsOpen(false)
            } else if (core.state.showShortcuts) {
                core.actions.setShowShortcuts(false)
            } else if (core.state.isFullscreen) {
                core.actions.toggleFullscreen()
            } else {
                props.onClose()
            }
        }
    })

    // External mpv playback (desktop app only): hands the local file off to an
    // mpv window while progress keeps syncing through the IPC bridge.
    const mpv = useMpvPlayer({
        path: isLocal ? props.streamUrl : undefined,
        title: props.episodeLabel || props.title,
        mediaId: props.mediaId,
        episodeNumber: props.episodeNumber,
        onExited: () => props.onClose(),
    })

    const handleOpenInMpv = useCallback(async () => {
        try {
            const current = core.state.currentTime > 5
                ? core.state.currentTime
                : (props.initialProgressSeconds || 0)
            core.domElements.videoElement.current?.pause()
            const success = await mpv.play(current)
            if (!success) {
                toast.error("No se pudo iniciar el reproductor MPV externo")
            }
        } catch (err) {
            console.error("[MPV] Error opening external player:", err)
            toast.error("Error al abrir reproductor MPV")
        }
    }, [mpv, core, props.initialProgressSeconds])

    const canUseMpv = mpv.isDesktop && mpv.isAvailable && isLocal

    const isDrive = useMemo(() => {
        return Boolean(props.streamUrl?.includes("/api/v1/drive/play"))
    }, [props.streamUrl])

    const episodeSources = useMemo<EpisodeSource[]>(() => {
        if (isDrive) {
            return [
                {
                    title: "Google Drive (Cloud)",
                    quality: "Original",
                    url: props.streamUrl,
                    type: "direct",
                    path: props.streamUrl,
                    priority: 1,
                }
            ]
        }
        return [
            {
                title: "Direct Play",
                quality: "Original",
                url: props.streamUrl,
                type: "direct",
                path: props.streamUrl,
                priority: 1,
            },
            {
                title: "Transcodificado",
                quality: "Auto HLS",
                url: props.streamUrl,
                type: "transcode",
                path: props.streamUrl,
                priority: 2,
            }
        ]
    }, [props.streamUrl, isDrive])

    const switchSource = core.actions.switchSource
    const handleSourceSwitch = useCallback((source: EpisodeSource) => {
        if (source.type) {
            switchSource(source.type)
        }
    }, [switchSource])

    const handleMpvStop = useCallback(() => mpv.stop(), [mpv])

    return (
        <>
        {mpv.isActive && (
            <MpvOverlay
                title={props.title}
                episodeLabel={props.episodeLabel}
                onStop={handleMpvStop}
            />
        )}
        <PlayerUI
            title={props.title}
            episodeLabel={props.episodeLabel}
            onClose={props.onClose}
            onOpenInMpv={canUseMpv && !mpv.isActive ? handleOpenInMpv : undefined}
            onNextEpisode={props.onNextEpisode}
            playableUrl={playableUrl}
            streamType={activeStreamType as "local" | "online" | "direct" | "transcode" | "optimized"}
            episodeSources={episodeSources}
            onSourceSwitch={handleSourceSwitch}
            core={core}
            mediaId={props.mediaId}
            episodeNumber={props.episodeNumber}
            malId={props.malId}
            episodes={props.episodes}
            onSelectEpisode={props.onSelectEpisode}
            mediaFormat={props.mediaFormat}
            nextEpisodeTitle={props.nextEpisodeTitle}
            nextEpisodeNumber={props.nextEpisodeNumber}
            nextEpisodeImage={props.nextEpisodeImage}
            isEpisodesSidebarOpen={isEpisodesSidebarOpen}
            onToggleEpisodesSidebar={handleToggleEpisodesSidebar}
            setIsEpisodesSidebarOpen={setIsEpisodesSidebarOpen}
            isQueueSidebarOpen={isQueueSidebarOpen}
            onToggleQueueSidebar={handleToggleQueueSidebar}
            setIsQueueSidebarOpen={setIsQueueSidebarOpen}
            momentKey={props.momentKey}
            momentTitle={props.momentTitle}
        />
        </>
    )
}
