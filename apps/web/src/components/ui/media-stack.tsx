"use client"

import React from "react"
import { motion } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { MediaCard, type MediaCardProps } from "./media-card"

interface MediaStackProps extends MediaCardProps {
    stackCount?: number
}

/**
 * MediaStack (Stacked Cassettes)
 * 
 * Represents a collection (series/season) as a stack of physical media (cassettes).
 * Features a "fanning" animation on hover using 3D perspective.
 */
export function MediaStack({ stackCount = 3, className, ...props }: MediaStackProps) {
    // Generate indices for the background cards (the "stack" underneath)
    const stackItems = Array.from({ length: stackCount - 1 }).map((_, i) => i + 1)

    return (
        <div className={cn("relative group/stack perspective-1000", className)}>
            {/* Background stack elements (Cassette lomos/edges) */}
            {stackItems.map((idx) => (
                <motion.div
                    key={idx}
                    className="absolute inset-0 bg-zinc-950 border border-white/5 rounded-xl shadow-2xl overflow-hidden"
                    initial={false}
                    animate={{
                        x: 0,
                        y: 0,
                        rotateZ: 0,
                        scale: 1 - idx * 0.02,
                    }}
                    whileHover={{
                        x: idx * 16,
                        y: -idx * 2,
                        rotateZ: idx * 1.5,
                        transition: { 
                            type: "spring", 
                            stiffness: 300, 
                            damping: 25,
                            delay: idx * 0.01 
                        }
                    }}
                    style={{
                        zIndex: 10 - idx,
                        transformOrigin: "bottom left"
                    }}
                >
                    {/* Retro "marker" label style on the edge/spine */}
                    <div className="absolute top-2 left-1 bottom-2 w-5 bg-brand-orange/15 rounded-md flex items-center justify-center overflow-hidden border border-brand-orange/20">
                        <span className="rotate-90 whitespace-nowrap text-[8px] font-mono font-black text-brand-orange tracking-tighter">
                            VOL. {idx + 1}
                        </span>
                    </div>
                </motion.div>
            ))}

            {/* Main top card (The front cassette) */}
            <motion.div
                className="relative z-20"
                whileHover={{
                    x: -2,
                    y: -4,
                    rotateZ: -0.5,
                    transition: { type: "spring", stiffness: 300, damping: 25 }
                }}
            >
                <MediaCard {...props} />
                
                <div className="absolute -top-1 -right-1 z-30 flex items-center justify-center">
                    <div className="bg-brand-orange text-white text-[9px] font-black px-2 py-0.5 rounded-full border border-brand-orange/50 shadow-md shadow-black/20">
                        SERIE
                    </div>
                </div>
            </motion.div>

            {/* Retro texture overlay */}
            <div className="absolute inset-0 z-40 pointer-events-none mix-blend-overlay opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/p6.png')]" />
        </div>
    )
}
