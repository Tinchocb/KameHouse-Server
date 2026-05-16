"use client"

import React from "react"
import { motion } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { MediaCard, type MediaCardProps } from "./media-card"

interface MediaStackProps extends MediaCardProps {
    stackCount?: number
}

/**
 * MediaStack (Stacked)
 * 
 * Represents a series or collection as a clean stack of cards.
 */
export function MediaStack({ stackCount = 2, className, ...props }: MediaStackProps) {
    const stackItems = Array.from({ length: stackCount }).map((_, i) => i + 1)

    return (
        <div className={cn("relative group/stack", className)}>
            {/* Background stack elements */}
            {stackItems.map((idx) => (
                <motion.div
                    key={idx}
                    className={cn(
                        "absolute inset-0 border border-white/5 rounded-2xl shadow-2xl overflow-hidden",
                        "bg-zinc-900/50 backdrop-blur-sm"
                    )}
                    initial={false}
                    animate={{
                        x: idx * 4,
                        y: idx * 4,
                        scale: 1,
                    }}
                    whileHover={{
                        x: idx * 12,
                        y: -idx * 4,
                        rotateZ: idx * 1,
                        transition: { 
                            type: "spring", 
                            stiffness: 300, 
                            damping: 25,
                        }
                    }}
                    style={{
                        zIndex: 10 - idx,
                    }}
                />
            ))}

            {/* Main top card */}
            <motion.div
                className="relative z-20"
                whileHover={{
                    y: -8,
                    transition: { type: "spring", stiffness: 300, damping: 25 }
                }}
            >
                <MediaCard {...props} />
                
                {/* Minimalist Series Indicator */}
                <div className="absolute top-4 right-4 z-30">
                    <div className="bg-black/60 backdrop-blur-md text-white/70 text-[8px] font-black px-2 py-1 rounded-md border border-white/10 uppercase tracking-[0.2em]">
                        Serie
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
