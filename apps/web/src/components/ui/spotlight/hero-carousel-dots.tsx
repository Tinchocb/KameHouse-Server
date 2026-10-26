import * as React from "react"
import { AnimatePresence, m, type Transition } from "framer-motion"
import { IconMediaPause, IconMediaPlay } from "@/components/ui/icons"
import { IconSwap, useMotionTier, useSpringPreset } from "@/components/ui/kinetics"

export const HERO_ROTATION_MS = 5000

const DOT_WINDOW_DESKTOP = 7
const DOT_WINDOW_MOBILE = 5

const DOT_SUBTLE: Transition = { duration: 0.2, ease: [0.22, 1, 0.36, 1] }
// Guía §12.3: con reduced-motion, tween corto en vez de spring.
const DOT_REDUCED: Transition = { type: "tween", duration: 0.15 }

/**
 * Ventana deslizante de dots: como máximo `maxVisible` índices contiguos
 * centrados en el activo (clamp en bordes).
 */
export function getDotWindow(active: number, total: number, maxVisible: number = DOT_WINDOW_DESKTOP): number[] {
    if (total <= 0 || maxVisible <= 0) return []
    if (total <= maxVisible) return Array.from({ length: total }, (_, i) => i)
    const half = Math.floor(maxVisible / 2)
    const maxStart = total - maxVisible
    const start = Math.min(Math.max(active - half, 0), maxStart)
    return Array.from({ length: maxVisible }, (_, k) => start + k)
}

/**
 * Dots de los extremos de la ventana que tienen más dots ocultos detrás:
 * se dibujan más chicos para insinuar que la lista continúa.
 */
export function getDotEdges(window: number[], total: number): Set<number> {
    const edges = new Set<number>()
    if (window.length === 0 || total <= 0) return edges
    const first = window[0]
    const last = window[window.length - 1]
    if (first > 0) edges.add(first)
    if (last < total - 1) edges.add(last)
    return edges
}

/**
 * Segundo escalón progresivo hacia el interior de los bordes cuando hay más
 * ítems ocultos detrás (curva de 2 niveles estilo Apple TV+ / iOS).
 */
export function getDotInnerEdges(window: number[], total: number): Set<number> {
    const inner = new Set<number>()
    if (window.length < 4 || total <= 0) return inner
    const first = window[0]
    const last = window[window.length - 1]
    if (first > 0) inner.add(window[1])
    if (last < total - 1) inner.add(window[window.length - 2])
    return inner
}

function subscribeDocumentActive(callback: () => void): () => void {
    if (typeof document === "undefined") return () => {}
    document.addEventListener("visibilitychange", callback)
    window.addEventListener("focus", callback)
    window.addEventListener("blur", callback)
    return () => {
        document.removeEventListener("visibilitychange", callback)
        window.removeEventListener("focus", callback)
        window.removeEventListener("blur", callback)
    }
}

function getDocumentActiveSnapshot(): boolean {
    if (typeof document === "undefined") return true
    return document.visibilityState !== "hidden" && (document.hasFocus?.() ?? true)
}

/** true mientras la pestaña está visible y la ventana tiene foco. */
function useDocumentActive(): boolean {
    return React.useSyncExternalStore(
        subscribeDocumentActive,
        getDocumentActiveSnapshot,
        () => true
    )
}

interface HeroCarouselDotsProps {
    count: number
    activeIndex: number
    onSelect: (index: number) => void
    getLabel: (index: number) => string
    /** Congela la barra de progreso (hover, preview, etc.). */
    paused?: boolean
    /** Barra de progreso animada; si es false se muestra un relleno estático. */
    showProgress?: boolean
    /** Se dispara al completarse la barra: el padre avanza el carrusel aquí. */
    onCycleComplete?: () => void
    durationMs?: number
    /** Color de acento del slide actual (ej. colors?.accent en Inicio). */
    accentColor?: string
    /** Color de acento por índice para el Peek Label y el hover de cada dot. */
    getAccentColor?: (index: number) => string | undefined
    /** Título corto para mostrar en el Peek Label flotante al hacer hover sobre un dot. */
    getPeekTitle?: (index: number) => string | undefined
}

/**
 * Controlador estilo Apple Dynamic Island para el carrusel del hero (Inicio y Películas).
 * Integra botón Play/Pause, Peek Label flotante en hover, magnificación tipo Dock,
 * ola sinusoidal en los puntos vecinos y barra de progreso de 5s teñida con el color de la era.
 */
