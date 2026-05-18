import { useEffect } from "react"
import Hls from "hls.js"
import { AudioTrack, SubtitleTrack } from "@/components/ui/track-types"

interface UsePlayerHlsProps {
    videoRef: React.RefObject<HTMLVideoElement | null>
    hlsRef: React.MutableRefObject<Hls | null>
    playableUrl: string
    backendTracks: { audioTracks: AudioTrack[]; subtitleTracks: SubtitleTrack[] } | null
    initialProgressSeconds?: number
    episodeNumber?: number
    historyData: any
    setStatus: (status: "loading" | "ready" | "error") => void
    setIsBuffering: (buffering: boolean) => void
    setErrorMsg: (msg: string) => void
    setHlsLevels: (levels: { index: number; label: string; height: number }[]) => void
    setAudioTracks: (tracks: AudioTrack[]) => void
    setSubtitleTracks: (tracks: SubtitleTrack[]) => void
    setActiveAudioIndex: (index: number) => void
    setResumeTime: (time: number) => void
    setShowResume: (show: boolean) => void
    setIsPlaying: (playing: boolean) => void
}

export function usePlayerHls({
    videoRef,
    hlsRef,
    playableUrl,
    backendTracks,
    initialProgressSeconds,
    episodeNumber,
    historyData,
    setStatus,
    setIsBuffering,
    setErrorMsg,
    setHlsLevels,
    setAudioTracks,
    setSubtitleTracks,
    setActiveAudioIndex,
    setResumeTime,
    setShowResume,
    setIsPlaying,
}: UsePlayerHlsProps) {
    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        const progressSeconds = initialProgressSeconds || 0

        // Handle Resume Logic
        if (historyData?.found && historyData.item && historyData.item.episodeNumber === episodeNumber) {
            const time = historyData.item.currentTime
            if (time > 10) { // Only resume if more than 10 seconds in
                setTimeout(() => {
                    setResumeTime(time)
                    setShowResume(true)
                }, 0)
                // Auto-hide resume after 10 seconds
                setTimeout(() => setShowResume(false), 10000)
            }
        }

        Promise.resolve().then(() => {
            setStatus("loading")
            setIsBuffering(true)
        })

        if (hlsRef.current) {
            hlsRef.current.destroy()
            hlsRef.current = null
        }

        const isHlsUrl = playableUrl.includes(".m3u8")
        let hlsInstance: Hls | null = null

        const handleCanPlay = () => {
            setStatus("ready")
            setIsBuffering(false)
            if (progressSeconds > 0) {
                video.currentTime = progressSeconds
            }
            video.play()
                .then(() => setIsPlaying(true))
                .catch((err) => {
                    console.log("Autoplay blocked:", err)
                    setIsPlaying(false)
                })
        }

        const handleNativeError = () => {
            setStatus("error")
            setErrorMsg(video.error?.message || "Ocurrió un error al cargar el archivo de video.")
        }

        if (isHlsUrl && Hls.isSupported()) {
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90,
            })
            hlsRef.current = hls
            hlsInstance = hls

            hls.loadSource(playableUrl)
            hls.attachMedia(video)

            hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
                setStatus("ready")
                setIsBuffering(false)

                const levels = data.levels.map((level, index) => ({
                    index,
                    label: level.name || `${level.height}p`,
                    height: level.height
                }))
                setHlsLevels(levels)

                if (progressSeconds > 0) {
                    video.currentTime = progressSeconds
                }

                // Autoplay when HLS manifest is parsed and stream is ready
                video.play()
                    .then(() => setIsPlaying(true))
                    .catch((err) => {
                        console.log("Autoplay blocked:", err)
                        setIsPlaying(false)
                    })
            })

            hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data) => {
                const mappedTracks = data.audioTracks.map((t) => ({
                    index: t.id,
                    language: t.lang || "und",
                    title: t.name || t.lang || `Audio ${t.id}`,
                }))
                setAudioTracks(mappedTracks.length > 0 ? mappedTracks : (backendTracks?.audioTracks || []))
                setActiveAudioIndex(hls.audioTrack)
            })

            hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_, data) => {
                const mappedSubs = data.subtitleTracks.map((t, i) => ({
                    index: i,
                    language: t.lang || "und",
                    title: t.name || t.lang || `Subtítulos ${i + 1}`,
                }))
                setSubtitleTracks(mappedSubs.length > 0 ? mappedSubs : (backendTracks?.subtitleTracks || []))
            })

            hls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) {
                    console.error("Fatal HLS error:", data)
                    setStatus("error")
                    setErrorMsg(`Error fatal de reproducción HLS: ${data.details}`)
                    hls.destroy()
                }
            })
        } else {
            video.src = playableUrl
            video.load()

            video.addEventListener("canplay", handleCanPlay)
            video.addEventListener("error", handleNativeError)

            if (backendTracks) {
                Promise.resolve().then(() => {
                    setAudioTracks(backendTracks.audioTracks)
                    setSubtitleTracks(backendTracks.subtitleTracks)
                })
            }
        }

        return () => {
            if (hlsInstance) {
                hlsInstance.destroy()
                if (hlsRef.current === hlsInstance) {
                    hlsRef.current = null
                }
            }
            video.removeEventListener("canplay", handleCanPlay)
            video.removeEventListener("error", handleNativeError)
        }
    }, [
        playableUrl,
        backendTracks,
        initialProgressSeconds,
        episodeNumber,
        historyData?.found,
        historyData?.item,
        videoRef,
        hlsRef,
        setStatus,
        setIsBuffering,
        setErrorMsg,
        setHlsLevels,
        setAudioTracks,
        setSubtitleTracks,
        setActiveAudioIndex,
        setResumeTime,
        setShowResume,
        setIsPlaying,
    ])
}
