import * as React from "react"
import { m, type HTMLMotionProps } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { useSpringPreset } from "./hooks"

export interface HoldConfirmProps extends Omit<HTMLMotionProps<"button">, "children"> {
    onConfirm: () => void
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
            label = "Mantener para confirmar",
            confirmLabel = "¡Confirmado!",
            variant = "destructive",
            className,
            children,
            ...props
        },
        ref
    ) => {
        const [progress, setProgress] = React.useState(0)
        const [isHolding, setIsHolding] = React.useState(false)
        const [isConfirmed, setIsConfirmed] = React.useState(false)
        const rafRef = React.useRef<number | null>(null)
        const startTimeRef = React.useRef<number>(0)
        const pressSpring = useSpringPreset("press")

        const cancelRaf = () => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current)
                rafRef.current = null
            }
        }

        const startHold = () => {
            if (isConfirmed) return
            setIsHolding(true)
            startTimeRef.current = performance.now()

            const tick = (now: number) => {
                const elapsed = now - startTimeRef.current
                const currentProgress = Math.min(100, (elapsed / holdDurationMs) * 100)
                setProgress(currentProgress)

                if (currentProgress >= 100) {
                    setIsConfirmed(true)
                    setIsHolding(false)
                    onConfirm()
                    setTimeout(() => {
                        setIsConfirmed(false)
                        setProgress(0)
                    }, 2000)
                    return
                }
                rafRef.current = requestAnimationFrame(tick)
            }
            rafRef.current = requestAnimationFrame(tick)
        }

        const cancelHold = () => {
            if (isConfirmed) return
            setIsHolding(false)
            cancelRaf()
            setProgress(0)
        }

        React.useEffect(() => {
            return () => cancelRaf()
        }, [])

        return (
            <m.button
                ref={ref}
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={pressSpring}
                onMouseDown={startHold}
                onMouseUp={cancelHold}
                onMouseLeave={cancelHold}
                onTouchStart={startHold}
                onTouchEnd={cancelHold}
                onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                        if (!isHolding) startHold()
                    }
                }}
                onKeyUp={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                        cancelHold()
                    }
                }}
                className={cn(
                    "relative overflow-hidden select-none min-h-[44px] px-4 py-2 rounded-full font-medium text-xs uppercase tracking-wider transition-[background-color,border-color,color] duration-200 cursor-pointer",
                    variant === "destructive"
                        ? "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                        : "bg-white/10 text-white border border-white/20 hover:bg-white/15",
                    className
                )}
                {...props}
            >
                {/* Barra de progreso de carga */}
                <m.div
                    role="progressbar"
                    aria-valuenow={Math.round(progress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Progreso de confirmación"
                    className={cn(
                        "absolute inset-y-0 left-0 pointer-events-none rounded-full",
                        variant === "destructive" ? "bg-red-500/40" : "bg-white/25"
                    )}
                    style={{ width: `${progress}%` }}
                    transition={{ ease: "linear", duration: 0.05 }}
                />

                <span className="relative z-10 flex items-center justify-center gap-2">
                    {children || (isConfirmed ? confirmLabel : label)}
                </span>
            </m.button>
        )
    }
)

HoldConfirm.displayName = "HoldConfirm"
