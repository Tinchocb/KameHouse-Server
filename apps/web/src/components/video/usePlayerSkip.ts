'use no memo'
import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { aniskipQueryKeys, getAniSkipTimes } from "@/api/hooks/aniskip.hooks"
import { useGetSettings } from "@/api/hooks/settings.hooks"
import { usePreloadMediastreamMediaContainer } from "@/api/hooks/mediastream.hooks"
import { useQueryClient } from "@tanstack/react-query"
import { usePlayerStore } from "@/lib/store"
import { Mediastream_StreamType } from "@/api/generated/types"
import {
    isIntroChapter,
    isOutroChapter,
    isRecapChapter,
    isPreviewChapter,
    findActivePreview,
    extendOpeningSkip,
    resolveActiveEd,
    resolveActiveOp,
    shouldAutoSkip,
    shouldAutoSkipOutro,
} from "./skip-windows"
import type { Chapter, SkipWindow } from "./skip-windows"
import { useMirroredState } from "./use-mirrored-state"
import { usePlayerSkipWindows } from "./usePlayerSkipWindows"
import { prefetchDriveTitleCard } from "./useDriveTitleCard"
import { usePlayerVideoEnded } from "./usePlayerVideoEnded"
import {
    findActiveChapter,
    findSkippableChapter,
    getChapterSkipKey,
} from "./chapter-navigation"
import {
    getSegmentStatus,
    isNearEnd,
    shouldAutoAdvanceMarathon,
    shouldShowNextEpisode,
} from "./next-episode-policy"

/** "segment": capítulo intermedio (recap, eyecatch, avance…). */
type AutoSkipToastType = "intro" | "outro" | "recap" | "segment"

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
    malId?: number | null
    episodeNumber?: number
    chapters: Chapter[]
    mediaFormat?: string | null
    autoSkipIntroPref: boolean
    autoSkipOutroPref: boolean
    skipStepSecondsPref: number
    hasNextEpisode: boolean
    onNextEpisode?: () => void
    setAutoSkipIntro: (val: boolean) => void
    setAutoSkipOutro: (val: boolean) => void
    triggerControlsVisibility: () => void
    clientId?: string
    nextStreamUrl?: string
    streamType?: "local" | "online" | "direct" | "transcode" | "optimized"
    mediaId?: number | null
    preferredAudioLang?: string
    /** Ruta gdrive:// del episodio (para detectar el resumen por sus subtítulos). */
    drivePath?: string
}

// ─── Main Hook ─────────────────────────────────────────────────────────────────

