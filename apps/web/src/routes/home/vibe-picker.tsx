import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { Flame, Coffee, Heart, Zap, Ghost } from "lucide-react"

const VIBES = [
    { id: "EPIC", label: "Épico", icon: Flame, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
    { id: "CHILL", label: "Chill", icon: Coffee, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    { id: "EMOTIONAL", label: "Emocional", icon: Heart, color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20" },
    { id: "HYPED", label: "Hype", icon: Zap, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
    { id: "INTENSE", label: "Intenso", icon: Ghost, color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20" },
]

interface VibePickerProps {
    selectedVibe?: string | null
    onSelect: (vibe: string) => void
    className?: string
}

export function VibePicker({ selectedVibe, onSelect, className }: VibePickerProps) {
    return (
        <div className={cn("px-6 md:px-10 lg:px-16 xl:px-24 2xl:px-32 flex flex-wrap gap-4", className)}>
            {VIBES.map((vibe, idx) => {
                const isActive = selectedVibe === vibe.id
                return (
                    <motion.button
                        key={vibe.id}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ 
                            delay: idx * 0.05, 
                            duration: 0.8,
                            ease: [0.23, 1, 0.32, 1]
                        }}
                        onClick={() => onSelect(vibe.id)}
                        className={cn(
                            "group relative flex items-center gap-4 px-5 py-3.5 rounded-[22px] border transition-all duration-500 hover:scale-105 active:scale-95 shadow-lg overflow-hidden",
                            isActive 
                                ? "border-primary bg-primary/10 shadow-primary/20 scale-105" 
                                : "border-white/5 bg-zinc-950/20 backdrop-blur-3xl hover:border-white/10 hover:bg-zinc-900/40"
                        )}
                    >
                        {/* Hover/Active Background Accent */}
                        <div className={cn(
                            "absolute inset-0 transition-opacity duration-500", 
                            vibe.bg,
                            isActive ? "opacity-20" : "opacity-0 group-hover:opacity-10"
                        )} />
                        
                        <div className={cn(
                            "relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-500",
                            vibe.bg, vibe.color, vibe.border,
                            isActive ? "scale-110 shadow-lg" : "group-hover:scale-110"
                        )}>
                            <vibe.icon className="w-5 h-5 stroke-[2px]" />
                        </div>
                        
                        <div className="flex flex-col items-start pr-2">
                            <span className={cn(
                                "text-[0.6rem] font-black uppercase tracking-[0.2em] transition-colors",
                                isActive ? "text-primary-foreground/70" : "text-zinc-500 group-hover:text-zinc-400"
                            )}>
                                MOOD
                            </span>
                            <span className={cn(
                                "text-sm font-bold tracking-wider transition-colors",
                                isActive ? "text-white" : "text-zinc-300 group-hover:text-white"
                            )}>
                                {vibe.label}
                            </span>
                        </div>
                    </motion.button>
                )
            })}
        </div>
    )
}
