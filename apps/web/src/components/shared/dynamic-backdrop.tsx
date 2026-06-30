import * as React from "react"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"
import { useLocation } from "@tanstack/react-router"
import { useAppStore } from "@/lib/store"

/**
 * DynamicBackdrop — Cinematic Minimalist backdrop for KameHouse v3
 * - Subtle gradient orbs animated via CSS keyframes (GPU-accelerated)
 * - Cross-fade between artwork images
 * - Film grain + vignette overlays
 * - Mouse parallax (optional, respects reduced motion)
 */
export function DynamicBackdrop() {
    const location = useLocation()
    const isHomePage =
        location.pathname === "/home" ||
        location.pathname === "/home/"
    // Listing/section pages: no big hero image of their own, so the global
    // backdrop needs to stay visible (with blur) behind them for the
    // glassmorphic chrome (sidebar, panels) to have something to blur.
    const isListingPage =
        location.pathname === "/movies" ||
        location.pathname === "/movies/" ||
        location.pathname === "/series" ||
        location.pathname === "/series/" ||
        location.pathname.startsWith("/settings")
    const isStaticPage = isHomePage || isListingPage

    const isEnabled = useAppStore(state => state.dynamicBackdropEnabled)
    const isMotionEnabled = useAppStore(state => state.dynamicBackdropMotionEnabled)
    const currentBackdropUrl = useIntelligenceStore(s => s.currentBackdropUrl)
    const activeBackdropUrl = currentBackdropUrl
    const baseOpacity = isHomePage ? 0.65 : isListingPage ? 0.40 : 0.12

    const [displayedUrl, setDisplayedUrl] = React.useState<string | null>(null)
    const [nextUrl, setNextUrl] = React.useState<string | null>(null)
    const [isCrossFading, setIsCrossFading] = React.useState(false)

    const currentLayerRef = React.useRef<HTMLDivElement>(null)
    const nextLayerRef = React.useRef<HTMLDivElement>(null)
    const containerRef = React.useRef<HTMLDivElement>(null)
    const backdropWrapperRef = React.useRef<HTMLDivElement>(null)

    // Mouse parallax (GPU-accelerated)
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

    // Cross-fade orchestration
    React.useEffect(() => {
        if (!isEnabled) return
        if (!activeBackdropUrl || activeBackdropUrl === displayedUrl) return

        if (!displayedUrl) {
            setTimeout(() => setDisplayedUrl(activeBackdropUrl), 0)
            return
        }

        setTimeout(() => {
            setNextUrl(activeBackdropUrl)
            setIsCrossFading(true)
        }, 0)

        const timer = setTimeout(() => {
            setDisplayedUrl(activeBackdropUrl)
            setNextUrl(null)
            setIsCrossFading(false)
        }, 520)

        return () => clearTimeout(timer)
    }, [activeBackdropUrl, displayedUrl, isEnabled])

    const filterClass = isHomePage ? "" : "blur-2xl"

    if (!isEnabled) return null

    return (
        <div
            ref={containerRef}
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[var(--bg-primary)]"
        >
            {/* Cinematic Gradient Orbs - CSS animated, GPU-composited */}
            <div className="absolute inset-0 overflow-hidden" style={{ filter: "blur(160px)" }}>
                <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full animate-float-blur mix-blend-plus-lighter"
                    style={{
                        background: "radial-gradient(circle at 30% 30%, hsl(var(--brand-accent)) 0%, transparent 70%)",
                        opacity: 0.18,
                        willChange: "transform",
                    }}
                />
                <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full animate-float-blur-reverse mix-blend-plus-lighter"
                    style={{
                        background: "radial-gradient(circle at 70% 70%, var(--era-dbs-hex) 0%, transparent 70%)",
                        opacity: 0.15,
                        willChange: "transform",
                    }}
                />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full animate-pulse-glow mix-blend-plus-lighter"
                    style={{
                        background: "radial-gradient(circle at 50% 50%, var(--era-db-hex) 0%, transparent 60%)",
                        opacity: 0.1,
                        willChange: "opacity, transform",
                    }}
                />
            </div>

            {/* Frosted Glass Overlay - adds blur depth behind content */}
            <div className="absolute inset-0 bg-surface-container/30 backdrop-blur-overlay-xl" style={{ opacity: isHomePage ? 0.3 : isListingPage ? 0.25 : 0.1 }} />

            {/* Wrapper for backdrop layers with mouse parallax */}
            <div
                ref={backdropWrapperRef}
                className="absolute inset-0"
                style={{
                    transform: "translate3d(0px, 0px, 0px)",
                    willChange: "transform",
                }}
            >
                {/* Current backdrop */}
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

                {/* Incoming backdrop */}
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

            {/* Film Grain Overlay */}
            <div className="absolute inset-0 opacity-[0.025] pointer-events-none mix-blend-overlay z-10"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
            />

            {/* Vignette Stack */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_0%,rgba(255,255,255,0.015),transparent_60%)]" />
            <div
                className="absolute inset-0 bg-gradient-to-r from-[var(--bg-primary)] via-[var(--bg-primary)]/10 to-transparent transition-opacity duration-500"
                style={{ opacity: isHomePage ? 0.08 : isListingPage ? 0.35 : 0.65 }}
            />
            <div
                className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent transition-opacity duration-500"
                style={{ opacity: isHomePage ? 0.1 : isListingPage ? 0.40 : 0.70 }}
            />
        </div>
    )
}