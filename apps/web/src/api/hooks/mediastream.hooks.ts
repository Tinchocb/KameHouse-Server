import { useServerMutation, useServerQuery } from "@/api/client/requests"
import {
    PreloadMediastreamMediaContainer_Variables,
    RequestMediastreamMediaContainer_Variables,
} from "@/api/generated/endpoint.types"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { Mediastream_MediaContainer } from "@/api/generated/types"
import { logger } from "@/lib/helpers/debug"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

export function useRequestMediastreamMediaContainer(variables: Partial<RequestMediastreamMediaContainer_Variables>, enabled: boolean) {
    return useServerQuery<Mediastream_MediaContainer, RequestMediastreamMediaContainer_Variables>({
        endpoint: API_ENDPOINTS.MEDIASTREAM.RequestMediastreamMediaContainer.endpoint,
        method: API_ENDPOINTS.MEDIASTREAM.RequestMediastreamMediaContainer.methods[0],
        queryKey: [API_ENDPOINTS.MEDIASTREAM.RequestMediastreamMediaContainer.key, variables?.path, variables?.streamType],
        data: variables as RequestMediastreamMediaContainer_Variables,
        enabled: !!variables.path && !!variables.streamType && enabled,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        staleTime: Infinity,
        // El reproductor muestra el error en su overlay (ver streamRequestError);
        // un toast genérico encima sería redundante.
        muteError: true,
        // gcTime: 0 is load-bearing for CORRECTNESS, not just memory. This POST is a
        // server-side session bind: RequestPlayback sets clientMediaContainers[clientID]
        // and currentMediaContainer, and every stream request (segments, ranges,
        // subtitles) resolves the file from that binding. If cached data were reused on
        // episode change WITHOUT re-issuing the POST, the server would still point at the
        // previous file and stream the wrong episode. Evicting on unmount forces a fresh
        // bind every time. Do NOT raise this to "fix" refetching — warm via the
        // side-effect-free preload endpoint instead.
        gcTime: 0,
    })
}

export function usePreloadMediastreamMediaContainer() {
    return useServerMutation<boolean, PreloadMediastreamMediaContainer_Variables>({
        endpoint: API_ENDPOINTS.MEDIASTREAM.PreloadMediastreamMediaContainer.endpoint,
        method: API_ENDPOINTS.MEDIASTREAM.PreloadMediastreamMediaContainer.methods[0],
        mutationKey: [API_ENDPOINTS.MEDIASTREAM.PreloadMediastreamMediaContainer.key],
        onSuccess: async () => {
            logger("MEDIASTREAM").success("Preloaded mediastream media container")
        },
    })
}

export function useMediastreamShutdownTranscodeStream() {
    return useServerMutation<boolean, { clientId: string }>({
        endpoint: API_ENDPOINTS.MEDIASTREAM.MediastreamShutdownTranscodeStream.endpoint,
        method: API_ENDPOINTS.MEDIASTREAM.MediastreamShutdownTranscodeStream.methods[0],
        mutationKey: [API_ENDPOINTS.MEDIASTREAM.MediastreamShutdownTranscodeStream.key],
        onSuccess: async () => {

        },
    })
}

interface FFmpegStatus {
    ffmpegAvailable: boolean
    ffprobeAvailable: boolean
    ffmpegPath: string
    ffprobePath: string
    ffmpegVersion: string
    ffprobeVersion: string
    isDownloading: boolean
    downloadProgress: number
    downloadStatus: string
    lastError?: string
}

export function useGetFFmpegStatus() {
    return useServerQuery<FFmpegStatus>({
        endpoint: API_ENDPOINTS.MEDIASTREAM.GetFFmpegStatus.endpoint,
        method: "GET",
        queryKey: [API_ENDPOINTS.MEDIASTREAM.GetFFmpegStatus.key],
        refetchInterval: (query) => {
            const data = query.state.data
            return data?.isDownloading ? 1000 : false
        },
    })
}

export function useInstallFFmpeg() {
    const qc = useQueryClient()
    return useServerMutation<{ started: boolean }, void>({
        endpoint: API_ENDPOINTS.MEDIASTREAM.InstallFFmpeg.endpoint,
        method: "POST",
        mutationKey: [API_ENDPOINTS.MEDIASTREAM.InstallFFmpeg.key],
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: [API_ENDPOINTS.MEDIASTREAM.GetFFmpegStatus.key] })
            toast.info("Iniciando descarga e instalación de FFmpeg...")
        },
    })
}

