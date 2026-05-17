import React from "react"
import { FiX } from "react-icons/fi"
import { cn } from "@/components/ui/core/styling"

interface PlayerTopBarProps {
    title?: string
    episodeLabel?: string
    episodeNumber?: number
    onClose: () => void
}

export function PlayerTopBar({ title, episodeLabel, episodeNumber, onClose }: PlayerTopBarProps) {
    return (
        <div className={cn(
            "absolute top-0 inset-x-0 p-6 md:p-10 flex items-center justify-between pointer-events-auto",
            "bg-gradient-to-b from-black/60 to-transparent",
            "transition-all duration-300 ease-out z-[100]"
        )}>
            <div className="flex gap-4 md:gap-8 items-center">
                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    aria-label="Cerrar reproductor"
                    className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 text-white/40 hover:text-white hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-xl transition-all duration-300 backdrop-blur-xl group"
                >
                    <FiX className="w-5 h-5 md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
                </button>
                
                <div className="flex flex-col gap-1">
                    <h1 className="text-white font-bebas text-xl md:text-3xl tracking-[0.02em] uppercase leading-none truncate max-w-[50vw]">
                        {title || episodeLabel || "Reproduciendo"}
                    </h1>
                    {episodeNumber && (
                        <span className="text-zinc-500 font-bold tracking-[0.1em] uppercase text-[9px] md:text-[10px] flex items-center gap-2 opacity-80">
                            Episodio {episodeNumber}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}
