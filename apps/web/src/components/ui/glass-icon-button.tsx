import React from "react";
import { cn } from "./core/styling";
import { AnimatedTooltip } from "./kinetics";
import { IconButton } from "./button";

interface GlassIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: React.ReactNode;
    title: string;
    isActive?: boolean;
    activeTone?: "success" | "destructive" | "primary" | "secondary";
    className?: string;
    tooltipSide?: "top" | "bottom";
}

/** Botón de ícono sobre imagen: usa la receta `glass` del sistema de botones. */
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
            <IconButton
                intent="glass"
                size="md"
                aria-label={title}
                className={cn(
                    "group",
                    isActive ? toneMap[activeTone] : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container/80",
                    className
                )}
                icon={
                    <div className={cn("transition-transform duration-base ease-smooth-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:-translate-y-0.5", isActive && "scale-110")}>
                        {icon}
                    </div>
                }
                {...props}
            />
        </AnimatedTooltip>
    );
}
