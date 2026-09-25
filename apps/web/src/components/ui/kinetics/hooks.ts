import { useReducedMotion } from "framer-motion"

export { useReducedMotion }
export { useMotionTier, cardMotionProps, useCardMotionProps, type MotionTier, type CardMotionProps } from "./motion-tier"

export type SpringPresetName =
    | "entrance"
    | "tabIndicator"
    | "tabContent"
    | "cardHover"
    | "press"
    | "elasticCounter"

const SPRING_PRESETS = {
    entrance: { type: "spring", stiffness: 380, damping: 30, mass: 0.8 },
    tabIndicator: { type: "spring", stiffness: 480, damping: 34 },
    tabContent: { type: "spring", stiffness: 280, damping: 28 },
    cardHover: { type: "spring", stiffness: 380, damping: 30 },
    press: { type: "spring", stiffness: 520, damping: 32 },
    elasticCounter: { type: "spring", stiffness: 400, damping: 25 },
} as const

export function useSpringPreset(preset: SpringPresetName = "entrance") {
    const prefersReduced = useReducedMotion()
    const spring = SPRING_PRESETS[preset] ?? SPRING_PRESETS.entrance
    if (prefersReduced && spring.type === "spring") {
        return { type: "tween" as const, duration: 0.15 }
    }
    return spring
}

export function useSpring(stiffness: number, damping: number, mass = 0.8) {
    const prefersReduced = useReducedMotion()
    if (prefersReduced) {
        return { type: "tween" as const, duration: 0.15 }
    }
    return { type: "spring" as const, stiffness, damping, mass }
}

/**
 * 480/34 — Tab indicator, magnetic nav pill, SectionBar active indicator.
 * Uso: layoutId animations que deben seguir el cursor con snap rápido.
 */
export function useMagneticSpring() {
    const prefersReduced = useReducedMotion()
    if (prefersReduced) return { type: "tween" as const, duration: 0.15 }
    return { type: "spring" as const, stiffness: 480, damping: 34 }
}

/**
 * 280/28 — Panel content, rubber reveal, tab content swap.
 * Uso: contenido que aparece/desaparece debajo de un indicador magnético.
 */
export function useRubberSpring() {
    const prefersReduced = useReducedMotion()
    if (prefersReduced) return { type: "tween" as const, duration: 0.15 }
    return { type: "spring" as const, stiffness: 280, damping: 28 }
}
