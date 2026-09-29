import type { ReactNode } from "react"
import { AnimatePresence, m } from "framer-motion"
import { loadSwapVariants } from "./variants"

interface LoadSwapProps {
    loading: boolean
    skeleton: ReactNode
    children: ReactNode
    className?: string
}

/**
 * Cruce skeleton → contenido sin corte duro. `initial={false}`: si el contenido
 * ya está (caché) al montar, aparece directo, sin fade.
 */
export function LoadSwap({ loading, skeleton, children, className }: LoadSwapProps) {
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
                    initial="initial"
                    animate="animate"
                >
                    {children}
                </m.div>
            )}
        </AnimatePresence>
    )
}
