import React from "react"
import { motion } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { Star, Play, Calendar } from "lucide-react"

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

    // We only take the first 6 items for the Bento grid
    const bentoItems = items.slice(0, 6)

    return (
        <div className={cn("grid grid-cols-1 md:grid-cols-4 grid-rows-2 gap-4 px-6 md:px-10 lg:px-14", className)}>
            {bentoItems.map((item, idx) => {
                // Different layout based on index
                const isLarge = idx === 0
                const isMedium = idx === 1 || idx === 5

                return (
                    <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ 
                            duration: 0.5, 
                            delay: idx * 0.1,
                            ease: [0.23, 1, 0.32, 1] 
                        }}
                        onClick={item.onClick}
                        className={cn(
                            "group relative overflow-hidden rounded-3xl border border-white/[0.03] bg-zinc-950 cursor-pointer transition-all duration-500",
                            isLarge ? "md:col-span-2 md:row-span-2 h-[400px] md:h-full" : "h-[200px] md:h-full",
                            isMedium && !isLarge ? "md:col-span-1" : "",
                            "hover:border-white/10 hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.5)]"
                        )}
                    >
                        {/* Background Image */}
                        <img
                            src={item.image}
                            alt={item.title}
                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110 brightness-[0.6] group-hover:brightness-[0.4]"
                        />

                        {/* Hover Overlay Glow */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-t from-primary/40 via-transparent to-transparent" />

                        {/* Content */}
                        <div className="absolute inset-0 p-6 flex flex-col justify-end">
                            <div className="space-y-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                                <div className="flex items-center gap-2">
                                    {item.rating && (
                                        <div className="flex items-center gap-1 text-[0.6rem] font-black text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                                            <Star className="w-2.5 h-2.5 fill-current" />
                                            {item.rating.toFixed(1)}
                                        </div>
                                    )}
                                    {item.year && (
                                        <div className="flex items-center gap-1 text-[0.6rem] font-black text-zinc-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                                            <Calendar className="w-2.5 h-2.5" />
                                            {item.year}
                                        </div>
                                    )}
                                    {item.vibes?.slice(0, 2).map(vibe => (
                                        <div key={vibe} className="text-[0.6rem] font-black tracking-[0.1em] uppercase px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-zinc-500">
                                            {vibe}
                                        </div>
                                    ))}
                                </div>
                                
                                <h3 className={cn(
                                    "font-bebas text-white leading-none tracking-wide transition-colors group-hover:text-primary",
                                    isLarge ? "text-4xl md:text-6xl" : "text-2xl md:text-3xl"
                                )}>
                                    {item.title}
                                </h3>

                                {isLarge && item.description && (
                                    <p className="text-zinc-400 text-sm line-clamp-2 max-w-md opacity-0 group-hover:opacity-100 transition-opacity delay-100 duration-500">
                                        {item.description}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Play Icon on Hover */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-500 scale-50 group-hover:scale-100">
                            <div className="bg-primary p-5 rounded-full shadow-[0_0_30px_rgba(var(--primary-rgb),0.5)]">
                                <Play className="w-8 h-8 text-white fill-current" />
                            </div>
                        </div>
                    </motion.div>
                )
            })}
        </div>
    )
}
