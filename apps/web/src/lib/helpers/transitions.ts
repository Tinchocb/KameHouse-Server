import { flushSync } from "react-dom"

/**
 * Envuelve un cambio de estado de React en document.startViewTransition si el navegador lo soporta.
 * Esto permite realizar animaciones de transición fluidas en la actualización del DOM.
 */
export function startViewTransition(callback: () => void) {
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
        // flushSync: React confirma el cambio dentro del callback, antes de que el
        // navegador capture el estado nuevo. Sin él, el setState queda agendado y la
        // captura compite con el render (el cierre del reproductor a veces sin fundido).
        const transition = document.startViewTransition(() => {
            flushSync(callback)
        })
        // Una transición interrumpida (por otra transición o por navegación) rechaza
        // `finished` con InvalidStateError. Es un final normal, no un error: sin este
        // catch, cada interrupción aparece como "Unhandled promise rejection" en consola.
        transition.finished.catch(() => {})
        transition.ready.catch(() => {})
    } else {
        callback();
    }
}
