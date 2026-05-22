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

    // Handle global mouse move for orbital effect with smooth interpolation (lerping)
    React.useEffect(() => {
        let rafId: number | null = null
        let targetX = 0
        let targetY = 0
        let currentX = 0
        let currentY = 0

        const updatePosition = () => {
            const dx = targetX - currentX
            const dy = targetY - currentY
            
            if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
                currentX += dx * 0.05
                currentY += dy * 0.05
                if (containerRef.current) {
                    containerRef.current.style.setProperty('--mouse-x', String(currentX))
                    containerRef.current.style.setProperty('--mouse-y', String(currentY))
                }
                rafId = requestAnimationFrame(updatePosition)
            } else {
                rafId = null
            }
        }

        const handleMouseMove = (e: MouseEvent) => {
            const { clientX, clientY } = e
            targetX = (clientX / window.innerWidth - 0.5) * 100
            targetY = (clientY / window.innerHeight - 0.5) * 100
            
            if (!rafId) {
                rafId = requestAnimationFrame(updatePosition)
            }
        }

        window.addEventListener("mousemove", handleMouseMove, { passive: true })
        rafId = requestAnimationFrame(updatePosition)

        return () => {
            window.removeEventListener("mousemove", handleMouseMove)
            if (rafId) cancelAnimationFrame(rafId)
        }
    }, [])

    // Organic breathing animation with GSAP (animating opacity to avoid heavy shader re-rasterization on scale/rotate)
    useGSAP(() => {
        if (!containerRef.current) return

        const tl = gsap.timeline({
            repeat: -1,
            defaults: { ease: "sine.inOut" }
        })

        tl.to(containerRef.current, {
            opacity: 0.92,
            duration: 8,
        })
        .to(containerRef.current, {
            opacity: 1.0,
            duration: 10,
        })
        .to(containerRef.current, {
            opacity: 0.95,
            duration: 9,
        })
        .to(containerRef.current, {
            opacity: 1.0,
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
            {/* Wrapper for the backdrop layers that receives the mouse translation without CSS transitions */}
            <div
                className="absolute inset-0"
                style={{
                    transform: "translate(calc(var(--mouse-x, 0) * 0.1px), calc(var(--mouse-y, 0) * 0.1px))",
                    willChange: "transform",
                }}
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
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat blur-3xl saturate-150"
                    style={{
                        backgroundImage: nextUrl ? `url(${nextUrl})` : undefined,
                        opacity: isCrossFading ? 0.2 : 0,
                        transform: isCrossFading ? "scale(1.05)" : "scale(1.2)",
                        transition: "opacity 500ms ease-in-out, transform 600ms cubic-bezier(0.4, 0, 0.2, 1)",
                        willChange: "opacity, transform",
                    }}
                />
            </div>

            {/* ── Orbital Orbs ── */}
            <div 
                className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px] mix-blend-screen"
                style={{ transform: "translate(calc(var(--mouse-x, 0) * 0.5px), calc(var(--mouse-y, 0) * 0.5px))" }}
            />
            <div 
                className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-blue-500/5 blur-[100px] mix-blend-screen"
                style={{ transform: "translate(calc(var(--mouse-x, 0) * -0.3px), calc(var(--mouse-y, 0) * -0.3px))" }}
            />

            {/* ── Cinematic Grain Overlay ── */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay z-10"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
            />

            {/* ── Vignette stack — ensures text is always legible ───────── */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_0%,rgba(255,255,255,0.04),transparent_60%)]" />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/40 to-transparent opacity-90" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-100" />
        </div>
    )
}

