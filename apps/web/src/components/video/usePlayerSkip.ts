import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useAniSkipTimes } from "@/api/hooks/aniskip.hooks"
import type { PlayerCoreProps } from "./player-core.types"

interface UsePlayerSkipProps {
    videoRef: React.RefObject<HTMLVideoElement | null>
    playableUrl: string
    duration: number
    isPlaying: boolean
    malId?: number | null
    episodeNumber?: number
    chapters: { startTime: number; endTime: number; name: string; type?: string }[]
    mediaFormat?: string | null
    autoSkipIntroPref: boolean
    autoSkipOutroPref: boolean
    marathonMode: boolean
    tvMode: boolean
    hasNextEpisode: boolean
    onNextEpisode?: () => void
    setAutoSkipIntro: (val: boolean) => void
    setAutoSkipOutro: (val: boolean) => void
    setMarathonMode: (val: boolean) => void
    setTvMode: (val: boolean) => void
    triggerControlsVisibility: () => void
}

export function usePlayerSkip({
    videoRef,
    playableUrl,
    duration,
    isPlaying,
    malId,
    episodeNumber,
    chapters,
    mediaFormat,
    autoSkipIntroPref,
    autoSkipOutroPref,
    marathonMode,
    tvMode,
    hasNextEpisode,
    onNextEpisode,
    setAutoSkipIntro,
    setAutoSkipOutro,
    setMarathonMode,
    setTvMode,
    triggerControlsVisibility
}: UsePlayerSkipProps) {
    const hasAutoSkippedIntroRef = useRef(false)
    const hasAutoSkippedOutroRef = useRef(false)
    const toastTimerRef = useRef<NodeJS.Timeout | null>(null)
    const nextEpisodeTimerRef = useRef<NodeJS.Timeout | null>(null)
    const hasTriggeredNextEpisodeRef = useRef<boolean>(false)

    const [skipMode, setSkipMode] = useState<"intro" | "outro" | null>(null)
    const [skipRemainingSeconds, setSkipRemainingSeconds] = useState(0)
    const [segmentProgress, setSegmentProgress] = useState(0)
    const [showNextEpisode, setShowNextEpisode] = useState(false)
    const [countdownSeconds, setCountdownSeconds] = useState(10)
    const [showAutoSkipToast, setShowAutoSkipToast] = useState<"intro" | "outro" | null>(null)
    const [activeChapter, setActiveChapter] = useState<string | null>(null)

    const { data: skipTimes } = useAniSkipTimes({
        malId: malId ?? null,
        episodeNumber: episodeNumber ?? null,
        episodeDuration: duration > 0 ? duration : undefined,
        enabled: !!(malId && episodeNumber),
    })

    const skipTimesOp = useMemo(() => {
        if (skipTimes?.op) return skipTimes.op
        const opChap = chapters.find(c => c.type === "opening" || c.name.toLowerCase().includes("op") || c.name.toLowerCase().includes("opening"))
        if (opChap) {
            return { startTime: opChap.startTime, endTime: opChap.endTime }
        }
        return undefined
    }, [skipTimes, chapters])

    const skipTimesEd = useMemo(() => {
        if (skipTimes?.ed) return skipTimes.ed
        const edChap = chapters.find(c => c.type === "ending" || c.name.toLowerCase().includes("ed") || c.name.toLowerCase().includes("ending") || c.name.toLowerCase().includes("outro"))
        if (edChap) {
            return { startTime: edChap.startTime, endTime: edChap.endTime }
        }
        return undefined
    }, [skipTimes, chapters])

    const triggerToast = useCallback((type: "intro" | "outro") => {
        setShowAutoSkipToast(type)
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        toastTimerRef.current = setTimeout(() => setShowAutoSkipToast(null), 3000)
    }, [])

    const checkManualSkipOverrides = useCallback((target: number) => {
        const video = videoRef.current
        if (!video) return
        const total = video.duration
        const isTvSeries = !mediaFormat || mediaFormat === "TV" || mediaFormat === "TV_SHORT"

        // Check intro override
        if (skipTimesOp) {
            if (target >= skipTimesOp.startTime && target < skipTimesOp.endTime) {
                hasAutoSkippedIntroRef.current = true
            }
        } else if (isTvSeries) {
            if (target >= 0 && target < 120) {
                hasAutoSkippedIntroRef.current = true
            }
        }

        // Check outro override
        if (skipTimesEd) {
            if (target >= skipTimesEd.startTime && target < skipTimesEd.endTime) {
                hasAutoSkippedOutroRef.current = true
            }
        } else if (isTvSeries && total > 300) {
            if (target >= total - 120 && target < total - 5) {
                hasAutoSkippedOutroRef.current = true
            }
        }
    }, [skipTimesOp, skipTimesEd, mediaFormat])

    const skipOpening = useCallback(() => {
        const video = videoRef.current
        if (!video) return
        video.currentTime = Math.min(video.duration, video.currentTime + 85)
        triggerControlsVisibility()
    }, [videoRef, triggerControlsVisibility])

    const skipToNextChapter = useCallback(() => {
        const video = videoRef.current
        if (!video || chapters.length === 0) return
        const curr = video.currentTime
        const next = chapters.find(c => c.startTime > curr + 0.5)
        if (next) {
            const target = next.startTime
            checkManualSkipOverrides(target)
            video.currentTime = target
            triggerControlsVisibility()
        }
    }, [videoRef, chapters, checkManualSkipOverrides, triggerControlsVisibility])

    const skipToPrevChapter = useCallback(() => {
        const video = videoRef.current
        if (!video || chapters.length === 0) return
        const curr = video.currentTime
        const prevs = chapters.filter(c => c.startTime < curr - 1.5)
        let target = 0
        if (prevs.length > 0) {
            const prev = prevs[prevs.length - 1]
            target = prev.startTime
        } else {
            target = 0
        }
        checkManualSkipOverrides(target)
        video.currentTime = target
        triggerControlsVisibility()
    }, [videoRef, chapters, checkManualSkipOverrides, triggerControlsVisibility])

    const handleSetAutoSkipIntro = useCallback((val: boolean) => {
        setAutoSkipIntro(val)
        const video = videoRef.current
        if (video && val) {
            const curr = video.currentTime
            const isTvSeries = !mediaFormat || mediaFormat === "TV" || mediaFormat === "TV_SHORT"
            
            if (skipTimesOp) {
                const { startTime, endTime } = skipTimesOp
                if (curr >= startTime && curr < endTime) {
                    video.currentTime = endTime
                    setSkipMode(null)
                    return
                }
            } else if (isTvSeries) {
                const introTarget = curr < 30 ? 90 : 120
                if (curr >= 0 && curr < introTarget) {
                    video.currentTime = introTarget
                    setSkipMode(null)
                    return
                }
            }
        }
    }, [videoRef, setAutoSkipIntro, skipTimesOp, mediaFormat])

    const handleSetAutoSkipOutro = useCallback((val: boolean) => {
        setAutoSkipOutro(val)
        const video = videoRef.current
        if (video && val) {
            const curr = video.currentTime
            const total = video.duration
            const isTvSeries = !mediaFormat || mediaFormat === "TV" || mediaFormat === "TV_SHORT"

            if (skipTimesEd) {
                const { startTime, endTime } = skipTimesEd
                if (!skipTimesOp || curr >= skipTimesOp.endTime) {
                    if (curr >= startTime && curr < endTime) {
                        video.currentTime = endTime
                        setSkipMode(null)
                        return
                    }
                }
            } else if (isTvSeries && total > 300) {
                const outroStart = total - 120
                const outroEnd = total - 5
                const opEndTime = skipTimesOp ? skipTimesOp.endTime : 120
                if (curr >= opEndTime) {
                    if (curr >= outroStart && curr < outroEnd) {
                        video.currentTime = outroEnd
                        setSkipMode(null)
                        return
                    }
                }
            }
        }
    }, [videoRef, setAutoSkipOutro, skipTimesOp, skipTimesEd, mediaFormat])

    const handleSetMarathonMode = useCallback((val: boolean) => {
        setMarathonMode(val)
        if (val && showNextEpisode && countdownSeconds === 0 && onNextEpisode) {
            onNextEpisode()
        }
    }, [setMarathonMode, showNextEpisode, countdownSeconds, onNextEpisode])

    const handleSetTvMode = useCallback((val: boolean) => {
        setTvMode(val)
        if (val) {
            setAutoSkipIntro(true)
            setAutoSkipOutro(true)
            setMarathonMode(true)
        }
    }, [setTvMode, setAutoSkipIntro, setAutoSkipOutro, setMarathonMode])

    const handleSkipIntro = useCallback(() => {
        const video = videoRef.current
        if (!video) return
        const curr = video.currentTime
        const total = video.duration
        const isTvSeries = !mediaFormat || mediaFormat === "TV" || mediaFormat === "TV_SHORT"

        const activeMode = skipMode || (curr < 120 ? "intro" : "outro")

        if (activeMode === "intro") {
            if (skipTimesOp && curr >= skipTimesOp.startTime && curr < skipTimesOp.endTime) {
                video.currentTime = skipTimesOp.endTime
            } else if (isTvSeries) {
                video.currentTime = 120
            }
        } else if (activeMode === "outro") {
            if (skipTimesEd && curr >= skipTimesEd.startTime && curr < skipTimesEd.endTime) {
                video.currentTime = skipTimesEd.endTime
            } else if (isTvSeries && total > 300) {
                video.currentTime = total - 5
            }
        }
        setSkipMode(null)
    }, [videoRef, skipMode, skipTimesOp, skipTimesEd, mediaFormat])

    const processTimeUpdates = useCallback((curr: number, total: number) => {
        const video = videoRef.current
        if (!video) return

        if (chapters.length > 0) {
            const current = chapters.find(c => curr >= c.startTime && curr < c.endTime)
            const name = current ? current.name : null
            if (activeChapter !== name) {
                setActiveChapter(name)
            }
        }

        // Reset the auto-skip flags when outside the respective windows
        if (skipTimesOp) {
            if (curr < skipTimesOp.startTime || curr >= skipTimesOp.endTime) {
                hasAutoSkippedIntroRef.current = false
            }
        } else {
            const isTvSeries = !mediaFormat || mediaFormat === "TV" || mediaFormat === "TV_SHORT"
            if (isTvSeries) {
                if (curr < 0 || curr >= 120) {
                    hasAutoSkippedIntroRef.current = false
                }
            }
        }

        if (skipTimesEd) {
            if (curr < skipTimesEd.startTime || curr >= skipTimesEd.endTime) {
                hasAutoSkippedOutroRef.current = false
            }
        } else {
            const isTvSeries = !mediaFormat || mediaFormat === "TV" || mediaFormat === "TV_SHORT"
            if (isTvSeries && total > 300) {
                if (curr < total - 120 || curr >= total - 5) {
                    hasAutoSkippedOutroRef.current = false
                }
            }
        }

        const isTvSeries = !mediaFormat || mediaFormat === "TV" || mediaFormat === "TV_SHORT"

        // OP / Intro window
        let activeOp = skipTimesOp
        if (!activeOp && isTvSeries) {
            activeOp = { startTime: 0, endTime: 120 }
        }

        if (activeOp) {
            const { startTime, endTime } = activeOp
            const inOpWindow = curr >= startTime && curr < endTime
            if (autoSkipIntroPref && inOpWindow && !hasAutoSkippedIntroRef.current) {
                hasAutoSkippedIntroRef.current = true
                video.currentTime = endTime
                setSkipMode(null)
                triggerToast("intro")
                return
            }
            if (inOpWindow) {
                const remaining = Math.ceil(endTime - curr)
                const progress = Math.round(((curr - startTime) / (endTime - startTime)) * 100)
                if (skipMode !== "intro") setSkipMode("intro")
                if (skipRemainingSeconds !== remaining) setSkipRemainingSeconds(remaining)
                if (segmentProgress !== progress) setSegmentProgress(progress)
            } else if (skipMode === "intro") {
                setSkipMode(null)
            }
        }

        // ED / Outro window
        let activeEd = skipTimesEd
        if (!activeEd && isTvSeries && total > 300) {
            activeEd = { startTime: total - 120, endTime: total - 5 }
        }

        if (activeEd) {
            const { startTime, endTime } = activeEd
            const inEdWindow = curr >= startTime && curr < endTime
            if (autoSkipOutroPref && inEdWindow && !hasAutoSkippedOutroRef.current) {
                hasAutoSkippedOutroRef.current = true
                video.currentTime = endTime
                setSkipMode(null)
                triggerToast("outro")
                return
            }
            const opEnd = activeOp ? activeOp.endTime : 120
            if (curr >= opEnd) {
                if (inEdWindow) {
                    const remaining = Math.ceil(endTime - curr)
                    const progress = Math.round(((curr - startTime) / (endTime - startTime)) * 100)
                    if (skipMode !== "outro") setSkipMode("outro")
                    if (skipRemainingSeconds !== remaining) setSkipRemainingSeconds(remaining)
                    if (segmentProgress !== progress) setSegmentProgress(progress)
                } else if (skipMode === "outro") {
                    setSkipMode(null)
                }
            }
        }

        // Next episode trigger
        const ed = skipTimesEd
        const edTriggered = ed ? curr >= ed.startTime : false

        const shouldShowNext =
            (total > 0 && total - curr <= 30) ||
            (edTriggered && hasNextEpisode)

        if (shouldShowNext && hasNextEpisode) {
            if (!showNextEpisode) {
                setShowNextEpisode(true)
                setCountdownSeconds(10)
            }
        } else {
            if (showNextEpisode) setShowNextEpisode(false)
        }
    }, [videoRef, skipTimesOp, skipTimesEd, autoSkipIntroPref, autoSkipOutroPref, skipMode, skipRemainingSeconds, segmentProgress, showNextEpisode, hasNextEpisode, mediaFormat, chapters, activeChapter, triggerToast])

    useEffect(() => {
        if (!showNextEpisode) {
            hasTriggeredNextEpisodeRef.current = false
        }
    }, [showNextEpisode])

    useEffect(() => {
        if (showNextEpisode && countdownSeconds > 0 && isPlaying) {
            if (tvMode && onNextEpisode) {
                if (!hasTriggeredNextEpisodeRef.current) {
                    hasTriggeredNextEpisodeRef.current = true
                    onNextEpisode()
                }
            } else {
                nextEpisodeTimerRef.current = setTimeout(() => {
                    setCountdownSeconds((c) => c - 1)
                }, 1000)
            }
        } else if (showNextEpisode && countdownSeconds === 0 && marathonMode && onNextEpisode) {
            if (!hasTriggeredNextEpisodeRef.current) {
                hasTriggeredNextEpisodeRef.current = true
                onNextEpisode()
            }
        }

        return () => {
            if (nextEpisodeTimerRef.current) clearTimeout(nextEpisodeTimerRef.current)
        }
    }, [showNextEpisode, countdownSeconds, isPlaying, marathonMode, tvMode, onNextEpisode])

    const remainingProgress = useMemo(() => {
        return (countdownSeconds / 10) * 100
    }, [countdownSeconds])

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
            if (nextEpisodeTimerRef.current) clearTimeout(nextEpisodeTimerRef.current)
        }
    }, [])

    return {
        skipTimesOp,
        skipTimesEd,
        skipMode,
        skipRemainingSeconds,
        segmentProgress,
        showNextEpisode,
        countdownSeconds,
        showAutoSkipToast,
        activeChapter,
        remainingProgress,
        skipOpening,
        skipToNextChapter,
        skipToPrevChapter,
        handleSetAutoSkipIntro,
        handleSetAutoSkipOutro,
        handleSetMarathonMode,
        handleSetTvMode,
        handleSkipIntro,
        processTimeUpdates,
        checkManualSkipOverrides
    }
}
