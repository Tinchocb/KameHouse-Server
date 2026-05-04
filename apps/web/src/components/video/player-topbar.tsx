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
            "absolute top-0 inset-x-0 pt-6 pb-24 px-6 md:px-10 flex flex-col md:flex-row md:items-start justify-between pointer-events-auto bg-gradient-to-b from-black/70 to-transparent",
            "transition-all duration-300 ease-out",
            "opacity-100 translate-y-0"
        )}>
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    aria-label="Cerrar reproductor"
                    className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 text-white/70 hover:text-white transition-colors group glass-layer rounded-full"
                >
                    <FiX className="w-6 h-6 drop-shadow-md" />
                </button>
                
                <div className="flex flex-col drop-shadow-lg max-w-lg mt-2 md:mt-0">
                    <span className="text-white font-black text-xl md:text-2xl leading-tight tracking-wide">{title || "Reproduciendo"}</span>
                    {episodeLabel && (
                        <span className="text-zinc-300 font-bold tracking-widest uppercase text-xs mt-1 md:mt-0.5">{episodeLabel}</span>
                    )}
                </div>
            </div>
        </div>
    )
}
