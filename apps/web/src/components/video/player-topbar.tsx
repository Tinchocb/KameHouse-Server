import React from "react"
import { FiX } from "react-icons/fi"
import { cn } from "@/components/ui/core/styling"

interface PlayerTopBarProps {
    title?: string
    episodeLabel?: string
    onClose: () => void
}

export function PlayerTopBar({ title, episodeLabel, onClose }: PlayerTopBarProps) {
    return (
        <div className={cn(
            "absolute top-0 inset-x-0 p-6 md:p-10 flex items-center justify-between pointer-events-auto",
            "bg-zinc-950/20 backdrop-blur-md border-b border-white/[0.03]",
            "transition-all duration-300 ease-out"
        )}>
            <div className="flex gap-4 md:gap-8 items-center">
                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    aria-label="Cerrar reproductor"
                    className="flex items-center justify-center w-10 h-10 md:w-14 md:h-14 text-white/50 hover:text-white hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-2xl transition-all duration-500 backdrop-blur-xl group"
                >
                    <FiX className="w-5 h-5 md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
                </button>
                
                <div className="flex flex-col">
                    <span className="text-white font-bebas text-2xl md:text-4xl tracking-[0.05em] uppercase leading-none">{title || "Reproduciendo"}</span>
                    {episodeLabel && (
                        <span className="text-zinc-500 font-bold tracking-[0.2em] uppercase text-[10px] md:text-xs mt-2 flex items-center gap-2">
                            <span className="w-2 h-[1px] bg-brand-orange" />
                            {episodeLabel}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}
