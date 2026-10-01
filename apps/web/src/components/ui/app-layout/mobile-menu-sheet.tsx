import * as React from "react"
import { Link } from "@tanstack/react-router"
import { Vaul, VaulContent } from "@/components/vaul"
import { useQueueStore, useUIStore } from "@/lib/store"
import { IconMediaShuffle, IconNavigationLayers, IconNavigationSettings, IconUiAdmin } from "@/components/ui/icons"

const ITEM_CLASS =
    "w-full min-h-[52px] px-4 flex items-center gap-3.5 rounded-2xl text-left text-sm font-semibold text-on-surface bg-white/[0.04] active:bg-white/[0.1] active:scale-[0.97] transition-[background-color,transform] duration-fast ease-out-strong cursor-pointer"

/**
 * Menú del botón de hamburguesa en celular.
 */
export function MobileMenuSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const queueCount = useQueueStore((s) => s.playlistQueue.length)
    const setGlobalQueueOpen = useUIStore((s) => s.setGlobalQueueOpen)

    const close = React.useCallback(() => onOpenChange(false), [onOpenChange])

    return (
        <Vaul open={open} onOpenChange={onOpenChange}>
            <VaulContent title="Menú" className="p-4 pb-6 gap-2" aria-describedby={undefined}>
                <nav aria-label="Opciones" className="flex flex-col gap-2 pt-3">
                    <Link to="/settings" onClick={close} className={ITEM_CLASS}>
                        <IconNavigationSettings className="w-5 h-5 text-on-surface-variant shrink-0" aria-hidden />
                        Ajustes
                    </Link>
                    <Link to="/admin" onClick={close} className={ITEM_CLASS}>
                        <IconUiAdmin className="w-5 h-5 text-on-surface-variant shrink-0" aria-hidden />
                        Administración
                    </Link>
                    <button
                        type="button"
                        onClick={() => {
                            close()
                            setGlobalQueueOpen(true)
                        }}
                        className={ITEM_CLASS}
                    >
                        <IconNavigationLayers className="w-5 h-5 text-on-surface-variant shrink-0" aria-hidden />
                        <span className="flex-1">Mi lista / Cola</span>
                        {queueCount > 0 && (
                            <span className="min-w-6 h-6 px-1.5 rounded-full bg-brand-accent text-on-primary text-xs font-bold flex items-center justify-center tabular-nums">
                                {queueCount}
                            </span>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            close()
                            window.dispatchEvent(new CustomEvent("open-random-picker"))
                        }}
                        className={ITEM_CLASS}
                    >
                        <IconMediaShuffle className="w-5 h-5 text-on-surface-variant shrink-0" aria-hidden />
                        Reproducción aleatoria
                    </button>
                </nav>
            </VaulContent>
        </Vaul>
    )
}
