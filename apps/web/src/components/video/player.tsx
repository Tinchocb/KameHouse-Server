import React, { useMemo } from "react"
import { useRequestMediastreamMediaContainer } from "@/api/hooks/mediastream.hooks"
import { Loader2, AlertTriangle } from "lucide-react"

import { usePlayerCore } from "./player-core"
import { PlayerUI } from "./player-ui"
import type { EpisodeSource } from "@/api/types/unified.types"
import type { Mediastream_StreamType } from "@/api/generated/types"
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

    const { data, isLoading, error } = useRequestMediastreamMediaContainer({
        path: props.streamUrl,
        streamType: props.streamType as Mediastream_StreamType,
    }, isLocal)

    if (isLocal) {
        if (isLoading) {
            return <PlayerLoadingScreen />
        }

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

        return (
            <VideoPlayerOrchestrator
                {...props}
                playableUrl={data.streamUrl}
                backendTracks={{
                    audioTracks: data.mediaInfo?.audios?.map((a: { index?: number; language?: string; title?: string; codec?: string; channels?: number; default?: boolean }, i: number) => ({
                        index: a.index ?? i,
                        language: a.language ?? "und",
                        title: a.title || a.language || `Audio ${i + 1}`,
                        codec: a.codec,
                        channels: a.channels,
                        default: a.default
                    })) || [],
                    subtitleTracks: data.mediaInfo?.subtitles?.map((s: { index?: number; language?: string; title?: string; codec?: string; default?: boolean; forced?: boolean }, i: number) => ({
                        index: s.index ?? i,
                        language: s.language ?? "und",
                        title: s.title || s.language || `Subtitle ${i + 1}`,
                        codec: s.codec,
                        default: s.default,
                        forced: s.forced,
                        url: `/api/v1/mediastream/subtitles?path=${encodeURIComponent(props.streamUrl)}&trackIndex=${s.index ?? i}`
                    })) || []
                }}
            />
        )
    }

    return (
        <VideoPlayerOrchestrator
            {...props}
            playableUrl={props.streamUrl}
        />
    )
}

interface OrchestratorProps extends VideoPlayerProps {
    playableUrl: string
    backendTracks?: {
        audioTracks: AudioTrack[]
        subtitleTracks: SubtitleTrack[]
    }
}

function VideoPlayerOrchestrator(props: OrchestratorProps) {
    const core = usePlayerCore(props)

    const episodeSources = useMemo<EpisodeSource[]>(() => [
        {
            title: "Original",
            quality: "1085p",
            url: props.playableUrl,
            type: "local",
            path: props.playableUrl,
            priority: 1,
        }
    ], [props.playableUrl])

    return (
        <PlayerUI
            title={props.title}
            episodeLabel={props.episodeLabel}
            onClose={props.onClose}
            onNextEpisode={props.onNextEpisode}
            playableUrl={props.playableUrl}
            streamType={props.streamType}
            episodeSources={episodeSources}
            core={core}
        />
    )
}
