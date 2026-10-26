import { useReducedMotion } from "framer-motion"

export { useReducedMotion }
export { useMotionTier, cardMotionProps, useCardMotionProps, type MotionTier, type CardMotionProps } from "./motion-tier"

type SpringPresetName =
    | "entrance"
    | "tabIndicator"
    | "tabContent"
    | "cardHover"
    | "press"
    | "elasticCounter"
    | "railResize"
    | "iconSwap"
    | "switch"
    | "island"
    | "selector"

const SPRING_PRESETS = {
    entrance: { type: "spring", stiffness: 380, damping: 30, mass: 0.8 },
    tabIndicator: { type: "spring", stiffness: 480, damping: 34 },
    tabContent: { type: "spring", stiffness: 280, damping: 28 },
    cardHover: { type: "spring", stiffness: 380, damping: 30 },
    press: { type: "spring", stiffness: 520, damping: 32 },
    elasticCounter: { type: "spring", stiffness: 400, damping: 25 },
    // Riel de eras: el activo se desliza al cambiar de era (antes escrito a mano en era-rail.tsx).
    railResize: { type: "spring", stiffness: 460, damping: 38 },
    // Cambio de ícono (IconSwap): mismos valores que estaban escritos a mano en icon-swap.tsx.
    iconSwap: { type: "spring", duration: 0.3, bounce: 0 },
    // Pulgar del interruptor (SpringSwitch): mismos valores que estaban escritos a mano en spring-switch.tsx.
    switch: { type: "spring", stiffness: 520, damping: 32, mass: 0.8 },
    // Islas flotantes del nav (FloatingPillNav): mismos valores que estaban escritos a mano en floating-pill-nav.tsx.
    island: { type: "spring", stiffness: 400, damping: 30 },
    // Modal aleatorio "Sorpréndeme" (RandomPlayButton): mismos valores que estaban escritos a mano en random-play-button.tsx.
    selector: { type: "spring", stiffness: 350, damping: 26 },
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
