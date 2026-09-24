import * as React from "react"
import { m, type HTMLMotionProps } from "framer-motion"
import { useSpringPreset, useReducedMotion } from "./hooks"

export interface MagneticHoverProps extends HTMLMotionProps<"div"> {
    children: React.ReactNode
    scale?: number
    x?: number
}

export const MagneticHover = React.forwardRef<HTMLDivElement, MagneticHoverProps>(
    ({ children, className, scale = 1.012, x = 2, ...props }, ref) => {
        const cardSpring = useSpringPreset("cardHover")
        const prefersReduced = useReducedMotion()

        if (prefersReduced) {
            return (
                <div ref={ref} className={className} {...(props as React.HTMLAttributes<HTMLDivElement>)}>
                    {children}
                </div>
            )
        }

        return (
            <m.div
                ref={ref}
                whileHover={{ scale, x }}
                whileTap={{ scale: 0.98 }}
                transition={cardSpring}
                className={className}
                {...props}
            >
                {children}
            </m.div>
        )
    }
)

MagneticHover.displayName = "MagneticHover"
