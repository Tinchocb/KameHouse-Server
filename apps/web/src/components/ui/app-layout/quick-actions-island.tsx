import type { ReactNode } from "react"
import { m, useIsPresent } from "framer-motion"
import { useReducedMotion, useSpringPreset } from "@/components/ui/kinetics/hooks"

/** La presencia controla los clics y el foco, incluso si se cancela una salida. */
export function QuickActionsIsland({ children }: { children: ReactNode }) {
    const isPresent = useIsPresent()
    const reducedMotion = useReducedMotion()
    const entrance = useSpringPreset("entrance")
    return (
        <m.div
            role="group"
            aria-label="Acciones rápidas"
            inert={!isPresent}
            aria-hidden={!isPresent || undefined}
            style={{ pointerEvents: isPresent ? "auto" : "none" }}
            initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reducedMotion ? 0 : 4, transition: { duration: 0.15, ease: "easeOut" } }}
            transition={entrance}
            className="floating-nav-quick fixed bottom-5 left-4 sm:left-6 md:left-8 z-navbar flex items-center transform-gpu"
        >
            {children}
        </m.div>
    )
}
