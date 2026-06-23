import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useAniSkipTimes, getAniSkipTimes } from "@/api/hooks/aniskip.hooks"
import { useGetSettings } from "@/api/hooks/settings.hooks"
import { usePreloadMediastreamMediaContainer } from "@/api/hooks/mediastream.hooks"
import { useQueryClient } from "@tanstack/react-query"
import { buildSeaQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { useAppStore, useSkipTimesStore } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import { Mediastream_StreamType } from "@/api/generated/types"

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
    hasNextEpisode: boolean
    onNextEpisode?: () => void
    setAutoSkipIntro: (val: boolean) => void
    setAutoSkipOutro: (val: boolean) => void
    triggerControlsVisibility: () => void
    clientId?: string
    nextStreamUrl?: string
    nextStreamType?: "local" | "online" | "direct" | "transcode" | "optimized"
    streamType?: "local" | "online" | "direct" | "transcode" | "optimized"
    mediaId?: number | null
    tvMode: boolean
    setTvMode: (val: boolean) => void
}

// Helper to set DOM properties without triggering React Compiler parameter mutation rules
function setVideoCurrentTime(video: HTMLVideoElement, time: number, lastSeekRef?: React.MutableRefObject<number>) {
    if (!Number.isFinite(time)) {
        console.warn("setVideoCurrentTime ignored non-finite time:", time)
        return
    }
    if (lastSeekRef) {
        lastSeekRef.current = Date.now()
    }
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
    hasNextEpisode,
    onNextEpisode,
    setAutoSkipIntro,
    setAutoSkipOutro,
    triggerControlsVisibility,
    clientId,
    nextStreamUrl,
    nextStreamType,
    streamType,
    mediaId,
    tvMode,
    setTvMode,
}: UsePlayerSkipProps) {
    const { data: settings } = useGetSettings()
    const { mutate: preloadStream } = usePreloadMediastreamMediaContainer()
    const queryClient = useQueryClient()
    const autoPlayNextEpisode = settings?.library?.autoPlayNextEpisode ?? true

    const { marathonMode } = useAppStore(
        useShallow(state => ({
            marathonMode: state.marathonMode,
        }))
    )

    const { seriesSkipTimes, saveSeriesSkipTimes } = useSkipTimesStore(
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
    const hasPreloadedRef = useRef<boolean>(false)
    // Guard: block auto-skip for 1.5s after any manual seek.
    // Without this, a seek into the intro/outro window triggers an
    // immediate auto-skip causing back-to-back currentTime writes
    // which corrupt HLS.js audio decoding.
    const lastManualSeekTimestampRef = useRef<number>(0)

    const [skipMode, setSkipModeState] = useState<"intro" | "outro" | null>(null)
    const skipModeRef = useRef<"intro" | "outro" | null>(null)
    const setSkipMode = useCallback((val: "intro" | "outro" | null) => {
        skipModeRef.current = val
        setSkipModeState(val)
    }, [])

    const [skipRemainingSeconds, setSkipRemainingSecondsState] = useState(0)
    const skipRemainingSecondsRef = useRef(0)
    const setSkipRemainingSeconds = useCallback((val: number) => {
        skipRemainingSecondsRef.current = val
        setSkipRemainingSecondsState(val)
    }, [])

    const [segmentProgress, setSegmentProgressState] = useState(0)
    const segmentProgressRef = useRef(0)
    const setSegmentProgress = useCallback((val: number) => {
        segmentProgressRef.current = val
        setSegmentProgressState(val)
    }, [])

    const [showNextEpisode, setShowNextEpisodeState] = useState(false)
    const showNextEpisodeRef = useRef(false)
    const setShowNextEpisode = useCallback((val: boolean) => {
        showNextEpisodeRef.current = val
        setShowNextEpisodeState(val)
    }, [])

    const [showAutoSkipToast, setShowAutoSkipToast] = useState<"intro" | "outro" | "pause" | null>(null)

    const [activeChapter, setActiveChapterState] = useState<string | null>(null)
    const activeChapterRef = useRef<string | null>(null)
    const setActiveChapter = useCallback((val: string | null) => {
        activeChapterRef.current = val
        setActiveChapterState(val)
    }, [])

    const [countdownSeconds, setCountdownSeconds] = useState(5)
    const [showCountdown, setShowCountdown] = useState(false)
    const [videoEnded, setVideoEnded] = useState(false)

    const currentEpisodeKey = `${episodeNumber}_${playableUrl}`
    useEffect(() => {
        setShowNextEpisode(false)
        setSkipMode(null)
        setShowCountdown(false)
        hasAutoSkippedIntroRef.current = false
        hasAutoSkippedOutroRef.current = false
        hasTriggeredNextEpisodeRef.current = false
        hasPreloadedRef.current = false
    }, [currentEpisodeKey])

    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        const handleEnded = () => {
            setVideoEnded(true)
        }
        const handlePlay = () => {
            setVideoEnded(false)
        }
        const handleSeeked = () => {
            setVideoEnded(video.ended)
        }

        video.addEventListener("ended", handleEnded)
        video.addEventListener("play", handlePlay)
        video.addEventListener("seeked", handleSeeked)

        // Initialize state
        setVideoEnded(video.ended)

        return () => {
            video.removeEventListener("ended", handleEnded)
            video.removeEventListener("play", handlePlay)
            video.removeEventListener("seeked", handleSeeked)
        }
    }, [videoRef])

    const { data: skipTimes } = useAniSkipTimes({
        malId: malId ?? null,
        episodeNumber: episodeNumber ?? null,
        episodeDuration: duration > 0 ? duration : undefined,
        enabled: !!((malId || mediaId) && episodeNumber),
        mediaId: mediaId ?? null,
    })

    const skipTimesOp = useMemo(() => {
        if (skipTimes?.op) return skipTimes.op
        const opChap = chapters.find(c => {
            const n = c.name.toLowerCase()
            return c.type === "opening" ||
                /^(op\d*|opening\d*|intro\d*)\b/i.test(n) ||
                /\b(op\d*|opening\d*|intro\d*)\b/i.test(n)
        })
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
        const edChap = chapters.find(c => {
            const n = c.name.toLowerCase()
            return c.type === "ending" ||
                /^(ed\d*|ending\d*|credits|créditos|outro\d*)\b/i.test(n) ||
                /\b(ed\d*|ending\d*|credits|créditos|outro\d*)\b/i.test(n)
        })
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

        if (skipTimes?.op) {
            opStart = skipTimes.op.startTime
            opEnd = skipTimes.op.endTime
        } else {
            const opChap = chapters.find(c => {
                const n = c.name.toLowerCase()
                return c.type === "opening" ||
                    /^(op\d*|opening\d*|intro\d*)\b/i.test(n) ||
                    /\b(op\d*|opening\d*|intro\d*)\b/i.test(n)
            })
            if (opChap) {
                opStart = opChap.startTime
                opEnd = opChap.endTime
            }
        }

        // Resolve ending
        if (skipTimes?.ed) {
            edOffset = duration - skipTimes.ed.startTime
        } else {
            const edChap = chapters.find(c => {
                const n = c.name.toLowerCase()
                return c.type === "ending" ||
                    /^(ed\d*|ending\d*|credits|créditos|outro\d*)\b/i.test(n) ||
                    /\b(ed\d*|ending\d*|credits|créditos|outro\d*)\b/i.test(n)
            })
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

        // Mark this moment as a manual seek to suppress auto-skip briefly
        lastManualSeekTimestampRef.current = Date.now()

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
        setVideoCurrentTime(video, Math.min(video.duration, video.currentTime + 85), lastManualSeekTimestampRef)
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
            setVideoCurrentTime(video, target, lastManualSeekTimestampRef)
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
        setVideoCurrentTime(video, target, lastManualSeekTimestampRef)
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
                    setVideoCurrentTime(video, endTime, lastManualSeekTimestampRef)
                    setSkipMode(null)
                    return
                }
            } else if (isTvSeries) {
                const introTarget = 90
                if (curr >= 0 && curr < introTarget) {
                    setVideoCurrentTime(video, introTarget, lastManualSeekTimestampRef)
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
                        setVideoCurrentTime(video, endTime, lastManualSeekTimestampRef)
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
                        setVideoCurrentTime(video, outroEnd, lastManualSeekTimestampRef)
                        setSkipMode(null)
                        return
                    }
                }
            }
        }
    }, [videoRef, setAutoSkipOutro, skipTimesOp, skipTimesEd, mediaFormat])

    const handleSetTvMode = useCallback((val: boolean) => {
        setTvMode(val)
    }, [setTvMode])

    const handleSkipIntro = useCallback(() => {
        const video = videoRef.current
        if (!video) return
        const curr = video.currentTime
        const total = video.duration
        const isTvSeries = !mediaFormat || mediaFormat === "TV" || mediaFormat === "TV_SHORT"

        const activeMode = skipMode || (curr < 120 ? "intro" : "outro")

        if (activeMode === "intro") {
            if (skipTimesOp && curr >= skipTimesOp.startTime && curr < skipTimesOp.endTime) {
                setVideoCurrentTime(video, skipTimesOp.endTime, lastManualSeekTimestampRef)
            } else if (isTvSeries) {
                setVideoCurrentTime(video, 120, lastManualSeekTimestampRef)
            }
        } else if (activeMode === "outro") {
            if (skipTimesEd && curr >= skipTimesEd.startTime && curr < skipTimesEd.endTime) {
                setVideoCurrentTime(video, skipTimesEd.endTime, lastManualSeekTimestampRef)
            } else if (isTvSeries && total > 300) {
                setVideoCurrentTime(video, total - 5, lastManualSeekTimestampRef)
            }
        }
        setSkipMode(null)
    }, [videoRef, skipMode, skipTimesOp, skipTimesEd, mediaFormat])

    const processTimeUpdates = useCallback((curr: number, total: number) => {
        const video = videoRef.current
        if (!video) return

        // ── Seek guard ────────────────────────────────────────────────────────────
        // Do NOT fire any auto-skip for 1.5s after a manual seek.
        // A seek already positions currentTime where the user wants; firing another
        // currentTime write immediately after causes HLS.js to issue a second seek
        // request while the first is still buffering, which drops/corrupts audio.
        const SEEK_COOLDOWN_MS = 1500
        if (Date.now() - lastManualSeekTimestampRef.current < SEEK_COOLDOWN_MS) {
            // Still update UI state (chapter name, skip button) but skip no auto-jumps
            if (chapters.length > 0) {
                const current = chapters.find(c => curr >= c.startTime && curr < c.endTime)
                const name = current ? current.name : null
                if (activeChapterRef.current !== name) setActiveChapter(name)
            }
            return
        }

        if (chapters.length > 0) {
            const current = chapters.find(c => curr >= c.startTime && curr < c.endTime)
            const name = current ? current.name : null
            if (activeChapterRef.current !== name) {
                setActiveChapter(name)
            }

            // Intermediate pause auto-skip (recap, eyecatch, sponsor, intro, outro)
            const skippable = chapters.find(c => {
                if (curr >= c.startTime && curr < c.endTime - 0.5) {
                    const n = c.name.toLowerCase();

                    const isIntro =
                        /^(op\d*|opening\d*|intro\d*)\b/i.test(n) ||
                        /\b(op\d*|opening\d*|intro\d*)\b/i.test(n) ||
                        c.type === "opening";

                    const isOutro =
                        /^(ed\d*|ending\d*|credits|créditos|outro\d*)\b/i.test(n) ||
                        /\b(ed\d*|ending\d*|credits|créditos|outro\d*)\b/i.test(n) ||
                        c.type === "ending";

                    if (isIntro) return autoSkipIntroPref;
                    if (isOutro) return autoSkipOutroPref;

                    return (
                        autoSkipIntroPref &&
                        (n.includes("eyecatch") ||
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
                        c.type === "preview")
                    );
                }
                return false;
            });

            if (skippable) {
                setVideoCurrentTime(video, skippable.endTime, lastManualSeekTimestampRef);
                triggerToast("pause");
                return;
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
                setVideoCurrentTime(video, endTime, lastManualSeekTimestampRef)
                setSkipMode(null)
                triggerToast("intro")
                return
            }
            if (inOpWindow) {
                const remaining = Math.ceil(endTime - curr)
                const progress = Math.round(((curr - startTime) / (endTime - startTime)) * 100)
                if (skipModeRef.current !== "intro") setSkipMode("intro")
                if (skipRemainingSecondsRef.current !== remaining) setSkipRemainingSeconds(remaining)
                if (segmentProgressRef.current !== progress) setSegmentProgress(progress)
            } else if (skipModeRef.current === "intro") {
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
                setVideoCurrentTime(video, endTime, lastManualSeekTimestampRef)
                setSkipMode(null)
                triggerToast("outro")
                return
            }
            const opEnd = activeOp ? activeOp.endTime : 120
            if (curr >= opEnd) {
                if (inEdWindow) {
                    const remaining = Math.ceil(endTime - curr)
                    const progress = Math.round(((curr - startTime) / (endTime - startTime)) * 100)
                    if (skipModeRef.current !== "outro") setSkipMode("outro")
                    if (skipRemainingSecondsRef.current !== remaining) setSkipRemainingSeconds(remaining)
                    if (segmentProgressRef.current !== progress) setSegmentProgress(progress)
                } else if (skipModeRef.current === "outro") {
                    setSkipMode(null)
                }
            }
        }

        // Background preloading & prefetching
        if (nextStreamUrl && !hasPreloadedRef.current && total > 0 && (total - curr <= 180 || (activeEd && curr >= activeEd.startTime))) {
            hasPreloadedRef.current = true
            
            const resolvedStreamType = (
                streamType === "transcode" || streamType === "optimized" 
                    ? streamType 
                    : (nextStreamType === "transcode" || nextStreamType === "optimized" ? nextStreamType : "direct")
            ) as Mediastream_StreamType
            
            // 1. Go backend extraction preload
            preloadStream({
                path: nextStreamUrl,
                streamType: resolvedStreamType,
                audioStreamIndex: 0,
            })

            // 2. React Query query cache prefetch
            queryClient.prefetchQuery({
                queryKey: [API_ENDPOINTS.MEDIASTREAM.RequestMediastreamMediaContainer.key, nextStreamUrl, resolvedStreamType],
                queryFn: () => buildSeaQuery({
                    endpoint: API_ENDPOINTS.MEDIASTREAM.RequestMediastreamMediaContainer.endpoint,
                    method: API_ENDPOINTS.MEDIASTREAM.RequestMediastreamMediaContainer.methods[0],
                    data: {
                        path: nextStreamUrl,
                        streamType: resolvedStreamType,
                        audioStreamIndex: 0,
                        clientID: clientId || "prefetch-client",
                    }
                })
            })

            // 3. Prefetch skip times (AniSkip) for the next episode
            if ((malId || mediaId) && episodeNumber) {
                const nextEpisodeNumber = episodeNumber + 1
                queryClient.prefetchQuery({
                    queryKey: ["aniskip", malId ?? null, mediaId ?? null, nextEpisodeNumber, 0],
                    queryFn: () => getAniSkipTimes({
                        malId: malId ?? null,
                        mediaId: mediaId ?? null,
                        episodeNumber: nextEpisodeNumber,
                        episodeDuration: 0, // initially 0 duration
                    })
                })
            }
        }

        // Next episode trigger
        const ed = skipTimesEd
        const edTriggered = ed ? curr >= ed.startTime : false

        const shouldShowNext =
            (total > 0 && total - curr <= 15) ||
            (autoSkipOutroPref && edTriggered && hasNextEpisode)

        if (shouldShowNext && hasNextEpisode) {
            if (!showNextEpisodeRef.current) {
                setShowNextEpisode(true)
                setCountdownSeconds(5)
            }
        } else {
            if (showNextEpisodeRef.current) setShowNextEpisode(false)
        }

        // Calculate showCountdown state during playback
        const isVideoPlayingOrEnded = !video.paused || video.ended
        const isVideoEnded = video.ended
        const targetShowCountdown =
            tvMode &&
            !marathonMode &&
            autoPlayNextEpisode &&
            isVideoPlayingOrEnded &&
            hasNextEpisode &&
            (isVideoEnded || 
             (autoSkipOutroPref && skipTimesEd ? curr >= skipTimesEd.startTime : false) ||
             (total > 0 && total - curr <= 15))

        if (showCountdown !== targetShowCountdown) {
            setShowCountdown(targetShowCountdown)
        }

        // Trigger marathon autoplay during playback
        const shouldTriggerMarathon =
            marathonMode &&
            hasNextEpisode &&
            onNextEpisode &&
            (video.ended || (total > 0 && total - curr <= 3))

        if (shouldTriggerMarathon) {
            if (!hasTriggeredNextEpisodeRef.current) {
                hasTriggeredNextEpisodeRef.current = true
                video.pause()
                onNextEpisode()
            }
        }
    }, [videoRef, skipTimesOp, skipTimesEd, autoSkipIntroPref, autoSkipOutroPref, hasNextEpisode, mediaFormat, chapters, triggerToast, marathonMode, nextStreamUrl, nextStreamType, streamType, preloadStream, queryClient, clientId, showCountdown, tvMode, autoPlayNextEpisode, onNextEpisode])

    useEffect(() => {
        if (!showNextEpisode) {
            hasTriggeredNextEpisodeRef.current = false
        }
    }, [showNextEpisode])

    // Sync showCountdown when playback status changes (since processTimeUpdates does not fire when paused)
    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        const isVideoEnded = videoEnded
        const isVideoPlayingOrEnded = isPlaying || isVideoEnded
        const curr = video.currentTime
        const total = video.duration || duration

        const targetShowCountdown =
            tvMode &&
            !marathonMode &&
            autoPlayNextEpisode &&
            isVideoPlayingOrEnded &&
            hasNextEpisode &&
            (isVideoEnded ||
             (autoSkipOutroPref && skipTimesEd ? curr >= skipTimesEd.startTime : false) ||
             (total > 0 && total - curr <= 15))

        if (showCountdown !== targetShowCountdown) {
            setShowCountdown(targetShowCountdown)
        }
    }, [isPlaying, videoEnded, tvMode, marathonMode, autoPlayNextEpisode, hasNextEpisode, autoSkipOutroPref, skipTimesEd, duration, videoRef, showCountdown])

    const remainingProgress = useMemo(() => {
        return (countdownSeconds / 5) * 100
    }, [countdownSeconds])

    useEffect(() => {
        if (showNextEpisode && countdownSeconds > 0 && showCountdown) {
            nextEpisodeTimerRef.current = setTimeout(() => {
                setCountdownSeconds((c) => c - 1)
            }, 1000)
        } else if (showNextEpisode && countdownSeconds === 0 && showCountdown && onNextEpisode) {
            if (!hasTriggeredNextEpisodeRef.current) {
                hasTriggeredNextEpisodeRef.current = true
                if (videoRef.current) videoRef.current.pause()
                onNextEpisode()
            }
        }

        return () => {
            if (nextEpisodeTimerRef.current) clearTimeout(nextEpisodeTimerRef.current)
        }
    }, [showNextEpisode, countdownSeconds, showCountdown, onNextEpisode, videoRef])

    useEffect(() => {
        if (videoEnded && hasNextEpisode && onNextEpisode && autoPlayNextEpisode) {
            if (marathonMode) {
                if (!hasTriggeredNextEpisodeRef.current) {
                    hasTriggeredNextEpisodeRef.current = true
                    if (videoRef.current) videoRef.current.pause()
                    onNextEpisode()
                }
            } else if (!tvMode) {
                const timer = setTimeout(() => {
                    if (videoRef.current) videoRef.current.pause()
                    onNextEpisode()
                }, 1000)
                return () => clearTimeout(timer)
            }
        }
    }, [videoEnded, hasNextEpisode, onNextEpisode, autoPlayNextEpisode, tvMode, marathonMode, videoRef])

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
