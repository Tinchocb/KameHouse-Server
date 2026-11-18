import { flushSync } from "react-dom"

/**
 * Envuelve un cambio de estado de React en document.startViewTransition si el navegador lo soporta.
 * Esto permite realizar animaciones de transición fluidas en la actualización del DOM.
 */
export function startViewTransition(callback: () => void) {
    const preference = typeof window !== "undefined" ? window.matchMedia?.("(prefers-reduced-motion: reduce)") : undefined
    if (!preference?.matches && typeof document !== 'undefined' && 'startViewTransition' in document) {
        // flushSync: React confirma el cambio dentro del callback, antes de que el
        // navegador capture el estado nuevo. Sin él, el setState queda agendado y la
        // captura compite con el render (el cierre del reproductor a veces sin fundido).
        const transition = document.startViewTransition(() => {
            flushSync(callback)
        })
        let skipped = false
        const onPreferenceChange = () => {
            if (!preference?.matches || skipped) return
            skipped = true
            transition.skipTransition()
        }
        preference?.addEventListener("change", onPreferenceChange)
        const cleanup = () => preference?.removeEventListener("change", onPreferenceChange)
        // Una transición interrumpida (por otra transición o por navegación) rechaza
        // `finished` con InvalidStateError. Es un final normal, no un error: sin este
        // catch, cada interrupción aparece como "Unhandled promise rejection" en consola.
        void transition.finished.then(cleanup, cleanup)
        transition.ready.catch(() => {})
        onPreferenceChange()
    } else {
        callback();
    }
}

/** Paleta: --duration-quick (150 ms) más 50 ms para retirar la marca sin cortar el último frame. */
const THEME_FADE_MS = 200
let endThemeFade: (() => void) | undefined

/**
 * Funde un cambio de paleta (Universo DB cambia `data-theme` de <html>): mientras dura
 * `data-era-fade`, themes/era.css transiciona los colores base registrados con @property.
 * No usa View Transitions a propósito: durante una, Chrome manda todos los clics a <html>
 * (aun con pointer-events: none en la capa), y con la rotación del hero de Inicio cada 5 s
 * se perdían clics.
 * Cada cuadro del fundido recalcula los estilos de toda la página (medido 30/10: ~30 ms por
 * cuadro en la Cronología, ~1.600 nodos; casi nada en Inicio). Por eso un scroll lo termina
 * en el acto: quitar el atributo corta la transición y deja la paleta final.
 */
export function crossfadeThemeChange(update: () => void) {
    endThemeFade?.()
    const preference = window.matchMedia?.("(prefers-reduced-motion: reduce)")
    const skipOnDenseTree = typeof window !== "undefined" && window.location.pathname.startsWith("/chronology")
    if (preference?.matches || skipOnDenseTree) {
        update()
        return
    }
    const root = document.documentElement
    root.dataset.eraFade = "true"
    update()
    const end = (event?: Event) => {
        // El scroll del propio selector de era (hacia la era activa) no corta el fundido.
        if (event?.target instanceof Element && event.target.closest("[data-era-selector]")) return
        clearTimeout(timer)
        window.removeEventListener("scroll", end, { capture: true })
        preference?.removeEventListener("change", onPreferenceChange)
        delete root.dataset.eraFade
        if (endThemeFade === end) endThemeFade = undefined
    }
    const onPreferenceChange = () => { if (preference?.matches) end() }
    const timer = setTimeout(end, THEME_FADE_MS)
    window.addEventListener("scroll", end, { capture: true, passive: true })
    preference?.addEventListener("change", onPreferenceChange)
    endThemeFade = end
}
