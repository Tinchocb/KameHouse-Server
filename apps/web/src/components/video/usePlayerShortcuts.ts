import { useEffect } from "react"

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
}

export function usePlayerShortcuts({
    videoRef,
    isPlaying,
    isMuted,
    volume,
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
}: UsePlayerShortcutsProps) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (
                document.activeElement?.tagName === "INPUT" ||
                document.activeElement?.tagName === "SELECT" ||
                document.activeElement?.tagName === "TEXTAREA"
            ) {
                return
            }

            switch (e.key.toLowerCase()) {
                case " ":
                case "k":
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
                        videoUp.volume = newVol
                        setVolume(newVol)
                        setIsMuted(false)
                        videoUp.muted = false
                    }
                    break
                case "arrowdown":
                    e.preventDefault()
                    const videoDown = videoRef.current
                    if (videoDown) {
                        const newVol = Math.max(videoDown.volume - 0.1, 0)
                        videoDown.volume = newVol
                        setVolume(newVol)
                        setIsMuted(newVol === 0)
                        videoDown.muted = newVol === 0
                    }
                    break
                case "m":
                    e.preventDefault()
                    toggleMute()
                    break
                case "f":
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
    }, [
        isPlaying,
        isMuted,
        volume,
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
        videoRef,
    ])
}
