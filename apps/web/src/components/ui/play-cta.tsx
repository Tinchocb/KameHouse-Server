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
        // Un solo botón nativo: antes RippleFeedback (role="button") envolvía un
        // <button> y el teclado pasaba dos veces por el mismo CTA.
        <RippleFeedback
            onClick={onClick}
            onPointerEnter={onHoverIntent}
            onFocus={onHoverIntent}
            title={sublabel || label}
            rippleColor="rgba(0, 0, 0, 0.15)"
            className={cn(
                "group/play inline-flex items-center justify-center gap-2.5 px-6 sm:px-7 py-3 rounded-full select-none cursor-pointer shrink-0 min-h-[44px]",
                "bg-white hover:bg-zinc-100 text-zinc-950 font-display font-black text-xs sm:text-sm uppercase tracking-wider",
                "border border-white/40 border-t-white/80 border-b-white/20",
                "shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.6),0_8px_24px_rgba(255,255,255,0.25)] hover:shadow-[0_12px_32px_rgba(255,255,255,0.35)]",
                "transition-[transform,background-color,box-shadow] duration-base ease-smooth-out hover:scale-[1.02] active:scale-95",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                className
            )}
        >
            {/* Shimmer light sweep */}
            <span aria-hidden="true" className="absolute inset-0 -translate-x-full group-hover/play:translate-x-full transition-none group-hover/play:transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-black/10 to-transparent z-10 pointer-events-none rounded-full motion-reduce:hidden" />

            <IconMediaPlay size={15} fill="currentColor" className="shrink-0 transition-transform duration-base ease-smooth-out group-hover/play:scale-110 relative z-20" />
            <span className="whitespace-nowrap relative z-20">{label}</span>
        </RippleFeedback>
    );
}
