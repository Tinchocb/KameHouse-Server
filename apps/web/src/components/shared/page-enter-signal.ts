/**
 * Señal de "la página está entrando": PageTransition marca su contenedor mientras corre la
 * animación de entrada y avisa al terminar. El trabajo que no se ve al entrar (montar
 * secciones bajo el pliegue, por ejemplo) espera a esa señal para no caer a mitad del
 * fundido, donde cada cuadro lento se nota (medido: 37-67 ms en pleno fundido).
 */
export const PAGE_ENTERING_ATTR = "data-page-entering"
export const PAGE_ENTERED_EVENT = "kh:page-entered"

/** Tope de espera: si la señal no llega, el trabajo corre igual. */
const MAX_WAIT_MS = 600

const EARLY_INPUT_EVENTS = ["wheel", "keydown", "pointerdown", "touchstart"] as const

/**
 * Ejecuta `cb` cuando la página terminó de entrar. Si no está entrando, corre ya; si el usuario
 * empieza a scrollear o tocar, corre al instante (que no vea un hueco); y nunca espera más de
 * MAX_WAIT_MS. Devuelve la función que lo cancela.
 */
export function whenPageEntered(cb: () => void): () => void {
    if (typeof document === "undefined" || !document.querySelector(`[${PAGE_ENTERING_ATTR}]`)) {
        cb()
        return () => {}
    }
    let fired = false
    const cleanup = () => {
        window.removeEventListener(PAGE_ENTERED_EVENT, fire)
        EARLY_INPUT_EVENTS.forEach((ev) => window.removeEventListener(ev, fire))
        window.clearTimeout(timer)
    }
    const fire = () => {
        if (fired) return
        fired = true
        cleanup()
        cb()
    }
    const timer = window.setTimeout(fire, MAX_WAIT_MS)
    window.addEventListener(PAGE_ENTERED_EVENT, fire, { once: true })
    EARLY_INPUT_EVENTS.forEach((ev) => window.addEventListener(ev, fire, { passive: true, once: true }))
    return () => {
        fired = true
        cleanup()
    }
}
