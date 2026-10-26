import * as React from "react"

/** Espera antes de colapsar al sacar el puntero: evita parpadeo al cruzar el borde. */
const LEAVE_DELAY_MS = 160

/**
 * ¿El riel está "en uso"? Sí mientras el ratón está encima o el foco de teclado está dentro.
 * Con el dedo no hay "encima" (un toque no debe dejarlo abierto) y el foco tras un clic tampoco cuenta.
 */
export function useRailEngaged() {
    const [pointerInside, setPointerInside] = React.useState(false)
    const [focusInside, setFocusInside] = React.useState(false)
    const leaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

    React.useEffect(() => () => {
        if (leaveTimer.current) clearTimeout(leaveTimer.current)
    }, [])

    const handlers = React.useMemo(() => ({
        onPointerEnter: (e: React.PointerEvent) => {
            if (e.pointerType !== "mouse" && e.pointerType !== "pen") return
            if (leaveTimer.current) clearTimeout(leaveTimer.current)
            leaveTimer.current = null
            setPointerInside(true)
        },
        onPointerLeave: () => {
            if (leaveTimer.current) clearTimeout(leaveTimer.current)
            leaveTimer.current = setTimeout(() => setPointerInside(false), LEAVE_DELAY_MS)
        },
        onFocus: (e: React.FocusEvent) => {
            if (e.target instanceof HTMLElement && e.target.matches(":focus-visible")) setFocusInside(true)
        },
        onBlur: (e: React.FocusEvent) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusInside(false)
        },
    }), [])

    return { engaged: pointerInside || focusInside, handlers }
}
