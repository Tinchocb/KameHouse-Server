import { useEffect, useCallback, useRef } from "react"
import { isNavigable, pickNext } from "./tv-spatial"

interface SpatialNode {
    element: HTMLElement
    rect: DOMRect
    centerX: number
    centerY: number
}

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
    /** Navigation mode: 'four-way' for TV, 'two-way' for horizontal carousels */
    direction?: "four-way" | "two-way"
}

/**
 * Hook para navegación espacial D-pad/remote control en TV browsers.
 * Utiliza cálculo de distancias euclidianas para encontrar el elemento
 * más cercano en la dirección de navegación.
 *
 * Ejemplo de uso:
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null)
 * useFocusNavigation({
 *     containerRef,
 *     enabled: controlsVisible,
 *     onEscape: handleClose,
 *     direction: "four-way",
 * })
 * ```
 */
export function useFocusNavigation({
    containerRef,
    enabled = true,
    focusableSelector = 'button, [role="button"], input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
    onEscape,
    onEnter,
    direction = "four-way",
}: UseFocusNavigationOptions) {
    const focusedElementRef = useRef<HTMLElement | null>(null)

    const getFocusableSpatialNodes = useCallback((): SpatialNode[] => {
        if (!containerRef.current) return []
        const elements = Array.from(
            containerRef.current.querySelectorAll<HTMLElement>(focusableSelector)
        )
        const nodes: SpatialNode[] = []
        for (const el of elements) {
            if (el.offsetParent === null && el.offsetWidth === 0) continue
            const rect = el.getBoundingClientRect()
            if (rect.width > 0 && rect.height > 0 && isNavigable(el)) {
                nodes.push({
                    element: el,
                    rect,
                    centerX: rect.left + rect.width / 2,
                    centerY: rect.top + rect.height / 2,
                })
            }
        }
        return nodes
    }, [containerRef, focusableSelector])

    const findBestCandidate = useCallback(
        (
            current: SpatialNode,
            nodes: SpatialNode[],
            arrowDirection: "left" | "right" | "up" | "down"
        ): HTMLElement | null => {
            return pickNext(
                current.rect,
                nodes.map(n => ({ el: n.element, rect: n.rect })),
                arrowDirection,
                current.element
            )
        },
        []
    )

    const focusElement = useCallback(
        (element: HTMLElement | null) => {
            if (element) {
                element.focus()
                focusedElementRef.current = element
            }
        },
        []
    )

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (!enabled) return

            const nodes = getFocusableSpatialNodes()
            if (nodes.length === 0) return

            const currentElement = focusedElementRef.current || document.activeElement as HTMLElement
            const currentNode = nodes.find(n => n.element === currentElement) || nodes[0]

            // Si no hay elemento focalizado, enfocar el primero
            if (!currentElement || !nodes.some(n => n.element === currentElement)) {
                if (nodes.length > 0) {
                    focusElement(nodes[0].element)
                }
                return
            }

            switch (e.key) {
                case "ArrowRight": {
                    e.preventDefault()
                    if (direction === "two-way") {
                        const idx = nodes.findIndex(n => n.element === currentElement)
                        if (idx >= 0 && idx < nodes.length - 1) {
                            focusElement(nodes[idx + 1].element)
                        }
                    } else {
                        const best = findBestCandidate(currentNode, nodes, "right")
                        if (best) focusElement(best)
                    }
                    break
                }

                case "ArrowLeft": {
                    e.preventDefault()
                    if (direction === "two-way") {
                        const idx = nodes.findIndex(n => n.element === currentElement)
                        if (idx > 0) {
                            focusElement(nodes[idx - 1].element)
                        }
                    } else {
                        const best = findBestCandidate(currentNode, nodes, "left")
                        if (best) focusElement(best)
                    }
                    break
                }

                case "ArrowDown": {
                    e.preventDefault()
                    if (direction === "two-way") return
                    const best = findBestCandidate(currentNode, nodes, "down")
                    if (best) focusElement(best)
                    break
                }

                case "ArrowUp": {
                    e.preventDefault()
                    if (direction === "two-way") return
                    const best = findBestCandidate(currentNode, nodes, "up")
                    if (best) focusElement(best)
                    break
                }

                case "Enter":
                case "OK": {
                    e.preventDefault()
                    onEnter?.(currentElement)
                    currentElement.click()
                    break
                }

                case "Escape":
                case "Return": {
                    e.preventDefault()
                    onEscape?.()
                    break
                }

                default:
                    break
            }
        },
        [enabled, getFocusableSpatialNodes, findBestCandidate, focusElement, onEnter, onEscape, direction]
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
}
