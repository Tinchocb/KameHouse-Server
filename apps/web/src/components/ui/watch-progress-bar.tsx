import React from "react";
import { cn } from "./core/styling";

export type ProgressBarVariant = "hero" | "panel" | "card" | "compact";

export interface WatchProgressBarProps {
    percent: number;
    className?: string;
    animateOnMount?: boolean;
    /** Variante de diseño. "hero", "panel", "card" o "compact". Retrocompatible con `size`. */
    variant?: ProgressBarVariant;
    /** Alias retrocompatible para variant. */
    size?: "hero" | "panel";
    /** Identificador de era (ej: 'era-db', 'era-dbz', 'era-dbs') para tintado temático */
    era?: string | null;
    /** Color o degradado directo para la barra activa */
    color?: string;
    /** Muestra el porcentaje en texto si se requiere */
    showLabel?: boolean;
}

const ERA_COLOR_MAP: Record<string, string> = {
    "era-db": "var(--era-db-hex, #E87A2D)",
    "era-dbz": "var(--era-dbz-hex, #E6B43C)",
    "era-dbgt": "var(--era-dbgt-hex, #D23859)",
    "era-dbkai": "var(--era-dbkai-hex, #278DC5)",
    "era-dbs": "var(--era-dbs-hex, #2C9FC7)",
    "era-daima": "var(--era-daima-hex, #9564C8)",
};

export function WatchProgressBar({
    percent,
    className,
    animateOnMount = false,
    variant,
    size = "hero",
    era,
    color,
    showLabel = false,
}: WatchProgressBarProps) {
    const activeVariant: ProgressBarVariant = variant || (size === "panel" ? "panel" : "hero");
    const clampedPercent = Math.max(0, Math.min(100, Math.round(percent)));

    const eraColor = era ? ERA_COLOR_MAP[era] : undefined;
    const activeColor = color || eraColor;

    // Track styles per variant
    const trackClass = {
        hero: "h-[5px] rounded-full",
        panel: "h-2 rounded-full bg-white/10 border border-white/5 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]",
        card: "h-1 rounded-none bg-black/50",
        compact: "h-1 rounded-full bg-black/60 p-[1px] border border-white/15",
    }[activeVariant];

    // Bar fill styles per variant
    const defaultFillClass = {
        hero: "bg-brand-secondary",
        panel: "bg-gradient-to-r from-brand-secondary via-brand-accent to-brand-accent shadow-[0_0_8px_hsl(var(--brand-accent)/0.6)]",
        card: "bg-brand-accent shadow-[0_0_6px_hsl(var(--brand-accent)/0.5)]",
        compact: "bg-gradient-to-r from-amber-500 to-orange-400",
    }[activeVariant];

    const trackStyle = activeVariant === "hero"
        ? { background: "color-mix(in srgb, var(--md-sys-color-surface-container) 20%, transparent)" }
        : undefined;

    const fillStyle: React.CSSProperties = {
        transform: `scaleX(${clampedPercent / 100})`,
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
                <div
                    className={cn(
                        "h-full w-full rounded-pill origin-left",
                        !activeColor && defaultFillClass,
                        animateOnMount
                            ? "transition-transform duration-slower ease-expo-out"
                            : "transition-transform duration-base ease-smooth-out"
                    )}
                    style={fillStyle}
                />
            </div>
        </div>
    );
}
