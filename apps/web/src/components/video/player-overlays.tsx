import React, { useState, useEffect, useRef } from "react"
import { m, AnimatePresence } from "framer-motion"
import { useSpringPreset, useReducedMotion } from "@/components/ui/kinetics/hooks"
import { IconUiSpinner, IconUiAlert, IconMediaPlay } from "@/components/ui/icons"
import { cn } from "@/components/ui/core/styling"
import { ElasticCounter } from "@/components/ui/kinetics/elastic-counter"
import { PLAYER_EYEBROW, PLAYER_GLASS, PLAYER_PRIMARY_BTN, PLAYER_SECONDARY_BTN } from "./player-theme"

/** Mensaje del 404 de mediastream: el overlay lo titula "Archivo no disponible". */
export const STREAM_FILE_MISSING_MSG =
    "No encontramos el archivo de este episodio. Revisá que el disco o la carpeta de tu biblioteca estén conectados."

const STREAM_SWITCH_COPY = {
    audio: { title: "Cambiando pista de audio", detail: "Iniciando transcodificación…" },
    source: { title: "Cambiando de fuente", detail: "Retomando en el mismo punto…" },
    fallback: { title: "Preparando el video", detail: "Pasando a transcodificación…" },
} as const

export function LoadingErrorOverlay({
    status,
    errorMsg,
    streamType: _streamType,
    isBuffering,
    isSeeking,
    isStreamSwitching,
    streamSwitchReason = "audio",
    onClose,
    onRetry,
}: {
    status: "loading" | "ready" | "error"
    errorMsg: string
    streamType: string
    isBuffering: boolean
    isSeeking?: boolean
    /** true cuando el loading es un cambio de stream mid-playback (ej. switch de pista de audio). */
    isStreamSwitching?: boolean
    streamSwitchReason?: "audio" | "source" | "fallback"
    onClose: () => void
    onRetry?: () => void
}) {
    // Debounce buffering spinner on seek: wait 500ms before showing it
    const [isSeekBufferingDelayed, setIsSeekBufferingDelayed] = useState(false)
    const bufferingTimerRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        if (isBuffering && isSeeking) {
            if (bufferingTimerRef.current) clearTimeout(bufferingTimerRef.current)
            bufferingTimerRef.current = setTimeout(() => setIsSeekBufferingDelayed(true), 500)
        } else {
            if (bufferingTimerRef.current) clearTimeout(bufferingTimerRef.current)
            const timer = setTimeout(() => setIsSeekBufferingDelayed(false), 0)
            return () => clearTimeout(timer)
        }
        return () => {
            if (bufferingTimerRef.current) clearTimeout(bufferingTimerRef.current)
        }
    }, [isBuffering, isSeeking])

    const showBuffering = isBuffering && (!isSeeking || isSeekBufferingDelayed)

    if (status === "loading") {
        if (isStreamSwitching) {
            const { title, detail } = STREAM_SWITCH_COPY[streamSwitchReason]
            return (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-player-overlay text-white bg-black/60">
                    <IconUiSpinner className="w-8 h-8 text-brand-accent animate-spin" aria-label={`${title}…`} />
                    <div className="flex flex-col items-center text-center">
                        <span className="text-xs font-semibold tracking-wide">{title}</span>
                        <span className="text-xs text-on-surface-variant">{detail}</span>
                    </div>
                </div>
            )
        }
        // Carga inicial del player: fondo negro sólido justificado
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-player-overlay text-white bg-black">
                <IconUiSpinner className="w-8 h-8 text-white/80 animate-spin" />
            </div>
        )
    }

    if (showBuffering && status === "ready") {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-player-overlay text-white pointer-events-none">
                <IconUiSpinner className="w-8 h-8 text-white/80 animate-spin" aria-label={isSeeking ? "Buscando posición…" : "Cargando…"} />
            </div>
        )
    }

    if (status === "error") {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-player-overlay px-8 text-center text-white bg-black/80">
                <div className="flex flex-col items-center max-w-sm gap-2">
                    <IconUiAlert className="w-8 h-8 text-brand-accent mb-1" />
                    <h3 className="font-display text-xl font-medium tracking-tight">
                        {errorMsg === STREAM_FILE_MISSING_MSG ? "Archivo no disponible" : "No se pudo reproducir"}
                    </h3>
                    <p className="text-sm text-on-surface-variant leading-relaxed">{errorMsg}</p>
                    <div className="flex items-center gap-2 mt-4">
                        {onRetry && (
                            <button
                                onClick={onRetry}
                                className={PLAYER_PRIMARY_BTN}
                            >
                                Reintentar
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className={onRetry ? PLAYER_SECONDARY_BTN : PLAYER_PRIMARY_BTN}
                        >
                            Regresar
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return null
}

export function CenterPlayFlash({ flash }: { flash: "play" | "pause" | null }) {
    const reduceMotion = useReducedMotion()

    return (
        <AnimatePresence mode="wait">
            {flash && (
                <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                    <m.div
                        key={flash}
                        initial={{ scale: reduceMotion ? 1 : 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: reduceMotion ? 1 : 1.35, opacity: 0 }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        className={cn("flex items-center justify-center w-20 h-20 rounded-full", PLAYER_GLASS)}
                    >
                        {flash === "play"
                            ? <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white ml-1"><path d="M8 5v14l11-7z" /></svg>
                            : <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                        }
                    </m.div>
                </div>
            )}
        </AnimatePresence>
    )
}

export function SkipIntroOverlay({
    show,
    onSkip,
    skipMode = "intro",
    remainingSeconds,
    segmentProgress = 0,
    shortcutKey = "S",
    controlsVisible = true,
}: {
    show: boolean
    onSkip: () => void
    skipMode?: "intro" | "outro"
    remainingSeconds?: number
    segmentProgress?: number
    shortcutKey?: string
    /** Con la barra de controles visible, el botón sube para no pisarla. */
    controlsVisible?: boolean
}) {
    const isOutro = skipMode === "outro"
    const label = isOutro ? "Saltar outro" : "Saltar intro"
    const fillProgress = 100 - segmentProgress

    return (
        <div
            aria-hidden={!show}
            className={cn(
                // Esquina inferior derecha (convención Netflix/Crunchyroll): el lado
                // izquierdo lo ocupan play/volumen y sus tooltips.
                "absolute right-3 sm:right-6 z-player-overlay pointer-events-auto",
                "transition-[opacity,transform,bottom] duration-300 ease-out",
                controlsVisible ? "bottom-24" : "bottom-8",
                show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
            )}>
            <button
                id="skip-intro-btn"
                tabIndex={show ? 0 : -1}
                aria-label={isOutro ? "Saltar Outro / Ending" : "Saltar Intro / Opening"}
                onClick={(e) => {
                    e.stopPropagation()
                    onSkip()
                }}
                className={cn(
                    "relative isolate flex items-center gap-2.5 h-11 pl-4 pr-1.5 overflow-hidden rounded-full",
                    PLAYER_GLASS,
                    "text-white text-xs font-semibold tracking-wide",
                    "hover:bg-white/95 hover:text-black",
                    "transition-colors duration-200 active:scale-[0.97] cursor-pointer group",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                )}
            >
                {/* Cuenta regresiva del segmento: se vacía de izquierda a derecha */}
                <div
                    aria-hidden
                    className={cn(
                        "absolute inset-y-0 left-0 -z-10 transition-[width] duration-slow ease-linear group-hover:opacity-0",
                        isOutro ? "bg-brand-secondary/30" : "bg-brand-accent/30"
                    )}
                    style={{ width: `${fillProgress}%` }}
                />

                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
                    <path d="M5 5.5v13a1 1 0 0 0 1.53.85L15.5 13.1V18a1 1 0 0 0 2 0V6a1 1 0 0 0-2 0v4.9L6.53 4.65A1 1 0 0 0 5 5.5z" />
                </svg>

                <span className="whitespace-nowrap">{label}</span>

                {remainingSeconds !== undefined && remainingSeconds > 0 && (
                    <span className="tabular-nums text-on-surface-variant group-hover:text-black/50">
                        <ElasticCounter value={remainingSeconds} />s
                    </span>
                )}

                <kbd className={cn(
                    "hidden sm:inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full",
                    "text-[11px] font-mono font-semibold",
                    "bg-white/10 text-on-surface-variant group-hover:bg-black/10 group-hover:text-black/60"
                )}>
                    {shortcutKey}
                </kbd>
            </button>
        </div>
    )
}

export function AutoSkipToastOverlay({
    showType,
    onUndo,
    controlsVisible = true,
}: {
    showType: "intro" | "outro" | "segment" | "filler" | null
    onUndo: () => void
    controlsVisible?: boolean
}) {
    const entranceSpring = useSpringPreset("entrance")
    const reduceMotion = useReducedMotion()

    const label = showType === "outro"
        ? "Outro saltado"
        : showType === "segment"
            ? "Segmento saltado"
            : showType === "filler"
                ? "Relleno saltado"
                : "Intro saltada"
    // Al saltar relleno el reproductor ya pasa al siguiente episodio: no hay nada que deshacer.
    const canUndo = showType !== "filler"

    return (
        <AnimatePresence>
            {showType && (
                <m.div
                    key="auto-skip-toast"
                    initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
                    transition={reduceMotion ? { duration: 0.15 } : entranceSpring}
                    className={cn(
                        "absolute right-3 sm:right-6 z-player-overlay pointer-events-auto transition-[bottom] duration-300 ease-out",
                        controlsVisible ? "bottom-24" : "bottom-8"
                    )}
                >
                    <div className={cn(
                        "flex items-center h-11 pl-4 pr-1.5 text-white rounded-full",
                        PLAYER_GLASS,
                        "text-xs font-semibold tracking-wide",
                        "[&>*:not(:first-child)]:ml-2"
                    )}>
                        <span className="whitespace-nowrap">{label}</span>

                        {canUndo && <button
                            tabIndex={0}
                            aria-label="Deshacer salto"
                            onClick={(e) => {
                                e.stopPropagation()
                                onUndo()
                            }}
                            className={cn(PLAYER_SECONDARY_BTN, "h-8 px-3.5")}
                        >
                            Deshacer
                        </button>}
                    </div>
                </m.div>
            )}
        </AnimatePresence>
    )
}

export function NextEpisodeOverlay({
    show,
    tvMode: _tvMode,
    marathonMode: _marathonMode = false,
    showCountdown,
    countdownSeconds,
    nextEpisodeTitle,
    nextEpisodeImage,
    nextEpisodeNumber,
    onNext,
    duration: _duration,
    remainingProgress
}: {
    show: boolean
    tvMode: boolean
    marathonMode?: boolean
    showCountdown: boolean
    countdownSeconds: number
    nextEpisodeTitle?: string
    nextEpisodeImage?: string
    nextEpisodeNumber?: number
    onNext: () => void
    duration: number
    remainingProgress: number
}) {
    const entranceSpring = useSpringPreset("entrance")
    const reduceMotion = useReducedMotion()

    return (
        <AnimatePresence>
            {show && (
                <m.div
                    key="next-episode-overlay"
                    initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: reduceMotion ? 0 : 24 }}
                    transition={reduceMotion ? { duration: 0.15 } : entranceSpring}
                    className="absolute bottom-24 right-3 sm:right-6 z-player-overlay pointer-events-auto"
                >
                    <div className={cn(
                        "flex flex-col w-64 sm:w-72 overflow-hidden rounded-2xl",
                        PLAYER_GLASS,
                        "[&>*:not(:first-child)]:mt-3"
                    )}>
                        {/* Thumbnail */}
                        {nextEpisodeImage && (
                            <div className="relative w-full aspect-video bg-surface-container overflow-hidden">
                                <img
                                    src={nextEpisodeImage}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                                {showCountdown && (
                                    <div className={cn("absolute top-2 right-2 text-2xs font-semibold text-white px-2.5 py-1 rounded-full flex items-center tabular-nums", PLAYER_GLASS)}>
                                        <ElasticCounter value={countdownSeconds} />s
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex flex-col px-4 pb-4 pt-1 [&>*:not(:first-child)]:mt-2.5">
                            <div className="flex items-center justify-between">
                                <span className={PLAYER_EYEBROW}>
                                    {nextEpisodeNumber ? `Siguiente · Ep. ${nextEpisodeNumber}` : "Siguiente"}
                                </span>
                                {!nextEpisodeImage && showCountdown && (
                                    <span className="text-on-surface-variant text-xs tabular-nums flex items-center">
                                        <ElasticCounter value={countdownSeconds} />s
                                    </span>
                                )}
                            </div>

                            {nextEpisodeTitle && (
                                <p className="font-display text-white text-base font-medium tracking-tight leading-snug line-clamp-2">
                                    {nextEpisodeTitle}
                                </p>
                            )}

                            {showCountdown && (
                                <div className="w-full h-0.5 bg-white/15 overflow-hidden rounded-full">
                                    <div
                                        className="h-full bg-brand-accent transition-[width] duration-slow ease-linear"
                                        style={{ width: `${remainingProgress}%` }}
                                    />
                                </div>
                            )}

                            <button
                                tabIndex={0}
                                aria-label={nextEpisodeTitle ? `Ver siguiente episodio: ${nextEpisodeTitle}` : "Ver siguiente episodio"}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onNext()
                                }}
                                className={cn(PLAYER_PRIMARY_BTN, "w-full")}
                            >
                                <IconMediaPlay className="w-3.5 h-3.5 fill-current" />
                                Reproducir ahora
                            </button>
                        </div>
                    </div>
                </m.div>
            )}
        </AnimatePresence>
    )
}
