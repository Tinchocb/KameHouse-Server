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
        pathname.startsWith("/settings") ||
        pathname.startsWith("/chronology")
    
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

    // Las páginas con hero cinematográfico (Home / Movies / Series) ya pintan
    // su propia aura ambiental con la MISMA imagen (blur + máscara radial +
    // opacidad). Si el backdrop global también pintara la imagen con blur(64px),
    // se apilarían dos capas de blur sobre el mismo arte: wash duplicado y
    // doble coste GPU. En ese caso el global aporta solo orbes/scrims/grano;
    // la imagen con blur la pone el hero local (una sola capa).
    // (Detalle MediaHero no entra acá: su blur local de 12-14px es relleno
    // letterbox bajo la imagen nítida, no un duplicado del blur ambiental.)
    const hasLocalHeroAura = isHeroPage && !!activeBackdropUrl
    
    const baseOpacity = (isListingPage
        ? 0.35
        : isDetailPage
            ? 0.45
            : 0.25) * (isFlat ? 0.75 : 1)

    const [displayedUrl, setDisplayedUrl] = React.useState<string | null>(activeBackdropUrl)
    const [nextUrl, setNextUrl] = React.useState<string | null>(null)
    const [isCrossFading, setIsCrossFading] = React.useState(false)
    const [prevBackdropUrl, setPrevBackdropUrl] = React.useState(activeBackdropUrl)

    if (activeBackdropUrl !== prevBackdropUrl) {
        setPrevBackdropUrl(activeBackdropUrl)
        if (!activeBackdropUrl) {
            setIsCrossFading(true)
        } else if (!displayedUrl) {
            setDisplayedUrl(activeBackdropUrl)
        } else {
            setNextUrl(activeBackdropUrl)
            setIsCrossFading(true)
        }
    }

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

    // Cross-fade timer
    React.useEffect(() => {
        if (!isEnabled || !isCrossFading) return

        const finishTimer = setTimeout(() => {
            setDisplayedUrl(activeBackdropUrl)
            setNextUrl(null)
            setIsCrossFading(false)
        }, 350)

        return () => {
            clearTimeout(finishTimer)
        }
    }, [isEnabled, isCrossFading, activeBackdropUrl])

    // Preload next low-res image
    React.useEffect(() => {
        if (!nextUrl) return
        const lowRes = getLowResImage(nextUrl)
        if (typeof window !== "undefined" && lowRes) {
            const img = new Image()
            img.src = lowRes
        }
    }, [nextUrl])

    if (!isEnabled) return null

    // La capa de era solo se renderiza en modo Era con tema activo (se omite en detalle para mantener fondo negro puro)
    const showEraLayer = !tvMode && !isEcoMode && ts.effectiveMode === "era" && ts.hasEraTheme && !isDetailPage

    return (
        <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg-primary"
            style={{ contain: "paint" }}
        >
            {/* Capa de degradé del tema Universo. Sin orbes flotantes: el color de la
                era llega por --page-gradient, que tiñe el fondo sin formas visibles. */}
            {showEraLayer && (
                <div className="absolute inset-0 overflow-hidden">
                    <div className="era-universe-layer absolute inset-0 transition-opacity duration-slow opacity-0" />
                </div>
            )}

            {/* Wrapper for backdrop layers with mouse parallax */}
            <div
                ref={backdropWrapperRef}
                className="absolute inset-0 transform-gpu"
                style={{
                    transform: "translate3d(0px, 0px, 0px)",
                }}
            >
                {/* Blurred layer — low-res image, heavy blur 64px (puramente ambiental y difuso).
                    Se omite cuando el hero local ya pinta la misma imagen con su
                    propio blur (hasLocalHeroAura): evita la doble capa de blur. */}
                {!hasLocalHeroAura && !isDetailPage && displayedUrlLowRes && (
                    <div
                        className="absolute inset-0 bg-cover bg-center bg-no-repeat transform-gpu"
                        style={{
                            backgroundImage: `url(${displayedUrlLowRes})`,
                            opacity: isCrossFading ? 0 : baseOpacity,
                            transform: "scale(1.18)",
                            filter: isFlat || isEcoMode
                                ? "none"
                                : "blur(48px) brightness(0.50) saturate(135%)",
                            transition: "opacity 350ms cubic-bezier(0.16, 1, 0.3, 1)",
                        }}
                    />
                )}
                {!hasLocalHeroAura && !isDetailPage && nextUrlLowRes && (
                    <div
                        className="absolute inset-0 bg-cover bg-center bg-no-repeat transform-gpu"
                        style={{
                            backgroundImage: `url(${nextUrlLowRes})`,
                            opacity: isCrossFading ? baseOpacity : 0,
                            transform: "scale(1.18)",
                            filter: isFlat || isEcoMode
                                ? "none"
                                : "blur(48px) brightness(0.50) saturate(135%)",
                            transition: "opacity 350ms cubic-bezier(0.16, 1, 0.3, 1)",
                        }}
                    />
                )}
            </div>

            {/* Film Grain Overlay */}
            {!tvMode && !isFlat && <div className="grain-overlay z-10" />}

            {/* Ambient soft glow when no backdrop image is active */}
            {/* --brand-accent-hex (no --brand-accent, que es un triplete HSL y dejaba el color-mix inválido) */}
            {!displayedUrlLowRes && (
                <div
                    className="absolute inset-0 pointer-events-none opacity-40"
                    style={{
                        background: "radial-gradient(ellipse at 50% 15%, color-mix(in srgb, var(--brand-accent-hex, #ffffff) 8%, transparent) 0%, transparent 70%)",
                    }}
                />
            )}

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