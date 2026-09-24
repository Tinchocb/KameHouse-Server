import { useEffect, useRef } from "react"

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
    toggleMute: () => void
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
    onToggleQueueSidebar?: () => void
    duration?: number
    handleVolume: (e: React.ChangeEvent<HTMLInputElement> | number) => void
    onToggleShortcuts?: () => void
    onEscape?: () => void
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
                isFullscreen,
                skipMode,
                showNextEpisode,
                onNextEpisode,
                handleSkipIntro,
                onClose,
                skipOpening,
                skipTime,
                toggleMute,
                togglePlay,
                toggleFullscreen,
                setIsSettingsOpen,
                setShowStats,
                skipToNextChapter,
                skipToPrevChapter,
                onToggleSubtitle,
                onToggleEpisodesSidebar,
                onToggleQueueSidebar,
                onEscape,
                duration,
                handleVolume,
            } = refs.current
            const activeEl = document.activeElement as HTMLElement | null
            // Un range (barra de progreso, volumen) solo necesita las flechas,
            // Inicio/Fin y RePág/AvPág; el resto de los atajos debe seguir andando.
            const isRangeInput = activeEl?.tagName === "INPUT" && (activeEl as HTMLInputElement).type === "range"
            const rangeOwnsKey = isRangeInput && ["arrowleft", "arrowright", "arrowup", "arrowdown", "home", "end", "pageup", "pagedown"].includes(e.key.toLowerCase())
            const isInteractiveElement = activeEl && !(isRangeInput && !rangeOwnsKey) && (
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
                case "q":
                    if (onToggleQueueSidebar) {
                        e.preventDefault()
                        onToggleQueueSidebar()
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
                case "j":
                    e.preventDefault()
                    skipTime(-10)
                    break
                case "l":
                    e.preventDefault()
                    skipTime(10)
                    break
                case "arrowleft":
                    e.preventDefault()
                    if (e.shiftKey) {
                        skipTime(-10)
                    } else {
                        skipTime(-5)
                    }
                    break
                case "arrowright":
                    e.preventDefault()
                    if (e.shiftKey) {
                        skipOpening()
                    } else {
                        skipTime(5)
                    }
                    break
                case "arrowup":
                    e.preventDefault()
                    if (videoRef.current) {
                        handleVolume(Math.min(videoRef.current.volume + 0.1, 1))
                    }
                    break
                case "arrowdown":
                    e.preventDefault()
                    if (videoRef.current) {
                        handleVolume(Math.max(videoRef.current.volume - 0.1, 0))
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
                case "v":
                    e.preventDefault()
                    setShowStats((prev) => !prev)
                    break
                case "?":
                    e.preventDefault()
                    refs.current.onToggleShortcuts?.()
                    break
                case "/":
                    if (e.shiftKey) {
                        e.preventDefault()
                        refs.current.onToggleShortcuts?.()
                    }
                    break
                case "escape":
                case "browserback":
                    e.preventDefault()
                    if (onEscape) {
                        onEscape()
                    } else if (isFullscreen) {
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
