import * as React from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"

/**
 * DynamicBackdrop — global fixed layer behind the entire home page.
 * Enhanced with organic breathing animation and smooth asymmetric cross-fade.
 *
 * Performance notes:
 * - The cross-fade is driven purely by CSS `opacity` + `will-change: opacity`
 *   so the browser handles it on the compositor thread (zero layout/paint cost).
 * - The blurred image is scaled to 115% to avoid transparent edge bleeding.
 * - Organic breathing uses GSAP for smooth 60fps animation on transform.
 * - The 150 ms hover debounce in `useIntelligenceStore` prevents flicker.
 */
export function DynamicBackdrop() {
    const { currentBackdropUrl } = useIntelligenceStore()
    const [displayedUrl, setDisplayedUrl] = React.useState<string | null>(null)
    const [nextUrl, setNextUrl] = React.useState<string | null>(null)
    const [isCrossFading, setIsCrossFading] = React.useState(false)

    const currentLayerRef = React.useRef<HTMLDivElement>(null)
    const nextLayerRef = React.useRef<HTMLDivElement>(null)
    const containerRef = React.useRef<HTMLDivElement>(null)

    // Organic breathing animation with GSAP
    useGSAP(() => {
        if (!containerRef.current) return

        const tl = gsap.timeline({
            repeat: -1,
            defaults: { ease: "sine.inOut" }
        })

        // Subtle scale + rotation breathing effect
        tl.to(containerRef.current, {
            scale: 1.08,
            rotation: 0.3,
            duration: 8,
        })
        .to(containerRef.current, {
            scale: 1.12,
            rotation: -0.2,
            duration: 10,
        })
        .to(containerRef.current, {
            scale: 1.05,
            rotation: 0.1,
            duration: 9,
        })
        .to(containerRef.current, {
            scale: 1.1,
            rotation: 0,
            duration: 8,
        })

    }, { scope: containerRef })

    // Orchestrate a smooth cross-fade without Framer Motion (pure CSS opacity)
    React.useEffect(() => {
        if (!currentBackdropUrl || currentBackdropUrl === displayedUrl) return

        if (!displayedUrl) {
            // First image — just show it
            setTimeout(() => setDisplayedUrl(currentBackdropUrl), 0)
            return
        }

        // Cross-fade: load next into a hidden layer, then swap
        setTimeout(() => {
            setNextUrl(currentBackdropUrl)
            setIsCrossFading(true)
        }, 0)

        const timer = setTimeout(() => {
            setDisplayedUrl(currentBackdropUrl)
            setNextUrl(null)
            setIsCrossFading(false)
        }, 520) // slightly longer than the CSS transition (500ms)

        return () => clearTimeout(timer)
    }, [currentBackdropUrl, displayedUrl])

    return (
        <div
            ref={containerRef}
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-zinc-950"
        >
            {/* ── Displayed (current) backdrop ──────────────────────────── */}
            <div
                ref={currentLayerRef}
                className="absolute inset-0 scale-115 bg-cover bg-center bg-no-repeat blur-3xl saturate-150"
                style={{
                    backgroundImage: displayedUrl ? `url(${displayedUrl})` : undefined,
                    opacity: isCrossFading ? 0 : 0.2,
                    transition: "opacity 500ms ease-in-out",
                    willChange: "opacity",
                }}
            />

            {/* ── Incoming (next) backdrop — fades in over the current with asymmetric scale ── */}
            <div
                ref={nextLayerRef}
                className="absolute inset-0 scale-120 bg-cover bg-center bg-no-repeat blur-3xl saturate-150"
                style={{
                    backgroundImage: nextUrl ? `url(${nextUrl})` : undefined,
                    opacity: isCrossFading ? 0.2 : 0,
                    transform: isCrossFading ? "scale(1.05)" : "scale(1.2)",
                    transition: "opacity 500ms ease-in-out, transform 600ms cubic-bezier(0.4, 0, 0.2, 1)",
                    willChange: "opacity, transform",
                }}
            />

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
