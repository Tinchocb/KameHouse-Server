"use client"

import * as React from "react"
import { AnimatePresence, m, type TargetAndTransition } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { useMotionTier, useSpringPreset, type MotionTier } from "./hooks"

interface IconSwapProps {
    /** Cambia cuando cambia el ícono: dispara la transición. */
    swapKey: string
    children: React.ReactNode
    className?: string
    /** Controles frecuentes: fundido breve sin escala ni blur. */
    subtle?: boolean
}

/**
 * Estados del cambio según el tier de movimiento. El blur (`filter`) solo corre en "full":
 * en "subtle" (ahorro de energía) se quita porque repinta el ícono en cada frame.
 * Con movimiento reducido ("off") queda solo el fade.
 */
export function iconSwapStates(tier: MotionTier): { hidden: TargetAndTransition; shown: TargetAndTransition } {
    if (tier === "off") {
        return { hidden: { opacity: 0 }, shown: { opacity: 1 } }
    }
    if (tier === "subtle") {
        return { hidden: { opacity: 0, scale: 0.96 }, shown: { opacity: 1, scale: 1 } }
    }
    return {
        hidden: { opacity: 0, scale: 0.9, filter: "blur(2px)" },
        shown: { opacity: 1, scale: 1, filter: "blur(0px)" },
    }
}

/**
 * Cambio de ícono por estado (p. ej. "+" → "✓" al confirmar una acción).
 * Ambos íconos ocupan la misma celda: el nuevo entra desde scale 0.9 (con un
 * blur leve en tier "full") mientras el viejo sale igual, sin saltos de layout.
 * Con movimiento reducido solo hace fade.
 */
export function IconSwap({ swapKey, children, className, subtle = false }: IconSwapProps) {
    const tier = useMotionTier()
    const spring = useSpringPreset("iconSwap")
    const { hidden, shown } = iconSwapStates(subtle ? "off" : tier)
    return (
        <span className={cn("inline-grid place-items-center", className)}>
            <AnimatePresence initial={false}>
                <m.span
                    key={swapKey}
                    className="col-start-1 row-start-1 inline-flex"
                    initial={hidden}
                    animate={shown}
                    exit={hidden}
                    transition={subtle ? { duration: tier === "off" ? 0.15 : 0.25, ease: "easeInOut" } : spring}
                >
                    {children}
                </m.span>
            </AnimatePresence>
        </span>
    )
}

/**
 * Bandera que se enciende y se apaga sola tras `ms` (confirmaciones breves).
 * Volver a disparar reinicia el plazo.
 */
export function useTransientFlag(ms: number): [boolean, () => void] {
    const [on, setOn] = React.useState(false)
    const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    React.useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current)
    }, [])
    const trigger = React.useCallback(() => {
        if (timer.current) clearTimeout(timer.current)
        setOn(true)
        timer.current = setTimeout(() => setOn(false), ms)
    }, [ms])
    return [on, trigger]
}
