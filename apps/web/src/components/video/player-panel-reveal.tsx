import React, { useEffect, useRef, useState } from "react"
import { m, AnimatePresence, useIsPresent, type Transition, type HTMLMotionProps } from "framer-motion"
import { IconUiClose } from "@/components/ui/icons"
import { cn } from "@/components/ui/core/styling"
import { useReducedMotion } from "@/components/ui/kinetics/hooks"
import { useFocusTrap } from "@/hooks/use-focus-trap"
import { PLAYER_GLASS, PLAYER_ICON_BTN } from "./player-theme"
import { shouldDismissPanelDrag } from "./player-touch"

interface PlayerPanelRevealProps {
    isOpen: boolean
    onClose: () => void
    title: string
    titleBadge?: React.ReactNode
    children: React.ReactNode
    ariaLabel?: string
}

/** Velo del panel. Sigue montado hasta que el panel termina de salir (framer desmonta
 * el fragmento entero), así que mientras sale (useIsPresent en false) deja pasar los
 * clics al video en lugar de tragárselos. */
function PanelBackdrop({ onClose, transition }: { onClose: () => void; transition: Transition }) {
    const isPresent = useIsPresent()
    return (
        <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
            onClick={onClose}
            className={cn(
                "absolute inset-0 z-player-overlay bg-black/40",
                isPresent ? "pointer-events-auto" : "pointer-events-none"
            )}
        />
    )
}

const PanelSurface = React.forwardRef<HTMLDivElement, HTMLMotionProps<"div">>((props, ref) => {
    const isPresent = useIsPresent()
    const prefersReducedMotion = useReducedMotion()
    return <m.div {...props} ref={ref} inert={!isPresent} aria-hidden={!isPresent || undefined}
        // AnimatePresence conserva los props de salida. La superficie sigue escuchando
        // la preferencia para neutralizar también un recorrido que ya está en curso.
        transformTemplate={prefersReducedMotion ? () => "none" : props.transformTemplate}
        style={{ ...props.style, pointerEvents: isPresent ? "auto" : "none" }} />
})
PanelSurface.displayName = "PanelSurface"

export function PlayerPanelReveal({
    isOpen,
    onClose,
    title,
    titleBadge,
    children,
    ariaLabel,
}: PlayerPanelRevealProps) {
    const prefersReducedMotion = useReducedMotion()
    const dialogRef = useRef<HTMLDivElement>(null)
    useFocusTrap(dialogRef, isOpen)

    // Swipe para cerrar solo con entrada táctil. El panel entra por la derecha, así que
    // el gesto natural de cierre es el arrastre hacia la derecha (eje x), no y.
    const [isCoarse, setIsCoarse] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches)
    useEffect(() => {
        const mq = window.matchMedia?.("(pointer: coarse)")
        if (!mq) return
        const update = () => setIsCoarse(mq.matches)
        update()
        mq.addEventListener?.("change", update)
        return () => mq.removeEventListener?.("change", update)
    }, [])

    // Accesibilidad: captura de Escape
    useEffect(() => {
        if (!isOpen) return
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation()
                e.stopImmediatePropagation()
                onClose()
            }
        }
        window.addEventListener("keydown", handleKeyDown, { capture: true })
        return () => window.removeEventListener("keydown", handleKeyDown, { capture: true })
    }, [isOpen, onClose])

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop overlay único */}
                    <PanelBackdrop
                        key="panel-backdrop"
                        onClose={onClose}
                        transition={prefersReducedMotion ? { duration: 0.15 } : { duration: 0.25, ease: "easeOut" }}
                    />

                    {/* Sliding Panel */}
                    <PanelSurface
                        ref={dialogRef}
                        key="panel-content"
                        role="dialog"
                        data-liquid-surface="panel"
                        data-liquid-context="video"
                        aria-modal="true"
                        aria-label={ariaLabel || title}
                        initial={prefersReducedMotion ? { opacity: 0 } : { x: "110%" }}
                        animate={prefersReducedMotion ? { opacity: 1 } : { x: 0 }}
                        // PanelSurface controla la interacción por presencia, incluso al reabrir
                        // durante la salida. La animación solo controla propiedades visuales.
                        exit={prefersReducedMotion
                            ? { opacity: 0, transition: { duration: 0.15 } }
                            : { x: "110%", transition: { duration: 0.35, ease: [0.32, 0.72, 0, 1] } }}
                        transition={{ duration: prefersReducedMotion ? 0.15 : 0.4, ease: [0.32, 0.72, 0, 1] }}
                        drag={isCoarse && !prefersReducedMotion ? "x" : false}
                        dragDirectionLock
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={{ left: 0, right: 0.6 }}
                        dragSnapToOrigin
                        onDragEnd={(_, info) => {
                            if (shouldDismissPanelDrag(info.offset.x, info.velocity.x)) onClose()
                        }}
                        className={cn(
                            "absolute right-3 top-3 bottom-3 z-player-sidebar rounded-2xl overflow-hidden flex flex-col pointer-events-auto select-none w-[calc(100%-1.5rem)] sm:w-[380px]",
                            PLAYER_GLASS
                        )}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between h-14 pl-5 pr-2.5 border-b border-[var(--neutral-separator)] shrink-0">
                            <h3 className="font-display text-lg font-medium tracking-tight text-label-1 flex items-center gap-2">
                                <span>{title}</span>
                                {titleBadge}
                            </h3>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label={`Cerrar ${title}`}
                                className={PLAYER_ICON_BTN}
                            >
                                <IconUiClose className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Contenido inyectado */}
                        {children}
                    </PanelSurface>
                </>
            )}
        </AnimatePresence>
    )
}
