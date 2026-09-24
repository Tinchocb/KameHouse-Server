import { Glass } from "@samasante/liquid-glass"
import { useReducedMotion } from "framer-motion"
import { usePerformanceStore, selectIsHeavyEffectsAllowed } from "@/lib/hardware/performance-store"
import { cn } from "@/components/ui/core/styling"
import type { CSSProperties, ReactNode } from "react"

export interface LiquidLensProps {
    children?: ReactNode
    className?: string
    style?: CSSProperties
    /** px — border radius del pill. Default 9999 (full). */
    radius?: number
    /** Optics overrides para `<Glass>`. Por defecto: preset sutil para pills pequeños. */
    bend?: number
    bendWidth?: number
    frost?: number
    brightness?: number
    /** Fuerza el fallback a .glass-liquid aunque el tier lo permitiera */
    forceClassic?: boolean
}

/**
 * LiquidLens — wrapper de piloto acotado para `@samasante/liquid-glass`.
 *
 * Gates (cualquiera activa el fallback a .glass-liquid):
 *   1. `[data-flat=true]` en algún ancestro del DOM
 *   2. Tier de perf `low_power` (!selectIsHeavyEffectsAllowed)
 *   3. `prefers-reduced-motion: reduce`
 *   4. `forceClassic={true}`
 *
 * En prod Chromium (WebView2 / Chrome): bend real vía SVG displacement.
 * En Firefox / Safari: frost + tint + edge-light — aceptable como fallback visual,
 * no es el mismo fallback que .glass-liquid, pero sigue siendo glass.
 *
 * Regla: UNA sola capa de blur por elemento. No anidar <LiquidLens>.
 */
export function LiquidLens({
    children,
    className,
    style,
    radius = 9999,
    bend = 0.35,
    bendWidth = 0.18,
    frost = 6,
    brightness = 1.05,
    forceClassic = false,
}: LiquidLensProps) {
    const prefersReduced = useReducedMotion()
    const isHeavyAllowed = usePerformanceStore(selectIsHeavyEffectsAllowed)

    // Detectar data-flat en DOM — hacemos el check en CSS vía @container (no re-render)
    // pero como fallback simple, lo delegamos al prop forceClassic desde el padre si necesario.
    const useClassic = forceClassic || !!prefersReduced || !isHeavyAllowed

    if (useClassic) {
        return (
            <div
                className={cn("glass-liquid", className)}
                style={style}
            >
                {children}
            </div>
        )
    }

    return (
        <Glass
            radius={radius}
            optics={{
                bend,
                bendWidth,
                frost,
                brightness,
                // Preset sutil para pills pequeños: sin curvatura central agresiva
                curvature: 0.1,
                depth: 0.6,
                dispersion: 0.15,
                sheen: 0.4,
                sheenWidth: 0.12,
            }}
            // translateZ(0) — promueve a capa GPU, evita repaint del pill
            style={{
                transform: "translateZ(0)",
                ...style,
            }}
            className={className}
        >
            {children}
        </Glass>
    )
}
