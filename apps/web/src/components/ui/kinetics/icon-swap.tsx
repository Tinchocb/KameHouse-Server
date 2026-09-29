"use client"

import * as React from "react"
import { AnimatePresence, m, useReducedMotion } from "framer-motion"
import { cn } from "@/components/ui/core/styling"

interface IconSwapProps {
    /** Cambia cuando cambia el ícono: dispara la transición. */
    swapKey: string
    children: React.ReactNode
    className?: string
}

/**
 * Cambio de ícono por estado (p. ej. "+" → "✓" al confirmar una acción).
 * Ambos íconos ocupan la misma celda: el nuevo entra desde scale 0.25 con un
 * blur leve mientras el viejo sale igual, sin saltos de layout.
 * Con movimiento reducido solo hace fade.
 */
export function IconSwap({ swapKey, children, className }: IconSwapProps) {
    const reduce = useReducedMotion()
    const hidden = reduce ? { opacity: 0 } : { opacity: 0, scale: 0.25, filter: "blur(4px)" }
    return (
        <span className={cn("inline-grid place-items-center", className)}>
            <AnimatePresence initial={false}>
                <m.span
                    key={swapKey}
                    className="col-start-1 row-start-1 inline-flex"
                    initial={hidden}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={hidden}
                    transition={{ type: "spring", duration: 0.3, bounce: 0 }}
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
