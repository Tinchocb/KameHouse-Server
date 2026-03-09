import * as React from "react"
import { useIntelligenceStore } from "@/hooks/useHomeIntelligence"

/**
 * DynamicBackdrop — global fixed layer behind the entire home page.
 *
 * Performance notes:
 * - The cross-fade is driven purely by CSS `opacity` + `will-change: opacity`
 *   so the browser handles it on the compositor thread (zero layout/paint cost).
 * - The blurred image is scaled to 110% to avoid transparent edge bleeding.
 * - The 150 ms hover debounce in `useIntelligenceStore` prevents flicker.
 */
export function DynamicBackdrop() {
    const { currentBackdropUrl } = useIntelligenceStore()
    const [displayedUrl, setDisplayedUrl] = React.useState<string | null>(null)
    const [nextUrl, setNextUrl] = React.useState<string | null>(null)
    const [isCrossFading, setIsCrossFading] = React.useState(false)

    // Orchestrate a smooth cross-fade without Framer Motion (pure CSS opacity)
    React.useEffect(() => {
        if (currentBackdropUrl === displayedUrl) return

        if (!displayedUrl) {
            // First image — just show it
            setDisplayedUrl(currentBackdropUrl)
            return
        }

        // Cross-fade: load next into a hidden layer, then swap
        setNextUrl(currentBackdropUrl)
        setIsCrossFading(true)

        const timer = setTimeout(() => {
            setDisplayedUrl(currentBackdropUrl)
            setNextUrl(null)
            setIsCrossFading(false)
        }, 520) // slightly longer than the CSS transition (500ms)

        return () => clearTimeout(timer)
    }, [currentBackdropUrl]) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-zinc-950"
        >
            {/* ── Displayed (current) backdrop ──────────────────────────── */}
            {displayedUrl && (
                <div
                    className="absolute inset-0 scale-110 bg-cover bg-center bg-no-repeat blur-3xl saturate-150"
                    style={{
                        backgroundImage: `url(${displayedUrl})`,
                        opacity: isCrossFading ? 0 : 0.2,
                        transition: "opacity 500ms ease-in-out",
                        willChange: "opacity",
                    }}
                />
            )}

            {/* ── Incoming (next) backdrop — fades in over the current ── */}
            {nextUrl && (
                <div
                    className="absolute inset-0 scale-110 bg-cover bg-center bg-no-repeat blur-3xl saturate-150"
                    style={{
                        backgroundImage: `url(${nextUrl})`,
                        opacity: isCrossFading ? 0.2 : 0,
                        transition: "opacity 500ms ease-in-out",
                        willChange: "opacity",
                    }}
                />
            )}

            {/* ── Vignette stack — ensures text is always legible ───────── */}
            {/* Radial centre highlight (Seanime-style subtle glow) */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_0%,rgba(255,255,255,0.04),transparent_60%)]" />
            {/* Left-to-right crush ensures left-aligned hero text pops */}
            <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/95 via-zinc-950/60 to-transparent" />
            {/* Bottom crush anchors swimlanes */}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/75 to-zinc-950/10" />
        </div>
    )
}
