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
            "bg-gradient-to-b from-black/85 via-black/40 to-transparent",
            "transition-all duration-300 ease-out"
        )}>
            <div className="flex gap-4 md:gap-6 items-center">
                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    aria-label="Cerrar reproductor"
                    className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-full transition-all duration-300 backdrop-blur-md"
                >
                    <FiX className="w-5 h-5 md:w-6 md:h-6" />
                </button>
                
                <div className="flex flex-col">
                    <span className="text-white font-semibold text-lg md:text-xl tracking-wide leading-none">{title || "Reproduciendo"}</span>
                    {episodeLabel && (
                        <span className="text-zinc-400 font-medium tracking-wide text-xs md:text-sm mt-1.5">{episodeLabel}</span>
                    )}
                </div>
            </div>
        </div>
    )
}
