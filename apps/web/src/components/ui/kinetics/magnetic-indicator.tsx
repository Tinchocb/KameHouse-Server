import * as React from "react"
import { m, type HTMLMotionProps } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { useSpringPreset } from "./hooks"

interface MagneticIndicatorProps extends Omit<HTMLMotionProps<"div">, "children" | "style"> {
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
            // El layoutId anima con scale entre pastillas de distinto ancho, y framer solo corrige el
            // radio si está en `style`: con `rounded-full` por clase, los extremos se pellizcaban hasta
            // que el spring se asentaba (G1-01). Un radio distinto se pasa por `style.borderRadius`,
            // que gana sobre este valor; una clase `rounded-*` no alcanza.
            style={{ borderRadius: 9999, ...style }}
            {...props}
        >
            {children}
        </m.div>
    )
}

MagneticIndicator.displayName = "MagneticIndicator"
