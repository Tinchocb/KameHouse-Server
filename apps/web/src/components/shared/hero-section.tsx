import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/components/ui/core/styling"

interface HeroSectionProps {
    title: React.ReactNode // Usually "MI<br/><span...>...</span>"
    subtitle?: string
    decorationTag?: string
    verticalTag?: string
    count?: number | string
    countLabel?: string
    children?: React.ReactNode // Extra content like stats or buttons
    className?: string
    maxWidth?: string
}

export function HeroSection({
    title,
    subtitle,
    decorationTag = "COLECCIÓN PREMIUM",
    verticalTag = "BIBLIOTECA · COLECCIÓN · ARCHIVOS",
    count,
    countLabel = "Títulos",
    children,
    className,
    maxWidth = "max-w-none"
}: HeroSectionProps) {
    return (
        <div className={cn("relative overflow-hidden pt-32 pb-20 px-6 md:px-14", className)}>
            <SpeedLines opacity={0.02} />
            <HalftoneDots />
            
            {/* Vertical Decoration */}
            <div className="absolute right-6 top-1/2 -translate-y-1/2 [writing-mode:vertical-rl] font-black text-[11px] tracking-[0.5em] text-zinc-900 uppercase pointer-events-none select-none">
                {verticalTag}
            </div>

            <div className={cn("relative z-10 mx-auto", maxWidth)}>
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7 }}
                    className="flex items-center gap-4 mb-6"
                >
                    <div className="h-[2px] w-12 bg-white" />
                    <p className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-500">{decorationTag}</p>
                </motion.div>
                
                <motion.h1 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.1 }}
                    className="font-bebas text-7xl md:text-9xl lg:text-[11rem] leading-[0.8] tracking-[0.02em] text-white uppercase"
                >
                    {title}
                </motion.h1>

                {subtitle && (
                    <motion.p 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="font-bebas text-3xl md:text-5xl tracking-[0.1em] text-white mt-4 uppercase"
                    >
                        {subtitle}
                    </motion.p>
                )}
                
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="mt-12"
                >
                    {count !== undefined && (
                        <div className="inline-block px-4 py-2 bg-black border border-white/20">
                            <p className="text-[14px] font-black text-white tabular-nums uppercase tracking-widest">
                                {count} <span className="text-[11px] font-black text-zinc-600 uppercase ml-2 tracking-widest">{countLabel}</span>
                            </p>
                        </div>
                    )}
                    {children}
                </motion.div>
            </div>
            
            <style>{`
                .stroke-text {
                    -webkit-text-stroke: 1.5px white;
                }
            `}</style>
        </div>
    )
}

// ─── Shared Cinematic Decorations ───────────────────────

function SpeedLines({ opacity = 0.04 }: { opacity?: number }) {
    return (
        <svg
            aria-hidden
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ opacity }}
            viewBox="0 0 900 320"
            preserveAspectRatio="xMidYMid slice"
        >
            {Array.from({ length: 32 }).map((_, i) => {
                const angle = (i / 32) * 360
                const rad = (angle * Math.PI) / 180
                return (
                    <line
                        key={i}
                        x1="450" y1="160"
                        x2={450 + Math.cos(rad) * 1400}
                        y2={160 + Math.sin(rad) * 1400}
                        stroke="white"
                        strokeWidth={i % 4 === 0 ? "1.5" : "0.6"}
                    />
                )
            })}
        </svg>
    )
}

function HalftoneDots() {
    return (
        <svg
            aria-hidden
            className="absolute inset-0 w-full h-full opacity-[0.025] pointer-events-none"
        >
            <defs>
                <pattern id="dots" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
                    <circle cx="6" cy="6" r="1.5" fill="white" />
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
    )
}
