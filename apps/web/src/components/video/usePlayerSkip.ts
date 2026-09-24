'use no memo'
import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useAniSkipTimes, getAniSkipTimes } from "@/api/hooks/aniskip.hooks"
import { useGetSettings } from "@/api/hooks/settings.hooks"
import { usePreloadMediastreamMediaContainer } from "@/api/hooks/mediastream.hooks"
import { useQueryClient } from "@tanstack/react-query"
import { usePlayerStore, useSkipTimesStore } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import { Mediastream_StreamType } from "@/api/generated/types"
import {
    findIntroChapter,
    findOutroChapter,
    isIntroChapter,
    isOutroChapter,
    resolveActiveEd,
    resolveActiveOp,
    shouldAutoSkip,
    shouldAutoSkipOutro,
} from "./skip-windows"
import type { Chapter, SkipWindow } from "./skip-windows"
import {
    findActiveChapter,
    findSkippableChapter,
    getChapterSkipKey,
    getNextChapterTarget,
    getPrevChapterTarget,
} from "./chapter-navigation"
import {
    getSegmentStatus,
    isNearEnd,
    shouldAutoAdvanceMarathon,
    shouldShowNextEpisode,
} from "./next-episode-policy"

/** "segment": capítulo intermedio (recap, eyecatch, avance…); "filler": episodio de relleno. */
export type AutoSkipToastType = "intro" | "outro" | "segment" | "filler"

// ─── Constants ─────────────────────────────────────────────────────────────────

const COUNTDOWN_START = 5
const SEEK_COOLDOWN_MS = 800


