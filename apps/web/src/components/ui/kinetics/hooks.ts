import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { useIsMinimalistMode } from "@/lib/theme/use-classic-mode"

export { useReducedMotion }
export { useMotionTier, cardMotionProps, useCardMotionProps, type MotionTier } from "./motion-tier"

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

const FEEDBACK_PRESETS = new Set<SpringPresetName>([
    "press",
    "cardHover",
    "elasticCounter",
    "iconSwap",
    "switch",
])

const MINIMAL_EASE = [0.23, 1, 0.32, 1] as const

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
} as const

export function useSpringPreset(preset: SpringPresetName = "entrance") {
    const prefersReduced = useReducedMotion()
    const isMinimalist = useIsMinimalistMode()

    // Perfil Minimalista: 160 ms para feedback y 180 ms para entradas/cambios, sin rebote.
    // Con movimiento reducido, transición inmediata (duración 0).
    if (isMinimalist) {
        if (prefersReduced) {
            return { type: "tween" as const, duration: 0 }
        }
        const isFeedback = FEEDBACK_PRESETS.has(preset)
        return {
            type: "tween" as const,
            duration: isFeedback ? 0.16 : 0.18,
            ease: MINIMAL_EASE,
        }
    }

    const spring = SPRING_PRESETS[preset] ?? SPRING_PRESETS.entrance
    if (prefersReduced && spring.type === "spring") {
        return { type: "tween" as const, duration: 0.15 }
    }
    return spring
}
