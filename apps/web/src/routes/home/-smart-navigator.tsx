import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { 
    Zap, 
    Sword, 
    History, 
    Users, 
    Heart, 
    Flame, 
    Shield,
    Award,
    Sparkles
} from "lucide-react"

const CATEGORIES = [
    { id: "eleva_tu_ki", label: "Eleva tu Ki", icon: Zap, color: "text-amber-400", bg: "bg-amber-400/10" },
    { id: "camino_guerrero", label: "Gohan", icon: Sword, color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { id: "fusion_ha", label: "Fusiones", icon: Users, color: "text-blue-400", bg: "bg-blue-400/10" },
    { id: "epic_moments", label: "Épico", icon: Flame, color: "text-orange-400", bg: "bg-orange-400/10" },
    { id: "essential_cinema", label: "Cine", icon: Award, color: "text-rose-400", bg: "bg-rose-400/10" },
    { id: "cronicas_trunks", label: "Trunks", icon: History, color: "text-purple-400", bg: "bg-purple-400/10" },
    { id: "redencion", label: "Redención", icon: Heart, color: "text-pink-400", bg: "bg-pink-400/10" },
    { id: "fuera_ring", label: "Torneo", icon: Shield, color: "text-cyan-400", bg: "bg-cyan-400/10" },
]

interface SmartNavigatorProps {
    className?: string
}

export function SmartNavigator({ className }: SmartNavigatorProps) {
    const scrollToSection = (id: string) => {
        const element = document.getElementById(`lane-${id}`)
        if (element) {
            const yOffset = -100 // Spacing for header
            const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset
            window.scrollTo({ top: y, behavior: "smooth" })
        }
    }

    return (
        <div className={cn(
            "relative z-40 px-6 md:px-12 lg:px-20 py-8",
            className
        )}>
            <div className="flex flex-col gap-6">
                <div className="flex items-center gap-3">
                    <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
                    <span className="text-[0.65rem] font-bold tracking-[0.3em] text-zinc-500 uppercase">
                        Navegación Inteligente
                    </span>
                </div>

                <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-4">
                    {CATEGORIES.map((cat, idx) => (
                        <motion.button
                            key={cat.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ 
                                delay: idx * 0.05,
                                duration: 0.5,
                                ease: [0.23, 1, 0.32, 1]
                            }}
                            whileHover={{ scale: 1.05, y: -4 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => scrollToSection(cat.id)}
                            className={cn(
                                "group relative flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-500",
                                "bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] hover:border-white/[0.1]",
                                "backdrop-blur-xl shadow-2xl"
                            )}
                        >
                            <div className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-500",
                                cat.bg, cat.color,
                                "group-hover:scale-110 group-hover:rotate-3"
                            )}>
                                <cat.icon className="w-5 h-5" />
                            </div>

                            <div className="flex flex-col items-start">
                                <span className="text-sm font-bold tracking-tight text-zinc-200 group-hover:text-white transition-colors">
                                    {cat.label}
                                </span>
                            </div>

                            {/* Magnetic Glow Effect */}
                            <div className="absolute inset-0 rounded-2xl bg-primary/0 group-hover:bg-primary/5 transition-colors duration-500 -z-10" />
                            <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
                        </motion.button>
                    ))}
                </div>
            </div>
        </div>
    )
}
