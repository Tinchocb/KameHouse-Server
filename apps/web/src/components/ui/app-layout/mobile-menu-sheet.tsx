import * as React from "react"
import { Link } from "@tanstack/react-router"
import { Vaul, VaulContent } from "@/components/vaul"
import { useQueueStore, useUIStore } from "@/lib/store"
import { IconMediaShuffle, IconNavigationLayers, IconNavigationSettings } from "@/components/ui/icons"
import { useReducedMotion } from "@/components/ui/kinetics/hooks"
import { useFocusTrap } from "@/hooks/use-focus-trap"

const ITEM_CLASS =
    "w-full min-h-[52px] px-4 flex items-center gap-3.5 rounded-2xl text-left text-sm font-semibold text-on-surface bg-white/[0.04] active:bg-white/[0.1] active:scale-[0.97] transition-[background-color,transform] duration-fast ease-out-strong cursor-pointer"

// Vaul cierra en 500 ms: la hoja y su velo bajan en --duration-medium (la curva de
// vaul ya es --ease-drawer).
const CLOSE_DURATION_CLASS = "data-[state=closed]:![animation-duration:var(--duration-medium)]"
// La superficie siguiente (Mi Lista, Sorpréndeme) entra a los 150 ms (--duration-quick),
// cuando la hoja ya bajó casi entera: no se cruzan dos hojas ni dos velos.
const FOLLOW_UP_DELAY_MS = 150
// Padding inferior con safe area (respetando la home bar de iOS).
const SHEET_PADDING_CLASS = "p-4 !pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] gap-2"

/**
 * Menú del botón de hamburguesa en celular.
 */
export function MobileMenuSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const queueCount = useQueueStore((s) => s.playlistQueue.length)
    const setGlobalQueueOpen = useUIStore((s) => s.setGlobalQueueOpen)
    const reduceMotion = useReducedMotion()
    const followUpRef = React.useRef<number | null>(null)
    const sheetRef = React.useRef<HTMLDivElement>(null)
    // Vaul no lleva el foco adentro al abrir ni cicla Tab: el foco quedaba en el botón que abrió la hoja.
    useFocusTrap(sheetRef, open)

    React.useEffect(() => () => {
        if (followUpRef.current !== null) window.clearTimeout(followUpRef.current)
    }, [])

    const close = React.useCallback(() => onOpenChange(false), [onOpenChange])

    // Cierra la hoja y abre la superficie siguiente después del cierre.
    const closeThen = React.useCallback((action: () => void) => {
        close()
        if (followUpRef.current !== null) window.clearTimeout(followUpRef.current)
        followUpRef.current = window.setTimeout(() => {
            followUpRef.current = null
            action()
        }, reduceMotion ? 0 : FOLLOW_UP_DELAY_MS)
    }, [close, reduceMotion])

    return (
        <Vaul open={open} onOpenChange={onOpenChange}>
            <VaulContent
                ref={sheetRef}
                title="Menú"
                className={`${SHEET_PADDING_CLASS} ${CLOSE_DURATION_CLASS}`}
                overlayClassName={CLOSE_DURATION_CLASS}
                aria-describedby={undefined}
                aria-modal="true"
            >
                <nav aria-label="Opciones" className="flex flex-col gap-2 pt-3">
                    <Link to="/settings" onClick={close} className={ITEM_CLASS}>
                        <IconNavigationSettings className="w-5 h-5 text-on-surface-variant shrink-0" aria-hidden />
                        Ajustes
                    </Link>
                    <button
                        type="button"
                        onClick={() => closeThen(() => setGlobalQueueOpen(true))}
                        className={ITEM_CLASS}
                    >
                        <IconNavigationLayers className="w-5 h-5 text-on-surface-variant shrink-0" aria-hidden />
                        <span className="flex-1">Mi Lista</span>
                        {queueCount > 0 && (
                            <span className="min-w-6 h-6 px-1.5 rounded-full bg-brand-accent text-on-primary text-xs font-bold flex items-center justify-center tabular-nums">
                                {queueCount}
                            </span>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => closeThen(() => window.dispatchEvent(new CustomEvent("open-random-picker")))}
                        className={ITEM_CLASS}
                    >
                        <IconMediaShuffle className="w-5 h-5 text-on-surface-variant shrink-0" aria-hidden />
                        Sorpréndeme
                    </button>
                </nav>
            </VaulContent>
        </Vaul>
    )
}
