/**
 * Envuelve un cambio de estado de React en document.startViewTransition si el navegador lo soporta.
 * Esto permite realizar animaciones de transición fluidas en la actualización del DOM.
 */
export function startViewTransition(callback: () => void) {
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
        document.startViewTransition(callback);
    } else {
        callback();
    }
}
