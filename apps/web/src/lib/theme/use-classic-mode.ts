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
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode", "data-ui-style", "data-tv", "data-flat"] })
    }
    return () => {
        listeners.delete(cb)
        if (listeners.size === 0) {
            observer?.disconnect()
            observer = null
        }
    }
}

/**
 * Interruptor del "cromo en grises" de Neutro (Series, Cronología, Películas).
 * ACTIVADO: Modo Neutro (Linear-style Dark UI) es 100% acromático en su cromo;
 * los colores de saga y auras pertenecen exclusivamente al Modo Por Era (`data-mode="era"`).
 */
const NEUTRAL_CHROME = true

const getMinimalistSnapshot = () =>
    typeof document !== "undefined" && document.documentElement?.dataset?.uiStyle === "classic-minimalist" && document.documentElement.dataset.tv !== "true"

const getFlatSnapshot = () =>
    typeof document !== "undefined" && document.documentElement?.dataset?.flat === "true"

export function isMinimalistModeActive(): boolean {
    return getMinimalistSnapshot()
}

const getClassicSnapshot = () => document.documentElement.dataset.mode === "classic"
const getSnapshot = () =>
    getMinimalistSnapshot() ||
    (NEUTRAL_CHROME && getClassicSnapshot())
const getSeriesSnapshot = () =>
    NEUTRAL_CHROME && getClassicSnapshot()
const getServerSnapshot = () => false

export function useIsClassicMode(options?: { preserveSeriesGradients?: boolean }): boolean {
    const snapshot = options?.preserveSeriesGradients ? getSeriesSnapshot : getSnapshot
    return useSyncExternalStore(subscribe, snapshot, getServerSnapshot)
}

const getEraSnapshot = () => document.documentElement.dataset.mode === "era"

/** ¿La interfaz está en Por era (`data-mode="era"`)? Para los guiños de Dragon Ball que solo van ahí. */
export function useIsEraMode(): boolean {
    return useSyncExternalStore(subscribe, getEraSnapshot, getServerSnapshot)
}

/** Identidad explícita del tema, independiente de Neutro y sus preferencias. */
export function useIsMinimalistMode(): boolean {
    return useSyncExternalStore(subscribe, getMinimalistSnapshot, getServerSnapshot)
}

/** ¿El shell tiene transparencia desactivada (`data-flat="true"`)? Lee el atributo en <html> sin requerir providers. */
export function useIsFlatMode(): boolean {
    return useSyncExternalStore(subscribe, getFlatSnapshot, getServerSnapshot)
}
