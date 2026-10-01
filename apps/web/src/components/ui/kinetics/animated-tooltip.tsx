import * as React from "react"
import { m, AnimatePresence } from "framer-motion"
import { useReducedMotion } from "./hooks"
import { cn } from "@/components/ui/core/styling"

export interface AnimatedTooltipProps {
    content: React.ReactNode
    children: React.ReactNode
    side?: "top" | "bottom" | "left" | "right"
    delayMs?: number
    className?: string
}

export function AnimatedTooltip({
    content,
    children,
    side = "top",
    delayMs = 120,
    className,
}: AnimatedTooltipProps) {
    const [isVisible, setIsVisible] = React.useState(false)
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const prefersReducedMotion = useReducedMotion()

    const handleMouseEnter = () => {
        timerRef.current = setTimeout(() => {
            setIsVisible(true)
        }, delayMs)
    }

    const handleMouseLeave = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current)
            timerRef.current = null
        }
        setIsVisible(false)
    }

    React.useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [])

    if (!content) return <>{children}</>

    const initialOffset = {
        top: { y: 6 },
        bottom: { y: -6 },
        left: { x: 6 },
        right: { x: -6 },
    }[side]

    const exitOffset = {
        top: { y: 4 },
        bottom: { y: -4 },
        left: { x: 4 },
        right: { x: -4 },
    }[side]

    const positionClass = {
        top: "-top-9 left-1/2 -translate-x-1/2",
        bottom: "-bottom-9 left-1/2 -translate-x-1/2",
        left: "right-[calc(100%+10px)] top-1/2 -translate-y-1/2",
        right: "left-[calc(100%+10px)] top-1/2 -translate-y-1/2",
    }[side]

    return (
        <div
            role="group"
            className="relative inline-flex items-center justify-center"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onFocus={handleMouseEnter}
            onBlur={handleMouseLeave}
        >
            {children}
            <AnimatePresence>
                {isVisible && (
                    <m.div
                        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, ...initialOffset, scale: 0.95 }}
                        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0, y: 0, scale: 1 }}
                        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, ...exitOffset, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 420, damping: 28 }}
                        className={cn(
                            "absolute pointer-events-none z-50 px-2.5 py-1 rounded-xl",
                            "sectionbar",
                            "text-white font-mono text-2xs font-bold tracking-wider uppercase",
                            "whitespace-nowrap select-none",
                            positionClass,
                            className
                        )}
                    >
                        {content}
                    </m.div>
                )}
            </AnimatePresence>
        </div>
    )
}

AnimatedTooltip.displayName = "AnimatedTooltip"
