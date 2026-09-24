import React from "react";
import { cn } from "./core/styling";
import { AnimatedTooltip } from "./kinetics";

interface GlassIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: React.ReactNode;
    title: string;
    isActive?: boolean;
    activeTone?: "success" | "destructive" | "primary" | "secondary";
    className?: string;
    tooltipSide?: "top" | "bottom";
}

export function GlassIconButton({
    icon,
    title,
    isActive = false,
    activeTone = "success",
    className,
    tooltipSide = "top",
    ...props
}: GlassIconButtonProps) {
    const toneMap = {
        success: "text-brand-success",
        destructive: "text-brand-destructive",
        primary: "text-brand-accent",
        secondary: "text-brand-secondary",
    };

    return (
        <AnimatedTooltip content={title} side={tooltipSide}>
            <button
                aria-label={title}
                className={cn(
                    "group flex items-center justify-center p-3.5 sm:p-4 rounded-xl",
                    "bg-surface/60 border border-white/20 border-t-white/40 border-b-white/10",
                    "backdrop-blur-overlay-2xl backdrop-saturate-[190%]",
                    "shadow-[shadow:var(--glass-highlight-lg),0_8px_24px_rgba(0,0,0,0.6)]",
                    "transition-[transform,background-color,border-color,color] duration-base ease-smooth-out hover:scale-[1.03] active:scale-95 min-h-[44px] min-w-[44px] cursor-pointer",
                    isActive ? toneMap[activeTone] : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container/80",
                    className
                )}
                {...props}
            >
                <div className={cn("transition-transform duration-base ease-smooth-out group-hover:-translate-y-0.5", isActive && "scale-110")}>
                    {icon}
                </div>
            </button>
        </AnimatedTooltip>
    );
}