function setVideoCurrentTime(video: HTMLVideoElement, time: number) {
    video.currentTime = time
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface UsePlayerSkipProps {
    videoRef: React.RefObject<HTMLVideoElement | null>
    playableUrl: string
    duration: number
    isPlaying: boolean
    malId?: number | null
    episodeNumber?: number
    chapters: Chapter[]
    mediaFormat?: string | null
    autoSkipIntroPref: boolean
    autoSkipOutroPref: boolean
    autoSkipFillerPref: boolean
    isFillerEpisode: boolean
    skipStepSecondsPref: number
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
    preferredAudioLang?: string
    tvMode: boolean
    setTvMode: (val: boolean) => void
}

// ─── Main Hook ─────────────────────────────────────────────────────────────────

export function usePlayerSkip({
    videoRef,
    playableUrl,
    duration,
    isPlaying: _isPlaying,
    malId,
    episodeNumber,
    chapters,
    mediaFormat,
    autoSkipIntroPref,
    autoSkipOutroPref,
    autoSkipFillerPref,
    isFillerEpisode,
    skipStepSecondsPref,
    hasNextEpisode,
    onNextEpisode,
    setAutoSkipIntro,
    setAutoSkipOutro,
    triggerControlsVisibility,
    clientId,
    nextStreamUrl,
    streamType,
    mediaId,
    preferredAudioLang,
    tvMode,
    setTvMode,
}: UsePlayerSkipProps) {
    const { data: settings } = useGetSettings()
    const { mutate: preloadStream } = usePreloadMediastreamMediaContainer()
    const queryClient = useQueryClient()
    const autoPlayNextEpisode = settings?.library?.autoPlayNextEpisode ?? true

    const { marathonMode } = usePlayerStore(
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

    // ── Refs ────────────────────────────────────────────────────────────────────
    const hasAutoSkippedIntroRef = useRef(false)
    const hasAutoSkippedOutroRef = useRef(false)
    const hasAutoSkippedFillerRef = useRef(false)
    const toastTimerRef = useRef<NodeJS.Timeout | null>(null)
    const nextEpisodeTimerRef = useRef<NodeJS.Timeout | null>(null)
    const hasTriggeredNextEpisodeRef = useRef<boolean>(false)
    const hasPreloadedRef = useRef<boolean>(false)
    const lastManualSeekTimestampRef = useRef<number>(0)
    const preSkipPositionRef = useRef<number>(0)
    const skippedChaptersRef = useRef<Set<string>>(new Set())

    // ── Stable config ref (decouples processTimeUpdates from closure deps) ──────
    const configRef = useRef({
        skipTimesOp: undefined as SkipWindow | undefined,
        skipTimesEd: undefined as SkipWindow | undefined,
        autoSkipIntroPref: false,
        autoSkipOutroPref: false,
        autoSkipFillerPref: false,
        isFillerEpisode: false,
        skipStepSecondsPref: 85,
        chapters: [] as Chapter[],
        mediaFormat: undefined as string | undefined | null,
        marathonMode: false,
        tvMode: false,
        hasNextEpisode: false,
        onNextEpisode: undefined as (() => void) | undefined,
        autoPlayNextEpisode: false,
        nextStreamUrl: undefined as string | undefined,
        streamType: undefined as string | undefined,
        preloadStream: ((_: { path: string; streamType: Mediastream_StreamType; audioStreamIndex: number; preferredAudioLang: string }) => {}) as (vars: { path: string; streamType: Mediastream_StreamType; audioStreamIndex: number; preferredAudioLang: string }) => void,
        queryClient: undefined as ReturnType<typeof useQueryClient> | undefined,
        clientId: undefined as string | undefined,
        malId: undefined as number | null | undefined,
        mediaId: undefined as number | null | undefined,
        episodeNumber: undefined as number | undefined,
        showCountdown: false,
        preferredAudioLang: undefined as string | undefined,
    })

    // Guard centralizado para auto-advance. Todas las fuentes (processTimeUpdates
    // secciones 6/9, countdown, videoEnded) deben pasar por aquí para evitar
    // triple invocación simultánea y para poder resetear en caso de fallo.
    const tryAdvance = useCallback(() => {
        if (hasTriggeredNextEpisodeRef.current) return false
        const next = configRef.current.onNextEpisode
        if (!next) return false
        hasTriggeredNextEpisodeRef.current = true
        try {
            const v = videoRef.current
            if (v && !v.paused) v.pause()
            next()
            return true
        } catch (err) {
            console.error("[usePlayerSkip] onNextEpisode failed, resetting guard:", err)
            hasTriggeredNextEpisodeRef.current = false
            return false
        }
    }, [videoRef])
    // ── Dual ref+state pattern (avoids stale closures in hot callbacks) ─────────
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

    const [showAutoSkipToast, setShowAutoSkipToast] = useState<AutoSkipToastType | null>(null)

    const [activeChapter, setActiveChapterState] = useState<string | null>(null)
    const activeChapterRef = useRef<string | null>(null)
    const setActiveChapter = useCallback((val: string | null) => {
        activeChapterRef.current = val
        setActiveChapterState(val)
    }, [])

    const [countdownSeconds, setCountdownSeconds] = useState(COUNTDOWN_START)
    const [showCountdown, setShowCountdown] = useState(false)
    const [videoEnded, setVideoEnded] = useState(false)

    // ── Episode change reset ─────────────────────────────────────────────────────
    // When the orchestrator loads a new episode, playableUrl transitions "" → realUrl
    // while episodeNumber changes immediately. Keying the effect on episodeNumber alone
    // meant it ran during the "" phase (early return) and never re-ran once the real
    // URL arrived, so every flag stayed stale for the new episode. Depending on both
    // and deduping with a ref guarantees exactly one reset per episode+URL, avoiding
    // the double-reset ("" then realUrl) that cleared hasTriggeredNextEpisodeRef
    // prematurely.
    const lastResetKeyRef = useRef<string | null>(null)
    useEffect(() => {
        if (!playableUrl) return  // still in the loading phase — wait for real URL
        const resetKey = `${episodeNumber}_${playableUrl}`
        if (lastResetKeyRef.current === resetKey) return
        lastResetKeyRef.current = resetKey
        setShowNextEpisode(false)
        setSkipMode(null)
        setShowCountdown(false)
        setCountdownSeconds(COUNTDOWN_START)
        setVideoEnded(false)
        hasAutoSkippedIntroRef.current = false
        hasAutoSkippedOutroRef.current = false
        hasAutoSkippedFillerRef.current = false
        hasTriggeredNextEpisodeRef.current = false
        hasPreloadedRef.current = false
        skippedChaptersRef.current.clear()
    }, [episodeNumber, playableUrl]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Video ended tracking ─────────────────────────────────────────────────────
    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        const handleEnded = () => setVideoEnded(true)
        const handlePlay = () => setVideoEnded(false)
        const handleSeeked = () => setVideoEnded(video.ended)

        video.addEventListener("ended", handleEnded)
        video.addEventListener("play", handlePlay)
        video.addEventListener("seeked", handleSeeked)
        setVideoEnded(video.ended)

        return () => {
            video.removeEventListener("ended", handleEnded)
            video.removeEventListener("play", handlePlay)
            video.removeEventListener("seeked", handleSeeked)
        }
    }, [videoRef])

    // ── AniSkip data ─────────────────────────────────────────────────────────────
    const { data: skipTimes } = useAniSkipTimes({
        malId: malId ?? null,
        episodeNumber: episodeNumber ?? null,
        episodeDuration: duration > 0 ? duration : undefined,
        enabled: !!((malId || mediaId) && episodeNumber),
        mediaId: mediaId ?? null,
    })

    // ── Resolved skip windows (AniSkip → chapter → series cache) ────────────────
    const storeKey = malId || mediaId
    const skipTimesOp = useMemo<SkipWindow | undefined>(() => {
        if (skipTimes?.op) return { startTime: skipTimes.op.startTime, endTime: skipTimes.op.endTime, source: skipTimes.opSource ?? "aniskip" }
        const chap = findIntroChapter(chapters)
        if (chap) return { startTime: chap.startTime, endTime: chap.endTime, source: "chapters" }
        if (storeKey) {
            const cached = seriesSkipTimes[String(storeKey)]
            if (cached && typeof cached.opStart === "number" && typeof cached.opEnd === "number") {
                return { startTime: cached.opStart, endTime: cached.opEnd, source: "propagated" }
            }
        }
        return undefined
    }, [skipTimes, chapters, storeKey, seriesSkipTimes])

    const skipTimesEd = useMemo<SkipWindow | undefined>(() => {
        if (skipTimes?.ed) {
            const endTime = skipTimes.ed.endTime > 0 ? skipTimes.ed.endTime : (duration > 0 ? duration : 0)
            return { startTime: skipTimes.ed.startTime, endTime, source: skipTimes.edSource ?? "aniskip" }
        }
        const chap = findOutroChapter(chapters)
        if (chap) return { startTime: chap.startTime, endTime: chap.endTime, source: "chapters" }
        if (storeKey && duration > 0) {
            const cached = seriesSkipTimes[String(storeKey)]
            if (cached && typeof cached.edOffset === "number" && cached.edOffset > 0) {
                const endTime = (typeof cached.edEnd === "number" && cached.edEnd > 0) ? cached.edEnd : duration
                return { startTime: cached.edOffset, endTime, source: "propagated" }
            }
        }
        return undefined
    }, [skipTimes, chapters, storeKey, duration, seriesSkipTimes])

    // ── Auto-learning: persist resolved skip times to series cache ───────────────
    useEffect(() => {
        if (!storeKey || duration <= 0) return

        const cached = seriesSkipTimes[String(storeKey)]
        let opStart = cached?.opStart
        let opEnd = cached?.opEnd
        let edOffset = cached?.edOffset
        let edEnd = cached?.edEnd

        // Use resolved skipTimesOp/Ed rather than re-running chapter regex
        if (skipTimesOp) {
            opStart = skipTimesOp.startTime
            opEnd = skipTimesOp.endTime
        }
        if (skipTimesEd) {
            edOffset = skipTimesEd.startTime
            edEnd = skipTimesEd.endTime
        }

        if (typeof opStart === "number" && typeof opEnd === "number" && typeof edOffset === "number") {
            if (cached?.opStart !== opStart || cached?.opEnd !== opEnd || cached?.edOffset !== edOffset || cached?.edEnd !== edEnd) {
                saveSeriesSkipTimes(storeKey, opStart, opEnd, edOffset, edEnd)
            }
        }
    }, [storeKey, duration, skipTimesOp, skipTimesEd, seriesSkipTimes, saveSeriesSkipTimes])

    // ── Helpers ──────────────────────────────────────────────────────────────────
    const triggerToast = useCallback((type: AutoSkipToastType) => {
        setShowAutoSkipToast(type)
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        toastTimerRef.current = setTimeout(() => setShowAutoSkipToast(null), 3000)
    }, [])

    /** Duración efectiva: video.duration si es finita, si no el prop `duration`
     * (ya saneado en player-core con la duración de ffprobe). Con Infinity/NaN,
     * resolveActiveOp/Ed generan ventanas inalcanzables y los skips mueren. */
    const getEffectiveTotal = useCallback((video: HTMLVideoElement): number => {
        const raw = video.duration
        if (Number.isFinite(raw) && raw > 0) return raw
        return duration
    }, [duration])

    /** Suppress auto-skip after any manual seek into a skip window */
    const checkManualSkipOverrides = useCallback((target: number) => {
        const video = videoRef.current
        if (!video) return
        const total = getEffectiveTotal(video)

        lastManualSeekTimestampRef.current = Date.now()

        const activeOp = resolveActiveOp(skipTimesOp, total, mediaFormat)
        if (activeOp && target >= activeOp.startTime && target < activeOp.endTime) {
            hasAutoSkippedIntroRef.current = true
        }

        const activeEd = resolveActiveEd(skipTimesEd, total, mediaFormat)
        if (activeEd && target >= activeEd.startTime && target < activeEd.endTime) {
            hasAutoSkippedOutroRef.current = true
        }
    }, [skipTimesOp, skipTimesEd, videoRef, mediaFormat, getEffectiveTotal])

    // ── Public skip actions ───────────────────────────────────────────────────────
    const skipOpening = useCallback(() => {
        const video = videoRef.current
        if (!video) return
        const dur = Number.isFinite(video.duration) ? video.duration : Infinity
        
        let target = Math.max(0, Math.min(dur, video.currentTime + configRef.current.skipStepSecondsPref))
        
        const activeOp = resolveActiveOp(skipTimesOp, dur, mediaFormat)
        if (activeOp && video.currentTime < activeOp.endTime && video.currentTime >= activeOp.startTime - 20) {
            target = activeOp.endTime
        } else {
            const activeEd = resolveActiveEd(skipTimesEd, dur, mediaFormat)
            if (activeEd && video.currentTime < activeEd.endTime && video.currentTime >= activeEd.startTime - 20) {
                target = activeEd.endTime
            }
        }

        checkManualSkipOverrides(target)
        setVideoCurrentTime(video, target)
        lastManualSeekTimestampRef.current = Date.now()
        video.play().catch(() => {})
        triggerControlsVisibility()
    }, [videoRef, skipTimesOp, skipTimesEd, mediaFormat, triggerControlsVisibility, checkManualSkipOverrides])

    const undoSkip = useCallback(() => {
        const video = videoRef.current
        if (!video || preSkipPositionRef.current === 0) return
        setVideoCurrentTime(video, preSkipPositionRef.current)
        lastManualSeekTimestampRef.current = Date.now()
        video.play().catch(() => {})
        triggerControlsVisibility()
        setShowAutoSkipToast(null)
    }, [videoRef, triggerControlsVisibility])

    const skipToNextChapter = useCallback(() => {
        const video = videoRef.current
        if (!video || chapters.length === 0) return
        const curr = video.currentTime
        const target = getNextChapterTarget(chapters, curr)
        if (target != null) {
            checkManualSkipOverrides(target)
            setVideoCurrentTime(video, target)
            lastManualSeekTimestampRef.current = Date.now()
            video.play().catch(() => {})
            triggerControlsVisibility()
        }
    }, [videoRef, chapters, checkManualSkipOverrides, triggerControlsVisibility])

    const skipToPrevChapter = useCallback(() => {
        const video = videoRef.current
        if (!video || chapters.length === 0) return
        const curr = video.currentTime
        const target = getPrevChapterTarget(chapters, curr)
        checkManualSkipOverrides(target)
        setVideoCurrentTime(video, target)
        lastManualSeekTimestampRef.current = Date.now()
        video.play().catch(() => {})
        triggerControlsVisibility()
    }, [videoRef, chapters, checkManualSkipOverrides, triggerControlsVisibility])

    const handleSetAutoSkipIntro = useCallback((val: boolean) => {
        setAutoSkipIntro(val)
        const video = videoRef.current
        if (!video || !val) return
        const curr = video.currentTime
        const activeOp = resolveActiveOp(skipTimesOp, getEffectiveTotal(video), mediaFormat)
        if (activeOp && curr >= activeOp.startTime && curr < activeOp.endTime) {
            setVideoCurrentTime(video, activeOp.endTime)
            lastManualSeekTimestampRef.current = Date.now()
            video.play().catch(() => {})
            setSkipMode(null)
        }
    }, [videoRef, setAutoSkipIntro, skipTimesOp, setSkipMode, getEffectiveTotal, mediaFormat])

    const handleSetAutoSkipOutro = useCallback((val: boolean) => {
        setAutoSkipOutro(val)
        const video = videoRef.current
        if (!video || !val) return
        const curr = video.currentTime
        const total = getEffectiveTotal(video)
        // Only act on outro, not inside intro window
        const activeOp = resolveActiveOp(skipTimesOp, total, mediaFormat)
        if (activeOp && curr < activeOp.endTime) return
        const activeEd = resolveActiveEd(skipTimesEd, total, mediaFormat)
        if (activeEd && curr >= activeEd.startTime && curr < activeEd.endTime) {
            setVideoCurrentTime(video, activeEd.endTime)
            lastManualSeekTimestampRef.current = Date.now()
            video.play().catch(() => {})
            setSkipMode(null)
        }
    }, [videoRef, setAutoSkipOutro, skipTimesOp, skipTimesEd, setSkipMode, getEffectiveTotal, mediaFormat])

    const handleSetTvMode = useCallback((val: boolean) => {
        setTvMode(val)
    }, [setTvMode])

    const handleSetMarathonMode = useCallback((val: boolean) => {
        usePlayerStore.setState({ marathonMode: val })
        
        const video = videoRef.current
        if (!video || !val) return
        
        hasAutoSkippedIntroRef.current = false
        hasAutoSkippedOutroRef.current = false

        const curr = video.currentTime
        const total = getEffectiveTotal(video)

        // 1. Check intro
        const activeOp = resolveActiveOp(skipTimesOp, total, mediaFormat)
        if (activeOp && curr >= activeOp.startTime && curr < activeOp.endTime) {
            setVideoCurrentTime(video, activeOp.endTime)
            lastManualSeekTimestampRef.current = Date.now()
            video.play().catch(() => {})
            setSkipMode(null)
            return
        }
        
        // 2. En el outro o muy cerca del final: en maratón se avanza directo al
        //    siguiente episodio (mismo criterio que la sección 6 de
        //    processTimeUpdates). Si es el último episodio, se salta el outro.
        const activeEd = resolveActiveEd(skipTimesEd, total, mediaFormat)
        const inEd = !!activeEd && curr >= activeEd.startTime && curr < activeEd.endTime
        const nearEnd = total > 0 && total - curr <= 3
        const canAdvance = hasNextEpisode && !!onNextEpisode && mediaFormat?.toUpperCase() !== "MOVIE"
        if ((inEd || nearEnd) && canAdvance) {
            tryAdvance()
            return
        }
        if (inEd && activeEd) {
            setVideoCurrentTime(video, activeEd.endTime)
            lastManualSeekTimestampRef.current = Date.now()
            video.play().catch(() => {})
            setSkipMode(null)
        }
    }, [videoRef, skipTimesOp, skipTimesEd, mediaFormat, hasNextEpisode, onNextEpisode, setSkipMode, getEffectiveTotal, tryAdvance])

    const handleSkipIntro = useCallback(() => {
        const video = videoRef.current
        if (!video) return
        const curr = video.currentTime
        const total = getEffectiveTotal(video)
        const activeMode = skipMode || (curr < 120 ? "intro" : "outro")

        if (activeMode === "intro") {
            const activeOp = resolveActiveOp(skipTimesOp, total, mediaFormat)
            if (!activeOp || !(curr >= activeOp.startTime && curr < activeOp.endTime)) return
            setVideoCurrentTime(video, activeOp.endTime)
        } else {
            const activeEd = resolveActiveEd(skipTimesEd, total, mediaFormat)
            if (!activeEd || !(curr >= activeEd.startTime && curr < activeEd.endTime)) return
            setVideoCurrentTime(video, activeEd.endTime)
        }

        lastManualSeekTimestampRef.current = Date.now()
        video.play().catch(() => {})
        setSkipMode(null)
    }, [videoRef, skipMode, skipTimesOp, skipTimesEd, setSkipMode, mediaFormat, getEffectiveTotal])

    // ─────────────────────────────────────────────────────────────────────────────
    // processTimeUpdates — called on every timeupdate event from the video element
    // Split into focused sub-sections for clarity.
    // ─────────────────────────────────────────────────────────────────────────────
    // D5: configRef.current se asignaba directamente en el cuerpo del render,
    // lo cual es un anti-patrón en React (los renders pueden ser interrumpidos
    // o repetidos en modo concurrente / StrictMode). useLayoutEffect garantiza
    // que la mutación ocurre sincrónicamente después del commit, antes de que
    // el navegador pinte, y nunca en medio de un render interrumpido.
    useEffect(() => {
        configRef.current = {
            skipTimesOp,
            skipTimesEd,
            autoSkipIntroPref: autoSkipIntroPref || marathonMode,
            autoSkipOutroPref: autoSkipOutroPref || marathonMode,
            autoSkipFillerPref: autoSkipFillerPref || marathonMode,
            isFillerEpisode,
            skipStepSecondsPref,
            chapters,
            mediaFormat,
            marathonMode,
            tvMode,
            hasNextEpisode,
            onNextEpisode,
            autoPlayNextEpisode,
            nextStreamUrl,
            streamType,
            preloadStream,
            queryClient,
            clientId,
            malId,
            mediaId,
            episodeNumber,
            showCountdown,
            preferredAudioLang,
        }
    })

    const processTimeUpdates = useCallback((curr: number, total: number) => {
        const video = videoRef.current
        if (!video) return

        const cfg = configRef.current
        const activeOp = resolveActiveOp(cfg.skipTimesOp, total, cfg.mediaFormat)
        const activeEd = resolveActiveEd(cfg.skipTimesEd, total, cfg.mediaFormat)

        // ── 1. Seek cooldown guard ─────────────────────────────────────────────
        const inCooldown = Date.now() - lastManualSeekTimestampRef.current < SEEK_COOLDOWN_MS
        if (inCooldown) {
            if (cfg.chapters.length > 0) {
                const chap = findActiveChapter(cfg.chapters, curr)
                const name = chap ? chap.name : null
                if (activeChapterRef.current !== name) setActiveChapter(name)
            }
            return
        }

        // ── 2. Active chapter detection ────────────────────────────────────────
        if (cfg.chapters.length > 0) {
            const chap = findActiveChapter(cfg.chapters, curr)
            const name = chap ? chap.name : null
            if (activeChapterRef.current !== name) setActiveChapter(name)
        }

        // ── 3. Chapter-based intermediate auto-skip ────────────────────────────
        if (cfg.chapters.length > 0) {
            const skippable = findSkippableChapter(cfg.chapters, curr, skippedChaptersRef.current, {
                autoSkipIntroPref: cfg.autoSkipIntroPref,
                autoSkipOutroPref: cfg.autoSkipOutroPref,
            })
            if (skippable) {
                skippedChaptersRef.current.add(getChapterSkipKey(skippable))
                // Guardar la posición para que "Deshacer" vuelva al inicio del capítulo.
                preSkipPositionRef.current = curr
                setVideoCurrentTime(video, skippable.endTime)
                lastManualSeekTimestampRef.current = Date.now()
                video.play().catch(() => {})
                triggerToast(isIntroChapter(skippable) ? "intro" : isOutroChapter(skippable) ? "outro" : "segment")
                return
            }
        }

        // ── 4. Reset auto-skip flags when before windows ──────────────────────
        if (activeOp && curr < activeOp.startTime) {
            hasAutoSkippedIntroRef.current = false
        }
        if (activeEd && curr < activeEd.startTime) {
            hasAutoSkippedOutroRef.current = false
        }

        // ── 5. OP / Intro window ───────────────────────────────────────────────
        if (activeOp) {
            const { startTime, endTime, source } = activeOp
            const inWindow = curr >= startTime && curr < endTime
            if (cfg.autoSkipIntroPref && inWindow && !hasAutoSkippedIntroRef.current && shouldAutoSkip(source)) {
                hasAutoSkippedIntroRef.current = true
                preSkipPositionRef.current = curr
                setVideoCurrentTime(video, endTime)
                lastManualSeekTimestampRef.current = Date.now()
                video.play().catch(() => {})
                setSkipMode(null)
                triggerToast("intro")
                return
            }
            if (inWindow && curr >= startTime + 1) {
                const { remaining, progress } = getSegmentStatus(curr, startTime, endTime)
                if (skipModeRef.current !== "intro") setSkipMode("intro")
                if (skipRemainingSecondsRef.current !== remaining) {
                    setSkipRemainingSeconds(remaining)
                    setSegmentProgress(progress)
                }
            } else if (skipModeRef.current === "intro") {
                setSkipMode(null)
            }
        }

        // ── 6. ED / Outro window ───────────────────────────────────────────────
        if (activeEd) {
            const { startTime, endTime, source } = activeEd
            const inWindow = curr >= startTime && curr < endTime
            
            if (cfg.autoSkipOutroPref && inWindow && !hasAutoSkippedOutroRef.current && shouldAutoSkipOutro(source)) {
                // En maratón no tiene sentido saltar el outro para seguir viendo el
                // buffer post-ED: se avanza directo al siguiente episodio, sin el
                // residuo de ~2s que dejaba el salto a `endTime` (= total-5) hasta
                // que la sección 9 disparaba a total-3. Si es el último episodio
                // (no hay siguiente), cae al salto de outro normal de abajo.
                if (cfg.marathonMode && cfg.hasNextEpisode && cfg.onNextEpisode && cfg.mediaFormat?.toUpperCase() !== "MOVIE") {
                    tryAdvance()
                    return
                }

                hasAutoSkippedOutroRef.current = true
                preSkipPositionRef.current = curr

                setVideoCurrentTime(video, endTime)
                lastManualSeekTimestampRef.current = Date.now()
                video.play().catch(() => {})

                setSkipMode(null)
                triggerToast("outro")
                return
            }
            
            if (inWindow && curr >= startTime + 1) {
                const { remaining, progress } = getSegmentStatus(curr, startTime, endTime)
                if (skipModeRef.current !== "outro") setSkipMode("outro")
                if (skipRemainingSecondsRef.current !== remaining) {
                    setSkipRemainingSeconds(remaining)
                    setSegmentProgress(progress)
                }
            } else if (skipModeRef.current === "outro") {
                setSkipMode(null)
            }
        }

        // ── 6.5. Filler episode auto-advance ───────────────────────────────────
        // Filler is a whole-episode editorial mark (not an intra-video window),
        // so the "skip" is an auto-next, reusing the marathon guard.
        if (
            cfg.isFillerEpisode &&
            cfg.autoSkipFillerPref &&
            !hasAutoSkippedFillerRef.current &&
            cfg.hasNextEpisode &&
            cfg.onNextEpisode &&
            cfg.mediaFormat?.toUpperCase() !== "MOVIE"
        ) {
            hasAutoSkippedFillerRef.current = true
            triggerToast("filler")
            tryAdvance()
            return
        }

        // ── 7. Next-episode preload ────────────────────────────────────────────
        const nearEnd = isNearEnd(total, curr, activeEd?.startTime)
        if (cfg.nextStreamUrl && !hasPreloadedRef.current && nearEnd) {
            hasPreloadedRef.current = true

            const resolvedStreamType = (
                cfg.streamType === "transcode" || cfg.streamType === "optimized"
                    ? cfg.streamType
                    : "direct"
            ) as Mediastream_StreamType

            // Warm the NEXT episode via the side-effect-free preload path only.
            cfg.preloadStream({ path: cfg.nextStreamUrl, streamType: resolvedStreamType, audioStreamIndex: 0, preferredAudioLang: cfg.preferredAudioLang || "" })

            if ((cfg.malId || cfg.mediaId) && cfg.episodeNumber) {
                const nextEp = cfg.episodeNumber + 1
                cfg.queryClient?.prefetchQuery({
                    queryKey: ["aniskip", cfg.malId ?? null, cfg.mediaId ?? null, nextEp],
                    queryFn: () => getAniSkipTimes({ malId: cfg.malId ?? null, mediaId: cfg.mediaId ?? null, episodeNumber: nextEp, episodeDuration: 0 })
                })
            }
        }

        // ── 8. "Up next" panel + countdown visibility ─────────────────────────
        const inEdWindow = activeEd ? curr >= activeEd.startTime && curr < activeEd.endTime : false
        const shouldShowNext = shouldShowNextEpisode({
            mediaFormat: cfg.mediaFormat,
            marathonMode: cfg.marathonMode,
            tvMode: cfg.tvMode,
            hasNextEpisode: cfg.hasNextEpisode,
            total,
            curr,
            inEdWindow,
        })

        if (shouldShowNext) {
            if (!showNextEpisodeRef.current) {
                setShowNextEpisode(true)
                const wantCountdown = cfg.tvMode || (!cfg.marathonMode && cfg.autoPlayNextEpisode)
                setShowCountdown(wantCountdown)
                setCountdownSeconds(cfg.tvMode ? 3 : COUNTDOWN_START)
            }
        } else {
            if (showNextEpisodeRef.current) {
                setShowNextEpisode(false)
                setShowCountdown(false)
            }
        }

        // ── 9. Marathon mode auto-advance ────────────────────────────────
        if (shouldAutoAdvanceMarathon({
            marathonMode: cfg.marathonMode,
            hasNextEpisode: cfg.hasNextEpisode,
            hasOnNext: cfg.onNextEpisode != null,
            mediaFormat: cfg.mediaFormat,
            ended: video.ended,
            total,
            curr,
        })) {
            tryAdvance()
        }
    }, [setActiveChapter, setSegmentProgress, setShowNextEpisode, setSkipMode, setSkipRemainingSeconds, triggerToast, videoRef, tryAdvance])

    // D6: Se eliminó el efecto que limpiaba hasTriggeredNextEpisodeRef cuando
    // showNextEpisode pasaba a false. Ese comportamiento era incorrecto: si el
    // usuario retrocede dentro del outro y el panel se oculta y reaparece, el
    // guard quedaba limpio y el avance podía re-dispararse. El ref ahora se
    // limpia exclusivamente en el reset por cambio de episodio (~línea 275),
    // keyed en `${episodeNumber}_${playableUrl}`.

    // ── Reset skip flags when marathon mode is activated ────────────────────────
    // If the user enables marathon mode while the video is inside an intro/outro
    // window (or after already passing through it without auto-skipping), the
    // forced handleTimeUpdate() in player-core won't fire the skip because
    // hasAutoSkippedIntroRef is true from a previous manual skip or heuristic pass.
    // Resetting the flags here gives processTimeUpdates a clean slate so the
    // very next timeupdate (or the force-check) can skip immediately.
    useEffect(() => {
        if (marathonMode) {
            hasAutoSkippedIntroRef.current = false
            hasAutoSkippedOutroRef.current = false
            hasAutoSkippedFillerRef.current = false
        }
    }, [marathonMode])


    // ── Countdown tick ────────────────────────────────────────────────────────────
    const remainingProgress = useMemo(() => (countdownSeconds / COUNTDOWN_START) * 100, [countdownSeconds])

    useEffect(() => {
        if (showNextEpisode && countdownSeconds > 0 && showCountdown) {
            nextEpisodeTimerRef.current = setTimeout(() => setCountdownSeconds(c => c - 1), 1000)
        } else if (showNextEpisode && countdownSeconds === 0 && showCountdown) {
            tryAdvance()
        }
        return () => { if (nextEpisodeTimerRef.current) clearTimeout(nextEpisodeTimerRef.current) }
    }, [showNextEpisode, countdownSeconds, showCountdown, tryAdvance])

    // ── Auto-advance on video end ─────────────────────────────────────────────────
    // onNextEpisode is intentionally NOT in the dep array: it is an inline arrow
    // function in the parent and gets a new reference on every parent re-render.
    // Including it would cause React to cancel the pending 1-second timer on each
    // re-render (via the effect cleanup), meaning onNextEpisode() would never fire.
    // We read it through configRef.current inside the callback so it is always current.
    // episodeNumber IS in the dep array on purpose: if the episode advances through any
    // other path (manual click, "Up next" panel, shortcut) while this timer is pending,
    // the cleanup cancels it — otherwise the stale timer fired against the already-updated
    // queue index and skipped an extra episode.
    useEffect(() => {
        if (videoEnded && hasNextEpisode && configRef.current.onNextEpisode && mediaFormat?.toUpperCase() !== "MOVIE" && (marathonMode || autoPlayNextEpisode)) {
            if (marathonMode) {
                tryAdvance()
            } else {
                if (!hasTriggeredNextEpisodeRef.current) {
                    const timer = setTimeout(() => {
                        tryAdvance()
                    }, tvMode ? 5000 : 1000)
                    return () => clearTimeout(timer)
                }
            }
        }
    }, [videoEnded, hasNextEpisode, autoPlayNextEpisode, tvMode, marathonMode, mediaFormat, episodeNumber, tryAdvance])

    // ── Cleanup ───────────────────────────────────────────────────────────────────
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
        handleSetMarathonMode,
        handleSkipIntro,
        showCountdown,
        processTimeUpdates,
        checkManualSkipOverrides,
        undoSkip,
    }
}
