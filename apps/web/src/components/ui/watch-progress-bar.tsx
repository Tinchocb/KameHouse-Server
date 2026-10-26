import React from "react";
import { m } from "framer-motion";
import { cn } from "./core/styling";
import { useReducedMotion } from "./kinetics/hooks";

type ProgressBarVariant = "hero" | "compact";

interface WatchProgressBarProps {
    percent: number;
    className?: string;
    animateOnMount?: boolean;
    /** Variante de diseño. "hero" o "compact". Retrocompatible con `size`. */
    variant?: ProgressBarVariant;
    /** Alias retrocompatible para variant. */
    size?: "hero";
    /** Identificador de era (ej: 'era-db', 'era-dbz', 'era-dbs') para tintado temático */
    era?: string | null;
    /** Color o degradado directo para la barra activa */
    color?: string;
    /** Muestra el porcentaje en texto si se requiere */
    showLabel?: boolean;
}

const ERA_COLOR_MAP: Record<string, string> = {
    "era-db": "var(--era-db-hex, #F97316)",
    "era-dbz": "var(--era-dbz-hex, #FBBF24)",
    "era-dbgt": "var(--era-dbgt-hex, #F43F5E)",
    "era-dbkai": "var(--era-dbkai-hex, #10B981)",
    "era-dbs": "var(--era-dbs-hex, #3B82F6)",
    "era-daima": "var(--era-daima-hex, #A855F7)",
};

export function WatchProgressBar({
    percent,
    className,
    animateOnMount = false,
    variant,
    era,
    color,
    showLabel = false,
}: WatchProgressBarProps) {
    const activeVariant: ProgressBarVariant = variant || "hero";
    const clampedPercent = Math.max(0, Math.min(100, Math.round(percent)));

    const eraColor = era ? ERA_COLOR_MAP[era] : undefined;
    const activeColor = color || eraColor;

    // Track styles per variant
    const trackClass = activeVariant === "compact"
        ? "h-1 rounded-full bg-black/60 p-[1px] border border-white/15"
        : "h-[5px] rounded-full";

    // Bar fill styles per variant
    const defaultFillClass = activeVariant === "compact"
        ? "bg-gradient-to-r from-amber-500 to-orange-400"
        : "bg-brand-secondary";

    const trackStyle = activeVariant === "hero"
        ? { background: "color-mix(in srgb, var(--md-sys-color-surface-container) 20%, transparent)" }
        : undefined;

    // El scaleX lo maneja framer (no va en el style): una transición CSS no corre en
    // el primer pintado, así que con animateOnMount la barra aparecía ya llena.
    const reduceMotion = useReducedMotion();
    const fillTransition = animateOnMount
        ? { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } // --duration-slower + --ease-expo-out
        : { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const }; // --duration-base + --ease-smooth-out

    const fillStyle: React.CSSProperties = {
        transformOrigin: "left",
        ...(activeColor ? {
            background: activeColor.startsWith("linear-gradient") || activeColor.startsWith("var(")
                ? activeColor
                : `linear-gradient(to right, ${activeColor}, color-mix(in srgb, ${activeColor} 80%, white))`,
            boxShadow: `0 0 8px color-mix(in srgb, ${activeColor.startsWith("var(") ? "hsl(var(--brand-accent))" : activeColor} 50%, transparent)`,
        } : {}),
    };

    return (
        <div className={cn("w-full flex flex-col gap-1", className)}>
            {showLabel && (
                <div className="flex justify-between items-center text-3xs font-mono uppercase tracking-wider text-white/70">
                    <span>Progreso</span>
                    <span className="font-bold text-on-surface">{clampedPercent}%</span>
                </div>
            )}
            <div
                className={cn("w-full overflow-hidden relative z-10", trackClass)}
                style={trackStyle}
            >
                <m.div
                    className={cn(
                        "h-full w-full rounded-pill origin-left",
                        !activeColor && defaultFillClass
                    )}
                    style={fillStyle}
                    initial={animateOnMount && !reduceMotion ? { scaleX: 0 } : false}
                    animate={{ scaleX: clampedPercent / 100 }}
                    transition={fillTransition}
                />
            </div>
        </div>
    );
}
