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
        <div className={cn(
            "relative z-40 -mt-10 px-6 md:px-12 lg:px-20",
            className
        )}>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-4 border-b border-white/5">
                {VIBES.map((vibe, idx) => {
                    const isActive = selectedVibe === vibe.id
                    return (
                        <motion.button
                            key={vibe.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ 
                                delay: idx * 0.04, 
                                duration: 0.6,
                                ease: [0.23, 1, 0.32, 1]
                            }}
                            onClick={() => onSelect(vibe.id)}
                            className={cn(
                                "group relative flex items-center gap-3 px-6 py-3 rounded-xl transition-all duration-300",
                                isActive ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            {isActive && (
                                <motion.div 
                                    layoutId="vibe-active-bg"
                                    className="absolute inset-0 bg-white/[0.03] rounded-xl -z-10"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                            
                            <div className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300",
                                isActive ? vibe.bg + " " + vibe.color : "bg-zinc-900/50 text-zinc-600 group-hover:text-zinc-400"
                            )}>
                                <vibe.icon className="w-4 h-4" />
                            </div>
                            
                            <span className="text-sm font-bold tracking-tight">
                                {vibe.label}
                            </span>

                            {isActive && (
                                <motion.div 
                                    layoutId="vibe-underline"
                                    className="absolute bottom-0 left-6 right-6 h-[2px] bg-primary"
                                    transition={{ type: "spring", bounce: 0, duration: 0.6 }}
                                />
                            )}
                        </motion.button>
                    )
                })}
            </div>
        </div>
    )
}

