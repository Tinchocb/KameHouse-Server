import * as React from "react"
import { m, type HTMLMotionProps } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { useSpringPreset } from "./hooks"

export interface MagneticIndicatorProps extends Omit<HTMLMotionProps<"div">, "children" | "style"> {
    layoutId: string
    active?: boolean
    disableAnimation?: boolean
    children?: React.ReactNode
    style?: React.CSSProperties
}

export const MagneticIndicator: React.FC<MagneticIndicatorProps> = ({
    layoutId,
    active = true,
    disableAnimation = false,
    children,
    className,
    style,
    ...props
}) => {
    const spring = useSpringPreset("tabIndicator")

    if (!active) return null

    if (disableAnimation) {
        return (
            <div
                className={cn(
                    "absolute inset-0 rounded-full pointer-events-none z-0 transform-gpu",
                    className
                )}
                style={style}
            >
                {children}
            </div>
        )
    }

    return (
        <m.div
            layoutId={layoutId}
            transition={spring}
            className={cn(
                "absolute inset-0 rounded-full pointer-events-none z-0 transform-gpu shadow-elevation-1",
                className
            )}
            style={style}
            {...props}
        >
            {children}
        </m.div>
    )
}

MagneticIndicator.displayName = "MagneticIndicator"
