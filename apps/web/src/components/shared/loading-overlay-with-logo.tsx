import { Button } from "@/components/ui/button"
import { m } from "framer-motion"
import { useEffect, useState } from "react"
import { IconUiRefresh, IconNavigationSettings } from "@/components/ui/icons";
import { cn } from "@/components/ui/core/styling"
import { useReducedMotion } from "@/components/ui/kinetics/hooks"

const CONNECTION_TIMEOUT_MS = 12000 // tiempo antes de mostrar el cuadro de diagnóstico
const POLL_FAST_MS = 1200
const POLL_SLOW_MS = 4000
// Anillo de 7 esferas del Dragón (1 a 7 estrellas, PNG en public/icons/dragon-balls): empieza arriba y
// avanza en sentido horario. Todas se encienden y apagan a la vez (ciclo de 3 s).
const RING_SIZE = 120 // px del anillo
const RING_RADIUS = 42 // px del centro del anillo al centro de cada esfera
const BALL_SIZE = 26 // px de cada esfera
const DRAGON_BALLS = Array.from({ length: 7 }, (_, i) => ({
    src: `/icons/dragon-balls/star-${i + 1}.png`,
    angle: (i * 360) / 7,
}))

// El instante de arranque vive fuera del componente: el overlay puede desmontarse y volver a
// montarse mientras el estado de la consulta alterna (isLoading/isError) y el temporizador no debe reiniciarse.
const appStartedAt = typeof performance !== "undefined" ? performance.now() : Date.now()
const elapsedMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now()) - appStartedAt

