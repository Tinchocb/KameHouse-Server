import React from "react"
import { motion } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { Play } from "lucide-react"

export interface BentoItem {
    id: string
    title: string
    image: string
    subtitle?: string
    year?: string | number
    rating?: number
    description?: string
    vibes?: string[]
    onClick: () => void
}

interface BentoRecentlyAddedProps {
    items: BentoItem[]
    className?: string
}

export function BentoRecentlyAdded({ items, className }: BentoRecentlyAddedProps) {
    if (items.length === 0) return null
    const bentoItems = items.slice(0, 6)

    return (
        <div className={cn("grid grid-cols-1 md:grid-cols-4 grid-rows-2 gap-6 px-8 md:px-16 lg:px-24", className)}>
            {bentoItems.map((item, idx) => {
                const isLarge = idx === 0
                const isMedium = idx === 1 || idx === 5

                return (
                    <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ 
                            duration: 0.8, 
                            delay: idx * 0.08,
                            ease: [0.23, 1, 0.32, 1] 
                        }}
                        onClick={item.onClick}
                        className={cn(
                            "group relative overflow-hidden rounded-[32px] border border-white/[0.05] bg-zinc-900/40 backdrop-blur-xl cursor-pointer transition-all duration-500",
                            isLarge ? "md:col-span-2 md:row-span-2 h-[450px] md:h-full" : "h-[220px] md:h-full",
                            isMedium && !isLarge ? "md:col-span-1" : "",
                            "hover:border-brand-orange/20 hover:shadow-[0_20px_40px_-15px_rgba(255,110,58,0.15)]"
                        )}
                    >
                        {/* Background Image */}
                        <img
                            src={item.image}
                            alt={item.title}
                            className="absolute inset-0 h-full w-full object-cover transition-all duration-[1200ms] [transition-timing-function:cubic-bezier(0.25,1,0.5,1)] group-hover:scale-[1.06] group-hover:brightness-[0.4] group-hover:saturate-[1.1] brightness-[0.5]"
                        />

                        {/* Overlays */}
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/25 to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />

                        {/* Content */}
                        <div className="absolute inset-0 p-8 flex flex-col justify-end">
                            <div className="space-y-4">
                                {/* Minimalist Badges */}
                                <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500">
                                    {item.year && (
                                        <span className="text-[10px] font-black tracking-widest text-white/40 uppercase">
                                            {item.year}
                                        </span>
                                    )}
                                    {item.rating && (
                                        <span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">
                                            {(item.rating * 10).toFixed(0)}% Match
                                        </span>
                                    )}
                                </div>
                                
                                <h3 className={cn(
                                    "font-bebas text-white leading-[0.9] uppercase tracking-wide transition-all duration-500 group-hover:text-brand-orange",
                                    isLarge ? "text-5xl md:text-8xl" : "text-3xl md:text-4xl"
                                )}>
                                    {item.title}
                                </h3>

                                {isLarge && item.description && (
                                    <p className="text-zinc-400 text-lg line-clamp-2 max-w-md opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all delay-100 duration-500 leading-relaxed font-medium">
                                        {item.description}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Centered Play Indicator */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none z-30">
                            <div className="bg-brand-orange/20 backdrop-blur-md p-5 rounded-full border border-brand-orange/40 scale-75 group-hover:scale-100 shadow-[0_0_20px_rgba(255,110,58,0.25)] transition-all duration-500">
                                <Play className="w-6 h-6 text-white fill-current translate-x-[2px]" />
                            </div>
                        </div>
                    </motion.div>
                )
            })}
        </div>
    )
}