export function HeroCarouselDots({
    count,
    activeIndex,
    onSelect,
    getLabel,
    paused = false,
    showProgress = true,
    onCycleComplete,
    durationMs = HERO_ROTATION_MS,
    accentColor,
    getAccentColor,
    getPeekTitle,
}: HeroCarouselDotsProps) {
    const documentActive = useDocumentActive()
    const motionTier = useMotionTier()
    const tabIndicatorSpring = useSpringPreset("tabIndicator")
    const entranceSpring = useSpringPreset("entrance")
    const isFullMotion = motionTier === "full"
    const dotTransition = isFullMotion ? tabIndicatorSpring : motionTier === "subtle" ? DOT_SUBTLE : DOT_REDUCED
    const buttonRefs = React.useRef(new Map<number, HTMLButtonElement>())
    const focusActiveRef = React.useRef(false)
    // Con el foco en los dots la rotación se detiene: quien navega con
    // teclado no debería ver cambiar el slide bajo sus pies (WCAG 2.2.2).
    const [hasFocusWithin, setHasFocusWithin] = React.useState(false)
    const [isManualPaused, setIsManualPaused] = React.useState(false)
    const [isPillHovered, setIsPillHovered] = React.useState(false)
    const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null)

    // Protege contra índices inválidos que puedan llegar desde el padre
    const safeActiveIndex = count > 0 ? Math.min(Math.max(activeIndex, 0), count - 1) : 0

    // Evita disparar el anillo/ola en el primer render de montaje; solo al cambiar de slide.
    const prevActiveRef = React.useRef(safeActiveIndex)
    const [waveKey, setWaveKey] = React.useState(0)
    React.useEffect(() => {
        if (prevActiveRef.current !== safeActiveIndex) {
            prevActiveRef.current = safeActiveIndex
            setWaveKey((k) => k + 1)
        }
    }, [safeActiveIndex])

    // Con teclado el foco sigue al dot activo (roving tabindex): el botón
    // nuevo recién existe tras el render, por eso se enfoca en un efecto.
    React.useEffect(() => {
        if (!focusActiveRef.current) return
        focusActiveRef.current = false
        buttonRefs.current.get(safeActiveIndex)?.focus()
    }, [safeActiveIndex])

    if (count <= 1) return null

    const desktopWindow = getDotWindow(safeActiveIndex, count, DOT_WINDOW_DESKTOP)
    const mobileWindowList = getDotWindow(safeActiveIndex, count, DOT_WINDOW_MOBILE)
    const mobileWindow = new Set(mobileWindowList)
    const desktopEdges = getDotEdges(desktopWindow, count)
    const mobileEdges = getDotEdges(mobileWindowList, count)
    const desktopInnerEdges = getDotInnerEdges(desktopWindow, count)
    const mobileInnerEdges = getDotInnerEdges(mobileWindowList, count)

    const isPaused = paused || isManualPaused || isPillHovered || !documentActive || hasFocusWithin
    const activeAccent = accentColor ?? getAccentColor?.(safeActiveIndex) ?? "var(--brand-accent-hex)"
    const peekTitle = hoveredIndex !== null ? getPeekTitle?.(hoveredIndex) : undefined
    const peekAccent =
        hoveredIndex !== null
            ? (getAccentColor?.(hoveredIndex) ?? accentColor ?? "var(--brand-accent-hex)")
            : activeAccent

    // Solo usar layout="position" cuando la ventana deslizante realmente desplaza índices
    const shouldAnimateWindowLayout = isFullMotion && count > DOT_WINDOW_DESKTOP

    const selectFromKeyboard = (index: number) => {
        if (index === safeActiveIndex) return
        focusActiveRef.current = true
        onSelect(index)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).dataset.carouselControl === "play-pause") return
        let next: number
        if (e.key === "ArrowLeft") next = (safeActiveIndex - 1 + count) % count
        else if (e.key === "ArrowRight") next = (safeActiveIndex + 1) % count
        else if (e.key === "Home") next = 0
        else if (e.key === "End") next = count - 1
        else return
        e.preventDefault()
        e.stopPropagation()
        selectFromKeyboard(next)
    }

    return (
        <div
            role="group"
            aria-label="Indicadores del carrusel"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
            onMouseEnter={() => setIsPillHovered(true)}
            onMouseLeave={() => {
                setIsPillHovered(false)
                setHoveredIndex(null)
            }}
            onFocus={(e) => {
                // Solo pausar si el foco proviene de navegación por teclado para evitar
                // clavar la rotación al hacer click con el mouse (WCAG 2.2.2).
                if (e.target.matches(":focus-visible")) setHasFocusWithin(true)
            }}
            onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHasFocusWithin(false)
            }}
            style={{ "--dot-accent": activeAccent } as React.CSSProperties}
            className="glass-frosted-pill relative flex items-center gap-1 px-2.5 py-1 ml-auto shrink-0"
        >
            {/* Peek Label flotante estilo Apple Dynamic Island al hacer hover en puntero fino */}
            <AnimatePresence>
                {peekTitle && (
                    <m.div
                        key="island-peek"
                        initial={isFullMotion ? { opacity: 0, y: 5, scale: 0.92 } : { opacity: 0 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={isFullMotion ? { opacity: 0, y: 4, scale: 0.95 } : { opacity: 0 }}
                        transition={entranceSpring}
                        style={{
                            borderColor: `color-mix(in srgb, ${peekAccent} 40%, rgba(255, 255, 255, 0.16))`,
                        }}
                        className="pointer-events-none absolute bottom-full right-0 mb-2 hidden [@media(hover:hover)_and_(pointer:fine)]:flex items-center gap-1.5 rounded-full bg-black/80 px-2.5 py-1 text-2xs font-semibold text-on-surface shadow-elevation-2 border whitespace-nowrap z-hero-controls"
                    >
                        <span
                            aria-hidden
                            className="h-1.5 w-1.5 rounded-full shrink-0"
                            style={{
                                backgroundColor: peekAccent,
                                boxShadow: `0 0 8px ${peekAccent}`,
                            }}
                        />
                        <span className="max-w-48 truncate">{peekTitle}</span>
                    </m.div>
                )}
            </AnimatePresence>

            {/* Botón Play / Pause integrado en la isla */}
            <button
                type="button"
                data-carousel-control="play-pause"
                onClick={() => setIsManualPaused((prev) => !prev)}
                aria-label={isManualPaused ? "Reanudar rotación automática" : "Pausar rotación automática"}
                aria-pressed={isManualPaused}
                style={
                    isManualPaused
                        ? {
                              color: activeAccent,
                              backgroundColor: `color-mix(in srgb, ${activeAccent} 22%, rgba(255, 255, 255, 0.08))`,
                          }
                        : undefined
                }
                className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white/90 hover:text-white transition-colors duration-base cursor-pointer shrink-0"
            >
                <IconSwap swapKey={isManualPaused ? "play" : "pause"}>
                    {isManualPaused ? (
                        <IconMediaPlay className="h-2.5 w-2.5 fill-current translate-x-px" aria-hidden="true" />
                    ) : (
                        <IconMediaPause className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
                    )}
                </IconSwap>
            </button>

            <span aria-hidden="true" className="h-3 w-px bg-white/15 mx-0.5 shrink-0" />

            {/* Pista de puntos con roving tabindex */}
            <div className="relative flex items-center">
                {/* popLayout: al deslizarse la ventana los dots entran/salen escalando
                    y los que quedan se reacomodan con layout en vez de saltar. */}
                <AnimatePresence initial={false} mode="popLayout">
                    {desktopWindow.map((i) => {
                        const isCurrent = i === safeActiveIndex
                        const isHovered = hoveredIndex === i
                        const isNeighborHovered = hoveredIndex !== null && Math.abs(hoveredIndex - i) === 1
                        const dotAccent = getAccentColor?.(i) ?? activeAccent
                        const waveDelayMs = Math.abs(i - safeActiveIndex) * 38

                        return (
                            <m.button
                                key={i}
                                layout={shouldAnimateWindowLayout ? "position" : false}
                                initial={isFullMotion ? { opacity: 0, scale: 0.4 } : false}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={isFullMotion ? { opacity: 0, scale: 0.4 } : { opacity: 0 }}
                                transition={dotTransition}
                                ref={(el) => {
                                    if (el) buttonRefs.current.set(i, el)
                                    else buttonRefs.current.delete(i)
                                }}
                                type="button"
                                tabIndex={isCurrent ? 0 : -1}
                                onClick={() => onSelect(i)}
                                onMouseEnter={() => setHoveredIndex(i)}
                                onMouseLeave={() => setHoveredIndex((prev) => (prev === i ? null : prev))}
                                aria-label={getLabel(i)}
                                aria-current={isCurrent ? "true" : undefined}
                                className={[
                                    "group relative flex min-h-11 min-w-11 px-1 items-center justify-center rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                                    // Área real de 44×44: no se superpone al indicador vecino.
                                    mobileWindow.has(i) ? "" : "max-sm:hidden",
                                ].join(" ")}
                            >
                                {/* Anillo expansivo de aterrizaje con el color de la era */}
                                {isCurrent && isFullMotion && waveKey > 0 && (
                                    <span
                                        key={`ring-${waveKey}`}
                                        aria-hidden="true"
                                        style={{ borderColor: activeAccent }}
                                        className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-5 rounded-full border animate-dot-ring"
                                    />
                                )}

                                {/* Wrapper del encogido progresivo en bordes (2 niveles) + ola sinusoidal en vecinos */}
                                <span
                                    key={!isCurrent && isFullMotion && waveKey > 0 ? `wave-${i}-${waveKey}` : `static-${i}`}
                                    aria-hidden
                                    style={
                                        !isCurrent && isFullMotion && waveKey > 0
                                            ? ({ "--dot-wave-delay": `${waveDelayMs}ms` } as React.CSSProperties)
                                            : undefined
                                    }
                                    className={[
                                        "flex items-center transition-[opacity,transform] duration-base ease-smooth-out",
                                        !isCurrent && isFullMotion && waveKey > 0 ? "animate-dot-wave" : "",
                                        mobileEdges.has(i)
                                            ? "max-sm:opacity-45 max-sm:scale-[0.52]"
                                            : mobileInnerEdges.has(i)
                                              ? "max-sm:opacity-75 max-sm:scale-[0.78]"
                                              : "",
                                        desktopEdges.has(i)
                                            ? "sm:opacity-45 sm:scale-[0.52]"
                                            : desktopInnerEdges.has(i)
                                              ? "sm:opacity-75 sm:scale-[0.78]"
                                              : "",
                                    ].join(" ")}
                                >
                                    {/* Cápsula / punto con curva spring, magnificación Dock en hover y color de era */}
                                    <span
                                        style={
                                            isCurrent
                                                ? {
                                                      backgroundColor: `color-mix(in srgb, var(--dot-accent) 32%, rgba(255, 255, 255, 0.16))`,
                                                      boxShadow: `0 0 12px color-mix(in srgb, var(--dot-accent) 65%, transparent)`,
                                                  }
                                                : isHovered
                                                  ? {
                                                        backgroundColor: dotAccent,
                                                        boxShadow: `0 0 8px color-mix(in srgb, ${dotAccent} 60%, transparent)`,
                                                    }
                                                  : undefined
                                        }
                                        className={[
                                            "block rounded-full overflow-hidden transition-[width,height,background-color,box-shadow,transform] duration-medium ease-bounce-spring",
                                            isCurrent
                                                ? [
                                                      "w-8 bg-white/25 shadow-hero-dot",
                                                      isPaused ? "h-2" : "h-1.5",
                                                      isFullMotion && waveKey > 0 ? "animate-dot-jelly" : "",
                                                  ].join(" ")
                                                : isHovered
                                                  ? "w-3 h-2 -translate-y-0.5 bg-white/90"
                                                  : isNeighborHovered
                                                    ? "w-2 h-2 -translate-y-px bg-white/70"
                                                    : "w-1.5 h-1.5 bg-white/45 group-active:scale-95",
                                        ].join(" ")}
                                    >
                                        {isCurrent && showProgress && (
                                            <span
                                                key={safeActiveIndex}
                                                className="block h-full w-full rounded-full animate-hero-progress"
                                                style={{
                                                    background: "linear-gradient(90deg, var(--dot-accent) 0%, var(--label-1) 100%)",
                                                    animationDuration: `${Math.max(durationMs, 0)}ms`,
                                                    animationPlayState: isPaused ? "paused" : "running",
                                                }}
                                                onAnimationEnd={(e) => {
                                                    if (e.target === e.currentTarget) onCycleComplete?.()
                                                }}
                                            />
                                        )}
                                        {isCurrent && !showProgress && (
                                            <span
                                                className="block h-full w-full rounded-full"
                                                style={{
                                                    background: "linear-gradient(90deg, var(--dot-accent) 0%, var(--label-1) 100%)",
                                                }}
                                            />
                                        )}
                                    </span>
                                </span>
                            </m.button>
                        )
                    })}
                </AnimatePresence>
            </div>
        </div>
    )
}
