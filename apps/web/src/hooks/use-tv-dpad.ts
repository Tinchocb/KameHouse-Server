import { useEffect } from "react"
import { useAppStore } from "@/lib/store"

/**
 * Activates global D-pad spatial navigation and sets `data-tv` on <html> when tvMode is on.
 * Uses the same euclidean-distance scoring as useFocusNavigation but scoped to document.
 */
export function useTvDpad() {
    const tvMode = useAppStore((state) => state.tvMode)
    const isVideoActive = useAppStore((state) => state.isVideoActive)

    useEffect(() => {
        if (tvMode) {
            document.documentElement.setAttribute("data-tv", "true")
        } else {
            document.documentElement.removeAttribute("data-tv")
        }
    }, [tvMode])

    useEffect(() => {
        // Yield arrow keys to the video player when it's active — it handles them for seek/volume
        if (!tvMode || isVideoActive) return

        const SELECTOR =
            'a[href], button:not([disabled]), [role="button"], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

        function getNodes(): HTMLElement[] {
            return Array.from(document.querySelectorAll<HTMLElement>(SELECTOR)).filter((el) => {
                const s = getComputedStyle(el)
                return s.display !== "none" && s.visibility !== "hidden" && el.offsetParent !== null
            })
        }

        function center(el: HTMLElement) {
            const r = el.getBoundingClientRect()
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
        }

        function score(
            from: { x: number; y: number },
            to: { x: number; y: number },
            dir: "up" | "down" | "left" | "right"
        ): number {
            const dx = to.x - from.x
            const dy = to.y - from.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist === 0) return Infinity

            let inDir = false
            let perp = 1
            switch (dir) {
                case "right": inDir = dx > 0; perp = 1 + (Math.abs(dy) / (Math.abs(dx) + 1)) * 0.5; break
                case "left":  inDir = dx < 0; perp = 1 + (Math.abs(dy) / (Math.abs(dx) + 1)) * 0.5; break
                case "down":  inDir = dy > 0; perp = 1 + (Math.abs(dx) / (Math.abs(dy) + 1)) * 0.5; break
                case "up":    inDir = dy < 0; perp = 1 + (Math.abs(dx) / (Math.abs(dy) + 1)) * 0.5; break
            }
            return inDir ? dist * perp : dist * 3
        }

        function findBest(current: HTMLElement, dir: "up" | "down" | "left" | "right"): HTMLElement | null {
            const nodes = getNodes()
            const cc = center(current)
            let bestEl: HTMLElement | null = null
            let bestScore = Infinity

            for (const el of nodes) {
                if (el === current) continue
                const s = score(cc, center(el), dir)
                if (s < bestScore) { bestScore = s; bestEl = el }
            }
            return bestEl
        }

        function handleKeyDown(e: KeyboardEvent) {
            const dirMap: Record<string, "up" | "down" | "left" | "right"> = {
                ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
            }
            const dir = dirMap[e.key]
            if (!dir) return

            e.preventDefault()
            const active = document.activeElement as HTMLElement
            const nodes = getNodes()

            if (!active || !nodes.includes(active)) {
                nodes[0]?.focus()
                return
            }

            findBest(active, dir)?.focus()
        }

        document.addEventListener("keydown", handleKeyDown)
        return () => document.removeEventListener("keydown", handleKeyDown)
    }, [tvMode, isVideoActive])
}
