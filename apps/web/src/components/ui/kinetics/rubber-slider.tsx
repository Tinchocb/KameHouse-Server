import * as React from "react"
import { m, type HTMLMotionProps } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { useSpringPreset } from "./hooks"

export interface RubberSliderProps extends Omit<HTMLMotionProps<"div">, "children"> {
    children: React.ReactNode
}

export const RubberSlider = React.forwardRef<HTMLDivElement, RubberSliderProps>(
    ({ children, className, ...props }, ref) => {
        const pressSpring = useSpringPreset("press")

        return (
            <m.div
                ref={ref}
                whileHover={{ scaleY: 1.15 }}
                whileTap={{ scaleY: 1.35 }}
                transition={pressSpring}
                className={cn("touch-pan-y cursor-pointer origin-center", className)}
                {...props}
            >
                {children}
            </m.div>
        )
    }
)

RubberSlider.displayName = "RubberSlider"
