import * as React from "react"
import { m, type HTMLMotionProps } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { useReducedMotion, useSpringPreset } from "./hooks"

interface HoldConfirmProps extends Omit<HTMLMotionProps<"button">, "children"> {
    onConfirm: () => void | Promise<void>
    holdDurationMs?: number
    label?: string
    confirmLabel?: string
    variant?: "destructive" | "default"
    children?: React.ReactNode
}

export const HoldConfirm = React.forwardRef<HTMLButtonElement, HoldConfirmProps>(
    (
        {
            onConfirm,
            holdDurationMs = 800,
            label = "Mantén para confirmar",
            confirmLabel = "¡Confirmado!",
            variant = "destructive",
            className,
            children,
            disabled,
            ...props
        },
        ref
    ) => {
        // El llenado se escribe en el DOM (scaleX por ref), sin re-render de React en cada cuadro.
        // `aria-valuenow` solo cambia al empezar, cada 10 % y al terminar.
        const [ariaProgress, setAriaProgress] = React.useState(0)
        const [isConfirmed, setIsConfirmed] = React.useState(false)
        const [isPending, setIsPending] = React.useState(false)
        const [hasError, setHasError] = React.useState(false)
        const pendingRef = React.useRef(false)
        const mountedRef = React.useRef(true)
        const barRef = React.useRef<HTMLDivElement>(null)
        const rafRef = React.useRef<number | null>(null)
        const resetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
        const startTimeRef = React.useRef<number>(0)
        const lastStepRef = React.useRef(0)
        const pressSpring = useSpringPreset("press")
        const prefersReducedMotion = useReducedMotion()

        const cancelRaf = React.useCallback(() => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current)
                rafRef.current = null
            }
        }, [])

        const clearResetTimer = React.useCallback(() => {
            if (resetTimerRef.current !== null) {
                clearTimeout(resetTimerRef.current)
                resetTimerRef.current = null
            }
        }, [])

        // Al soltar antes de tiempo la barra retrocede en vez de desaparecer de golpe.
        const retreatBar = React.useCallback(() => {
            const bar = barRef.current
            if (!bar) return
            bar.style.transition = prefersReducedMotion ? "" : "transform var(--duration-quick) var(--ease-out)"
            bar.style.transform = "scaleX(0)"
        }, [prefersReducedMotion])

        const confirm = async () => {
            pendingRef.current = true
            setIsPending(true)
            try {
                await onConfirm()
                if (!mountedRef.current) return
                setIsConfirmed(true)
                resetTimerRef.current = setTimeout(() => {
                    resetTimerRef.current = null
                    setIsConfirmed(false)
                    setAriaProgress(0)
                    retreatBar()
                }, 2000)
            } catch {
                if (!mountedRef.current) return
                setHasError(true)
                setAriaProgress(0)
                retreatBar()
            } finally {
                pendingRef.current = false
                if (mountedRef.current) setIsPending(false)
            }
        }

        const startHold = () => {
            // Con un llenado en curso (rafRef) no se reinicia: cubre la repetición de tecla.
            if (isConfirmed || pendingRef.current || disabled || rafRef.current !== null) return
            setHasError(false)
            // El llenado sigue al dedo: no hereda la transición de retroceso de la pulsación anterior.
            if (barRef.current) barRef.current.style.transition = ""
            startTimeRef.current = performance.now()
            lastStepRef.current = 0
            setAriaProgress(0)

            const tick = (now: number) => {
                const fraction = Math.min(1, (now - startTimeRef.current) / holdDurationMs)
                if (barRef.current) barRef.current.style.transform = `scaleX(${fraction})`
                const step = Math.floor(fraction * 10) * 10
                if (step !== lastStepRef.current) {
                    lastStepRef.current = step
                    setAriaProgress(step)
                }

                if (fraction >= 1) {
                    rafRef.current = null
                    void confirm()
                    return
                }
                rafRef.current = requestAnimationFrame(tick)
            }
            rafRef.current = requestAnimationFrame(tick)
        }

        const cancelHold = React.useCallback(() => {
            // Sin llenado en curso (o ya confirmado) no hay nada que cancelar.
            if (rafRef.current === null) return
            cancelRaf()
            setAriaProgress(0)
            retreatBar()
        }, [cancelRaf, retreatBar])

        React.useEffect(() => {
            if (disabled) cancelHold()
        }, [disabled, cancelHold])

        React.useEffect(() => {
            const onVisibilityChange = () => {
                if (document.hidden) cancelHold()
            }
            window.addEventListener("blur", cancelHold)
            document.addEventListener("visibilitychange", onVisibilityChange)
            return () => {
                window.removeEventListener("blur", cancelHold)
                document.removeEventListener("visibilitychange", onVisibilityChange)
            }
        }, [cancelHold])

        React.useEffect(() => {
            mountedRef.current = true
            return () => {
                mountedRef.current = false
                cancelRaf()
                clearResetTimer()
            }
        }, [cancelRaf, clearResetTimer])

        return (
            <m.button
                ref={ref}
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={pressSpring}
                disabled={disabled || isPending}
                aria-busy={isPending || undefined}
                // Pointer Events: un solo camino para mouse, tacto y lápiz (sin el doble disparo de los
                // eventos de mouse de compatibilidad). Si el toque pasa a scroll, llega `pointercancel`.
                onPointerDown={(e) => {
                    if (e.pointerType === "mouse" && e.button !== 0) return
                    // Al tocar, el navegador captura el puntero en el botón y `pointerleave` no llegaría al deslizar fuera.
                    if ((e.pointerType === "touch" || e.pointerType === "pen") && e.currentTarget.hasPointerCapture(e.pointerId)) {
                        e.currentTarget.releasePointerCapture(e.pointerId)
                    }
                    startHold()
                }}
                onPointerUp={cancelHold}
                onPointerCancel={cancelHold}
                onPointerLeave={cancelHold}
                onBlur={cancelHold}
                onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                        e.preventDefault()
                        startHold()
                    }
                }}
                onKeyUp={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                        e.preventDefault()
                        cancelHold()
                    }
                }}
                className={cn(
                    "relative overflow-hidden select-none min-h-[44px] px-4 py-2 rounded-full font-semibold text-xs transition-[background-color,border-color,color] duration-fast cursor-pointer",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
                    // Colores por token: en plano (--neutral-* sólidos) el rojo se aclara para pasar AA (#ef4444 sobre #2C2C2E da 4,0:1).
                    variant === "destructive"
                        ? "bg-[color-mix(in_srgb,var(--status-error)_14%,var(--neutral-elev-2))] text-status-error-fg border border-[color-mix(in_srgb,var(--status-error)_40%,transparent)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[color-mix(in_srgb,var(--status-error)_24%,var(--neutral-elev-2))]"
                        : "bg-[var(--neutral-elev-2)] text-label-1 border border-[var(--neutral-separator)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)]",
                    className
                )}
                {...props}
            >
                {/* Barra de progreso: scaleX escrito por ref (solo compositor). Es funcional, así que se
                    llena igual con movimiento reducido. El botón ya recorta con overflow-hidden y rounded-full. */}
                <div
                    ref={barRef}
                    role="progressbar"
                    aria-valuenow={ariaProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Progreso"
                    className={cn(
                        "absolute inset-0 origin-left scale-x-0 pointer-events-none",
                        variant === "destructive" ? "bg-[color-mix(in_srgb,var(--status-error)_40%,transparent)]" : "bg-[color-mix(in_srgb,var(--label-1)_18%,transparent)]"
                    )}
                />

                {/* Al confirmar, el texto entra con text-swap-in (la `key` lo vuelve a montar). */}
                <span
                    role="status"
                    key={isConfirmed && !children ? "confirmed" : "label"}
                    className={cn("relative z-10 flex items-center justify-center gap-2", isConfirmed && !children && "animate-text-swap-in")}
                >
                    {isPending ? "Procesando…" : hasError ? "No se pudo completar. Inténtalo de nuevo" : children || (isConfirmed ? confirmLabel : label)}
                </span>
            </m.button>
        )
    }
)

HoldConfirm.displayName = "HoldConfirm"
