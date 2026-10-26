import type { ReactNode } from "react"
import { AnimatePresence, m } from "framer-motion"
import { loadSwapVariants } from "./variants"
import { useMotionTier } from "./motion-tier"

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

/**
 * Cruce skeleton → contenido sin corte duro. `initial={false}`: si el contenido
 * ya está (caché) al montar, aparece directo, sin fade.
 */
export function LoadSwap({ loading, skeleton, children, className, ownEntrance = false }: LoadSwapProps) {
    const tier = useMotionTier()
    const skipContentFade = ownEntrance && tier === "full"
    return (
        <AnimatePresence mode="wait" initial={false}>
            {loading ? (
                <m.div key="skeleton" className={className} variants={loadSwapVariants} exit="exit">
                    {skeleton}
                </m.div>
            ) : (
                <m.div
                    key="content"
                    className={className}
                    variants={loadSwapVariants}
                    initial={skipContentFade ? false : "initial"}
                    animate="animate"
                >
                    {children}
                </m.div>
            )}
        </AnimatePresence>
    )
}
