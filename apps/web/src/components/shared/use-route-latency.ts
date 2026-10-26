import { useEffect, useState } from "react"
import { useRouter } from "@tanstack/react-router"

/** Desde el inicio de navegación hasta una oportunidad de pintar la ruta montada.
 * No mide imágenes tardías, datos diferidos ni el final de las animaciones.
 */
export function useRouteLatency(): number | null {
    const router = useRouter()
    const [latency, setLatency] = useState<number | null>(null)

    useEffect(() => {
        let pending: { href: string; started: number } | null = null
        let raf = 0
        const reset = () => {
            pending = null
            cancelAnimationFrame(raf)
        }
        const observable = () => document.visibilityState === "visible" && document.hasFocus()
        const before = router.subscribe("onBeforeNavigate", (event) => {
            reset()
            setLatency(null)
            if (observable()) pending = { href: event.toLocation.href, started: performance.now() }
        })
        const rendered = router.subscribe("onRendered", (event) => {
            const navigation = pending
            if (!navigation || navigation.href !== event.toLocation.href) return
            cancelAnimationFrame(raf)
            // El primer rAF todavía precede al paint; el segundo deja una oportunidad de pintado.
            raf = requestAnimationFrame(() => {
                raf = requestAnimationFrame(() => {
                    if (pending !== navigation || !observable()) return
                    setLatency(Math.round(performance.now() - navigation.started))
                    pending = null
                })
            })
        })
        document.addEventListener("visibilitychange", reset)
        window.addEventListener("blur", reset)
        return () => {
            reset()
            before()
            rendered()
            document.removeEventListener("visibilitychange", reset)
            window.removeEventListener("blur", reset)
        }
    }, [router])

    return latency
}
