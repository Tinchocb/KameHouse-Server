import * as React from "react"

export const HERO_ROTATION_MS = 8000

const DOT_WINDOW_DESKTOP = 7
const DOT_WINDOW_MOBILE = 5

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
    if (count <= 1) return null

    const desktopWindow = getDotWindow(activeIndex, count, DOT_WINDOW_DESKTOP)
    const mobileWindow = new Set(getDotWindow(activeIndex, count, DOT_WINDOW_MOBILE))
    const isWindowed = count > DOT_WINDOW_MOBILE
    const isPaused = paused || !documentActive

    return (
        <div
            role="group"
            aria-label="Indicadores del carrusel"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
                if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
                e.preventDefault()
                e.stopPropagation()
                const delta = e.key === "ArrowLeft" ? -1 : 1
                onSelect((activeIndex + delta + count) % count)
            }}
            className="flex items-center rounded-full bg-surface-container-lowest/60 border border-white/20 border-t-white/40 border-b-white/10 backdrop-blur-overlay-2xl px-2.5 py-0.5 ml-auto shrink-0 shadow-[shadow:var(--glass-highlight-lg),0_8px_20px_rgba(0,0,0,0.6)]"
        >
            {desktopWindow.map((i) => {
                const isCurrent = i === activeIndex
                const distance = Math.abs(i - activeIndex)
                return (
                    <button
                        key={i}
                        type="button"
                        onClick={() => onSelect(i)}
                        aria-label={getLabel(i)}
                        aria-current={isCurrent ? "true" : undefined}
                        className={[
                            "group flex min-w-6 min-h-8 px-0.5 items-center justify-center rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                            mobileWindow.has(i) ? "" : "max-sm:hidden",
                        ].join(" ")}
                    >
                        <span
                            aria-hidden
                            className={[
                                "block h-1.5 rounded-full overflow-hidden transition-[width,background-color,opacity,transform] duration-300",
                                isCurrent
                                    ? "w-7 bg-white/25 shadow-[0_0_8px_rgba(255,255,255,0.35)]"
                                    : "w-1.5 bg-white/40 group-hover:bg-white/75 group-active:scale-90",
                                isWindowed && !isCurrent && distance === 2 ? "opacity-60 scale-90" : "",
                                isWindowed && !isCurrent && distance >= 3 ? "opacity-40 scale-75" : "",
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
                    </button>
                )
            })}
        </div>
    )
}
