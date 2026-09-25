import * as React from "react"
import { AnimatePresence, m, type Transition } from "framer-motion"
import { useMotionTier } from "@/components/ui/kinetics"
import { SPRING_PILL } from "@/components/ui/core/motion"

export const HERO_ROTATION_MS = 8000

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
    if (total <= maxVisible) return Array.from({ length: total }, (_, i) => i)
    const half = Math.floor(maxVisible / 2)
    let start = active - half
    if (start < 0) start = 0
    if (start + maxVisible > total) start = total - maxVisible
    return Array.from({ length: maxVisible }, (_, k) => start + k)
}

/**
 * Dots de los extremos de la ventana que tienen más dots ocultos detrás:
 * se dibujan más chicos para insinuar que la lista continúa.
 */
export function getDotEdges(window: number[], total: number): Set<number> {
    const edges = new Set<number>()
    if (window.length === 0) return edges
    const first = window[0]
    const last = window[window.length - 1]
    if (first > 0) edges.add(first)
    if (last < total - 1) edges.add(last)
    return edges
}

/** true mientras la pestaña está visible y la ventana tiene foco. */
function useDocumentActive(): boolean {
    const read = () =>
        typeof document === "undefined" ||
        (document.visibilityState !== "hidden" && (!document.hasFocus || document.hasFocus()))
    const [active, setActive] = React.useState(read)
    React.useEffect(() => {
        const update = () => setActive(read())
        document.addEventListener("visibilitychange", update)
        window.addEventListener("focus", update)
        window.addEventListener("blur", update)
        return () => {
            document.removeEventListener("visibilitychange", update)
            window.removeEventListener("focus", update)
            window.removeEventListener("blur", update)
        }
    }, [])
    return active
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
}

/**
 * Dots del carrusel del hero (Inicio y Películas). La barra del dot activo es
 * la fuente de verdad del tiempo de rotación: pausarla pausa la rotación y el
 * cambio ocurre exactamente cuando se llena.
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
}: HeroCarouselDotsProps) {
    const documentActive = useDocumentActive()
    const motionTier = useMotionTier()
    const isFullMotion = motionTier === "full"
    const dotTransition = isFullMotion ? SPRING_PILL : motionTier === "subtle" ? DOT_SUBTLE : DOT_REDUCED
    const buttonRefs = React.useRef(new Map<number, HTMLButtonElement>())
    const focusActiveRef = React.useRef(false)
    // Con el foco en los dots la rotación se detiene: quien navega con
    // teclado no debería ver cambiar el slide bajo sus pies (WCAG 2.2.2).
    const [hasFocusWithin, setHasFocusWithin] = React.useState(false)

    // Con teclado el foco sigue al dot activo (roving tabindex): el botón
    // nuevo recién existe tras el render, por eso se enfoca en un efecto.
    React.useEffect(() => {
        if (!focusActiveRef.current) return
        focusActiveRef.current = false
        buttonRefs.current.get(activeIndex)?.focus()
    }, [activeIndex])

    if (count <= 1) return null

    const desktopWindow = getDotWindow(activeIndex, count, DOT_WINDOW_DESKTOP)
    const mobileWindowList = getDotWindow(activeIndex, count, DOT_WINDOW_MOBILE)
    const mobileWindow = new Set(mobileWindowList)
    const desktopEdges = getDotEdges(desktopWindow, count)
    const mobileEdges = getDotEdges(mobileWindowList, count)
    const isPaused = paused || !documentActive || hasFocusWithin

    const selectFromKeyboard = (index: number) => {
        if (index === activeIndex) return
        focusActiveRef.current = true
        onSelect(index)
    }

    return (
        <div
            role="group"
            aria-label="Indicadores del carrusel"
            onClick={(e) => e.stopPropagation()}
            onFocus={(e) => {
                if (e.target.matches(":focus-visible")) setHasFocusWithin(true)
            }}
            onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHasFocusWithin(false)
            }}
            onKeyDown={(e) => {
                let next: number
                if (e.key === "ArrowLeft") next = (activeIndex - 1 + count) % count
                else if (e.key === "ArrowRight") next = (activeIndex + 1) % count
                else if (e.key === "Home") next = 0
                else if (e.key === "End") next = count - 1
                else return
                e.preventDefault()
                e.stopPropagation()
                selectFromKeyboard(next)
            }}
            className="flex items-center rounded-full bg-surface-container-lowest/60 border border-white/20 border-t-white/40 border-b-white/10 backdrop-blur-overlay-2xl px-2.5 py-0.5 ml-auto shrink-0 shadow-[shadow:var(--glass-highlight-lg),0_8px_20px_rgba(0,0,0,0.6)]"
        >
            {/* popLayout: al deslizarse la ventana los dots entran/salen escalando
                y los que quedan se reacomodan con layout en vez de saltar. */}
            <AnimatePresence initial={false} mode="popLayout">
            {desktopWindow.map((i) => {
                const isCurrent = i === activeIndex
                return (
                    <m.button
                        key={i}
                        layout={isFullMotion ? "position" : false}
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
                        aria-label={getLabel(i)}
                        aria-current={isCurrent ? "true" : undefined}
                        className={[
                            "group flex min-w-6 min-h-8 px-0.5 items-center justify-center rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                            mobileWindow.has(i) ? "" : "max-sm:hidden",
                        ].join(" ")}
                    >
                        {/* Wrapper del encogido de borde: separado del scale de :active */}
                        <span
                            aria-hidden
                            className={[
                                "flex items-center transition-[opacity,transform] duration-base ease-smooth-out",
                                mobileEdges.has(i) ? "max-sm:opacity-50 max-sm:scale-[0.6]" : "",
                                desktopEdges.has(i) ? "sm:opacity-50 sm:scale-[0.6]" : "",
                            ].join(" ")}
                        >
                            {/* Ancho por transición CSS: la guía (§9) prohíbe animar width por JS. */}
                            <span
                                className={[
                                    "block h-1.5 rounded-full overflow-hidden transition-[width,background-color,box-shadow,transform] duration-base ease-smooth-out",
                                    isCurrent
                                        ? "w-7 bg-white/25 shadow-hero-dot"
                                        : "w-1.5 bg-white/45 group-hover:bg-white/85 group-hover:scale-125 group-active:scale-90",
                                ].join(" ")}
                            >
                                {isCurrent && showProgress && (
                                    <span
                                        key={activeIndex}
                                        className="block h-full w-full rounded-full bg-white animate-hero-progress"
                                        style={{
                                            animationDuration: `${durationMs}ms`,
                                            animationPlayState: isPaused ? "paused" : "running",
                                        }}
                                        onAnimationEnd={(e) => {
                                            if (e.target === e.currentTarget) onCycleComplete?.()
                                        }}
                                    />
                                )}
                                {isCurrent && !showProgress && (
                                    <span className="block h-full w-full rounded-full bg-white/80" />
                                )}
                            </span>
                        </span>
                    </m.button>
                )
            })}
            </AnimatePresence>
        </div>
    )
}
