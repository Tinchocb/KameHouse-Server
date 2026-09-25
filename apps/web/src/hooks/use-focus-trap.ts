import { type RefObject, useEffect } from "react"

const FOCUSABLE = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled]):not([type=\"hidden\"])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex=\"-1\"])",
].join(",")

function getFocusables(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => el.offsetParent !== null || el.getClientRects().length > 0)
}

/**
 * Trap de foco para diálogos propios (los de Radix ya traen FocusScope).
 * Mientras `active`: lleva el foco adentro, cicla Tab/Shift+Tab dentro del
 * contenedor y, al cerrar, devuelve el foco a quien lo tenía al abrir.
 * Escape queda a cargo de cada diálogo.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
    useEffect(() => {
        if (!active) return
        const previouslyFocused = document.activeElement as HTMLElement | null

        // Un frame de margen: el contenedor puede montarse con AnimatePresence.
        const raf = requestAnimationFrame(() => {
            const container = ref.current
            if (!container || container.contains(document.activeElement)) return
            const target = getFocusables(container)[0] ?? container
            if (target === container && !container.hasAttribute("tabindex")) {
                container.setAttribute("tabindex", "-1")
            }
            target.focus({ preventScroll: true })
        })

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Tab") return
            const container = ref.current
            if (!container) return
            const focusables = getFocusables(container)
            if (focusables.length === 0) {
                e.preventDefault()
                return
            }
            const first = focusables[0]
            const last = focusables[focusables.length - 1]
            const current = document.activeElement
            const outside = !container.contains(current)
            if (e.shiftKey && (current === first || outside)) {
                e.preventDefault()
                last.focus()
            } else if (!e.shiftKey && (current === last || outside)) {
                e.preventDefault()
                first.focus()
            }
        }

        document.addEventListener("keydown", onKeyDown, true)
        return () => {
            cancelAnimationFrame(raf)
            document.removeEventListener("keydown", onKeyDown, true)
            if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true })
        }
    }, [ref, active])
}
