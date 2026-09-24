import * as React from "react"
import { m, type Variants } from "framer-motion"
import { useReducedMotion } from "./hooks"
import { cn } from "@/components/ui/core/styling"

export interface BlurTextProps {
    text: string
    className?: string
    delay?: number
    animateBy?: "words" | "letters"
    style?: React.CSSProperties
    onClick?: () => void
}

const blurTextVariants: Variants = {
    hidden: {
        opacity: 0,
        y: 12,
        filter: "blur(8px)",
    },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        transition: {
            type: "spring",
            stiffness: 380,
            damping: 30,
            delay: i * 0.035,
        },
    }),
}

export const BlurText = React.memo(function BlurText({
    text,
    className,
    delay = 0.035,
    animateBy = "words",
    style,
    onClick,
}: BlurTextProps) {
    const prefersReducedMotion = useReducedMotion()

    if (prefersReducedMotion) {
        if (onClick) {
            return (
                <button
                    type="button"
                    className={cn("text-left bg-transparent border-0 p-0 [font:inherit] cursor-pointer", className)}
                    style={style}
                    onClick={onClick}
                >
                    {text}
                </button>
            )
        }
        return (
            <span className={className} style={style}>
                {text}
            </span>
        )
    }

    const elements = animateBy === "words" ? text.split(" ") : text.split("")

    const content = elements.map((el, index) => (
        <m.span
            key={`${el}-${index}`}
            custom={index}
            initial="hidden"
            animate="visible"
            variants={{
                hidden: blurTextVariants.hidden,
                visible: (i: number) => ({
                    opacity: 1,
                    y: 0,
                    filter: "blur(0px)",
                    transition: {
                        type: "spring",
                        stiffness: 380,
                        damping: 30,
                        delay: i * delay,
                    },
                }),
            }}
            className="inline-block transform-gpu"
        >
            {el}
            {animateBy === "words" && index < elements.length - 1 ? "\u00A0" : ""}
        </m.span>
    ))

    if (onClick) {
        return (
            <button
                type="button"
                className={cn("inline-flex flex-wrap text-left bg-transparent border-0 p-0 [font:inherit] cursor-pointer", className)}
                style={style}
                onClick={onClick}
            >
                {content}
            </button>
        )
    }

    return (
        <span
            className={cn("inline-flex flex-wrap", className)}
            style={style}
        >
            {content}
        </span>
    )
})

BlurText.displayName = "BlurText"
