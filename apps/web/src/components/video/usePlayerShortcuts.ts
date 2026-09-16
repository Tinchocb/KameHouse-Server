import { useEffect, useRef } from "react"
import { useAppStore } from "@/lib/store"

interface UsePlayerShortcutsProps {
    videoRef: React.RefObject<HTMLVideoElement | null>
    isPlaying: boolean
    isMuted: boolean
    volume: number
    isFullscreen: boolean
    skipMode: string | null
    showNextEpisode: boolean
    onNextEpisode?: () => void
    handleSkipIntro: () => void
    onClose: () => void
    skipOpening: () => void
    skipTime: (seconds: number) => void
    takeScreenshot: () => void
    toggleMute: () => void
    togglePip: () => void
    togglePlay: () => void
    toggleFullscreen: () => void
    setVolume: (v: number) => void
    setIsMuted: (m: boolean) => void
    setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>
    setShowStats: React.Dispatch<React.SetStateAction<boolean>>
    skipToNextChapter?: () => void
    skipToPrevChapter?: () => void
    onToggleSubtitle?: () => void
    onToggleEpisodesSidebar?: () => void
    duration?: number
}

function setVideoVolume(video: HTMLVideoElement, vol: number) {
    video.volume = vol
}

function setVideoMuted(video: HTMLVideoElement, muted: boolean) {
    video.muted = muted
}

export function usePlayerShortcuts(props: UsePlayerShortcutsProps) {
    const refs = useRef<UsePlayerShortcutsProps>(props)
    // Mantener refs sincronizados sin re-registrar el listener (evita churn en cada cambio de volume/isPlaying)
    useEffect(() => {
        refs.current = props
    })

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const {
                videoRef,
                isMuted,
                isFullscreen,
                skipMode,
                showNextEpisode,
                onNextEpisode,
                handleSkipIntro,
                onClose,
                skipOpening,
                skipTime,
                takeScreenshot,
                toggleMute,
                togglePip,
                togglePlay,
                toggleFullscreen,
                setVolume,
                setIsMuted,
                setIsSettingsOpen,
                setShowStats,
                skipToNextChapter,
                skipToPrevChapter,
                onToggleSubtitle,
                onToggleEpisodesSidebar,
                duration,
            } = refs.current
            const activeEl = document.activeElement as HTMLElement | null
            const isInteractiveElement = activeEl && (
                activeEl.tagName === "INPUT" ||
                activeEl.tagName === "TEXTAREA" ||
                activeEl.tagName === "SELECT" ||
                activeEl.isContentEditable ||
                activeEl.getAttribute("role") === "textbox" ||
                activeEl.getAttribute("role") === "searchbox" ||
                activeEl.getAttribute("role") === "slider" ||
                activeEl.getAttribute("role") === "combobox" ||
                activeEl.getAttribute("role") === "menuitem" ||
                activeEl.getAttribute("role") === "menuitemcheckbox" ||
                activeEl.getAttribute("role") === "menuitemradio" ||
                activeEl.getAttribute("role") === "option"
            )

            if (isInteractiveElement) {
                if (e.key.toLowerCase() === "escape") return
                return
            }

            const isModalOpen = Boolean(document.querySelector('[role="dialog"][aria-modal="true"], [cmdk-root]'))
            if (isModalOpen && e.key.toLowerCase() !== "escape") {
                return
            }

            const key = e.key.toLowerCase()

            // 0-9 percent seeking
            if (/^[0-9]$/.test(key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
                e.preventDefault()
                const video = videoRef.current
                const total = duration || video?.duration || 0
                if (video && Number.isFinite(total) && total > 0) {
                    const pct = parseInt(key, 10) / 10
                    video.currentTime = pct * total
                }
                return
            }

            switch (key) {
                case "e":
                    if (onToggleEpisodesSidebar) {
                        e.preventDefault()
                        onToggleEpisodesSidebar()
                    }
                    break
                case "c":
                    if (onToggleSubtitle) {
                        e.preventDefault()
                        onToggleSubtitle()
                    }
                    break
                case ",":
                    e.preventDefault()
                    const videoComma = videoRef.current
                    if (videoComma) {
                        if (!videoComma.paused) videoComma.pause()
                        videoComma.currentTime = Math.max(0, videoComma.currentTime - 1 / 24)
                    }
                    break
                case ".":
                    e.preventDefault()
                    const videoPeriod = videoRef.current
                    if (videoPeriod) {
                        if (!videoPeriod.paused) videoPeriod.pause()
                        const total = duration || videoPeriod.duration || Infinity
                        videoPeriod.currentTime = Math.min(total, videoPeriod.currentTime + 1 / 24)
                    }
                    break
                case "[":
                    if (skipToPrevChapter) {
                        e.preventDefault()
                        skipToPrevChapter()
                    }
                    break
                case "]":
                    if (skipToNextChapter) {
                        e.preventDefault()
                        skipToNextChapter()
                    }
                    break
                case " ":
                case "k":
                case "mediaplaypause":
                    e.preventDefault()
                    togglePlay()
                    break
                case "arrowleft":
                case "j":
                    e.preventDefault()
                    if (e.shiftKey) {
                        skipTime(-10)
                    } else {
                        skipTime(-5)
                    }
                    break
                case "arrowright":
                case "l":
                    e.preventDefault()
                    if (e.shiftKey) {
                        skipOpening()
                    } else {
                        skipTime(5)
                    }
                    break
                case "arrowup":
                    e.preventDefault()
                    const videoUp = videoRef.current
                    if (videoUp) {
                        const newVol = Math.min(videoUp.volume + 0.1, 1)
                        setVideoVolume(videoUp, newVol)
                        setVolume(newVol)
                        setIsMuted(false)
                        setVideoMuted(videoUp, false)
                        useAppStore.getState().setPlayerVolume(newVol)
                    }
                    break
                case "arrowdown":
                    e.preventDefault()
                    const videoDown = videoRef.current
                    if (videoDown) {
                        const newVol = Math.max(videoDown.volume - 0.1, 0)
                        setVideoVolume(videoDown, newVol)
                        setVolume(newVol)
                        setIsMuted(newVol === 0)
                        setVideoMuted(videoDown, newVol === 0)
                        useAppStore.getState().setPlayerVolume(newVol)
                    }
                    break
                case "m":
                    e.preventDefault()
                    toggleMute()
                    break
                case "f":
                case "f11":
                    e.preventDefault()
                    toggleFullscreen()
                    break
                case "s":
                    if (skipMode !== null) {
                        e.preventDefault()
                        handleSkipIntro()
                    }
                    break
                case "n":
                case "medianexttrack":
                    if (showNextEpisode && onNextEpisode) {
                        e.preventDefault()
                        onNextEpisode()
                    }
                    break
                case "o":
                    e.preventDefault()
                    setIsSettingsOpen((prev) => !prev)
                    break
                case "i":
                    e.preventDefault()
                    togglePip()
                    break
                case "g":
                    e.preventDefault()
                    takeScreenshot()
                    break
                case "v":
                    e.preventDefault()
                    setShowStats((prev) => !prev)
                    break
                case "escape":
                case "browserback":
                case "backspace":
                    e.preventDefault()
                    if (isFullscreen) {
                        toggleFullscreen()
                    } else {
                        onClose()
                    }
                    break
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [])
}
