import * as React from "react"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"
import { useLocation } from "@tanstack/react-router"
import { useAppStore } from "@/lib/store"

/**
 * DynamicBackdrop — global fixed layer behind the entire home page.
 * Enhanced with organic breathing animation and smooth asymmetric cross-fade.
 *
 * Performance notes:
 * - The cross-fade is driven purely by CSS `opacity` + `will-change: opacity`
 *   so the browser handles it on the compositor thread (zero layout/paint cost).
 * - The blurred image is scaled to 115% to avoid transparent edge bleeding.
 * - Organic breathing uses CSS keyframes for 100% GPU compositor-driven animation.
 * - The 150 ms hover debounce in `useIntelligenceStore` prevents flicker.
 */
export function DynamicBackdrop() {
    const location = useLocation()
    const isHomePage =
        location.pathname === "/home" ||
        location.pathname === "/home/"
    const isStaticPage =
        isHomePage ||
        location.pathname === "/movies" ||
        location.pathname === "/movies/" ||
        location.pathname === "/series" ||
        location.pathname === "/series/" ||
        location.pathname.startsWith("/settings")

    const isEnabled = useAppStore(state => state.dynamicBackdropEnabled)
    const isMotionEnabled = useAppStore(state => state.dynamicBackdropMotionEnabled)
    const currentBackdropUrl = useIntelligenceStore(s => s.currentBackdropUrl)
    const activeBackdropUrl = currentBackdropUrl
    // Home uses a more subtle opacity to avoid competing with content
    const baseOpacity = isHomePage ? 0.65 : 0.35

    const [displayedUrl, setDisplayedUrl] = React.useState<string | null>(null)
    const [nextUrl, setNextUrl] = React.useState<string | null>(null)
    const [isCrossFading, setIsCrossFading] = React.useState(false)

    const currentLayerRef = React.useRef<HTMLDivElement>(null)
    const nextLayerRef = React.useRef<HTMLDivElement>(null)
    const containerRef = React.useRef<HTMLDivElement>(null)
    const backdropWrapperRef = React.useRef<HTMLDivElement>(null)
    const orb1Ref = React.useRef<HTMLDivElement>(null)
    const orb2Ref = React.useRef<HTMLDivElement>(null)

    // Handle global mouse move for orbital effect with smooth interpolation (lerping)
    React.useEffect(() => {
        if (!isEnabled || !isMotionEnabled) return
        let rafId: number | null = null
        let targetX = 0
        let targetY = 0
        let currentX = 0
        let currentY = 0
        let paused = document.visibilityState === "hidden"

        const updatePosition = () => {
            if (paused) {
                rafId = null
                return
            }
            const dx = targetX - currentX
            const dy = targetY - currentY

            if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
                currentX += dx * 0.05
                currentY += dy * 0.05
                if (backdropWrapperRef.current) {
                    backdropWrapperRef.current.style.transform = `translate3d(${currentX * 0.1}px, ${currentY * 0.1}px, 0)`
                }
                if (orb1Ref.current) {
                    orb1Ref.current.style.transform = `translate3d(${currentX * 0.5}px, ${currentY * 0.5}px, 0)`
                }
                if (orb2Ref.current) {
                    orb2Ref.current.style.transform = `translate3d(${currentX * -0.3}px, ${currentY * -0.3}px, 0)`
                }
                rafId = requestAnimationFrame(updatePosition)
            } else {
                rafId = null
            }
        }

        const handleMouseMove = (e: MouseEvent) => {
            if (paused) return
            const { clientX, clientY } = e
            targetX = (clientX / window.innerWidth - 0.5) * 100
            targetY = (clientY / window.innerHeight - 0.5) * 100

            if (!rafId) {
                rafId = requestAnimationFrame(updatePosition)
            }
        }

        const handleVisibility = () => {
            paused = document.visibilityState === "hidden"
            if (paused && rafId) {
                cancelAnimationFrame(rafId)
                rafId = null
            }
        }

        window.addEventListener("mousemove", handleMouseMove, { passive: true })
        document.addEventListener("visibilitychange", handleVisibility)
        rafId = requestAnimationFrame(updatePosition)

        return () => {
            window.removeEventListener("mousemove", handleMouseMove)
            document.removeEventListener("visibilitychange", handleVisibility)
            if (rafId) cancelAnimationFrame(rafId)
        }
    }, [isEnabled, isMotionEnabled])

    // Orchestrate a smooth cross-fade without Framer Motion (pure CSS opacity)
    React.useEffect(() => {
        if (!isEnabled) return
        if (!activeBackdropUrl || activeBackdropUrl === displayedUrl) return

        if (!displayedUrl) {
            // First image — just show it
            setTimeout(() => setDisplayedUrl(activeBackdropUrl), 0)
            return
        }

        // Cross-fade: load next into a hidden layer, then swap
        setTimeout(() => {
            setNextUrl(activeBackdropUrl)
            setIsCrossFading(true)
        }, 0)

        const timer = setTimeout(() => {
            setDisplayedUrl(activeBackdropUrl)
            setNextUrl(null)
            setIsCrossFading(false)
        }, 520) // slightly longer than the CSS transition (500ms)

        return () => clearTimeout(timer)
    }, [activeBackdropUrl, displayedUrl, isEnabled])

    const isWails = typeof window !== "undefined" && ((window as any).wails !== undefined || (window as any).runtime !== undefined)
    const filterClass = isWails ? "blur-lg saturate-150" : "blur-md"

    if (!isEnabled) return null

    return (
        <div
            ref={containerRef}
            aria-hidden="true"
            className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background ${isMotionEnabled ? "animate-breathing" : ""}`}
        >
            {/* Wrapper for the backdrop layers that receives the mouse translation without CSS transitions */}
            <div
                ref={backdropWrapperRef}
                className="absolute inset-0"
                style={{
                    transform: "translate3d(0px, 0px, 0px)",
                    willChange: "transform",
                }}
            >
                {/* ── Displayed (current) backdrop ──────────────────────────── */}
                <div
                    ref={currentLayerRef}
                    className={`absolute inset-0 scale-115 bg-cover bg-center bg-no-repeat ${filterClass}`}
                    style={{
                        backgroundImage: displayedUrl ? `url(${displayedUrl})` : undefined,
                        opacity: isCrossFading ? 0 : baseOpacity,
                        transition: "opacity 500ms ease-in-out",
                        willChange: "opacity",
                    }}
                />

                {/* ── Incoming (next) backdrop — fades in over the current with asymmetric scale ── */}
                <div
                    ref={nextLayerRef}
                    className={`absolute inset-0 bg-cover bg-center bg-no-repeat ${filterClass}`}
                    style={{
                        backgroundImage: nextUrl ? `url(${nextUrl})` : undefined,
                        opacity: isCrossFading ? baseOpacity : 0,
                        transform: isCrossFading ? "scale(1.05)" : "scale(1.2)",
                        transition: "opacity 500ms ease-in-out, transform 600ms cubic-bezier(0.4, 0, 0.2, 1)",
                        willChange: "opacity, transform",
                    }}
                />
            </div>

            {/* ── Orbital Orbs — more subtle on home/static pages ── */}
            <div
                ref={orb1Ref}
                className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full blur-[120px] mix-blend-screen"
                style={{
                    background: isHomePage ? 'rgba(255,110,58,0.06)' : 'rgba(255,110,58,0.12)',
                    transform: "translate3d(0px, 0px, 0px)",
                    willChange: "transform",
                }}
            />
            <div
                ref={orb2Ref}
                className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full blur-[100px] mix-blend-screen"
                style={{
                    background: isHomePage ? 'rgba(59,130,246,0.03)' : 'rgba(59,130,246,0.06)',
                    transform: "translate3d(0px, 0px, 0px)",
                    willChange: "transform",
                }}
            />

            {/* ── Cinematic Grain Overlay ── */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay z-10"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
            />

            {/* ── Vignette stack — ensures text is always legible ───────── */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_0%,rgba(255,255,255,0.04),transparent_60%)]" />
            <div
                className="absolute inset-0 bg-gradient-to-r from-background via-background/30 to-transparent transition-opacity duration-500"
                style={{ opacity: isStaticPage ? 0.20 : 0.65 }}
            />
            <div
                className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent transition-opacity duration-500"
                style={{ opacity: isStaticPage ? 0.25 : 0.70 }}
            />
        </div>
    )
}

