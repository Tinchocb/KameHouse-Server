import { memo } from "react"
import { cn } from "@/components/ui/core/styling"

interface GlowingEffectProps {
    blur?: number;
    inactiveZone?: number;
    proximity?: number;
    spread?: number;
    variant?: "default" | "white" | "classic";
    glow?: boolean;
    className?: string;
    disabled?: boolean;
    movementDuration?: number;
    borderWidth?: number;
}

export const GlowingEffect = memo(
    ({
        blur = 0,
        inactiveZone = 0.7,
        proximity = 0,
        spread = 20,
        variant = "default",
        glow = false,
        className,
        movementDuration = 2,
        borderWidth = 1,
        disabled = false,
    }: GlowingEffectProps) => {
        if (disabled) return null;

        return (
            <div
                className={cn(
                    "pointer-events-none absolute -inset-[1px] rounded-[inherit] border border-white/5 opacity-40 transition-opacity duration-300",
                    glow && "opacity-100",
                    variant === "white" && "border-white/20",
                    variant === "default" && "group-hover:border-brand-orange/30 group-hover:bg-brand-orange/[0.02]",
                    variant === "classic" && "group-hover:border-purple-500/30 group-hover:bg-purple-500/[0.02]",
                    className
                )}
                style={{
                    borderWidth: `${borderWidth}px`,
                }}
            />
        )
    }
)

GlowingEffect.displayName = "GlowingEffect"
