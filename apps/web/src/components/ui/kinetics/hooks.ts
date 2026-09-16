import { useReducedMotion } from "framer-motion"

export { useReducedMotion }

export type SpringPresetName =
    | "entrance"
    | "tabIndicator"
    | "tabContent"
    | "cardHover"
    | "press"

const SPRING_PRESETS = {
    entrance: { type: "spring", stiffness: 380, damping: 30, mass: 0.8 },
    tabIndicator: { type: "spring", stiffness: 480, damping: 34 },
    tabContent: { type: "spring", stiffness: 280, damping: 28 },
    cardHover: { type: "spring", stiffness: 380, damping: 30 },
    press: { type: "spring", stiffness: 520, damping: 32 },
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
