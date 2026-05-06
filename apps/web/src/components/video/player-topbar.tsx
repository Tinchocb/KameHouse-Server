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
            "absolute top-0 inset-x-0 p-8 flex items-start justify-between pointer-events-auto bg-black border-b border-white/10",
            "transition-all duration-300 ease-out",
            "opacity-100 translate-y-0"
        )}>
            <div className="flex gap-6 items-center">
                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    aria-label="Cerrar reproductor"
                    className="flex items-center justify-center w-12 h-12 bg-white text-black border border-white hover:bg-zinc-200 transition-colors"
                >
                    <FiX className="w-6 h-6" />
                </button>
                
                <div className="flex flex-col">
                    <span className="text-white font-black text-2xl uppercase tracking-tight leading-none">{title || "Reproduciendo"}</span>
                    {episodeLabel && (
                        <span className="text-zinc-500 font-black tracking-[0.3em] uppercase text-[10px] mt-2">{episodeLabel}</span>
                    )}
                </div>
            </div>
        </div>
    )
}
