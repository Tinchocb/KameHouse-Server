import type { ReactNode } from "react"
import * as React from "react"
import { AnimatePresence, m, useIsPresent, type HTMLMotionProps, type Variants } from "framer-motion"
import { useMotionTier } from "./motion-tier"
import { useReducedMotion } from "./hooks"
import { cn } from "@/components/ui/core/styling"

interface LoadSwapProps {
    loading: boolean
    skeleton: ReactNode
    children: ReactNode
    className?: string
    /**
     * El contenido trae su propia entrada en el tier "full" (p. ej. la cascada de
     * MediaSpotlight). En ese tier LoadSwap no le suma su fundido, para que no entre
     * dos veces. En "subtle" y "off" ese contenido no se anima solo, así que conserva
     * el fundido y no aparece de golpe. Sin la prop, el comportamiento no cambia.
     */
    ownEntrance?: boolean
}

interface LoadSwapSlotProps extends Pick<HTMLMotionProps<"div">, "variants" | "initial" | "animate" | "exit"> {
    children: ReactNode
    className?: string
}

function LoadSwapSlot({
    children,
    className,
    variants,
    initial,
    animate,
    exit,
}: LoadSwapSlotProps) {
    const isPresent = useIsPresent()
    const isExiting = !isPresent

    return (
        <m.div
            className={cn(
                className,
                isExiting && "absolute inset-0 pointer-events-none z-10"
            )}
            style={isExiting ? { position: "absolute", inset: 0, pointerEvents: "none" } : undefined}
            aria-hidden={isExiting ? true : undefined}
            inert={isExiting ? true : undefined}
            tabIndex={isExiting ? -1 : undefined}
            variants={variants}
            initial={initial}
            animate={animate}
            exit={exit}
        >
            {children}
        </m.div>
    )
}

/**
 * Cruce skeleton → contenido sin corte duro y sin espera artificial.
 * Al pasar loading de true a false, el contenido nuevo se monta en el mismo cambio
 * de estado ocupando el flujo normal, mientras el skeleton saliente queda superpuesto
 * (absoluto, inerte y aria-hidden) sin sumar altura ni retrasar el render.
 * `initial={false}`: si el contenido ya está listo (caché) al montar, aparece directo.
 */
export function LoadSwap({
    loading,
    skeleton,
    children,
    className,
    ownEntrance = false,
}: LoadSwapProps) {
    const tier = useMotionTier()
    const reducedMotion = useReducedMotion()
    const skipContentFade = ownEntrance && tier === "full"

    const variants = React.useMemo<Variants>(() => ({
        initial: {
            opacity: 0,
            y: tier === "full" ? 6 : 0,
        },
        animate: {
            opacity: 1,
            y: 0,
            transition: {
                duration: reducedMotion ? 0.15 : 0.25,
                ease: [0.22, 1, 0.36, 1],
            },
        },
        exit: {
            opacity: 0,
            y: 0,
            transition: {
                duration: 0.15,
                ease: "easeOut",
            },
        },
    }), [reducedMotion, tier])

    return (
        <div className="relative">
            <AnimatePresence initial={false}>
                {loading ? (
                    <LoadSwapSlot
                        key="skeleton"
                        className={className}
                        variants={variants}
                        initial={false}
                        animate="animate"
                        exit="exit"
                    >
                        {skeleton}
                    </LoadSwapSlot>
                ) : (
                    <LoadSwapSlot
                        key="content"
                        className={className}
                        variants={variants}
                        initial={skipContentFade ? false : "initial"}
                        animate="animate"
                        exit="exit"
                    >
                        {children}
                    </LoadSwapSlot>
                )}
            </AnimatePresence>
        </div>
    )
}
