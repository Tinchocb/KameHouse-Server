import * as React from "react"
import { m, useMotionValue, type PanInfo } from "framer-motion"
import { useReducedMotion } from "./hooks"
import { cn } from "@/components/ui/core/styling"

export interface SwipeRevealProps {
    children: React.ReactNode
    actions?: React.ReactNode
    actionWidth?: number
    className?: string
    onSwipeOpen?: () => void
}

export function SwipeReveal({
    children,
    actions,
    actionWidth = 100,
    className,
    onSwipeOpen,
}: SwipeRevealProps) {
    const prefersReducedMotion = useReducedMotion()
    const x = useMotionValue(0)
    const [isOpen, setIsOpen] = React.useState(false)

    const handleDragEnd = (_: unknown, info: PanInfo) => {
        if (prefersReducedMotion) return
        const threshold = -actionWidth / 2
        if (info.offset.x < threshold || info.velocity.x < -300) {
            setIsOpen(true)
            onSwipeOpen?.()
        } else {
            setIsOpen(false)
        }
    }

    if (prefersReducedMotion || !actions) {
        return <div className={cn("relative w-full", className)}>{children}</div>
    }

    return (
        <div className={cn("relative w-full overflow-hidden rounded-2xl", className)}>
            {/* Action buttons revealed behind the swiped content */}
            <div className="absolute inset-y-0 right-0 flex items-center justify-end z-0">
                {actions}
            </div>

            {/* Swipable content surface */}
            <m.div
                drag="x"
                dragDirectionLock
                dragConstraints={{ left: -actionWidth, right: 0 }}
                dragElastic={0.12}
                onDragEnd={handleDragEnd}
                animate={{ x: isOpen ? -actionWidth : 0 }}
                transition={{ type: "spring", stiffness: 340, damping: 28 }}
                style={{ x }}
                className="relative z-10 w-full bg-inherit"
            >
                {children}
            </m.div>
        </div>
    )
}

SwipeReveal.displayName = "SwipeReveal"
