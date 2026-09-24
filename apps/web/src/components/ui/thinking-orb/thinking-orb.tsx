import { ThinkingOrb } from "thinking-orbs"
import { useReducedMotion } from "framer-motion"
import { usePerformanceStore, selectIsHeavyEffectsAllowed } from "@/lib/hardware/performance-store"

// Los 9 estados semánticos del paquete
export type OrbState =
    | "working"
    | "searching"
    | "solving"
    | "listening"
    | "connecting"
    | "weaving"
    | "composing"
    | "breathing"
    | "shaping"

export interface ThinkingOrbProps {
    state: OrbState
    /**
     * 64 → chat-avatar scale (overlay centrado)
     * 20 → inline-text scale (junto a texto)
     */
    size?: 64 | 20
    /** Multiplicador de velocidad sobre el preset del estado. Default 1. */
    speed?: number
    /** aria-label override. Por defecto el paquete genera uno por estado. */
    "aria-label"?: string
    className?: string
}

/**
 * Wrapper de ThinkingOrb de `thinking-orbs`.
 *
 * - `theme="dark"` fijo: KameHouse es dark-first.
 * - Se pausa automáticamente si `useReducedMotion()` o tier `low_power`
 *   (el paquete ya maneja reduced-motion internamente vía frame estático,
 *   pero lo forzamos también por el tier de perf).
 * - `prefers-reduced-motion: reduce` → frame estático (manejo interno del paquete).
 * - IntersectionObserver + tab oculto → pausa automática (manejo interno).
 */
export function ThinkingOrbWrapper({
    state,
    size = 64,
    speed = 1,
    className,
    "aria-label": ariaLabel,
}: ThinkingOrbProps) {
    const prefersReduced = useReducedMotion()
    const isHeavyAllowed = usePerformanceStore(selectIsHeavyEffectsAllowed)

    // Pausar si reduced motion o tier low_power
    // El paquete ya renderiza frame estático con prefers-reduced-motion,
    // pero `paused` lo fuerza también cuando el tier de perf es bajo.
    const paused = !!prefersReduced || !isHeavyAllowed

    return (
        <ThinkingOrb
            state={state}
            size={size}
            speed={speed}
            theme="dark"
            paused={paused}
            aria-label={ariaLabel}
            className={className}
        />
    )
}
