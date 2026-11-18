import { useIsClassicMode } from '@/lib/theme/use-classic-mode';
import { m } from "framer-motion";
import { cn } from "./core/styling";
import { useReducedMotion } from "./kinetics/hooks";

interface WatchProgressBarProps {
    percent: number;
    animateOnMount?: boolean;
}

export function WatchProgressBar({
    percent,
    animateOnMount = false,
}: WatchProgressBarProps) {
    const isClassic = useIsClassicMode();
    const clampedPercent = Math.max(0, Math.min(100, Math.round(percent)));

    const defaultFillClass = isClassic ? "bg-[var(--selected-bg)]" : "bg-brand-secondary";
    const trackStyle = { background: "color-mix(in srgb, var(--md-sys-color-surface-container) 20%, transparent)" };

    // El scaleX lo maneja framer (no va en el style): una transición CSS no corre en
    // el primer pintado, así que con animateOnMount la barra aparecía ya llena.
    const reduceMotion = useReducedMotion();
    const fillTransition = animateOnMount
        ? { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } // --duration-slower + --ease-expo-out
        : { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const }; // --duration-base + --ease-smooth-out

    return (
        <div className="w-full flex flex-col gap-1">
            <div
                className="watch-progress-track w-full overflow-hidden relative z-10 h-[5px] rounded-full"
                style={trackStyle}
            >
                <m.div
                    className={cn("watch-progress-fill h-full w-full rounded-pill origin-left", defaultFillClass)}
                    style={{ transformOrigin: "left" }}
                    initial={animateOnMount && !reduceMotion ? { scaleX: 0 } : false}
                    animate={{ scaleX: clampedPercent / 100 }}
                    transition={fillTransition}
                />
            </div>
        </div>
    );
}
