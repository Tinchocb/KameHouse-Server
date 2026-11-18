import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { useMediaQuery } from "@/hooks/use-media-query"
import type { TargetAndTransition, Transition } from "framer-motion"
import { usePerformanceStore, selectIsHeavyEffectsAllowed } from "@/lib/hardware/performance-store"
import { useIsMinimalistMode, isMinimalistModeActive } from "@/lib/theme/use-classic-mode"

export type MotionTier = "full" | "subtle" | "off"

const MINIMAL_EASE = [0.23, 1, 0.32, 1] as const

interface CardMotionProps {
    whileHover?: TargetAndTransition
    whileTap?: TargetAndTransition
    transition?: Transition
}

/**
 * Deriva el tier de animación centralizado para toda la aplicación:
 * - "off": el usuario prefiere movimiento reducido (a11y).
 * - "subtle": hardware en bajo consumo / throttle activo.
 * - "full": hardware capaz (high/balanced), sin throttling y con motion habilitado.
 */
export function useMotionTier(): MotionTier {
    const prefersReduced = useReducedMotion()
    const isHeavyAllowed = usePerformanceStore(selectIsHeavyEffectsAllowed)

    if (prefersReduced) {
        return "off"
    }

    if (!isHeavyAllowed) {
        return "subtle"
    }

    return "full"
}

/**
 * Propiedades estándar de Framer Motion para hover/tap en tarjetas (posters, series, movies).
 * - full (Por era / Neutro): elevación y: -4 con spring 380/30, tap scale 0.97 con spring 520/32.
 * - full (Minimalista): sin elevación de tarjetas (y: 0), tap scale 0.98, 160 ms sin rebote.
 * - subtle: sin transforms en Framer Motion (delegado a transiciones CSS o estático).
 * - off: gestos con destinos neutros e inmediatos; conserva el final de una presión en curso.
 */
export function cardMotionProps(
    tier: MotionTier,
    canHover = true,
    options?: { isMinimalist?: boolean } | boolean
): CardMotionProps {
    const isMinimalist = typeof options === "boolean"
        ? options
        : (options?.isMinimalist ?? isMinimalistModeActive())

    // Al cambiar la preferencia durante un gesto, su retorno también debe ser inmediato.
    if (tier === "off") return {
        whileHover: canHover ? { y: 0, transition: { duration: 0 } } : undefined,
        whileTap: { scale: 1, transition: { duration: 0 } },
        transition: { duration: 0 },
    }
    if (tier !== "full") {
        return {}
    }
    if (isMinimalist) {
        return {
            whileHover: canHover ? { y: 0 } : undefined,
            whileTap: { scale: 0.98 },
            transition: { duration: 0.16, ease: MINIMAL_EASE },
        }
    }
    return {
        whileHover: canHover ? { y: -4 } : undefined,
        whileTap: { scale: 0.97 },
        transition: { type: "spring", stiffness: 380, damping: 30 },
    }
}

/**
 * Hook de conveniencia que combina useMotionTier() + cardMotionProps(tier).
 */
export function useCardMotionProps(): CardMotionProps {
    const tier = useMotionTier()
    const canHover = useMediaQuery("(hover: hover) and (pointer: fine)")
    const isMinimalist = useIsMinimalistMode()
    return cardMotionProps(tier, canHover, { isMinimalist })
}
