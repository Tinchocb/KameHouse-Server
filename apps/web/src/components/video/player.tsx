import React, { useMemo, useState } from "react"
import { useRequestMediastreamMediaContainer } from "@/api/hooks/mediastream.hooks"
import { Loader2, AlertTriangle } from "lucide-react"

import { usePlayerCore } from "./player-core"
import { PlayerUI } from "./player-ui"
import type { EpisodeSource } from "@/api/types/unified.types"
import type { Mediastream_StreamType, Audio, Subtitle } from "@/api/generated/types"
import type { AudioTrack, SubtitleTrack } from "@/components/ui/track-types"

export type VideoPlayerProps = {
    streamUrl: string
    streamType?: "local" | "online" | "direct" | "transcode" | "optimized"
    isExternalStream?: boolean
    title?: string
    episodeLabel?: string
    initialProgressSeconds?: number
    onClose: () => void
    onProgress?: (seconds: number) => void
    onNextEpisode?: () => void
    hasNextEpisode?: boolean
    mediaId?: number
    episodeNumber?: number
    malId?: number | null
    marathonMode?: boolean
}

function PlayerLoadingScreen() {
    return (
        <div className="fixed inset-0 z-[10000] bg-black w-screen h-screen flex flex-col items-center justify-center gap-4 text-white">
            <Loader2 className="w-14 h-14 text-white animate-spin" />
            <p className="font-bold tracking-widest uppercase text-[10px] opacity-80 animate-pulse">
                Cargando Reproductor
            </p>
        </div>
    )
}

export function VideoPlayer(props: VideoPlayerProps) {
    const isLocal = !props.isExternalStream && Boolean(props.streamUrl) && props.streamType !== "online"

    if (isLocal) {
        return <VideoPlayerOrchestrator {...props} />
    }

    return (
        <VideoPlayerOrchestrator
            {...props}
            playableUrl={props.streamUrl}
        />
    )
}

interface OrchestratorProps extends VideoPlayerProps {
    playableUrl?: string
    backendTracks?: {
        audioTracks: AudioTrack[]
        subtitleTracks: SubtitleTrack[]
    }
}

function VideoPlayerOrchestrator(props: OrchestratorProps) {
    const [streamType, setStreamType] = useState<string>(props.streamType || "direct")
    const [clientId] = useState(() => Math.random().toString(36).substring(2, 11))
    
    const isLocal = !props.isExternalStream && Boolean(props.streamUrl) && streamType !== "online"

    const { data, isLoading, error } = useRequestMediastreamMediaContainer({
        path: props.streamUrl,
        streamType: streamType as Mediastream_StreamType,
        clientId: clientId,
    }, isLocal)

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
            subtitleTracks: data.mediaInfo.subtitles?.map((s: Subtitle, i: number) => ({
                index: s.index ?? i,
                language: s.language ?? "und",
                title: s.title || s.language || `Subtitle ${i + 1}`,
                codec: s.codec,
                default: s.isDefault,
                forced: s.isForced,
                url: `/api/v1/mediastream/subtitles?path=${encodeURIComponent(props.streamUrl)}&trackIndex=${s.index ?? i}&clientId=${clientId}`
            })) || []
        }
    }, [data, props.streamUrl, clientId])

    const core = usePlayerCore({
        ...props,
        playableUrl,
        backendTracks,
        clientId,
    })

    const episodeSources = useMemo<EpisodeSource[]>(() => [
        {
            title: "Original",
            quality: "Original",
            url: props.streamUrl,
            type: "direct",
            path: props.streamUrl,
            priority: 1,
        },
        {
            title: "Transcodificado",
            quality: "Auto",
            url: props.streamUrl,
            type: "transcode",
            path: props.streamUrl,
            priority: 2,
        }
    ], [props.streamUrl])

    const handleSourceSwitch = (source: EpisodeSource) => {
        if (source.type) {
            setStreamType(source.type)
        }
    }

    if (isLocal) {
        if (isLoading) return <PlayerLoadingScreen />
        if (error || !data || !data.streamUrl) {
            return (
                <div className="fixed inset-0 z-[10000] bg-black w-screen h-screen flex flex-col items-center justify-center gap-6 px-6 text-center text-white">
                    <AlertTriangle className="w-16 h-16 text-white" />
                    <h3 className="font-black text-2xl tracking-[0.2em] uppercase">Error de Streaming</h3>
                    <p className="text-zinc-500 max-w-md text-sm font-bold uppercase tracking-wider leading-relaxed">
                        {error instanceof Error ? error.message : "El servidor no devolvió una URL de reproducción válida."}
                    </p>
                    <button
                        onClick={props.onClose}
                        className="mt-6 px-10 py-4 bg-white text-black font-black text-[11px] uppercase tracking-[0.3em] transition-all hover:bg-zinc-200"
                    >
                        REGRESAR
                    </button>
                </div>
            )
        }
    }

    return (
        <PlayerUI
            title={props.title}
            episodeLabel={props.episodeLabel}
            onClose={props.onClose}
            onNextEpisode={props.onNextEpisode}
            playableUrl={playableUrl}
            streamType={streamType as "local" | "online" | "direct" | "transcode" | "optimized"}
            episodeSources={episodeSources}
            onSourceSwitch={handleSourceSwitch}
            core={core}
            clientId={clientId}
            mediaId={props.mediaId}
            episodeNumber={props.episodeNumber}
            malId={props.malId}
        />
    )
}

