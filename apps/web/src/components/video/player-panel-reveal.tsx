import React, { useEffect, useRef } from "react"
import { m, AnimatePresence } from "framer-motion"
import { IconUiClose } from "@/components/ui/icons"
import { cn } from "@/components/ui/core/styling"
import { useSpringPreset, useReducedMotion } from "@/components/ui/kinetics/hooks"
import { useFocusTrap } from "@/hooks/use-focus-trap"
import { PLAYER_GLASS, PLAYER_ICON_BTN } from "./player-theme"

export interface PlayerPanelRevealProps {
    isOpen: boolean
    onClose: () => void
    title: string
    titleBadge?: React.ReactNode
    headerActions?: React.ReactNode
    children: React.ReactNode
    ariaLabel?: string
    widthClassName?: string
}

export function PlayerPanelReveal({
    isOpen,
    onClose,
    title,
    titleBadge,
    headerActions,
    children,
    ariaLabel,
    widthClassName = "w-[calc(100%-1.5rem)] sm:w-[380px]",
}: PlayerPanelRevealProps) {
    const prefersReducedMotion = useReducedMotion()
    const panelSpring = useSpringPreset("tabIndicator") // 480/34
    const dialogRef = useRef<HTMLDivElement>(null)
    useFocusTrap(dialogRef, isOpen)

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
                    <m.div
                        key="panel-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={prefersReducedMotion ? { duration: 0.15 } : { duration: 0.25, ease: "easeOut" }}
                        onClick={onClose}
                        className="absolute inset-0 z-player-overlay bg-black/40 pointer-events-auto"
                    />

                    {/* Sliding Panel */}
                    <m.div
                        ref={dialogRef}
                        key="panel-content"
                        role="dialog"
                        aria-modal="true"
                        aria-label={ariaLabel || title}
                        initial={prefersReducedMotion ? { opacity: 0 } : { x: "110%" }}
                        animate={prefersReducedMotion ? { opacity: 1 } : { x: 0 }}
                        exit={prefersReducedMotion ? { opacity: 0 } : { x: "110%" }}
                        transition={panelSpring}
                        className={cn(
                            "absolute right-3 top-3 bottom-3 z-player-sidebar rounded-2xl overflow-hidden flex flex-col pointer-events-auto select-none",
                            PLAYER_GLASS,
                            widthClassName
                        )}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between h-14 pl-5 pr-2.5 border-b border-white/10 shrink-0">
                            <h3 className="font-display text-lg font-medium tracking-tight text-white flex items-center gap-2">
                                <span>{title}</span>
                                {titleBadge}
                            </h3>
                            <div className="flex items-center gap-2">
                                {headerActions}
                                <button
                                    onClick={onClose}
                                    aria-label={`Cerrar ${title}`}
                                    className={PLAYER_ICON_BTN}
                                >
                                    <IconUiClose className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Contenido inyectado */}
                        {children}
                    </m.div>
                </>
            )}
        </AnimatePresence>
    )
}
