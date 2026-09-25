import { useReducedMotion } from "framer-motion"
import type { TargetAndTransition, Transition } from "framer-motion"
import { usePerformanceStore, selectIsHeavyEffectsAllowed } from "@/lib/hardware/performance-store"
import { useAppStore } from "@/lib/stores"

export type MotionTier = "full" | "subtle" | "off"

export interface CardMotionProps {
    whileHover?: TargetAndTransition
    whileTap?: TargetAndTransition
    transition?: Transition
}

/**
 * Deriva el tier de animación centralizado para toda la aplicación:
 * - "off": el usuario prefiere movimiento reducido (a11y).
 * - "subtle": hardware en bajo consumo / throttle activo, o modo TV (control remoto).
 * - "full": hardware capaz (high/balanced), sin throttling, sin modo TV y con motion habilitado.
 */
export function useMotionTier(): MotionTier {
    const prefersReduced = useReducedMotion()
    const isHeavyAllowed = usePerformanceStore(selectIsHeavyEffectsAllowed)
    const tvMode = useAppStore((state) => state.tvMode)

    if (prefersReduced) {
        return "off"
    }

    if (!isHeavyAllowed || tvMode) {
        return "subtle"
    }

    return "full"
}

/**
 * Propiedades estándar de Framer Motion para hover/tap en tarjetas (posters, series, movies).
 * - full: elevación y: -4 con spring 380/30, tap scale 0.97 con spring 520/32.
 * - subtle: sin transforms en Framer Motion (delegado a transiciones CSS o estático).
 * - off: sin hover/tap interactivo.
 */
export function cardMotionProps(tier: MotionTier): CardMotionProps {
    if (tier !== "full") {
        return {}
    }
    return {
        whileHover: { y: -4 },
        whileTap: { scale: 0.97 },
        transition: { type: "spring", stiffness: 380, damping: 30 },
    }
}

/**
 * Hook de conveniencia que combina useMotionTier() + cardMotionProps(tier).
 */
export function useCardMotionProps(): CardMotionProps {
    const tier = useMotionTier()
    return cardMotionProps(tier)
}
