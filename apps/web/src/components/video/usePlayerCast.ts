import { useState, useEffect, useRef, useCallback } from "react"
import Hls from "hls.js"

interface UsePlayerCastProps {
    videoRef: React.RefObject<HTMLVideoElement | null>
    hlsRef: React.RefObject<Hls | null>
    absoluteLanUrl: string
    playableUrl: string
    status: "loading" | "ready" | "error"
}

interface HTMLVideoElementWithPlaybackTarget extends HTMLVideoElement {
    webkitShowPlaybackTargetPicker?: () => void
    webkitCurrentPlaybackTargetIsWireless?: boolean
}

function setVideoSrc(video: HTMLVideoElement, src: string) {
    video.src = src
}

function setVideoCurrentTime(video: HTMLVideoElement, time: number) {
    if (Number.isFinite(time)) {
        video.currentTime = time
    } else {
        console.warn("usePlayerCast: setVideoCurrentTime ignored non-finite time:", time)
    }
}

export function usePlayerCast({
    videoRef,
    hlsRef,
    absoluteLanUrl,
    playableUrl,
    status
}: UsePlayerCastProps) {
    const [isCastSupported, setIsCastSupported] = useState(() => {
        if (typeof window === "undefined") return false
        const video = document.createElement("video") as HTMLVideoElementWithPlaybackTarget
        return 'remote' in video || 'webkitShowPlaybackTargetPicker' in video
    })
    const [castState, setCastState] = useState<"disconnected" | "connecting" | "connected">("disconnected")

    const isCastingRef = useRef(false)
    const castingSavedStateRef = useRef<{
        src: string
        currentTime: number
        wasPlaying: boolean
        wasHls: boolean
    } | null>(null)

    const absoluteLanUrlRef = useRef(absoluteLanUrl)
    const playableUrlRef = useRef(playableUrl)

    useEffect(() => {
        absoluteLanUrlRef.current = absoluteLanUrl
    }, [absoluteLanUrl])

    useEffect(() => {
        playableUrlRef.current = playableUrl
    }, [playableUrl])

    const prepareForCast = useCallback(() => {
        const video = videoRef.current as HTMLVideoElementWithPlaybackTarget | null
        if (!video || isCastingRef.current) return

        isCastingRef.current = true

        if (!castingSavedStateRef.current) {
            const isPlayingLocal = !video.paused
            const timeLocal = video.currentTime
            const isHls = hlsRef.current !== null

            castingSavedStateRef.current = {
                src: video.src,
                currentTime: timeLocal,
                wasPlaying: isPlayingLocal,
                wasHls: isHls
            }

            if (isHls && hlsRef.current) {
                hlsRef.current.detachMedia()
            }
        }

        const timeLocal = castingSavedStateRef.current.currentTime
        const targetUrl = absoluteLanUrlRef.current
        console.log("Preparing Cast: Swapping source to absolute LAN URL:", targetUrl)
        setVideoSrc(video, targetUrl)
        video.load()
        setVideoCurrentTime(video, timeLocal)
    }, [videoRef, hlsRef])

    const restoreLocalPlayback = useCallback(() => {
        const video = videoRef.current as HTMLVideoElementWithPlaybackTarget | null
        if (!video || !castingSavedStateRef.current) return

        isCastingRef.current = false
        const saved = castingSavedStateRef.current
        castingSavedStateRef.current = null

        const restoreTime = video.currentTime || saved.currentTime
        console.log("Restoring local playback. Time:", restoreTime)

        if (saved.wasHls && hlsRef.current) {
            video.removeAttribute("src")
            video.load()
            hlsRef.current.attachMedia(video)
            hlsRef.current.loadSource(playableUrlRef.current)

            const handleManifestParsed = () => {
                setVideoCurrentTime(video, restoreTime)
                if (saved.wasPlaying) {
                    video.play().catch(e => console.error("Error playing local video:", e))
                }
                hlsRef.current?.off(Hls.Events.MANIFEST_PARSED, handleManifestParsed)
            }
            hlsRef.current.on(Hls.Events.MANIFEST_PARSED, handleManifestParsed)
        } else {
            setVideoSrc(video, saved.src)
            video.load()
            setVideoCurrentTime(video, restoreTime)
            if (saved.wasPlaying) {
                video.play().catch(e => console.error("Error playing local video:", e))
            }
        }
    }, [videoRef, hlsRef])

    useEffect(() => {
        const video = videoRef.current as HTMLVideoElementWithPlaybackTarget | null
        if (!video) return

        const hasRemote = 'remote' in video && video.remote;
        const hasWebkit = 'webkitShowPlaybackTargetPicker' in video;

        if (hasRemote && video.remote) {
            setIsCastSupported(true)
            const remote = video.remote

            const handleStateChange = () => {
                const state = remote.state
                setCastState(state)
                console.log("RemotePlayback state changed to:", state)

                if (state === "connecting" || state === "connected") {
                    prepareForCast()
                } else if (state === "disconnected") {
                    restoreLocalPlayback()
                }
            }

            handleStateChange()
            remote.addEventListener('connect', handleStateChange)
            remote.addEventListener('connecting', handleStateChange)
            remote.addEventListener('disconnect', handleStateChange)

            return () => {
                remote.removeEventListener('connect', handleStateChange)
                remote.removeEventListener('connecting', handleStateChange)
                remote.removeEventListener('disconnect', handleStateChange)
            }
        } else if (hasWebkit) {
            setIsCastSupported(true)

            const handleAvailability = (event: Event & { availability?: string }) => {
                setIsCastSupported(event.availability === 'available')
            }

            const handleWebkitTargetChange = () => {
                const isWireless = video.webkitCurrentPlaybackTargetIsWireless
                setCastState(isWireless ? "connected" : "disconnected")
                console.log("WebKit wireless target changed, isWireless:", isWireless)

                if (isWireless) {
                    prepareForCast()
                } else {
                    restoreLocalPlayback()
                }
            }

            video.addEventListener('webkitplaybacktargetavailabilitychanged', handleAvailability as EventListener)
            video.addEventListener('webkitcurrentplaybacktargetiswirelesschanged', handleWebkitTargetChange)
            return () => {
                video.removeEventListener('webkitplaybacktargetavailabilitychanged', handleAvailability as EventListener)
                video.removeEventListener('webkitcurrentplaybacktargetiswirelesschanged', handleWebkitTargetChange)
            }
        }
    }, [status, videoRef, prepareForCast, restoreLocalPlayback])

    const promptCast = useCallback(async () => {
        const video = videoRef.current as HTMLVideoElementWithPlaybackTarget | null
        if (!video) return

        const hasRemote = 'remote' in video && video.remote;
        const hasWebkit = 'webkitShowPlaybackTargetPicker' in video;

        if (hasRemote && video.remote) {
            const remote = video.remote
            console.log("promptCast: Invoking remote.prompt() directly")
            try {
                await remote.prompt()
            } catch (err) {
                console.warn("User cancelled cast or prompt failed:", err)
            }
        } else if (hasWebkit && video.webkitShowPlaybackTargetPicker) {
            console.log("promptCast: Invoking webkitShowPlaybackTargetPicker() directly")
            try {
                video.webkitShowPlaybackTargetPicker()
            } catch (err) {
                console.error("Webkit casting error:", err)
            }
        } else {
            console.warn("Casting not supported in this browser.")
        }
    }, [videoRef])

    return {
        isCastSupported,
        castState,
        isCastingRef,
        promptCast
    }
}
