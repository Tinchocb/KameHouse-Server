import * as React from "react"
import { m, AnimatePresence } from "framer-motion"
import { useReducedMotion } from "./hooks"
import { cn } from "@/components/ui/core/styling"

export interface AnimatedTooltipProps {
    content: React.ReactNode
    children: React.ReactNode
    side?: "top" | "bottom"
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
                        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: side === "top" ? 6 : -6, scale: 0.95 }}
                        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: side === "top" ? 4 : -4, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 420, damping: 28 }}
                        className={cn(
                            "absolute pointer-events-none z-50 px-2.5 py-1 rounded-xl",
                            "bg-zinc-950/90 border border-white/20 border-t-white/40 border-b-white/10",
                            "text-white font-mono text-2xs font-bold tracking-wider uppercase",
                            "shadow-[shadow:0_8px_24px_rgba(0,0,0,0.7),var(--glass-highlight-md)]",
                            "backdrop-blur-overlay-xl whitespace-nowrap select-none",
                            side === "top" ? "-top-9 left-1/2 -translate-x-1/2" : "-bottom-9 left-1/2 -translate-x-1/2",
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
