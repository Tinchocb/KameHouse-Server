"use client"

import * as React from "react"
import { m, useReducedMotion } from "framer-motion"
import { cn } from "@/components/ui/core/styling"

export interface GradientRevealTextProps {
    children: React.ReactNode
    className?: string
    /** Tag HTML a renderizar. Por defecto 'span' */
    as?: "h1" | "h2" | "h3" | "h4" | "span" | "p"
    /** Colores del gradiente en orden. Por defecto blanco -> brand-accent -> blanco */
    colors?: [string, string, ...string[]]
    /** Duración del ciclo en segundos. Por defecto 4s */
    duration?: number
    /** Si debe animarse en bucle continuo o mantenerse estático */
    animateLoop?: boolean
}

export function GradientRevealText({
    children,
    className,
    as = "span",
    colors,
    duration = 4.5,
    animateLoop = true,
}: GradientRevealTextProps) {
    const prefersReducedMotion = useReducedMotion()

    const gradientColors = colors
        ? colors.join(", ")
        : "rgba(255, 255, 255, 0.95), var(--brand-accent, #F59E0B), rgba(255, 255, 255, 0.85)"

    const Component = m[as] as typeof m.span

    if (prefersReducedMotion || !animateLoop) {
        return (
            <Component
                className={cn("inline-block", className)}
                style={{
                    backgroundImage: `linear-gradient(135deg, ${gradientColors})`,
                    backgroundSize: "200% 100%",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                }}
            >
                {children}
            </Component>
        )
    }

    return (
        <Component
            className={cn("inline-block will-change-[background-position]", className)}
            style={{
                backgroundImage: `linear-gradient(90deg, ${gradientColors})`,
                backgroundSize: "250% 100%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
            }}
            animate={{
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
            }}
            transition={{
                duration,
                repeat: Infinity,
                ease: "linear",
            }}
        >
            {children}
        </Component>
    )
}
