import { useState, useEffect, type ReactNode } from "react"
import { m, AnimatePresence, useIsPresent } from "framer-motion"
import { useSpringPreset, useReducedMotion } from "@/components/ui/kinetics/hooks"
import { IconUiSpinner, IconUiAlert, IconMediaPlay, IconMediaPause, IconMediaSkipNext, IconMediaVolume2, IconMediaVolumeX, IconStatusZap } from "@/components/ui/icons"
import { cn } from "@/components/ui/core/styling"
import { ElasticCounter } from "@/components/ui/kinetics/elastic-counter"
import { Button } from "@/components/ui/button"
import { PLAYER_GLASS } from "./player-theme"

/** Mensaje del 404 de mediastream: el overlay lo titula "Archivo no disponible". */
export const STREAM_FILE_MISSING_MSG =
    "No encontramos el archivo de este episodio. Revisa que el disco o la carpeta de tu biblioteca estén conectados."

/** Mensaje del 401 de mediastream con Drive vencido: el overlay ofrece ir a Ajustes. */
export const STREAM_DRIVE_AUTH_MSG =
    "Google Drive se desconectó porque venció la autorización. Vuelve a conectarlo en Ajustes e inténtalo de nuevo."

const STREAM_SWITCH_COPY = {
    audio: { title: "Cambiando el audio", detail: "Preparando la nueva pista…" },
    source: { title: "Cambiando de fuente", detail: "Retomando en el mismo punto…" },
    fallback: { title: "Preparando el video", detail: "Adaptando el formato para tu dispositivo…" },
} as const