export function LoadingOverlayWithLogo({
    refetch,
    title,
    isError,
    message,
    className,
}: {
    refetch?: () => void
    title?: string
    isError?: boolean
    message?: string
    className?: string
}) {
    const [timedOut, setTimedOut] = useState(() => elapsedMs() >= CONNECTION_TIMEOUT_MS)
    const [dynamicStatusMessage, setStatusMessage] = useState("")
    const statusMessage = message || dynamicStatusMessage
    const reduceMotion = useReducedMotion()

    useEffect(() => {
        let isMounted = true
        // Progressive status message transitions
        const t1 = setTimeout(() => { if (isMounted) setStatusMessage("Iniciando servicios…") }, 2000)
        const t2 = setTimeout(() => { if (isMounted) setStatusMessage("Conectando con el servidor…") }, 4500)
        const t3 = setTimeout(() => { if (isMounted) setStatusMessage("Sincronizando datos locales…") }, 8000)

        // Listen for Tauri backend events if available
        let unlisten: (() => void) | undefined
        if (typeof window !== "undefined") {
            const hasTauri = typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== "undefined"
            if (hasTauri) {
                import("@tauri-apps/api/event").then(({ listen }) => {
                    if (!isMounted) return
                    listen<string>("server-status", (event) => {
                        if (!isMounted) return
                        if (event.payload === "compiling") {
                            setStatusMessage("Preparando el servidor…")
                        } else if (event.payload === "starting") {
                            setStatusMessage("Iniciando el servidor…")
                        } else if (event.payload === "ready") {
                            setStatusMessage("Servidor listo. Conectando…")
                        }
                    }).then((fn) => {
                        if (isMounted) unlisten = fn
                        else fn()
                    }).catch(() => {})
                }).catch(() => {})
            }
        }

        // Connection timeout
        const timeoutTimer = setTimeout(() => {
            if (isMounted) setTimedOut(true)
        }, Math.max(0, CONNECTION_TIMEOUT_MS - elapsedMs()))

        return () => {
            isMounted = false
            clearTimeout(t1)
            clearTimeout(t2)
            clearTimeout(t3)
            clearTimeout(timeoutTimer)
            if (unlisten) unlisten()
        }
    }, [])

    useEffect(() => {
        // Sync message with HTML global loader text if present
        const textEl = document.getElementById("global-loader-text")
        if (textEl && textEl.textContent !== statusMessage) {
            textEl.textContent = statusMessage
        }
    }, [statusMessage])

    useEffect(() => {
        // Con error, seguir sondeando el backend: rápido al principio y más espaciado tras el
        // aviso, para que la app se recupere sola cuando el servidor vuelva.
        if (isError) {
            const interval = setInterval(() => {
                if (refetch) {
                    refetch()
                }
            }, timedOut ? POLL_SLOW_MS : POLL_FAST_MS)
            return () => clearInterval(interval)
        }
    }, [isError, timedOut, refetch])

    // El aviso de "Sin conexión" necesita un error real: el reloj cuenta desde el arranque de la app, así
    // que sin `isError` (Ajustes, onboarding) una carga lenta pasada la marca de 12 s lo mostraba con el servidor sano.
    const showFailure = timedOut && Boolean(isError)

    // Sin AnimatePresence propio: quien lo monta lo envuelve y, al desmontarlo, espera a este nodo raíz.
    // La salida es un fundido de 150 ms (--duration-quick); con movimiento reducido, instantánea.
    return (
        <m.div
            role={showFailure ? "alert" : "status"}
            aria-live={showFailure ? "assertive" : "polite"}
            initial={false}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.15, ease: "easeOut" } }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className={cn(
                "UI-LoadingOverlay__overlay fixed inset-0 z-50 bg-bg-primary flex flex-col justify-center items-center overflow-hidden select-none",
                className
            )}
        >
            {/* Título & Branding */}
            <div className="flex flex-col items-center gap-7 z-[1] text-center">
                <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-cinema-md uppercase leading-none text-label-1 drop-shadow-[0_0_24px_color-mix(in_srgb,var(--brand-accent-hex)_20%,transparent)] pl-[0.3em]">
                    {title ?? "KAMEHOUSE"}
                </h1>

                {/* Anillo de 7 esferas del Dragón: se encienden y apagan todas a la vez, en círculo, como al
                    invocar a Shenlong. */}
                {!showFailure && (
                    <div className="flex flex-col items-center gap-3.5 animate-in fade-in duration-base">
                        <div className="relative shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
                            {DRAGON_BALLS.map((ball) => (
                                <img
                                    key={ball.src}
                                    src={ball.src}
                                    alt=""
                                    aria-hidden="true"
                                    draggable={false}
                                    className="absolute select-none pointer-events-none animate-ball-charge"
                                    style={{
                                        left: "50%",
                                        top: "50%",
                                        width: BALL_SIZE,
                                        height: BALL_SIZE,
                                        marginLeft: -BALL_SIZE / 2,
                                        marginTop: -BALL_SIZE / 2,
                                        transform: `rotate(${ball.angle}deg) translateY(-${RING_RADIUS}px) rotate(${-ball.angle}deg)`,
                                    }}
                                />
                            ))}
                        </div>
                        {/* Cada mensaje nuevo entra con text-swap-in (la `key` lo vuelve a montar). */}
                        <p key={statusMessage} className="text-xs font-medium text-label-2 animate-text-swap-in">
                            {statusMessage}
                        </p>
                    </div>
                )}
            </div>

            {/* Estado de error / Desconexión solo tras timeout real */}
            {showFailure ? (
                <m.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                    className="flex flex-col items-center gap-3 mt-6 z-[1] max-w-sm px-6 py-5 rounded-2xl bg-surface-container-high/80 border border-outline-variant/40 backdrop-blur-overlay-md [[data-flat=true]_&]:backdrop-blur-none [[data-flat=true]_&]:bg-surface-container-high shadow-elevation-3 text-center mx-4"
                >
                    {/* Ilustración de error recortada a la mitad inferior (solo cuello, hombros y manos). Decorativa: el texto explica el error. */}
                    <img
                        src="/illustrations/error-character.png"
                        alt=""
                        aria-hidden="true"
                        draggable={false}
                        className="w-48 aspect-[900/256] object-cover object-bottom select-none pointer-events-none"
                    />
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-brand-destructive/10 border border-brand-destructive/20">
                        <span className="w-2 h-2 rounded-full bg-brand-destructive animate-pulse motion-reduce:animate-none" />
                        <span className="text-xs font-semibold text-brand-destructive">
                            Sin conexión con el servidor
                        </span>
                    </div>
                    <p className="text-label-2 text-xs font-normal leading-relaxed">
                        El servidor no responde. Comprueba que KameHouse esté en ejecución; seguimos intentando conectar.
                    </p>
                    <div className="flex items-center gap-3 mt-2 w-full">
                        <Button
                            onClick={() => {
                                if (refetch) refetch()
                                else window.location.reload()
                            }}
                            intent="primary"
                            size="sm"
                            className="flex-1 rounded-xl text-xs font-semibold cursor-pointer transition-[background-color,border-color,transform] duration-fast ease-smooth-out"
                            leftIcon={<IconUiRefresh className="w-3.5 h-3.5" />}
                        >
                            Reintentar
                        </Button>
                        <Button
                            onClick={() => { window.location.href = "/settings" }}
                            intent="secondary"
                            size="sm"
                            className="flex-1 rounded-xl text-xs font-semibold cursor-pointer transition-[background-color,border-color,transform] duration-fast ease-smooth-out"
                            leftIcon={<IconNavigationSettings className="w-3.5 h-3.5" />}
                        >
                            Ajustes
                        </Button>
                    </div>
                </m.div>
            ) : null}
        </m.div>
    )
}
