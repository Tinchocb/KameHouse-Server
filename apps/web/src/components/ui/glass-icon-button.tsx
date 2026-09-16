import React from "react";
import { cn } from "./core/styling";

interface GlassIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: React.ReactNode;
    title: string;
    isActive?: boolean;
    activeTone?: "success" | "destructive" | "primary" | "secondary";
    className?: string;
}

export function GlassIconButton({
    icon,
    title,
    isActive = false,
    activeTone = "success",
    className,
    ...props
}: GlassIconButtonProps) {
    const toneMap = {
        success: "text-brand-success",
        destructive: "text-brand-destructive",
        primary: "text-brand-accent",
        secondary: "text-brand-secondary",
    };

    return (
        <button
            title={title}
            className={cn(
                "group flex items-center justify-center p-4 rounded-xl",
                "bg-zinc-950/60 border border-white/20 border-t-white/40 border-b-white/10",
                "backdrop-blur-overlay-2xl backdrop-saturate-[190%]",
                "shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.25),0_8px_24px_rgba(0,0,0,0.6)]",
                "transition-all duration-base hover:scale-[1.03] active:scale-95 min-h-[44px] cursor-pointer",
                isActive ? toneMap[activeTone] : "text-zinc-300 hover:text-white hover:bg-zinc-900/80",
                className
            )}
            {...props}
        >
            <div className={cn("transition-transform group-hover:-translate-y-0.5", isActive && "scale-110")}>
                {icon}
            </div>
        </button>
    );
}
