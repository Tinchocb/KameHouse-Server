import { useEffect, useCallback, useRef } from "react"

interface UseFocusNavigationOptions {
    /** Container ref that holds the focusable elements */
    containerRef: React.RefObject<HTMLElement>
    /** Whether D-pad navigation is enabled */
    enabled?: boolean
    /** Selector for focusable elements within the container */
    focusableSelector?: string
    /** Called when Escape key is pressed */
    onEscape?: () => void
    /** Called when Enter/OK key is pressed on a focused element */
    onEnter?: (element: HTMLElement) => void
}

/**
 * Hook for D-pad/remote control navigation in TV browsers.
 * Handles arrow key navigation between focusable elements.
 */
export function useFocusNavigation({
    containerRef,
    enabled = true,
    focusableSelector = 'button, [role="button"], input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
    onEscape,
    onEnter,
}: UseFocusNavigationOptions) {
    const focusedIndexRef = useRef<number>(-1)

    const getFocusableElements = useCallback(() => {
        if (!containerRef.current) return []
        const elements = Array.from(
            containerRef.current.querySelectorAll<HTMLElement>(focusableSelector)
        )
        // Filter out hidden elements
        return elements.filter((el) => {
            const style = window.getComputedStyle(el)
            return (
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                el.offsetParent !== null
            )
        })
    }, [containerRef, focusableSelector])

    const focusElement = useCallback(
        (index: number) => {
            const elements = getFocusableElements()
            if (index >= 0 && index < elements.length) {
                elements[index].focus()
                focusedIndexRef.current = index
            }
        },
        [getFocusableElements]
    )

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (!enabled) return

            const elements = getFocusableElements()
            if (elements.length === 0) return

            const currentIndex = focusedIndexRef.current
            let newIndex = currentIndex

            switch (e.key) {
                case "ArrowRight":
                    e.preventDefault()
                    newIndex = currentIndex < elements.length - 1 ? currentIndex + 1 : 0
                    focusElement(newIndex)
                    break

                case "ArrowLeft":
                    e.preventDefault()
                    newIndex = currentIndex > 0 ? currentIndex - 1 : elements.length - 1
                    focusElement(newIndex)
                    break

                case "ArrowDown":
                    e.preventDefault()
                    // For horizontal layouts, move to next element
                    newIndex = currentIndex < elements.length - 1 ? currentIndex + 1 : 0
                    focusElement(newIndex)
                    break

                case "ArrowUp":
                    e.preventDefault()
                    // For horizontal layouts, move to previous element
                    newIndex = currentIndex > 0 ? currentIndex - 1 : elements.length - 1
                    focusElement(newIndex)
                    break

                case "Enter":
                case "OK":
                    e.preventDefault()
                    if (currentIndex >= 0 && currentIndex < elements.length) {
                        onEnter?.(elements[currentIndex])
                        elements[currentIndex].click()
                    }
                    break

                case "Escape":
                case "Return":
                    e.preventDefault()
                    onEscape?.()
                    break

                default:
                    break
            }
        },
        [enabled, getFocusableElements, focusElement, onEnter, onEscape]
    )

    useEffect(() => {
        if (!enabled) return

        const container = containerRef.current
        if (!container) return

        container.addEventListener("keydown", handleKeyDown)
        return () => {
            container.removeEventListener("keydown", handleKeyDown)
        }
    }, [enabled, containerRef, handleKeyDown])

    return {
        /** Programmatically focus an element by index */
        focusElement,
        /** Get the currently focused index */
        getFocusedIndex: () => focusedIndexRef.current,
        /** Reset focus to -1 (no element focused) */
        resetFocus: () => {
            focusedIndexRef.current = -1
        },
    }
}
