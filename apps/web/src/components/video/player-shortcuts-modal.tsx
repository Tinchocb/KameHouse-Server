import { useEffect, useRef, type ReactNode } from "react"
import { m, AnimatePresence, useIsPresent } from "framer-motion"
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
        groupName: "Reproducción y navegación",
        shortcuts: [
            { keyCombination: ["Espacio", "K"], description: "Reproducir o pausar" },
            { keyCombination: ["J", "L"], description: "Saltar ±10 segundos" },
            { keyCombination: ["←", "→"], description: "Saltar ±5 segundos" },
            { keyCombination: ["Shift", "→"], description: "Saltar la intro" },
            { keyCombination: ["0", "–", "9"], description: "Ir al 0%–90% del video" },
            { keyCombination: [","], description: "Retroceder un fotograma" },
            { keyCombination: ["."], description: "Avanzar un fotograma" },
        ],
    },
    {
        groupName: "Audio y pantalla",
        shortcuts: [
            { keyCombination: ["↑", "↓"], description: "Subir o bajar el volumen (10%)" },
            { keyCombination: ["M"], description: "Silenciar o activar el sonido" },
            { keyCombination: ["F"], description: "Pantalla completa" },
            { keyCombination: ["C"], description: "Activar o desactivar subtítulos" },
        ],
    },
    {
        groupName: "Episodios y paneles",
        shortcuts: [
            { keyCombination: ["S"], description: "Saltar intro o créditos" },
            { keyCombination: ["N"], description: "Siguiente episodio" },
            { keyCombination: ["E"], description: "Abrir lista de episodios" },
            { keyCombination: ["Q"], description: "Abrir Mi Lista" },
            { keyCombination: ["O"], description: "Abrir Más opciones" },
            { keyCombination: ["V"], description: "Mostrar u ocultar estadísticas" },
            { keyCombination: ["?"], description: "Mostrar u ocultar esta ayuda" },
        ],
    },
]

// Curva y duraciones de tokens: --ease-out, --duration-fast (abrir) y --duration-quick (cerrar).
const EASE_OUT = [0.23, 1, 0.32, 1] as const

/** Envoltorio a pantalla completa: mientras sale (useIsPresent en false) deja pasar
 * los clics, así un clic sobre el video justo después de cerrar no cae en el velo. */
function ShortcutsLayer({ children }: { children: ReactNode }) {
    const isPresent = useIsPresent()
    return (
        <div className={cn(
            "absolute inset-0 z-player-settings flex items-center justify-center p-4 select-none",
            isPresent ? "pointer-events-auto" : "pointer-events-none"
        )}>
            {children}
        </div>
    )
}

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
                <ShortcutsLayer>
                    {/* Backdrop */}
                    <m.div
                        key="shortcuts-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.15, ease: EASE_OUT } }}
                        transition={{ duration: 0.25, ease: EASE_OUT }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60"
                    />

                    {/* Modal Window */}
                    <m.div
                        ref={dialogRef}
                        key="shortcuts-dialog"
                        role="dialog"
                        data-liquid-surface="panel"
                        data-liquid-context="video"
                        aria-modal="true"
                        aria-label="Atajos de teclado del reproductor"
                        initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        // Sale más corto que lo que entra (como el Modal canónico) y sin volver a bajar.
                        exit={prefersReduced
                            ? { opacity: 0, transition: { duration: 0.15 } }
                            : { opacity: 0, scale: 0.97, transition: { duration: 0.15, ease: EASE_OUT } }}
                        transition={spring}
                        className={cn("relative w-full max-w-2xl max-h-[85vh] rounded-2xl overflow-hidden flex flex-col z-10", PLAYER_GLASS)}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between h-14 pl-6 pr-2 border-b border-[var(--neutral-separator)]">
                            <h3 className="font-display text-lg font-medium tracking-tight text-label-1">Atajos de teclado</h3>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Cerrar atajos de teclado"
                                className={PLAYER_ICON_BTN}
                            >
                                <IconUiClose className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Shortcuts Grid */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                            {SHORTCUT_GROUPS.map((group) => (
                                <div key={group.groupName} className="space-y-3">
                                    <h4 className="text-sm font-semibold text-brand-accent-readable">
                                        {group.groupName}
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                                        {group.shortcuts.map((shortcut, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between py-2 border-b border-[var(--neutral-separator)]"
                                            >
                                                <span className="text-sm text-label-1">
                                                    {shortcut.description}
                                                </span>
                                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                                    {shortcut.keyCombination.map((key, kIdx) => (
                                                        <kbd
                                                            key={kIdx}
                                                            className="px-2.5 py-0.5 min-w-[24px] text-center text-xs font-mono font-semibold tabular-nums bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-ring)] text-label-1 rounded-full"
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
                        <div className="px-6 py-3 border-t border-[var(--neutral-separator)] bg-[var(--neutral-elev-1)] flex items-center justify-between text-xs text-label-2">
                            <span>Pulsa [?] o [Esc] para cerrar</span>
                            <span>La reproducción continúa en segundo plano</span>
                        </div>
                    </m.div>
                </ShortcutsLayer>
            )}
        </AnimatePresence>
    )
}
