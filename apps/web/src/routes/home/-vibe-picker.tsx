import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { Flame, Coffee, Heart, Zap, Ghost } from "lucide-react"

const VIBES = [
    { 
        id: "EPIC",      
        label: "Épico",     
        icon: Flame,  
        activeClass: "bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)]", 
        iconColor: "text-amber-400",
        accentLine: "bg-amber-400"
    },
    { 
        id: "CHILL",     
        label: "Chill",     
        icon: Coffee, 
        activeClass: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]", 
        iconColor: "text-emerald-400",
        accentLine: "bg-emerald-400"
    },
    { 
        id: "EMOTIONAL", 
        label: "Emocional", 
        icon: Heart,  
        activeClass: "bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.15)]", 
        iconColor: "text-rose-400",
        accentLine: "bg-rose-400"
    },
    { 
        id: "HYPED",     
        label: "Hype",      
        icon: Zap,    
        activeClass: "bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]", 
        iconColor: "text-blue-400",
        accentLine: "bg-blue-400"
    },
    { 
        id: "INTENSE",   
        label: "Intenso",   
        icon: Ghost,  
        activeClass: "bg-violet-500/10 border-violet-500/30 text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.15)]", 
        iconColor: "text-violet-400",
        accentLine: "bg-violet-400"
    },
]

interface VibePickerProps {
    selectedVibe?: string | null
    onSelect: (vibe: string) => void
    className?: string
}

export function VibePicker({ selectedVibe, onSelect, className }: VibePickerProps) {
    return (
        <div className={cn(
            "relative z-40 -mt-10 px-6 md:px-12 lg:px-20",
            className
        )}>
            {/* Section label */}
            <div className="mb-4 flex items-center gap-3">
                <div className="h-px w-8 bg-white/10" />
                <span className="text-[0.6rem] font-black uppercase tracking-[0.35em] text-white/25">
                    Mood
                </span>
            </div>

            {/* Pill tabs */}
            <div className="flex flex-wrap items-center gap-2">
                {VIBES.map((vibe, idx) => {
                    const isActive = selectedVibe === vibe.id
                    return (
                        <motion.button
                            key={vibe.id}
                            id={`vibe-btn-${vibe.id.toLowerCase()}`}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                delay: idx * 0.05,
                                duration: 0.5,
                                ease: [0.23, 1, 0.32, 1]
                            }}
                            onClick={() => onSelect(vibe.id)}
                            className={cn(
                                "relative flex items-center gap-2.5 px-5 py-2.5 rounded-full",
                                "border transition-all duration-500 select-none backdrop-blur-md cursor-pointer",
                                isActive
                                    ? vibe.activeClass
                                    : "bg-white/[0.01] border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-white/15 hover:bg-white/[0.04] shadow-sm"
                            )}
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.96 }}
                        >
                            <motion.div
                                animate={isActive ? { rotate: [0, -8, 8, 0] } : { rotate: 0 }}
                                transition={{ duration: 0.4, ease: "easeInOut" }}
                            >
                                <vibe.icon className={cn(
                                    "w-3.5 h-3.5 transition-colors duration-300",
                                    isActive ? vibe.iconColor : "text-zinc-600"
                                )} />
                            </motion.div>

                            <span className="text-xs font-bold tracking-wide">
                                {vibe.label}
                            </span>

                            {/* Active bottom accent line */}
                            {isActive && (
                                <motion.div
                                    layoutId="vibe-accent"
                                    className={cn(
                                        "absolute -bottom-px left-4 right-4 h-[1.5px] rounded-full",
                                        vibe.accentLine
                                    )}
                                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                                />
                            )}
                        </motion.button>
                    )
                })}

                {/* Clear filter button when a vibe is selected */}
                {selectedVibe && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={() => onSelect(selectedVibe)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-white/5 text-zinc-600 hover:text-zinc-400 text-xs font-bold transition-all duration-200 cursor-pointer"
                    >
                        <span>✕</span>
                        <span>Limpiar</span>
                    </motion.button>
                )}
            </div>
        </div>
    )
}
