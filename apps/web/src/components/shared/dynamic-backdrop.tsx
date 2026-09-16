import * as React from "react"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"
import { useLocation } from "@tanstack/react-router"
import { useAppStore } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import { useThemeSettings } from "@/lib/theme/theme-hooks"
import { usePerformanceStore, selectEffectiveTier } from "@/lib/hardware/performance-store"
import { getLowResImage } from "@/lib/helpers/images"

/**
 * DynamicBackdrop — Cinematic Minimalist backdrop for KameHouse v3
 * - Subtle gradient orbs animated via CSS keyframes (GPU-accelerated)
 * - Cross-fade between artwork images
 * - Film grain + vignette overlays
 * - Mouse parallax (optional, respects reduced motion and performance tier)
 */
export function DynamicBackdrop() {
    const pathname = useLocation({ select: (loc) => loc.pathname })
    const isHomePage =
        pathname === "/home" ||
        pathname === "/home/"
    // Listing/section pages: no big hero image of their own, so the global
    // backdrop needs to stay visible (with blur) behind them for the
    // glassmorphic chrome (sidebar, panels) to have something to blur.
    const isListingPage =
        pathname === "/movies" ||
        pathname === "/movies/" ||
        pathname === "/series" ||
        pathname === "/series/" ||
        pathname.startsWith("/settings")
    
    const isDetailPage = Boolean(pathname.match(/\/(movies|series)\/\d+/))

    const { isEnabled, isMotionEnabled, tvMode } = useAppStore(
        useShallow(state => ({
            isEnabled: state.dynamicBackdropEnabled,
            isMotionEnabled: state.dynamicBackdropMotionEnabled,
            tvMode: state.tvMode,
        }))
    )
    const currentBackdropUrl = useIntelligenceStore(s => s.currentBackdropUrl)
    const activeBackdropUrl = currentBackdropUrl
    
    const ts = useThemeSettings()

    const effectiveTier = usePerformanceStore(selectEffectiveTier)
    const autoThrottleActive = usePerformanceStore(state => state.autoThrottleActive)
    const isEcoMode = effectiveTier === "low_power" || autoThrottleActive
    const isFlat = !ts.themeEnableBlurringEffects || tvMode || isEcoMode
    
    const isHeroPage = isHomePage || isListingPage
    
    const baseOpacity = (isListingPage
        ? 0.35
        : isDetailPage
            ? 0.45
            : 0.25) * (isFlat ? 0.75 : 1)

    const [displayedUrl, setDisplayedUrl] = React.useState<string | null>(null)
    const [nextUrl, setNextUrl] = React.useState<string | null>(null)
    const [isCrossFading, setIsCrossFading] = React.useState(false)

    const displayedUrlLowRes = React.useMemo(() => displayedUrl ? getLowResImage(displayedUrl) : null, [displayedUrl])
    const nextUrlLowRes = React.useMemo(() => nextUrl ? getLowResImage(nextUrl) : null, [nextUrl])

    const backdropWrapperRef = React.useRef<HTMLDivElement>(null)

    // Mouse parallax (GPU-accelerated, disabled in TV, Eco mode, or Home — en Home el hero
    // tiene su propio backdrop sin blur; mover una capa con blur activo invalida una capa enorme)
    React.useEffect(() => {
        if (!isEnabled || !isMotionEnabled || tvMode || isEcoMode || isHomePage) return
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

            if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
                currentX += dx * 0.05
                currentY += dy * 0.05
                if (backdropWrapperRef.current) {
                    backdropWrapperRef.current.style.transform = `translate3d(${currentX * 0.08}px, ${currentY * 0.08}px, 0)`
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

        return () => {
            window.removeEventListener("mousemove", handleMouseMove)
            document.removeEventListener("visibilitychange", handleVisibility)
            if (rafId) cancelAnimationFrame(rafId)
        }
    }, [isEnabled, isMotionEnabled, tvMode, isEcoMode, isHomePage])

    // Cross-fade orchestration con soporte completo de transición a null
    React.useEffect(() => {
        if (!isEnabled) return
        if (activeBackdropUrl === displayedUrl) return

        if (!activeBackdropUrl) {
            setIsCrossFading(true)
            const finishTimer = setTimeout(() => {
                setDisplayedUrl(null)
                setNextUrl(null)
                setIsCrossFading(false)
            }, 600)
            return () => {
                clearTimeout(finishTimer)
            }
        }

        if (!displayedUrl) {
            setDisplayedUrl(activeBackdropUrl)
            return
        }

        setNextUrl(activeBackdropUrl)
        setIsCrossFading(true)

        const finishTimer = setTimeout(() => {
            setDisplayedUrl(activeBackdropUrl)
            setNextUrl(null)
            setIsCrossFading(false)
        }, 800)

        return () => {
            clearTimeout(finishTimer)
        }
    }, [activeBackdropUrl, displayedUrl, isEnabled])

    if (!isEnabled) return null

    // Los orbes solo se renderizan en modo Era con tema activo; en Clásico el fondo es minimalista sin animaciones
    const showAnimatedOrbs = !tvMode && !isEcoMode && ts.effectiveMode === "era" && ts.hasEraTheme

    return (
        <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[var(--bg-primary)]"
            style={{ contain: "strict" }}
        >
            {/* Cinematic Gradient Orbs (Omitted in TV / Eco / Classic Mode) */}
            {showAnimatedOrbs && (
                <div className="absolute inset-0 overflow-hidden">
                    {/* Era Universe gradient layer */}
                    <div className="era-universe-layer absolute inset-0 transition-opacity duration-slow opacity-0" />
                    <div className="absolute top-[10%] left-[8%] w-[clamp(220px,35vw,550px)] h-[clamp(220px,35vw,550px)] rounded-full animate-float-blur"
                        style={{
                            background: "radial-gradient(circle at 30% 30%, var(--glow-color-1) 0%, transparent 80%)",
                            opacity: (isListingPage || isDetailPage) && !activeBackdropUrl ? 0.60 : 0.35,
                        }}
                    />
                    <div className="absolute bottom-[8%] right-[6%] w-[clamp(200px,30vw,500px)] h-[clamp(200px,30vw,500px)] rounded-full animate-float-blur-reverse"
                        style={{
                            background: "radial-gradient(circle at 70% 70%, var(--glow-color-2) 0%, transparent 80%)",
                            opacity: (isListingPage || isDetailPage) && !activeBackdropUrl ? 0.50 : 0.30,
                        }}
                    />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[clamp(240px,38vw,580px)] h-[clamp(240px,38vw,580px)] rounded-full animate-pulse-glow-soft transform-gpu"
                        style={{
                            background: "radial-gradient(circle at 50% 50%, var(--glow-color-3) 0%, transparent 70%)",
                            opacity: (isListingPage || isDetailPage) && !activeBackdropUrl ? 0.40 : 0.20,
                        }}
                    />
                </div>
            )}

            {/* Wrapper for backdrop layers with mouse parallax (excluido en Home para evitar duplicación con el hero y su aura) */}
            {!isHomePage && (
                <div
                    ref={backdropWrapperRef}
                    className="absolute inset-0 transform-gpu"
                    style={{
                        transform: "translate3d(0px, 0px, 0px)",
                    }}
                >
                    {/* Blurred layer — low-res image, heavy blur 64px (puramente ambiental y difuso) */}
                    {displayedUrlLowRes && (
                        <div
                            className="absolute inset-0 bg-cover bg-center bg-no-repeat transform-gpu"
                            style={{
                                backgroundImage: `url(${displayedUrlLowRes})`,
                                opacity: isCrossFading ? 0 : baseOpacity,
                                transform: "scale(1.18)",
                                filter: isFlat || isEcoMode
                                    ? "none"
                                    : "blur(64px) brightness(0.50) saturate(135%)",
                                transition: "opacity 800ms cubic-bezier(0.25, 0.8, 0.25, 1)",
                            }}
                        />
                    )}
                    {nextUrlLowRes && (
                        <div
                            className="absolute inset-0 bg-cover bg-center bg-no-repeat transform-gpu"
                            style={{
                                backgroundImage: `url(${nextUrlLowRes})`,
                                opacity: isCrossFading ? baseOpacity : 0,
                                transform: "scale(1.18)",
                                filter: isFlat || isEcoMode
                                    ? "none"
                                    : "blur(64px) brightness(0.50) saturate(135%)",
                                transition: "opacity 800ms cubic-bezier(0.25, 0.8, 0.25, 1)",
                            }}
                        />
                    )}
                </div>
            )}

            {/* Film Grain Overlay */}
            {!tvMode && !isFlat && <div className="grain-overlay z-10" />}

            {/* Vignette Stack — Scrim superior, lateral y de base para contraste perfecto */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_0%,var(--glass-border-bottom),transparent_60%)]" />

            {/* Scrim superior para proteger la barra de navegación flotante */}
            <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-[var(--bg-primary)] via-[var(--bg-primary)]/60 to-transparent" />

            <div
                className="absolute inset-0 bg-gradient-to-r from-[var(--bg-primary)] via-[var(--bg-primary)]/20 to-transparent transition-opacity duration-slow"
                style={{ opacity: isListingPage ? 0.35 : isDetailPage ? 0.45 : 0.65 }}
            />
            <div
                className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent transition-opacity duration-slow"
                style={{ opacity: isListingPage ? 0.40 : isDetailPage ? 0.50 : 0.70 }}
            />
        </div>
    )
}