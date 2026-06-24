import React, { useMemo, useState } from "react"
import { useRequestMediastreamMediaContainer } from "@/api/hooks/mediastream.hooks"
import { useGetMediastreamSettings } from "@/api/hooks/mediastream.hooks"
import { useGetStatus } from "@/api/hooks/settings.hooks"
import { usePlayerCore } from "./player-core"
import { PlayerUI } from "./player-ui"
import type { EpisodeSource } from "@/api/types/unified.types"
import type { Mediastream_StreamType, Audio, Subtitle } from "@/api/generated/types"
import type { AudioTrack, SubtitleTrack } from "@/components/ui/track-types"
import type { VideoPlayerProps } from "./player"
import { __isElectronDesktop__ } from "@/types/constants"

export interface Chapter {
    startTime: number
    endTime: number
    name: string
    type?: string
}

export interface OrchestratorProps extends VideoPlayerProps {
    playableUrl?: string
    backendTracks?: {
        audioTracks: AudioTrack[]
        subtitleTracks: SubtitleTrack[]
        chapters: Chapter[]
    }
}

export function VideoPlayerOrchestrator(props: OrchestratorProps) {
    const [streamType, setStreamType] = useState<string>(props.streamType || "direct")
    const [clientId] = useState(() => Math.random().toString(36).substring(2, 11))

    const [prevStreamTypeProp, setPrevStreamTypeProp] = useState(props.streamType)
    if (props.streamType !== prevStreamTypeProp) {
        setPrevStreamTypeProp(props.streamType)
        setStreamType(props.streamType || "direct")
    }

    const { data: mediastreamSettings } = useGetMediastreamSettings()
    const { data: status } = useGetStatus()

    // Auto-detect if we're on local network (same PC or LAN)
    // Force Direct Play for local files when on LAN to avoid unnecessary transcoding
    const isLocalNetwork = useMemo(() => {
        if (__isElectronDesktop__) return true // Electron app always runs locally
        if (!status?.serverIPs?.length) return true // Default to local if no IPs
        const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost"
        // Check if accessing via localhost or LAN IP
        return hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("192.168.") || hostname.startsWith("10.") || hostname.startsWith("172.")
    }, [status?.serverIPs])

    const isLocal = !props.isExternalStream && Boolean(props.streamUrl) && streamType !== "online"

    // Override streamType for local files on local network: always prefer Direct Play
    const effectiveStreamType = useMemo(() => {
        if (isLocal && isLocalNetwork) {
            // If server has DirectPlayOnly setting enabled, or we're on LAN, force direct
            if (mediastreamSettings?.directPlayOnly) return "direct"
            // On LAN, default to direct for local files to avoid transcoding overhead
            return "direct"
        }
        return streamType
    }, [isLocal, isLocalNetwork, streamType, mediastreamSettings?.directPlayOnly])

    const { data } = useRequestMediastreamMediaContainer({
        path: props.streamUrl,
        streamType: effectiveStreamType as Mediastream_StreamType,
        clientID: clientId,
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
            })) || [],
            chapters: data.mediaInfo.chapters?.map((c) => ({
                startTime: c.startTime || 0,
                endTime: c.endTime || 0,
                name: c.name || "",
                type: c.type
            })) || []
        }
    }, [data, props.streamUrl, clientId])

    const activeStreamType = (data?.streamType || effectiveStreamType) as "local" | "online" | "direct" | "transcode" | "optimized"

    const core = usePlayerCore({
        ...props,
        streamType: activeStreamType,
        playableUrl,
        backendTracks,
        clientId,
        mediaFormat: props.mediaFormat,
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

    return (
        <PlayerUI
            title={props.title}
            episodeLabel={props.episodeLabel}
            onClose={props.onClose}
            onNextEpisode={props.onNextEpisode}
            playableUrl={playableUrl}
            streamType={activeStreamType as "local" | "online" | "direct" | "transcode" | "optimized"}
            episodeSources={episodeSources}
            onSourceSwitch={handleSourceSwitch}
            core={core}
            clientId={clientId}
            mediaId={props.mediaId}
            episodeNumber={props.episodeNumber}
            malId={props.malId}
            episodes={props.episodes}
            onSelectEpisode={props.onSelectEpisode}
            mediaFormat={props.mediaFormat}
            nextEpisodeTitle={props.nextEpisodeTitle}
            nextEpisodeNumber={props.nextEpisodeNumber}
            nextEpisodeImage={props.nextEpisodeImage}
        />
    )
}
