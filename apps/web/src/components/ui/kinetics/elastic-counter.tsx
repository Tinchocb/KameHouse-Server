import * as React from "react"
import { m, AnimatePresence, type Variants } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { useSpringPreset, useReducedMotion } from "./hooks"

export interface ElasticCounterProps {
    value: number
    className?: string
}

/**
 * Dirección como un cuentakilómetros: si el número sube, el nuevo entra desde abajo y
 * el viejo sale hacia arriba; si baja (una cuenta regresiva), al revés.
 */
const rollVariants: Variants = {
    enter: (dir: number) => ({ y: dir * 16, opacity: 0 }),
    center: { y: 0, opacity: 1 },
    exit: (dir: number) => ({ y: dir * -16, opacity: 0 }),
}

export const ElasticCounter: React.FC<ElasticCounterProps> = ({ value, className }) => {
    const spring = useSpringPreset("elasticCounter")
    const prefersReduced = useReducedMotion()

    // Dirección del último cambio, derivada durante el render (sin efecto extra).
    const [prev, setPrev] = React.useState(value)
    const [dir, setDir] = React.useState(-1)
    if (value !== prev) {
        setPrev(value)
        setDir(value > prev ? 1 : -1)
    }

    if (prefersReduced) {
        return <span className={cn("font-mono tabular-nums", className)}>{value}</span>
    }

    return (
        <span className={cn("inline-flex overflow-hidden font-mono tabular-nums", className)}>
            <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                <m.span
                    key={value}
                    custom={dir}
                    variants={rollVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={spring}
                    className="inline-block"
                >
                    {value}
                </m.span>
            </AnimatePresence>
        </span>
    )
}

ElasticCounter.displayName = "ElasticCounter"
