import React from "react";
import { IconMediaPlay } from "@/components/ui/icons";
import { cn } from "./core/styling";
import { RippleFeedback } from "./kinetics";

export interface PlayCtaProps {
    onClick: () => void;
    onHoverIntent?: () => void;
    label: string;
    sublabel?: string;
    className?: string;
}

export function PlayCta({ onClick, onHoverIntent, label, sublabel, className }: PlayCtaProps) {
    return (
        <RippleFeedback
            onClick={onClick}
            rippleColor="rgba(0, 0, 0, 0.15)"
            className={cn("inline-flex rounded-full overflow-hidden shrink-0", className)}
        >
            <button
                type="button"
                onPointerEnter={onHoverIntent}
                onFocus={onHoverIntent}
                title={sublabel || label}
                className={cn(
                    "group/play relative inline-flex items-center justify-center gap-2.5 px-6 sm:px-7 py-3 rounded-full select-none cursor-pointer w-full min-h-[44px]",
                    "bg-white hover:bg-zinc-100 text-zinc-950 font-display font-black text-xs sm:text-sm uppercase tracking-wider",
                    "border border-white/40 border-t-white/80 border-b-white/20",
                    "shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.6),0_8px_24px_rgba(255,255,255,0.25)] hover:shadow-[0_12px_32px_rgba(255,255,255,0.35)]",
                    "transition-[transform,background-color,box-shadow] duration-base ease-smooth-out hover:scale-[1.02] active:scale-95"
                )}
            >
                {/* Shimmer light sweep */}
                <div aria-hidden className="absolute inset-0 -translate-x-full group-hover/play:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-black/10 to-transparent z-10 pointer-events-none rounded-full" />
                
                <IconMediaPlay size={15} fill="currentColor" className="shrink-0 transition-transform duration-base ease-smooth-out group-hover/play:scale-110 relative z-20" />
                <span className="whitespace-nowrap relative z-20">{label}</span>
            </button>
        </RippleFeedback>
    );
}
