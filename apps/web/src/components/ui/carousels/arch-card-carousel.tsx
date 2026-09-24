"use client"

import * as React from "react"
import { useReducedMotion } from "framer-motion"
import { IconNavigationChevronLeft, IconNavigationChevronRight } from "@/components/ui/icons"
import { cn } from "@/components/ui/core/styling"

export interface ArchCardItem {
    id: string | number
    title: string
    subtitle?: string
    image: string
    tag?: string
}

export interface ArchCardCarouselProps {
    items: ArchCardItem[]
    onSelect?: (item: ArchCardItem) => void
    radius?: number
    stepAngleDeg?: number
    cardWidth?: number
    cardHeight?: number
    className?: string
    autoPlay?: boolean
}

function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function ArchCardCarousel({
    items,
    onSelect,
    radius = 780,
    stepAngleDeg = 12.5,
    cardWidth = 160,
    cardHeight = 240,
    className,
    autoPlay = true,
}: ArchCardCarouselProps) {
    const prefersReducedMotion = useReducedMotion()
    const [rotation, setRotation] = React.useState(0)
    const [screenSize, setScreenSize] = React.useState<"mobile" | "tablet" | "desktop">("desktop")

    const containerRef = React.useRef<HTMLDivElement>(null)
    const isDraggingRef = React.useRef(false)
    const isHoveredRef = React.useRef(false)
    const startXRef = React.useRef(0)
    const startRotationRef = React.useRef(0)
    const velocityRef = React.useRef(0)
    const lastXRef = React.useRef(0)
    const lastTimeRef = React.useRef(0)
    const userInteractedTimeRef = React.useRef(0)
    const currentRotationRef = React.useRef(0)

    React.useEffect(() => {
        const handleResize = () => {
            const w = window.innerWidth
            if (w < 640) setScreenSize("mobile")
            else if (w < 1024) setScreenSize("tablet")
            else setScreenSize("desktop")
        }
        handleResize()
        window.addEventListener("resize", handleResize)
        return () => window.removeEventListener("resize", handleResize)
    }, [])

    const effRadius = screenSize === "mobile" ? 460 : screenSize === "tablet" ? 640 : radius
    const effCardWidth = screenSize === "mobile" ? Math.min(cardWidth, 120) : screenSize === "tablet" ? Math.min(cardWidth, 140) : cardWidth
    const effCardHeight = screenSize === "mobile" ? Math.min(cardHeight, 180) : screenSize === "tablet" ? Math.min(cardHeight, 210) : cardHeight
    const effStepAngleDeg = screenSize === "mobile" ? 16 : screenSize === "tablet" ? 14 : stepAngleDeg

    const count = items.length
    const stepAngleRad = (effStepAngleDeg * Math.PI) / 180
    const totalSpanRad = count * stepAngleRad
    const maxScroll = Math.max(0, (totalSpanRad / 2) * 0.8)

    // Sincronizar referencia de rotación fuera del render (concurrent-safe)
    React.useEffect(() => {
        currentRotationRef.current = rotation
    })

    // Péndulo y amortiguación inercial
    React.useEffect(() => {
        if (prefersReducedMotion || count <= 1) return

        let animId: number
        let accumulatedTime = 0
        let lastStamp = performance.now()
        const cycleDuration = 10000 // 10s ciclo oscilante
        const halfCycle = cycleDuration / 2

        const tick = (now: number) => {
            const dt = Math.min(now - lastStamp, 100)
            lastStamp = now

            if (isDraggingRef.current) {
                userInteractedTimeRef.current = now
            } else if (Math.abs(velocityRef.current) > 0.0001) {
                // Inercia
                const nextRot = currentRotationRef.current + velocityRef.current * (dt / 16)
                velocityRef.current *= 0.94 // fricción
                const clamped = Math.max(-maxScroll, Math.min(maxScroll, nextRot))
                setRotation(clamped)
                userInteractedTimeRef.current = now
            } else if (autoPlay && !isHoveredRef.current && now - userInteractedTimeRef.current > 2500) {
                accumulatedTime += dt
                const progress = (accumulatedTime % cycleDuration) / halfCycle
                const phase = progress <= 1 ? progress : 2 - progress
                const eased = easeInOutCubic(phase)
                const targetRot = (eased - 0.5) * (maxScroll * 1.5)
                // Suavizar transición hacia target (con epsilon para no renderizar a 60fps en reposo)
                const diff = targetRot - currentRotationRef.current
                if (Math.abs(diff) > 0.0004) {
                    setRotation(prev => prev + diff * 0.02)
                }
            }

            animId = requestAnimationFrame(tick)
        }

        animId = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(animId)
    }, [autoPlay, prefersReducedMotion, count, maxScroll])

    // Drag handlers
    const handlePointerDown = (e: React.PointerEvent) => {
        isDraggingRef.current = true
        startXRef.current = e.clientX
        startRotationRef.current = currentRotationRef.current
        lastXRef.current = e.clientX
        lastTimeRef.current = performance.now()
        velocityRef.current = 0
        containerRef.current?.setPointerCapture(e.pointerId)
    }

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDraggingRef.current) return
        const now = performance.now()
        const dx = e.clientX - startXRef.current
        const rotDelta = (dx / effRadius) * 1.2
        const nextRot = startRotationRef.current + rotDelta

        // Cálculo de velocidad instantánea
        const dt = Math.max(1, now - lastTimeRef.current)
        const frameDx = e.clientX - lastXRef.current
        velocityRef.current = (frameDx / effRadius / dt) * 16

        lastXRef.current = e.clientX
        lastTimeRef.current = now

        setRotation(Math.max(-maxScroll * 1.2, Math.min(maxScroll * 1.2, nextRot)))
    }

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isDraggingRef.current) return
        isDraggingRef.current = false
        try {
            containerRef.current?.releasePointerCapture(e.pointerId)
        } catch {
            // Silently ignore
        }
    }

    const handleStep = (direction: -1 | 1) => {
        const step = stepAngleRad * 1.5 * direction
        setRotation(prev => Math.max(-maxScroll, Math.min(maxScroll, prev + step)))
        userInteractedTimeRef.current = performance.now()
    }

    // Fallback plano para prefersReducedMotion
    if (prefersReducedMotion) {
        return (
            <div className={cn("w-full flex gap-4 overflow-x-auto p-4 no-scrollbar snap-x", className)}>
                {items.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelect?.(item)}
                        className="group snap-start shrink-0 relative aspect-[2/3] rounded-2xl overflow-hidden border border-white/10 hover:border-white/30 text-left transition-all cursor-pointer"
                        style={{ width: effCardWidth, height: effCardHeight }}
                    >
                        <img src={item.image} alt={item.title} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-3 flex flex-col justify-end">
                            {item.tag && <span className="text-3xs font-mono text-brand-accent uppercase font-bold">{item.tag}</span>}
                            <p className="text-xs font-bold text-white line-clamp-1">{item.title}</p>
                        </div>
                    </button>
                ))}
            </div>
        )
    }

    return (
        <section
            aria-label="Carrusel de arcos"
            className={cn("relative w-full overflow-hidden select-none py-10 flex flex-col items-center", className)}
            onMouseEnter={() => { isHoveredRef.current = true }}
            onMouseLeave={() => { isHoveredRef.current = false }}
        >
            {/* Controles flotantes */}
            <div className="absolute top-4 right-6 flex items-center gap-1.5 z-20">
                <button
                    type="button"
                    onClick={() => handleStep(1)}
                    aria-label="Desplazar a la izquierda"
                    className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white transition-colors cursor-pointer"
                >
                    <IconNavigationChevronLeft className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={() => handleStep(-1)}
                    aria-label="Desplazar a la derecha"
                    className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white transition-colors cursor-pointer"
                >
                    <IconNavigationChevronRight className="w-4 h-4" />
                </button>
            </div>

            {/* Stage del Arco Convexo */}
            <div
                ref={containerRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="relative w-full h-[320px] sm:h-[380px] cursor-grab active:cursor-grabbing touch-none flex items-center justify-center"
            >
                {items.map((item, idx) => {
                    const midIndex = (count - 1) / 2
                    const offsetIndex = idx - midIndex
                    const cardAngleRad = offsetIndex * stepAngleRad + rotation
                    const cardAngleDeg = (cardAngleRad * 180) / Math.PI

                    // Ocultar si está fuera del cono visible (+- 75 deg)
                    if (Math.abs(cardAngleDeg) > 75) return null

                    // Coordenadas en arco circular
                    const x = Math.sin(cardAngleRad) * effRadius
                    const y = (1 - Math.cos(cardAngleRad)) * (effRadius * 0.45)
                    const rotZ = cardAngleDeg * 0.8
                    const depthScale = Math.max(0.75, 1 - Math.abs(cardAngleRad) * 0.35)
                    const zIndex = Math.round((1 - Math.abs(cardAngleRad)) * 100)
                    const opacity = Math.max(0.2, 1 - Math.pow(Math.abs(cardAngleDeg) / 75, 2))

                    return (
                        <button
                            type="button"
                            key={item.id}
                            onClick={() => onSelect?.(item)}
                            style={{
                                width: effCardWidth,
                                height: effCardHeight,
                                transform: `translate3d(${x}px, ${y}px, 0px) rotateZ(${rotZ}deg) scale(${depthScale})`,
                                zIndex,
                                opacity,
                                willChange: "transform, opacity",
                            }}
                            className="text-left p-0 outline-none focus-visible:ring-2 focus-visible:ring-brand-accent absolute rounded-2xl overflow-hidden border border-white/15 bg-surface-container shadow-[shadow:0_16px_36px_-6px_rgba(0,0,0,0.85),var(--glass-highlight-md)] group cursor-pointer"
                        >
                            <img
                                src={item.image}
                                alt={item.title}
                                draggable={false}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover pointer-events-none group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent p-3 flex flex-col justify-end pointer-events-none">
                                {item.tag && (
                                    <span className="text-3xs font-mono text-brand-accent uppercase font-bold tracking-wider">
                                        {item.tag}
                                    </span>
                                )}
                                <p className="text-xs font-bold text-white line-clamp-1 group-hover:text-brand-accent transition-colors">
                                    {item.title}
                                </p>
                                {item.subtitle && (
                                    <p className="text-3xs text-on-surface-variant line-clamp-1">
                                        {item.subtitle}
                                    </p>
                                )}
                            </div>
                        </button>
                    )
                })}
            </div>
        </section>
    )
}
