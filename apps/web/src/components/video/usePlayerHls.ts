import { useEffect, useRef } from "react"
import Hls from "hls.js"
import { AudioTrack, SubtitleTrack } from "@/components/ui/track-types"

interface UsePlayerHlsProps {
    videoRef: React.RefObject<HTMLVideoElement | null>
    hlsRef: React.MutableRefObject<Hls | null>
    playableUrl: string
    absoluteLanUrl: string
    isCastingRef: React.RefObject<boolean>
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
    absoluteLanUrl,
    isCastingRef,
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
    const backendTracksRef = useRef(backendTracks)
    const hasPromptedResumeRef = useRef<string | null>(null)

    useEffect(() => {
        backendTracksRef.current = backendTracks
    }, [backendTracks])

    // Decoupled watch history/resume prompt logic
    useEffect(() => {
        if (!historyData?.found || !historyData?.item) return
        if (historyData.item.episodeNumber !== episodeNumber) return

        const currentKey = `${episodeNumber}-${playableUrl}`
        if (hasPromptedResumeRef.current === currentKey) return

        const time = historyData.item.currentTime
        if (time > 10) {
            hasPromptedResumeRef.current = currentKey
            setResumeTime(time)
            setShowResume(true)

            const timer = setTimeout(() => setShowResume(false), 10000)
            return () => clearTimeout(timer)
        }
    }, [historyData, episodeNumber, playableUrl, setResumeTime, setShowResume])

    // Decoupled track updates for direct streams (non-HLS)
    useEffect(() => {
        if (!backendTracks) return
        const isHlsUrl = playableUrl.includes(".m3u8")
        if (!isHlsUrl || !Hls.isSupported()) {
            setAudioTracks(backendTracks.audioTracks)
            setSubtitleTracks(backendTracks.subtitleTracks)
        }
    }, [backendTracks, playableUrl, setAudioTracks, setSubtitleTracks])

    useEffect(() => {
        if (!playableUrl) {
            Promise.resolve().then(() => {
                setStatus("loading")
                setIsBuffering(true)
            })
            return
        }

        const video = videoRef.current
        if (!video) return

        const progressSeconds = initialProgressSeconds || 0

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
            if (isCastingRef.current) {
                console.log("Ignoring native video error because casting is active.")
                return
            }
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
                setAudioTracks(mappedTracks.length > 0 ? mappedTracks : (backendTracksRef.current?.audioTracks || []))
                setActiveAudioIndex(hls.audioTrack)
            })

            hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_, data) => {
                const mappedSubs = data.subtitleTracks.map((t, i) => ({
                    index: i,
                    language: t.lang || "und",
                    title: t.name || t.lang || `Subtítulos ${i + 1}`,
                }))
                setSubtitleTracks(mappedSubs.length > 0 ? mappedSubs : (backendTracksRef.current?.subtitleTracks || []))
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
            video.src = absoluteLanUrl
            video.load()

            video.addEventListener("canplay", handleCanPlay)
            video.addEventListener("error", handleNativeError)

            if (backendTracksRef.current) {
                Promise.resolve().then(() => {
                    setAudioTracks(backendTracksRef.current!.audioTracks)
                    setSubtitleTracks(backendTracksRef.current!.subtitleTracks)
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
        absoluteLanUrl,
        initialProgressSeconds,
        videoRef,
        hlsRef,
        isCastingRef,
        setStatus,
        setIsBuffering,
        setErrorMsg,
        setHlsLevels,
        setAudioTracks,
        setSubtitleTracks,
        setActiveAudioIndex,
        setIsPlaying,
    ])
}
