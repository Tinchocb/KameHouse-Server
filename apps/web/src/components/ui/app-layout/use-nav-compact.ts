import * as React from "react"
import { useUIStore } from "@/lib/store"
import { useMediaQuery } from "@/hooks/use-media-query"
import {
    INITIAL_NAV_SCROLL_STATE,
    nextNavScrollState,
    resolveNavCompact,
    type NavScrollState,
} from "@/lib/nav-compact"

const SCROLL_SELECTOR = '[data-scroll-container="true"]'
/** Espera antes de volver a compactar al sacar el puntero: evita parpadeo al cruzar el borde. */
const LEAVE_DELAY_MS = 160

/**
 * Estado compacto (solo íconos) de una barra de navegación flotante.
 * Sigue el scroll de la página con histéresis, se abre mientras el puntero
 * está encima o el foco de teclado está dentro, y respeta la preferencia
 * "Barra de navegación" de Ajustes.
 */
export function useNavCompact() {
    const density = useUIStore((s) => s.navDensity)
    const [scrollCompact, setScrollCompact] = React.useState(false)
    const [pointerInside, setPointerInside] = React.useState(false)
    const [focusInside, setFocusInside] = React.useState(false)
    const leaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

    React.useEffect(() => {
        if (density !== "auto") return
        let state: NavScrollState = INITIAL_NAV_SCROLL_STATE
        let raf = 0
        let pending: HTMLElement | null = null

        const apply = () => {
            raf = 0
            if (!pending) return
            const next = nextNavScrollState(state, pending.scrollTop)
            if (next.compact !== state.compact) setScrollCompact(next.compact)
            state = next
        }

        const onScroll = (e: Event) => {
            const target = e.target
            // Solo el scroll de la página: ignora carruseles horizontales, menús y listas internas.
            if (!(target instanceof HTMLElement) || !target.matches(SCROLL_SELECTOR)) return
            pending = target
            if (!raf) raf = requestAnimationFrame(apply)
        }

        window.addEventListener("scroll", onScroll, { capture: true, passive: true })
        return () => {
            window.removeEventListener("scroll", onScroll, { capture: true })
            if (raf) cancelAnimationFrame(raf)
        }
    }, [density])

    React.useEffect(() => () => {
        if (leaveTimer.current) clearTimeout(leaveTimer.current)
    }, [])

    const handlers = React.useMemo(() => ({
        onPointerEnter: (e: React.PointerEvent) => {
            // Con el dedo no hay "encima": un toque no debe dejar la barra abierta.
            if (e.pointerType !== "mouse" && e.pointerType !== "pen") return
            if (leaveTimer.current) clearTimeout(leaveTimer.current)
            leaveTimer.current = null
            setPointerInside(true)
        },
        onPointerLeave: () => {
            if (leaveTimer.current) clearTimeout(leaveTimer.current)
            leaveTimer.current = setTimeout(() => setPointerInside(false), LEAVE_DELAY_MS)
        },
        // Solo foco de teclado: tras un clic el foco queda en el enlace y mantendría la barra abierta.
        onFocus: (e: React.FocusEvent) => {
            if (e.target instanceof HTMLElement && e.target.matches(":focus-visible")) setFocusInside(true)
        },
        onBlur: (e: React.FocusEvent) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusInside(false)
        },
    }), [])

    const compact = resolveNavCompact({
        density,
        scrollCompact,
        engaged: pointerInside || focusInside,
    })
    return { compact, handlers }
}

/** ¿La ventana es al menos `px` de ancho? Con `defaultValue` fuera del navegador (SSR/tests). */
export function useMinWidth(px: number, defaultValue = true): boolean {
    return useMediaQuery(`(min-width: ${px}px)`, defaultValue)
}