export function LoadingErrorOverlay({
    status,
    errorMsg,
    isBuffering,
    isSeeking,
    isStreamSwitching,
    streamSwitchReason = "audio",
    onClose,
    onRetry,
}: {
    status: "loading" | "ready" | "error"
    errorMsg: string
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
    useEffect(() => {
        if (!isBuffering || !isSeeking) return
        const timer = setTimeout(() => setIsSeekBufferingDelayed(true), 500)
        return () => {
            clearTimeout(timer)
            setIsSeekBufferingDelayed(false)
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
                        {errorMsg === STREAM_FILE_MISSING_MSG
                            ? "Archivo no disponible"
                            : errorMsg === STREAM_DRIVE_AUTH_MSG ? "Drive desconectado" : "No se pudo reproducir"}
                    </h3>
                    <p className="text-sm text-on-surface-variant leading-relaxed">{errorMsg}</p>
                    <div className="flex items-center gap-2 mt-4">
                        {errorMsg === STREAM_DRIVE_AUTH_MSG && (
                            <Button
                                intent="primary"
                                size="lg"
                                onClick={() => { window.location.href = "/settings" }}
                            >
                                Ir a Ajustes
                            </Button>
                        )}
                        {onRetry && (
                            <Button
                                intent="primary"
                                size="lg"
                                onClick={onRetry}
                            >
                                Reintentar
                            </Button>
                        )}
                        <Button
                            intent={onRetry ? "glass" : "primary"}
                            size="lg"
                            onClick={onClose}
                        >
                            Volver
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    return null
}

export function CenterPlayFlash({ flash }: { flash: "play" | "pause" | null }) {
    const reduceMotion = useReducedMotion()

    // Sin mode="wait": con play/pausa seguidos (barra espaciadora) el ícono nuevo entra
    // mientras el anterior se va, en vez de hacer cola detrás de su salida.
    return (
        <AnimatePresence>
            {flash && (
                <div key={flash} className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                    <m.div
                        initial={{ scale: reduceMotion ? 1 : 0.85, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: reduceMotion ? 1 : 1.25, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                        className={cn("flex items-center justify-center w-20 h-20 rounded-full", PLAYER_GLASS)}
                    >
                        {flash === "play"
                            ? <IconMediaPlay className="w-8 h-8 text-white ml-1 fill-current" />
                            : <IconMediaPause className="w-8 h-8 text-white fill-current" />
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
    stackAbove = false,
    hasNextEpisode = false,
    nextEpisodeTitle,
}: {
    show: boolean
    onSkip: () => void
    skipMode?: "intro" | "outro" | "recap" | "preview"
    hasNextEpisode?: boolean
    /** Título del siguiente episodio: el outro lo muestra en el botón si está disponible. */
    nextEpisodeTitle?: string
    remainingSeconds?: number
    segmentProgress?: number
    shortcutKey?: string
    /** Con la tarjeta de siguiente episodio visible (modo normal), el botón se apila encima de ella. */
    stackAbove?: boolean
    /** Con la barra de controles visible, el botón sube para no pisarla. */
    controlsVisible?: boolean
}) {
    const isOutro = skipMode === "outro"
    const nextLabel = nextEpisodeTitle ? `Próximo: ${nextEpisodeTitle}` : "Próximo episodio"
    const label = skipMode === "preview" ? "Saltar adelanto" : skipMode === "recap" ? "Saltar resumen" : isOutro ? (hasNextEpisode ? nextLabel : "Saltar créditos") : "Saltar intro"
    const fillProgress = 100 - segmentProgress
    // Alturas: tarjeta h-14 (3.5rem) + separación 0.75rem; el botón parte de bottom-8 (2rem).
    // Con la barra visible la tarjeta sube 6rem, sin barra no sube.
    const lift = stackAbove
        ? (controlsVisible ? "-translate-y-[10.25rem]" : "-translate-y-[4.25rem]")
        : (controlsVisible ? "-translate-y-24" : "translate-y-0")

    return (
        <div
            aria-hidden={!show}
            className={cn(
                // Esquina inferior derecha (convención Netflix/Crunchyroll): el lado
                // izquierdo lo ocupan play/volumen y sus tooltips.
                // Sube sobre la barra de controles con transform (no con `bottom`, que
                // recalcula el layout en cada cuadro): bottom-8 − 4rem = bottom-24.
                "absolute right-3 sm:right-6 bottom-8 z-player-overlay pointer-events-auto",
                "transition-[opacity,transform] duration-base ease-out-strong",
                show
                    ? cn("opacity-100", lift)
                    : cn("opacity-0 pointer-events-none", controlsVisible ? "-translate-y-[5.25rem]" : "translate-y-3")
            )}>
            <button
                type="button"
                id="skip-intro-btn"
                tabIndex={show ? 0 : -1}
                aria-label={label}
                onClick={(e) => {
                    e.stopPropagation()
                    onSkip()
                }}
                className={cn(
                    // Pastilla clara (AVKit): la única acción blanca sobre el video.
                    "player-skip-btn relative isolate flex items-center gap-2.5 h-12 pl-5 pr-2 overflow-hidden rounded-full",
                    "bg-[var(--selected-bg)] text-[var(--selected-fg)] shadow-elevation-2",
                    "text-sm font-semibold tracking-wide",
                    "[@media(hover:hover)_and_(pointer:fine)]:hover:brightness-95",
                    "transition-[color,filter,transform] duration-fast motion-safe:active:scale-[0.97] ease-out-strong cursor-pointer group",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                )}
            >
                {/* Cuenta regresiva del segmento: se vacía de izquierda a derecha */}
                <div
                    aria-hidden
                    className={cn(
                        "absolute inset-0 -z-10 origin-left transition-transform duration-slow ease-linear motion-reduce:transition-none",
                        "bg-black/10"
                    )}
                    style={{ transform: `scaleX(${Math.min(100, Math.max(0, fillProgress)) / 100})` }}
                />

                <IconMediaSkipNext className="w-4 h-4 shrink-0 fill-current" />

                <span className="truncate max-w-[min(18rem,55vw)]">{label}</span>

                {remainingSeconds !== undefined && remainingSeconds > 0 && (
                    <span className="tabular-nums text-[color:color-mix(in_srgb,var(--selected-fg)_70%,transparent)]">
                        <ElasticCounter value={remainingSeconds} />s
                    </span>
                )}

                <kbd className={cn(
                    "hidden sm:inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full",
                    "text-2xs font-mono font-semibold",
                    "bg-black/10 text-[color:color-mix(in_srgb,var(--selected-fg)_70%,transparent)]"
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
    showType: "intro" | "outro" | "recap" | "segment" | null
    onUndo: () => void
    controlsVisible?: boolean
}) {
    const entranceSpring = useSpringPreset("entrance")
    const reduceMotion = useReducedMotion()

    const label = showType === "recap" ? "Resumen saltado" : showType === "outro"
        ? "Créditos saltados"
        : showType === "segment"
            ? "Segmento saltado"
            : "Intro saltada"

    return (
        // El contenedor sube sobre la barra de controles con transform (no con `bottom`,
        // que recalcula el layout); la entrada y salida del aviso las anima framer adentro.
        <div
            className={cn(
                "absolute right-3 sm:right-6 bottom-8 z-player-overlay pointer-events-none transition-transform duration-base ease-out-strong",
                controlsVisible ? "-translate-y-24" : "translate-y-0"
            )}
        >
        <AnimatePresence>
            {showType && (
                <m.div
                    key="auto-skip-toast"
                    data-toast="auto-skip"
                    initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
                    transition={reduceMotion ? { duration: 0.15 } : entranceSpring}
                    className="pointer-events-auto"
                >
                    <div className={cn(
                        "flex items-center h-11 pl-4 pr-1.5 text-label-1 rounded-full",
                        PLAYER_GLASS,
                        "text-xs font-semibold tracking-wide",
                        "[&>*:not(:first-child)]:ml-2"
                    )}>
                        <span className="whitespace-nowrap">{label}</span>

                        <Button
                            intent="secondary"
                            size="xs"
                            tabIndex={0}
                            aria-label="Deshacer salto"
                            onClick={(e) => {
                                e.stopPropagation()
                                onUndo()
                            }}
                        >
                            Deshacer
                        </Button>
                    </div>
                </m.div>
            )}
        </AnimatePresence>
        </div>
    )
}

/**
 * Capa de entrada/salida de la pastilla "Siguiente episodio". Mientras sale (useIsPresent en
 * false) deja de recibir clics, como el panel de Mi Lista: si no, un toque durante la salida
 * volvería a llamar onNext y podría saltar otro episodio.
 */
export function NextEpisodeLayer({ children }: { children: ReactNode }) {
    const isPresent = useIsPresent()
    const entranceSpring = useSpringPreset("entrance")
    const reduceMotion = useReducedMotion()

    return (
        <m.div
            initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : 24 }}
            transition={reduceMotion ? { duration: 0.15 } : entranceSpring}
            className={isPresent ? "pointer-events-auto" : "pointer-events-none"}
            // inert durante la salida: el teclado (Enter o Espacio sobre el foco) tampoco debe volver a llamar onNext.
            inert={!isPresent}
        >
            {children}
        </m.div>
    )
}

export function NextEpisodeOverlay({
    show,
    showCountdown,
    countdownSeconds,
    nextEpisodeTitle,
    nextEpisodeImage,
    nextEpisodeNumber,
    onNext,
    remainingProgress,
    controlsVisible = true,
}: {
    show: boolean
    showCountdown: boolean
    countdownSeconds: number
    nextEpisodeTitle?: string
    nextEpisodeImage?: string
    nextEpisodeNumber?: number
    onNext: () => void
    remainingProgress: number
    /** Con la barra de controles visible, la pastilla sube para no pisarla. */
    controlsVisible?: boolean
}) {
    const fill = Math.min(100, Math.max(0, remainingProgress)) / 100

    return (
        // Misma esquina y altura que "Saltar intro": las dos acciones de fin de segmento
        // viven en el mismo lugar. El desplazamiento usa transform, no `bottom`.
        <div
            className={cn(
                "absolute right-3 sm:right-6 bottom-8 z-player-overlay pointer-events-none transition-transform duration-base ease-out-strong motion-reduce:transition-none",
                controlsVisible ? "-translate-y-24" : "translate-y-0"
            )}
        >
        <AnimatePresence>
            {show && (
                <NextEpisodeLayer key="next-episode-overlay">
                    <button
                        type="button"
                        tabIndex={0}
                        aria-label={nextEpisodeTitle ? `Ver siguiente episodio: ${nextEpisodeTitle}` : "Ver siguiente episodio"}
                        onClick={(e) => {
                            e.stopPropagation()
                            onNext()
                        }}
                        className={cn(
                            "player-next-ep-btn relative isolate flex items-center gap-3 h-14 max-w-[min(26rem,calc(100vw-1.5rem))] pl-1.5 pr-5 overflow-hidden rounded-full text-left",
                            "bg-[var(--selected-bg)] text-[var(--selected-fg)] shadow-elevation-2 [@media(hover:hover)_and_(pointer:fine)]:hover:brightness-95",
                            "transition-[filter,transform] duration-fast motion-safe:active:scale-[0.97] ease-out-strong cursor-pointer",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                        )}
                    >
                        {/* Cuenta regresiva: el relleno se vacía hacia la izquierda */}
                        {showCountdown && (
                            <span
                                aria-hidden
                                className="absolute inset-0 -z-10 origin-left bg-black/10 transition-transform duration-slow ease-linear motion-reduce:transition-none"
                                style={{ transform: `scaleX(${fill})` }}
                            />
                        )}

                        {nextEpisodeImage ? (
                            <span className="player-next-ep-thumb relative shrink-0 h-11 aspect-video rounded-full overflow-hidden bg-black/10">
                                <img src={nextEpisodeImage} alt="" className="w-full h-full object-cover" loading="lazy" />
                                <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-white">
                                    <IconMediaPlay className="w-4 h-4 fill-current" />
                                </span>
                            </span>
                        ) : (
                            <span className="player-next-ep-thumb shrink-0 flex items-center justify-center w-11 h-11 rounded-full bg-black text-white">
                                <IconMediaPlay className="w-4 h-4 fill-current ml-0.5" />
                            </span>
                        )}

                        <span className="flex flex-col min-w-0">
                            <span className="text-sm font-semibold tracking-wide whitespace-nowrap">
                                {nextEpisodeNumber ? `Siguiente episodio · ${nextEpisodeNumber}` : "Siguiente episodio"}
                            </span>
                            {nextEpisodeTitle && (
                                <span className="text-xs text-[color:color-mix(in_srgb,var(--selected-fg)_70%,transparent)] truncate">{nextEpisodeTitle}</span>
                            )}
                        </span>

                        {showCountdown && (
                            <span className="shrink-0 ml-1 text-sm font-semibold tabular-nums text-[color:color-mix(in_srgb,var(--selected-fg)_70%,transparent)] flex items-center">
                                <ElasticCounter value={countdownSeconds} />s
                            </span>
                        )}
                    </button>
                </NextEpisodeLayer>
            )}
        </AnimatePresence>
        </div>
    )
}

export interface PlayerHudData {
    type: "volume" | "speed"
    value: number
    isMuted?: boolean
}

export function PlayerHudOverlay({ hud }: { hud: PlayerHudData | null }) {
    const reduceMotion = useReducedMotion()
    const hudSpring = useSpringPreset("tabIndicator")

    return (
        <AnimatePresence>
            {hud && (
                <div className="absolute top-12 sm:top-14 left-1/2 -translate-x-1/2 z-player-overlay pointer-events-none">
                    <m.div
                        key={`hud-${hud.type}`}
                        initial={{ opacity: 0, y: reduceMotion ? 0 : -8, scale: reduceMotion ? 1 : 0.94 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: reduceMotion ? 0 : -6, scale: reduceMotion ? 1 : 0.96 }}
                        transition={hudSpring}
                        className={cn(
                            "flex items-center gap-2.5 h-10 px-4 rounded-full text-label-1 text-xs font-semibold tracking-wide select-none",
                            PLAYER_GLASS
                        )}
                    >
                        {hud.type === "volume" && (
                            <>
                                {hud.isMuted || hud.value === 0 ? (
                                    <IconMediaVolumeX className="w-4 h-4 text-status-error shrink-0" />
                                ) : (
                                    <IconMediaVolume2 className="w-4 h-4 text-brand-accent shrink-0" />
                                )}
                                <div className="w-20 sm:w-24 h-1.5 bg-[var(--neutral-elev-3)] rounded-full overflow-hidden shrink-0">
                                    {/* scaleX en vez de width: cada paso de volumen avanza por el compositor, sin recalcular layout */}
                                    <div
                                        className="h-full w-full origin-left bg-brand-accent rounded-full transition-transform [transition-duration:var(--duration-micro)] ease-out-strong motion-reduce:transition-none"
                                        style={{ transform: `scaleX(${hud.isMuted ? 0 : hud.value})` }}
                                    />
                                </div>
                                <span className="font-mono tabular-nums text-xs font-bold min-w-[32px] text-right">
                                    {hud.isMuted ? "0%" : `${Math.round(hud.value * 100)}%`}
                                </span>
                            </>
                        )}

                        {hud.type === "speed" && (
                            <>
                                <IconStatusZap className="w-4 h-4 text-brand-accent shrink-0" />
                                <span className="font-mono tabular-nums font-bold text-xs">
                                    {hud.value}x
                                </span>
                                <span className="text-xs text-label-2 font-medium">
                                    Velocidad
                                </span>
                            </>
                        )}
                    </m.div>
                </div>
            )}
        </AnimatePresence>
    )
}