export function usePlayerSkip({
    videoRef,
    playableUrl,
    duration,
    malId,
    episodeNumber,
    chapters,
    mediaFormat,
    autoSkipIntroPref,
    autoSkipOutroPref,
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
    drivePath,
}: UsePlayerSkipProps) {
    const { data: settings } = useGetSettings()
    const { mutate: preloadStream } = usePreloadMediastreamMediaContainer()
    const queryClient = useQueryClient()
    const autoPlayNextEpisode = settings?.library?.autoPlayNextEpisode ?? true

    const marathonMode = usePlayerStore(state => state.marathonMode)

    // ── Refs ────────────────────────────────────────────────────────────────────
    const hasAutoSkippedIntroRef = useRef(false)
    const hasAutoSkippedOutroRef = useRef(false)
    const pendingOpeningEndRef = useRef<number | null>(null)
    const hasAutoSkippedRecapRef = useRef(false)
    const toastTimerRef = useRef<NodeJS.Timeout | null>(null)
    const nextEpisodeTimerRef = useRef<NodeJS.Timeout | null>(null)
    const hasTriggeredNextEpisodeRef = useRef<boolean>(false)
    const hasPreloadedRef = useRef<boolean>(false)
    const lastManualSeekTimestampRef = useRef<number>(0)
    const preSkipPositionRef = useRef<number | null>(null)
    const skippedChaptersRef = useRef<Set<string>>(new Set())

    // ── Stable config ref (decouples processTimeUpdates from closure deps) ──────
    const configRef = useRef({
        skipTimesOp: undefined as SkipWindow | undefined,
        skipTimesEd: undefined as SkipWindow | undefined,
        skipTimesRecap: undefined as SkipWindow | undefined,
        autoSkipIntroPref: false,
        autoSkipOutroPref: false,
        skipStepSecondsPref: 85,
        chapters: [] as Chapter[],
        mediaFormat: undefined as string | undefined | null,
        marathonMode: false,
        hasNextEpisode: false,
        onNextEpisode: undefined as (() => void) | undefined,
        autoPlayNextEpisode: false,
        nextStreamUrl: undefined as string | undefined,
        streamType: undefined as string | undefined,
        preloadStream: (() => {}) as (vars: { path: string; streamType: Mediastream_StreamType; audioStreamIndex: number; preferredAudioLang: string }) => void,
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
    const [skipMode, setSkipMode, skipModeRef] = useMirroredState<"intro" | "outro" | "recap" | "preview" | null>(null)

    const [skipRemainingSeconds, setSkipRemainingSeconds, skipRemainingSecondsRef] = useMirroredState<number>(0)

    const [segmentProgress, setSegmentProgress, segmentProgressRef] = useMirroredState<number>(0)

    const [showNextEpisode, setShowNextEpisode, showNextEpisodeRef] = useMirroredState<boolean>(false)

    const [showAutoSkipToast, setShowAutoSkipToast] = useState<AutoSkipToastType | null>(null)

    const [activeChapter, setActiveChapter, activeChapterRef] = useMirroredState<string | null>(null)

    const [countdownSeconds, setCountdownSeconds] = useState(COUNTDOWN_START)
    const [showCountdown, setShowCountdown] = useState(false)
    const [videoEnded, setVideoEnded] = usePlayerVideoEnded(videoRef)

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
        pendingOpeningEndRef.current = null
        lastResetKeyRef.current = resetKey
        setShowNextEpisode(false)
        setSkipMode(null)
        setShowCountdown(false)
        setCountdownSeconds(COUNTDOWN_START)
        setVideoEnded(false)
        hasAutoSkippedIntroRef.current = false
        hasAutoSkippedOutroRef.current = false
        hasAutoSkippedRecapRef.current = false
        preSkipPositionRef.current = null
        hasTriggeredNextEpisodeRef.current = false
        hasPreloadedRef.current = false
        skippedChaptersRef.current.clear()
    }, [episodeNumber, playableUrl, setShowNextEpisode, setSkipMode, setVideoEnded]) // setters estables

    // ── Skip windows (AniSkip → chapter → series cache) + auto-learning ─────────
    const { skipTimesOp, skipTimesEd, skipTimesRecap } = usePlayerSkipWindows({
        malId, mediaId, episodeNumber, duration, chapters,
        // Una película no abre con el resumen del episodio anterior.
        drivePath: mediaFormat?.toUpperCase() === "MOVIE" ? undefined : drivePath,
    })

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
        pendingOpeningEndRef.current = null
        const video = videoRef.current
        if (!video) return
        const total = getEffectiveTotal(video)

        lastManualSeekTimestampRef.current = Date.now()

        if (skipTimesRecap && target >= skipTimesRecap.startTime && target < skipTimesRecap.endTime) {
            hasAutoSkippedRecapRef.current = true
        }

        const activeOp = resolveActiveOp(skipTimesOp, total, mediaFormat)
        if (activeOp && target >= activeOp.startTime && target < activeOp.endTime) {
            hasAutoSkippedIntroRef.current = true
        }

        const activeEd = resolveActiveEd(skipTimesEd, total, mediaFormat)
        if (activeEd && target >= activeEd.startTime && target < activeEd.endTime) {
            hasAutoSkippedOutroRef.current = true
        }
    }, [skipTimesOp, skipTimesEd, skipTimesRecap, videoRef, mediaFormat, getEffectiveTotal])

    // ── Public skip actions ───────────────────────────────────────────────────────
    const skipOpening = useCallback(() => {
        const video = videoRef.current
        if (!video) return
        const dur = getEffectiveTotal(video) || Infinity
        
        let target = Math.max(0, Math.min(dur, video.currentTime + configRef.current.skipStepSecondsPref))
        
        const activeOp = resolveActiveOp(skipTimesOp, dur, mediaFormat)
        if (skipTimesRecap && video.currentTime >= skipTimesRecap.startTime && video.currentTime < skipTimesRecap.endTime && skipTimesRecap.endTime <= dur) {
            target = extendOpeningSkip(skipTimesRecap.endTime, skipTimesOp, dur)
        } else if (activeOp && video.currentTime < activeOp.endTime && video.currentTime >= activeOp.startTime - 20) {
            target = extendOpeningSkip(activeOp.endTime, skipTimesRecap, dur)
        } else {
            const activeEd = resolveActiveEd(skipTimesEd, dur, mediaFormat)
            if (activeEd && video.currentTime < activeEd.endTime && video.currentTime >= activeEd.startTime - 20) {
                target = activeEd.endTime
            }
        }

        checkManualSkipOverrides(target)
        if (activeOp && video.currentTime >= activeOp.startTime - 20 && video.currentTime < activeOp.endTime && target === activeOp.endTime && !skipTimesRecap) {
            pendingOpeningEndRef.current = target
        }
        setVideoCurrentTime(video, target)
        lastManualSeekTimestampRef.current = Date.now()
        video.play().catch(() => {})
        triggerControlsVisibility()
    }, [videoRef, skipTimesOp, skipTimesEd, skipTimesRecap, getEffectiveTotal, mediaFormat, triggerControlsVisibility, checkManualSkipOverrides])

    const undoSkip = useCallback(() => {
        const video = videoRef.current
        if (!video || preSkipPositionRef.current === null) return
        checkManualSkipOverrides(preSkipPositionRef.current)
        setVideoCurrentTime(video, preSkipPositionRef.current)
        lastManualSeekTimestampRef.current = Date.now()
        video.play().catch(() => {})
        triggerControlsVisibility()
        setShowAutoSkipToast(null)
    }, [videoRef, triggerControlsVisibility, checkManualSkipOverrides])

    const handleSetAutoSkipIntro = useCallback((val: boolean) => {
        setAutoSkipIntro(val)
        const video = videoRef.current
        if (!video || !val) return
        const curr = video.currentTime
        const activeOp = resolveActiveOp(skipTimesOp, getEffectiveTotal(video), mediaFormat)
        if (activeOp && curr >= activeOp.startTime && curr < activeOp.endTime) {
            setVideoCurrentTime(video, extendOpeningSkip(activeOp.endTime, skipTimesRecap, getEffectiveTotal(video)))
            lastManualSeekTimestampRef.current = Date.now()
            video.play().catch(() => {})
            setSkipMode(null)
        }
    }, [videoRef, setAutoSkipIntro, skipTimesOp, skipTimesRecap, setSkipMode, getEffectiveTotal, mediaFormat])

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

    const handleSetMarathonMode = useCallback((val: boolean) => {
        usePlayerStore.setState({ marathonMode: val })
        
        const video = videoRef.current
        if (!video || !val) return
        
        hasAutoSkippedIntroRef.current = false
        hasAutoSkippedOutroRef.current = false

        const curr = video.currentTime
        const total = getEffectiveTotal(video)

        if (skipTimesRecap && skipTimesRecap.endTime <= total && curr >= skipTimesRecap.startTime && curr < skipTimesRecap.endTime) {
            hasAutoSkippedRecapRef.current = true
            preSkipPositionRef.current = curr
            setVideoCurrentTime(video, skipTimesRecap.endTime)
            lastManualSeekTimestampRef.current = Date.now()
            video.play().catch(() => {})
            setSkipMode(null)
            triggerToast("recap")
            return
        }

        // 1. Check intro
        const activeOp = resolveActiveOp(skipTimesOp, total, mediaFormat)
        if (activeOp && curr >= activeOp.startTime && curr < activeOp.endTime) {
            setVideoCurrentTime(video, extendOpeningSkip(activeOp.endTime, skipTimesRecap, getEffectiveTotal(video)))
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
    }, [videoRef, skipTimesOp, skipTimesEd, skipTimesRecap, mediaFormat, hasNextEpisode, onNextEpisode, setSkipMode, getEffectiveTotal, tryAdvance, triggerToast])

    const handleSkipIntro = useCallback(() => {
        const video = videoRef.current
        if (!video) return
        const curr = video.currentTime
        const total = getEffectiveTotal(video)
        const activeMode = skipMode || (curr < 120 ? "intro" : "outro")

        if (activeMode === "preview") {
            const preview = findActivePreview(chapters, curr, total)
            if (!preview) return
            skippedChaptersRef.current.add(getChapterSkipKey(preview))
            setVideoCurrentTime(video, preview.endTime)
        } else if (activeMode === "recap") {
            if (!skipTimesRecap || !(curr >= skipTimesRecap.startTime && curr < skipTimesRecap.endTime)) return
            hasAutoSkippedRecapRef.current = true
            setVideoCurrentTime(video, extendOpeningSkip(Math.min(total, skipTimesRecap.endTime), skipTimesOp, total))
        } else if (activeMode === "intro") {
            const activeOp = resolveActiveOp(skipTimesOp, total, mediaFormat)
            if (!activeOp || !(curr >= activeOp.startTime && curr < activeOp.endTime)) return
            pendingOpeningEndRef.current = skipTimesRecap ? null : activeOp.endTime
            setVideoCurrentTime(video, extendOpeningSkip(activeOp.endTime, skipTimesRecap, total))
        } else {
            const activeEd = resolveActiveEd(skipTimesEd, total, mediaFormat)
            if (!activeEd || !(curr >= activeEd.startTime && curr < activeEd.endTime)) return
            if (hasNextEpisode && onNextEpisode && mediaFormat?.toUpperCase() !== "MOVIE") {
                tryAdvance()
                return
            }
            setVideoCurrentTime(video, activeEd.endTime)
        }

        lastManualSeekTimestampRef.current = Date.now()
        video.play().catch(() => {})
        setSkipMode(null)
    }, [videoRef, skipMode, skipTimesOp, skipTimesEd, skipTimesRecap, chapters, setSkipMode, mediaFormat, getEffectiveTotal, hasNextEpisode, onNextEpisode, tryAdvance])

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
            skipTimesRecap,
            // Maratón fuerza el salto de intro y créditos (ver processTimeUpdates). El avance
            // automático al terminar el episodio sigue igual (ver tryAdvance más abajo).
            autoSkipIntroPref,
            autoSkipOutroPref,
            skipStepSecondsPref,
            chapters,
            mediaFormat,
            marathonMode,
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
    }, [
        skipTimesOp,
        skipTimesEd,
        skipTimesRecap,
        autoSkipIntroPref,
        autoSkipOutroPref,
        skipStepSecondsPref,
        chapters,
        mediaFormat,
        marathonMode,
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
    ])

    const processTimeUpdates = useCallback((curr: number, total: number) => {
        const video = videoRef.current
        if (!video) return

        const cfg = configRef.current
        // En maratón, al llegar a los créditos con siguiente episodio se avanza directo (sin el residuo de ~2s de ED).
        const marathonAdvances = cfg.marathonMode && cfg.hasNextEpisode && !!cfg.onNextEpisode && cfg.mediaFormat?.toUpperCase() !== "MOVIE"
        const preview = findActivePreview(cfg.chapters, curr, total)
        const activeOp = preview ? undefined : resolveActiveOp(cfg.skipTimesOp, total, cfg.mediaFormat)
        const activeEd = preview ? undefined : resolveActiveEd(cfg.skipTimesEd, total, cfg.mediaFormat)

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
        // El resumen tiene su propia ventana y prioridad sobre la intro heurística.
        const recap = cfg.skipTimesRecap
        const pendingEnd = pendingOpeningEndRef.current
        const continueOpeningSkip = pendingEnd !== null && recap !== undefined &&
            extendOpeningSkip(pendingEnd, recap, total) > pendingEnd
        if (pendingEnd !== null && (curr < pendingEnd - 1 || (recap && curr >= recap.endTime))) {
            pendingOpeningEndRef.current = null
        }
        if (recap && recap.endTime <= total) {
            if (curr < recap.startTime) hasAutoSkippedRecapRef.current = false
            if (curr >= recap.startTime && curr < recap.endTime) {
                if ((cfg.marathonMode || cfg.autoSkipIntroPref || continueOpeningSkip) && !hasAutoSkippedRecapRef.current) {
                    pendingOpeningEndRef.current = null
                    hasAutoSkippedRecapRef.current = true
                    preSkipPositionRef.current = curr
                    setVideoCurrentTime(video, recap.endTime)
                    lastManualSeekTimestampRef.current = Date.now()
                    video.play().catch(() => {})
                    setSkipMode(null)
                    triggerToast("recap")
                    return
                }
                const { remaining, progress: rawProgress } = getSegmentStatus(curr, recap.startTime, recap.endTime)
                const progress = Math.round(rawProgress)
                if (skipModeRef.current !== "recap") setSkipMode("recap")
                if (skipRemainingSecondsRef.current !== remaining) setSkipRemainingSeconds(remaining)
                if (segmentProgressRef.current !== progress) setSegmentProgress(progress)
                return
            }
        }
        if (skipModeRef.current === "recap") setSkipMode(null)

        if (preview) {
            const key = getChapterSkipKey(preview)
            if ((cfg.autoSkipOutroPref || cfg.marathonMode) && !skippedChaptersRef.current.has(key)) {
                skippedChaptersRef.current.add(key)
                preSkipPositionRef.current = curr
                setVideoCurrentTime(video, preview.endTime)
                lastManualSeekTimestampRef.current = Date.now()
                video.play().catch(() => {})
                setSkipMode(null)
                triggerToast("segment")
                return
            }
            const { remaining, progress: rawProgress } = getSegmentStatus(curr, preview.startTime, preview.endTime)
            const progress = Math.round(rawProgress)
            if (skipModeRef.current !== "preview") setSkipMode("preview")
            if (skipRemainingSecondsRef.current !== remaining) setSkipRemainingSeconds(remaining)
            if (segmentProgressRef.current !== progress) setSegmentProgress(progress)
        } else if (skipModeRef.current === "preview") {
            setSkipMode(null)
        }

        if (cfg.chapters.length > 0) {
            const skippable = findSkippableChapter(cfg.chapters.filter(c => !isRecapChapter(c) && !isPreviewChapter(c)), curr, skippedChaptersRef.current, {
                // Maratón fuerza intro y créditos, y salta resumen/recap/eyecatch.
                autoSkipIntroPref: cfg.autoSkipIntroPref || cfg.marathonMode,
                autoSkipOutroPref: cfg.autoSkipOutroPref || cfg.marathonMode,
                skipIntermediates: cfg.autoSkipIntroPref || cfg.marathonMode,
            })
            if (skippable) {
                skippedChaptersRef.current.add(getChapterSkipKey(skippable))
                // Créditos por capítulo en maratón: mismo avance directo que la sección 6.
                if (marathonAdvances && isOutroChapter(skippable) && tryAdvance()) return
                // Guardar la posición para que "Deshacer" vuelva al inicio del capítulo.
                preSkipPositionRef.current = curr
                setVideoCurrentTime(video, isIntroChapter(skippable) ? extendOpeningSkip(skippable.endTime, recap, total) : skippable.endTime)
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
            // Maratón fuerza el salto, pero las ventanas heurísticas siguen sin saltarse solas (shouldAutoSkip).
            if ((cfg.autoSkipIntroPref || cfg.marathonMode) && inWindow && !hasAutoSkippedIntroRef.current && shouldAutoSkip(source)) {
                hasAutoSkippedIntroRef.current = true
                preSkipPositionRef.current = curr
                setVideoCurrentTime(video, extendOpeningSkip(endTime, recap, total))
                lastManualSeekTimestampRef.current = Date.now()
                video.play().catch(() => {})
                setSkipMode(null)
                triggerToast("intro")
                return
            }
            if (inWindow && curr >= startTime + 1) {
                const { remaining, progress: rawProgress } = getSegmentStatus(curr, startTime, endTime)
                const progress = Math.round(rawProgress)
                if (skipModeRef.current !== "intro") setSkipMode("intro")
                if (skipRemainingSecondsRef.current !== remaining) setSkipRemainingSeconds(remaining)
                if (segmentProgressRef.current !== progress) setSegmentProgress(progress)
            } else if (skipModeRef.current === "intro") {
                setSkipMode(null)
            }
        }

        // ── 6. ED / Outro window ───────────────────────────────────────────────
        if (activeEd) {
            const { startTime, endTime, source } = activeEd
            const inWindow = curr >= startTime && curr < endTime
            
            if ((cfg.autoSkipOutroPref || cfg.marathonMode) && inWindow && !hasAutoSkippedOutroRef.current && shouldAutoSkipOutro(source)) {
                // En maratón no tiene sentido saltar el outro para seguir viendo el
                // buffer post-ED: se avanza directo al siguiente episodio, sin el
                // residuo de ~2s que dejaba el salto a `endTime` (= total-5) hasta
                // que la sección 9 disparaba a total-3. Si es el último episodio
                // (no hay siguiente), cae al salto de outro normal de abajo.
                if (marathonAdvances) {
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
                const { remaining, progress: rawProgress } = getSegmentStatus(curr, startTime, endTime)
                const progress = Math.round(rawProgress)
                if (skipModeRef.current !== "outro") setSkipMode("outro")
                if (skipRemainingSecondsRef.current !== remaining) setSkipRemainingSeconds(remaining)
                if (segmentProgressRef.current !== progress) setSegmentProgress(progress)
            } else if (skipModeRef.current === "outro") {
                setSkipMode(null)
            }
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
            // Y la placa del título del siguiente (su resumen), si es un episodio de Drive.
            if (cfg.mediaFormat?.toUpperCase() !== "MOVIE") prefetchDriveTitleCard(cfg.nextStreamUrl)

            if ((cfg.malId || cfg.mediaId) && cfg.episodeNumber) {
                const nextEp = cfg.episodeNumber + 1
                cfg.queryClient?.prefetchQuery({
                    queryKey: aniskipQueryKeys.times(cfg.malId, cfg.mediaId, nextEp),
                    queryFn: () => getAniSkipTimes({ malId: cfg.malId ?? null, mediaId: cfg.mediaId ?? null, episodeNumber: nextEp, episodeDuration: 0 })
                })
            }
        }

        // ── 8. "Up next" panel + countdown visibility ─────────────────────────
        const inEdWindow = activeEd ? curr >= activeEd.startTime && curr < activeEd.endTime : false
        const shouldShowNext = shouldShowNextEpisode({
            mediaFormat: cfg.mediaFormat,
            marathonMode: cfg.marathonMode,
            hasNextEpisode: cfg.hasNextEpisode,
            total,
            curr,
            inEdWindow,
        })

        if (shouldShowNext) {
            if (!showNextEpisodeRef.current) {
                setShowNextEpisode(true)
                const wantCountdown = !cfg.marathonMode && cfg.autoPlayNextEpisode
                setShowCountdown(wantCountdown)
                setCountdownSeconds(COUNTDOWN_START)
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
    }, [setActiveChapter, setSegmentProgress, setShowNextEpisode, setSkipMode, setSkipRemainingSeconds, activeChapterRef, showNextEpisodeRef, skipModeRef, skipRemainingSecondsRef, segmentProgressRef, triggerToast, videoRef, tryAdvance])

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
            hasAutoSkippedRecapRef.current = false
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
                    }, 1000)
                    return () => clearTimeout(timer)
                }
            }
        }
    }, [videoEnded, hasNextEpisode, autoPlayNextEpisode, marathonMode, mediaFormat, episodeNumber, tryAdvance])

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
        handleSetAutoSkipIntro,
        handleSetAutoSkipOutro,
        handleSetMarathonMode,
        handleSkipIntro,
        showCountdown,
        processTimeUpdates,
        checkManualSkipOverrides,
        undoSkip,
    }
}
