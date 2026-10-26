import { useSyncExternalStore } from "react"

/**
 * ¿La interfaz está en Neutro (`data-mode="classic"`)? Lee el atributo que ya fija el shell
 * en <html>, así que no depende de cargar Ajustes ni de cuándo llega el tema. Un único
 * MutationObserver compartido sirve a todos los suscriptores.
 */
const listeners = new Set<() => void>()
let observer: MutationObserver | null = null

function subscribe(cb: () => void) {
    listeners.add(cb)
    if (!observer && typeof MutationObserver !== "undefined") {
        observer = new MutationObserver(() => listeners.forEach((l) => l()))
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] })
    }
    return () => {
        listeners.delete(cb)
        if (listeners.size === 0) {
            observer?.disconnect()
            observer = null
        }
    }
}

const getSnapshot = () => document.documentElement.dataset.mode === "classic"
const getServerSnapshot = () => true

/**
 * Interruptor del "cromo en grises" de Neutro (Series, Cronología, Películas).
 * DESACTIVADO por decisión del usuario (06/10): Neutro conserva el color de saga.
 * Para reactivarlo, poner NEUTRAL_CHROME en true.
 */
const NEUTRAL_CHROME = false

export function useIsClassicMode(): boolean {
    const isClassic = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
    return NEUTRAL_CHROME && isClassic
}
