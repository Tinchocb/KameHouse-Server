import * as React from "react"
import { AnimatePresence, m, type Transition } from "framer-motion"
import { useMotionTier, useSpringPreset } from "@/components/ui/kinetics"

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
    /** Color de acento del slide actual (ej. colors?.accent en Inicio). */
    accentColor?: string
    /** Color de acento por índice para el hover de cada dot. */
    getAccentColor?: (index: number) => string | undefined
    /** Título corto para accesibilidad / tooltip al hacer hover sobre un dot. */
    getPeekTitle?: (index: number) => string | undefined
}

/**
 * Indicador de puntos puros flotantes (Opción 2):
 * Cero marcos o cajas exteriores. Puntos y botón flotan directamente sobre la viñeta
 * del hero con sombra perimetral de alto contraste, roving tabindex y progreso fluido.
 */
export function HeroCarouselDots({
    count,
    activeIndex,
    onSelect,
    getLabel,
    paused = false,
    showProgress = true,
    onCycleComplete,
    accentColor,
    getAccentColor,
    getPeekTitle,
}: HeroCarouselDotsProps) {
    const documentActive = useDocumentActive()
    const motionTier = useMotionTier()
    const tabIndicatorSpring = useSpringPreset("tabIndicator")
    const isFullMotion = motionTier === "full"
    const dotTransition = isFullMotion ? tabIndicatorSpring : motionTier === "subtle" ? DOT_SUBTLE : DOT_REDUCED
    const buttonRefs = React.useRef(new Map<number, HTMLButtonElement>())
    const focusActiveRef = React.useRef(false)
    // Con el foco en los dots la rotación se detiene: quien navega con
    // teclado no debería ver cambiar el slide bajo sus pies (WCAG 2.2.2).
    const [hasFocusWithin, setHasFocusWithin] = React.useState(false)
    const [isPillHovered, setIsPillHovered] = React.useState(false)

    // Protege contra índices inválidos que puedan llegar desde el padre
    const safeActiveIndex = count > 0 ? Math.min(Math.max(activeIndex, 0), count - 1) : 0

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

    const isPaused = paused || isPillHovered || !documentActive || hasFocusWithin
    const activeAccent = accentColor ?? getAccentColor?.(safeActiveIndex) ?? "var(--brand-accent-hex)"

    // Solo usar layout="position" cuando la ventana deslizante realmente desplaza índices
    const shouldAnimateWindowLayout = isFullMotion && count > DOT_WINDOW_DESKTOP

    const selectFromKeyboard = (index: number) => {
        if (index === safeActiveIndex) return
        focusActiveRef.current = true
        onSelect(index)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
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
            onMouseLeave={() => setIsPillHovered(false)}
            onFocus={(e) => {
                // Solo pausar si el foco proviene de navegación por teclado para evitar
                // clavar la rotación al hacer click con el mouse (WCAG 2.2.2).
                if (e.target.matches(":focus-visible")) setHasFocusWithin(true)
            }}
            onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHasFocusWithin(false)
            }}
            style={{ "--dot-accent": activeAccent } as React.CSSProperties}
            className="relative flex items-center gap-1.5 ml-auto shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]"
        >
            {/* Pista de puntos puros flotantes */}
            <div className="relative flex items-center gap-1.5">
                <AnimatePresence initial={false} mode="popLayout">
                    {desktopWindow.map((i) => {
                        const isCurrent = i === safeActiveIndex
                        const isEdge = desktopEdges.has(i)

                        return (
                            <m.button
                                key={i}
                                layout={shouldAnimateWindowLayout ? "position" : false}
                                initial={isFullMotion ? { opacity: 0, scale: 0.9 } : false}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={isFullMotion ? { opacity: 0, scale: 0.96, transition: { duration: 0.15, ease: "easeOut" } } : { opacity: 0 }}
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
                                title={getPeekTitle?.(i) ?? getLabel(i)}
                                className={[
                                    "touch-target-auto relative flex h-6 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:min-w-[32px] items-center justify-center px-1 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50 rounded-full after:absolute after:inset-x-0 after:-inset-y-2.5 after:content-[''] transition-transform duration-fast motion-safe:active:scale-[0.97]",
                                    mobileWindow.has(i) ? "" : "max-sm:hidden",
                                ].join(" ")}
                            >
                                <span
                                    aria-hidden="true"
                                    className={[
                                        "block h-1.5 rounded-full transition-[width,transform,background-color] duration-base ease-smooth-out motion-reduce:transition-none",
                                        isCurrent
                                            ? "w-7 bg-white/20 overflow-hidden"
                                            : isEdge
                                              ? "w-1.5 bg-white/25 scale-75"
                                              : "w-1.5 bg-white/40 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/80",
                                    ].join(" ")}
                                >
                                    {isCurrent && showProgress && (
                                        <span
                                            key={safeActiveIndex}
                                            className="block h-full w-full rounded-full animate-hero-progress"
                                            style={{
                                                background: "linear-gradient(90deg, var(--dot-accent) 0%, var(--label-1) 100%)",
                                                animationDuration: `${HERO_ROTATION_MS}ms`,
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
                            </m.button>
                        )
                    })}
                </AnimatePresence>
            </div>
        </div>
    )
}
