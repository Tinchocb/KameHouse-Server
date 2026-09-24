"use client"

import * as React from "react"
import { m, type Variants, useReducedMotion } from "framer-motion"
import { cn } from "@/components/ui/core/styling"

export interface SplitTextRevealProps {
    text: string
    className?: string
    /** Desglose por palabras ("words") o por caracteres ("chars"). Por defecto "words" */
    mode?: "words" | "chars"
    /** Tag HTML contenedor */
    as?: "h1" | "h2" | "h3" | "h4" | "span" | "p"
    /** Delay escalonado entre fragmentos en segundos. Por defecto 0.04 */
    staggerDelay?: number
    /** Delay inicial antes del arranque de la animación */
    initialDelay?: number
}

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: (custom: { staggerDelay: number; initialDelay: number }) => ({
        opacity: 1,
        transition: {
            staggerChildren: custom.staggerDelay,
            delayChildren: custom.initialDelay,
        },
    }),
}

const itemVariants: Variants = {
    hidden: {
        opacity: 0,
        y: 14,
        filter: "blur(6px)",
    },
    visible: {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        transition: {
            type: "spring",
            stiffness: 380,
            damping: 28,
            mass: 0.8,
        },
    },
}

export function SplitTextReveal({
    text,
    className,
    mode = "words",
    as = "span",
    staggerDelay = 0.045,
    initialDelay = 0,
}: SplitTextRevealProps) {
    const prefersReducedMotion = useReducedMotion()
    const Component = m[as] as typeof m.span

    if (prefersReducedMotion) {
        return <Component className={className}>{text}</Component>
    }

    if (mode === "words") {
        const words = text.split(" ")
        return (
            <Component
                className={cn("inline-flex flex-wrap gap-x-[0.25em]", className)}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                custom={{ staggerDelay, initialDelay }}
            >
                {words.map((word, idx) => (
                    <m.span
                        key={`${word}-${idx}`}
                        variants={itemVariants}
                        className="inline-block will-change-transform"
                    >
                        {word}
                    </m.span>
                ))}
            </Component>
        )
    }

    // mode === "chars": divide respetando agrupaciones de palabras para evitar cortes huérfanos
    const words = text.split(" ")
    return (
        <Component
            className={cn("inline-flex flex-wrap gap-x-[0.25em]", className)}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            custom={{ staggerDelay, initialDelay }}
        >
            {words.map((word, wordIdx) => (
                <span key={`${word}-${wordIdx}`} className="inline-block whitespace-nowrap">
                    {Array.from(word).map((char, charIdx) => (
                        <m.span
                            key={`${char}-${charIdx}`}
                            variants={itemVariants}
                            className="inline-block will-change-transform"
                        >
                            {char}
                        </m.span>
                    ))}
                </span>
            ))}
        </Component>
    )
}
