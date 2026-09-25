import React, { useEffect, useRef } from "react"
import { m, AnimatePresence } from "framer-motion"
import { IconUiClose } from "@/components/ui/icons"
import { cn } from "@/components/ui/core/styling"
import { PLAYER_GLASS, PLAYER_ICON_BTN } from "./player-theme"
import { useSpringPreset, useReducedMotion } from "@/components/ui/kinetics/hooks"
import { useFocusTrap } from "@/hooks/use-focus-trap"

interface PlayerShortcutsModalProps {
    isOpen: boolean
    onClose: () => void
}

interface ShortcutItem {
    keyCombination: string[]
    description: string
}

const SHORTCUT_GROUPS: { groupName: string; shortcuts: ShortcutItem[] }[] = [
    {
        groupName: "Reproducción & Navegación",
        shortcuts: [
            { keyCombination: ["Espacio", "K"], description: "Reproducir / Pausar" },
            { keyCombination: ["J", "L"], description: "Saltar ±10 segundos" },
            { keyCombination: ["←", "→"], description: "Saltar ±5 segundos" },
            { keyCombination: ["Shift", "→"], description: "Saltar intro / opening" },
            { keyCombination: ["0", "–", "9"], description: "Saltar al 0% – 90% del video" },
            { keyCombination: [","], description: "Retroceder 1 cuadro (frame)" },
            { keyCombination: ["."], description: "Avanzar 1 cuadro (frame)" },
        ],
    },
    {
        groupName: "Audio & Pantalla",
        shortcuts: [
            { keyCombination: ["↑", "↓"], description: "Subir / Bajar volumen (10%)" },
            { keyCombination: ["M"], description: "Silenciar / Activar audio" },
            { keyCombination: ["F"], description: "Pantalla completa" },
            { keyCombination: ["C"], description: "Alternar subtítulos" },
        ],
    },
    {
        groupName: "Capítulos & Paneles",
        shortcuts: [
            { keyCombination: ["["], description: "Capítulo anterior" },
            { keyCombination: ["]"], description: "Siguiente capítulo" },
            { keyCombination: ["S"], description: "Saltar segmento (Intro/Outro)" },
            { keyCombination: ["N"], description: "Siguiente episodio" },
            { keyCombination: ["E"], description: "Abrir lista de episodios" },
            { keyCombination: ["Q"], description: "Abrir cola de reproducción" },
            { keyCombination: ["O"], description: "Abrir menú de ajustes" },
            { keyCombination: ["V"], description: "Alternar estadísticas avanzadas" },
            { keyCombination: ["?"], description: "Mostrar esta ayuda de atajos" },
        ],
    },
]

export function PlayerShortcutsModal({ isOpen, onClose }: PlayerShortcutsModalProps) {
    const spring = useSpringPreset("entrance")
    const prefersReduced = useReducedMotion()
    const dialogRef = useRef<HTMLDivElement>(null)
    useFocusTrap(dialogRef, isOpen)

    useEffect(() => {
        if (!isOpen) return
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" || e.key === "?") {
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
                <div className="absolute inset-0 z-player-settings flex items-center justify-center pointer-events-auto p-4 select-none">
                    {/* Backdrop */}
                    <m.div
                        key="shortcuts-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60"
                    />

                    {/* Modal Window */}
                    <m.div
                        ref={dialogRef}
                        key="shortcuts-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Atajos de teclado del reproductor"
                        initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 16 }}
                        transition={spring}
                        className={cn("relative w-full max-w-2xl max-h-[85vh] rounded-2xl overflow-hidden flex flex-col z-10", PLAYER_GLASS)}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between h-14 pl-6 pr-2 border-b border-white/10">
                            <h3 className="font-display text-lg font-medium tracking-tight text-white">Atajos de teclado</h3>
                            <button
                                onClick={onClose}
                                aria-label="Cerrar ayuda de atajos"
                                className={PLAYER_ICON_BTN}
                            >
                                <IconUiClose className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Shortcuts Grid */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                            {SHORTCUT_GROUPS.map((group) => (
                                <div key={group.groupName} className="space-y-3">
                                    <h4 className="text-2xs font-semibold uppercase tracking-widest text-brand-accent">
                                        {group.groupName}
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                                        {group.shortcuts.map((shortcut, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between py-2 border-b border-white/5"
                                            >
                                                <span className="text-xs font-semibold tracking-wide text-white/85">
                                                    {shortcut.description}
                                                </span>
                                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                                    {shortcut.keyCombination.map((key, kIdx) => (
                                                        <kbd
                                                            key={kIdx}
                                                            className="px-2 py-0.5 min-w-[24px] text-center text-2xs font-semibold bg-white/10 text-white rounded-full"
                                                        >
                                                            {key}
                                                        </kbd>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer note */}
                        <div className="px-6 py-3 border-t border-white/10 bg-zinc-950/40 flex items-center justify-between text-caption text-zinc-500 font-mono">
                            <span>Presiona [?] o [Esc] para cerrar</span>
                            <span>La reproducción continúa en segundo plano</span>
                        </div>
                    </m.div>
                </div>
            )}
        </AnimatePresence>
    )
}
