import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useAniSkipTimes } from "@/api/hooks/aniskip.hooks"
import { useAppStore } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
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
    tvMode: boolean
    hasNextEpisode: boolean
    onNextEpisode?: () => void
    setAutoSkipIntro: (val: boolean) => void
    setAutoSkipOutro: (val: boolean) => void
    setTvMode: (val: boolean) => void
    triggerControlsVisibility: () => void
}

// Helper to set DOM properties without triggering React Compiler parameter mutation rules
function setVideoCurrentTime(video: HTMLVideoElement, time: number) {
    video.currentTime = time
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
    tvMode,
    hasNextEpisode,
    onNextEpisode,
    setAutoSkipIntro,
    setAutoSkipOutro,
    setTvMode,
    triggerControlsVisibility
}: UsePlayerSkipProps) {
    const { seriesSkipTimes, saveSeriesSkipTimes } = useAppStore(
        useShallow(state => ({
            seriesSkipTimes: state.seriesSkipTimes,
            saveSeriesSkipTimes: state.saveSeriesSkipTimes
        }))
    )

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
    const [showAutoSkipToast, setShowAutoSkipToast] = useState<"intro" | "outro" | "pause" | null>(null)
    const [activeChapter, setActiveChapter] = useState<string | null>(null)

    // Synchronize video ended and current time into state to avoid accessing ref during render
    const [videoTime, setVideoTime] = useState(0)
    const [videoEnded, setVideoEnded] = useState(false)

    useEffect(() => {
        hasAutoSkippedIntroRef.current = false
        hasAutoSkippedOutroRef.current = false
        hasTriggeredNextEpisodeRef.current = false
        setShowNextEpisode(false)
        setCountdownSeconds(3)
        setSkipMode(null)
    }, [episodeNumber, playableUrl])

    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        const handleTimeUpdate = () => {
            setVideoTime(video.currentTime)
        }
        const handleEnded = () => {
            setVideoEnded(true)
        }
        const handlePlay = () => {
            setVideoEnded(false)
        }
        const handleSeeked = () => {
            setVideoEnded(video.ended)
            setVideoTime(video.currentTime)
        }

        video.addEventListener("timeupdate", handleTimeUpdate)
        video.addEventListener("ended", handleEnded)
        video.addEventListener("play", handlePlay)
        video.addEventListener("seeked", handleSeeked)

        // Initialize state
        setVideoTime(video.currentTime)
        setVideoEnded(video.ended)

        return () => {
            video.removeEventListener("timeupdate", handleTimeUpdate)
            video.removeEventListener("ended", handleEnded)
            video.removeEventListener("play", handlePlay)
            video.removeEventListener("seeked", handleSeeked)
        }
    }, [videoRef])

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
        if (malId) {
            const cached = seriesSkipTimes[String(malId)]
            if (cached && typeof cached.opStart === "number" && typeof cached.opEnd === "number") {
                return { startTime: cached.opStart, endTime: cached.opEnd }
            }
        }
        return undefined
    }, [skipTimes, chapters, malId, seriesSkipTimes])

    const skipTimesEd = useMemo(() => {
        if (skipTimes?.ed) return skipTimes.ed
        const edChap = chapters.find(c => c.type === "ending" || c.name.toLowerCase().includes("ed") || c.name.toLowerCase().includes("ending") || c.name.toLowerCase().includes("outro"))
        if (edChap) {
            return { startTime: edChap.startTime, endTime: edChap.endTime }
        }
        if (malId && duration > 0) {
            const cached = seriesSkipTimes[String(malId)]
            if (cached && typeof cached.edOffset === "number") {
                return { startTime: duration - cached.edOffset, endTime: duration }
            }
        }
        return undefined
    }, [skipTimes, chapters, malId, duration, seriesSkipTimes])

    // Auto-learning: save resolved skip times to the series cache
    useEffect(() => {
        if (!malId || duration <= 0) return

        const cached = seriesSkipTimes[String(malId)]
        
        let opStart = cached?.opStart
        let opEnd = cached?.opEnd
        let edOffset = cached?.edOffset

        // Resolve opening
        if (skipTimes?.op) {
            opStart = skipTimes.op.startTime
            opEnd = skipTimes.op.endTime
        } else {
            const opChap = chapters.find(c => c.type === "opening" || c.name.toLowerCase().includes("op") || c.name.toLowerCase().includes("opening"))
            if (opChap) {
                opStart = opChap.startTime
                opEnd = opChap.endTime
            }
        }

        // Resolve ending
        if (skipTimes?.ed) {
            edOffset = duration - skipTimes.ed.startTime
        } else {
            const edChap = chapters.find(c => c.type === "ending" || c.name.toLowerCase().includes("ed") || c.name.toLowerCase().includes("ending") || c.name.toLowerCase().includes("outro"))
            if (edChap) {
                edOffset = duration - edChap.startTime
            }
        }

        if (typeof opStart === "number" && typeof opEnd === "number" && typeof edOffset === "number") {
            // Only update if something changed to avoid infinite loop
            if (cached?.opStart !== opStart || cached?.opEnd !== opEnd || cached?.edOffset !== edOffset) {
                saveSeriesSkipTimes(malId, opStart, opEnd, edOffset)
            }
        }
    }, [malId, duration, skipTimes, chapters, seriesSkipTimes, saveSeriesSkipTimes])

    const triggerToast = useCallback((type: "intro" | "outro" | "pause") => {
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
            if (target >= 0 && target < 90) {
                hasAutoSkippedIntroRef.current = true
            }
        }

        // Check outro override
        if (skipTimesEd) {
            if (target >= skipTimesEd.startTime && target < skipTimesEd.endTime) {
                hasAutoSkippedOutroRef.current = true
            }
        } else if (isTvSeries && total > 300) {
            if (target >= total - 95 && target < total - 5) {
                hasAutoSkippedOutroRef.current = true
            }
        }
    }, [skipTimesOp, skipTimesEd, mediaFormat, videoRef])

    const skipOpening = useCallback(() => {
        const video = videoRef.current
        if (!video) return
        setVideoCurrentTime(video, Math.min(video.duration, video.currentTime + 85))
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
            setVideoCurrentTime(video, target)
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
        setVideoCurrentTime(video, target)
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
                    setVideoCurrentTime(video, endTime)
                    setSkipMode(null)
                    return
                }
            } else if (isTvSeries) {
                const introTarget = 90
                if (curr >= 0 && curr < introTarget) {
                    setVideoCurrentTime(video, introTarget)
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
                        setVideoCurrentTime(video, endTime)
                        setSkipMode(null)
                        return
                    }
                }
            } else if (isTvSeries && total > 300) {
                const outroStart = total - 95
                const outroEnd = total - 5
                const opEndTime = skipTimesOp ? skipTimesOp.endTime : 90
                if (curr >= opEndTime) {
                    if (curr >= outroStart && curr < outroEnd) {
                        setVideoCurrentTime(video, outroEnd)
                        setSkipMode(null)
                        return
                    }
                }
            }
        }
    }, [videoRef, setAutoSkipOutro, skipTimesOp, skipTimesEd, mediaFormat])

    const handleSetTvMode = useCallback((val: boolean) => {
        setTvMode(val)
        
        const video = videoRef.current
        if (!video) return

        const curr = video.currentTime
        const total = video.duration

        if (val) {
            // 1. Check chapter-based skips if TV mode is enabled
            if (chapters.length > 0) {
                const skippable = chapters.find(c => {
                    if (curr >= c.startTime && curr < c.endTime - 0.5) {
                        const n = c.name.toLowerCase();
                        const isIntro = n.includes("op") || n.includes("opening") || c.type === "opening";
                        const isOutro = n.includes("ed") || n.includes("ending") || n.includes("credits") || n.includes("créditos") || c.type === "ending";
                        
                        if (isIntro) return autoSkipIntroPref;
                        if (isOutro) return autoSkipOutroPref;

                        return (
                            n.includes("eyecatch") || n.includes("eye-catch") || n.includes("commercial") ||
                            n.includes("sponsor") || n.includes("recap") || n.includes("preview") ||
                            n.includes("title card") || n.includes("titlecard") || n.includes("avance") ||
                            n.includes("adelanto") || n.includes("publicidad") || n.includes("patrocinio") ||
                            n.includes("resumen") || n.includes("intermedio") || n.includes("prologue") ||
                            n.includes("prólogo") || n.includes("sponsors") || n.includes("title") ||
                            n.includes("título") || c.type === "sponsor" || c.type === "recap" ||
                            c.type === "preview"
                        );
                    }
                    return false;
                });

                if (skippable) {
                    setVideoCurrentTime(video, skippable.endTime);
                    triggerToast("pause");
                    triggerControlsVisibility();
                    return;
                }
            }

            // 2. Check general OP/ED auto-skips if TV mode is enabled
            const isTvSeries = !mediaFormat || mediaFormat === "TV" || mediaFormat === "TV_SHORT"
            let activeOp = skipTimesOp
            if (!activeOp && isTvSeries) {
                activeOp = { startTime: 0, endTime: 120 }
            }
            if (activeOp && autoSkipIntroPref && curr >= activeOp.startTime && curr < activeOp.endTime && !hasAutoSkippedIntroRef.current) {
                hasAutoSkippedIntroRef.current = true
                setVideoCurrentTime(video, activeOp.endTime)
                setSkipMode(null)
                triggerToast("intro")
                triggerControlsVisibility()
                return
            }

            let activeEd = skipTimesEd
            if (!activeEd && isTvSeries && total > 300) {
                activeEd = { startTime: total - 120, endTime: total - 5 }
            }
            if (activeEd && autoSkipOutroPref && curr >= activeEd.startTime && curr < activeEd.endTime && !hasAutoSkippedOutroRef.current) {
                hasAutoSkippedOutroRef.current = true
                setVideoCurrentTime(video, activeEd.endTime)
                setSkipMode(null)
                triggerToast("outro")
                triggerControlsVisibility()
                return
            }
        }
        
        triggerControlsVisibility()
    }, [setTvMode, videoRef, chapters, autoSkipIntroPref, autoSkipOutroPref, skipTimesOp, skipTimesEd, mediaFormat, triggerToast, triggerControlsVisibility])

    const handleSkipIntro = useCallback(() => {
        const video = videoRef.current
        if (!video) return
        const curr = video.currentTime
        const total = video.duration
        const isTvSeries = !mediaFormat || mediaFormat === "TV" || mediaFormat === "TV_SHORT"

        const activeMode = skipMode || (curr < 120 ? "intro" : "outro")

        if (activeMode === "intro") {
            if (skipTimesOp && curr >= skipTimesOp.startTime && curr < skipTimesOp.endTime) {
                setVideoCurrentTime(video, skipTimesOp.endTime)
            } else if (isTvSeries) {
                setVideoCurrentTime(video, 120)
            }
        } else if (activeMode === "outro") {
            if (skipTimesEd && curr >= skipTimesEd.startTime && curr < skipTimesEd.endTime) {
                setVideoCurrentTime(video, skipTimesEd.endTime)
            } else if (isTvSeries && total > 300) {
                setVideoCurrentTime(video, total - 5)
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

            // TV Mode intermediate pause auto-skip
            if (tvMode) {
                const skippable = chapters.find(c => {
                    if (curr >= c.startTime && curr < c.endTime - 0.5) {
                        const n = c.name.toLowerCase();
                        
                        // Check if it's an intro/opening and user wants to skip intro
                        const isIntro = 
                            n.includes("op") ||
                            n.includes("opening") ||
                            c.type === "opening";
                            
                        // Check if it's an outro/ending/credits and user wants to skip outro
                        const isOutro = 
                            n.includes("ed") ||
                            n.includes("ending") ||
                            n.includes("credits") ||
                            n.includes("créditos") ||
                            c.type === "ending";
                            
                        if (isIntro) {
                            return autoSkipIntroPref;
                        }
                        if (isOutro) {
                            return autoSkipOutroPref;
                        }

                        // Other TV Mode specific intermediate pauses/advertisements
                        return (
                            n.includes("eyecatch") ||
                            n.includes("eye-catch") ||
                            n.includes("commercial") ||
                            n.includes("sponsor") ||
                            n.includes("recap") ||
                            n.includes("preview") ||
                            n.includes("title card") ||
                            n.includes("titlecard") ||
                            n.includes("avance") ||
                            n.includes("adelanto") ||
                            n.includes("publicidad") ||
                            n.includes("patrocinio") ||
                            n.includes("resumen") ||
                            n.includes("intermedio") ||
                            n.includes("prologue") ||
                            n.includes("prólogo") ||
                            n.includes("sponsors") ||
                            n.includes("title") ||
                            n.includes("título") ||
                            c.type === "sponsor" ||
                            c.type === "recap" ||
                            c.type === "preview"
                        );
                    }
                    return false;
                });

                if (skippable) {
                    setVideoCurrentTime(video, skippable.endTime);
                    triggerToast("pause");
                    return;
                }
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
                if (curr < 0 || curr >= 90) {
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
                if (curr < total - 95 || curr >= total - 5) {
                    hasAutoSkippedOutroRef.current = false
                }
            }
        }

        const isTvSeries = !mediaFormat || mediaFormat === "TV" || mediaFormat === "TV_SHORT"

        // OP / Intro window
        let activeOp = skipTimesOp
        if (!activeOp && isTvSeries) {
            activeOp = { startTime: 0, endTime: 90 }
        }

        if (activeOp) {
            const { startTime, endTime } = activeOp
            const inOpWindow = curr >= startTime && curr < endTime
            if (autoSkipIntroPref && inOpWindow && !hasAutoSkippedIntroRef.current) {
                hasAutoSkippedIntroRef.current = true
                setVideoCurrentTime(video, endTime)
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
            activeEd = { startTime: total - 95, endTime: total - 5 }
        }

        if (activeEd) {
            const { startTime, endTime } = activeEd
            const inEdWindow = curr >= startTime && curr < endTime
            if (autoSkipOutroPref && inEdWindow && !hasAutoSkippedOutroRef.current) {
                hasAutoSkippedOutroRef.current = true
                setVideoCurrentTime(video, endTime)
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
            (total > 0 && total - curr <= 15) ||
            (autoSkipOutroPref && edTriggered && hasNextEpisode)

        if (shouldShowNext && hasNextEpisode) {
            if (!showNextEpisode) {
                setShowNextEpisode(true)
                setCountdownSeconds(3)
            }
        } else {
            if (showNextEpisode) setShowNextEpisode(false)
        }
    }, [videoRef, skipTimesOp, skipTimesEd, autoSkipIntroPref, autoSkipOutroPref, skipMode, skipRemainingSeconds, segmentProgress, showNextEpisode, hasNextEpisode, mediaFormat, chapters, activeChapter, triggerToast, tvMode])

    useEffect(() => {
        if (!showNextEpisode) {
            hasTriggeredNextEpisodeRef.current = false
        }
    }, [showNextEpisode])

    const isVideoEnded = videoEnded
    const isVideoPlayingOrEnded = isPlaying || isVideoEnded
    const showCountdown =
        tvMode &&
        isVideoPlayingOrEnded &&
        hasNextEpisode &&
        (isVideoEnded || 
         (autoSkipOutroPref && skipTimesEd ? videoTime >= skipTimesEd.startTime : false) ||
         (duration > 0 && duration - videoTime <= 15))

    useEffect(() => {
        if (showNextEpisode && countdownSeconds > 0 && showCountdown) {
            nextEpisodeTimerRef.current = setTimeout(() => {
                setCountdownSeconds((c) => c - 1)
            }, 1000)
        } else if (showNextEpisode && countdownSeconds === 0 && showCountdown && onNextEpisode) {
            if (!hasTriggeredNextEpisodeRef.current) {
                hasTriggeredNextEpisodeRef.current = true
                onNextEpisode()
            }
        }

        return () => {
            if (nextEpisodeTimerRef.current) clearTimeout(nextEpisodeTimerRef.current)
        }
    }, [showNextEpisode, countdownSeconds, showCountdown, onNextEpisode])

    const remainingProgress = useMemo(() => {
        return (countdownSeconds / 3) * 100
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
        handleSetTvMode,
        handleSkipIntro,
        showCountdown,
        processTimeUpdates,
        checkManualSkipOverrides
    }
}
