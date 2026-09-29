import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { useMotionTier } from "./motion-tier"
import { useUIStore } from "@/lib/stores/ui-store"

/*
 * Fundido de la viñeta. Va en la misma capa que el backdrop-filter, nunca en el
 * contenedor: un ancestro con opacity < 1 pasa a ser el "backdrop root" y el
 * desenfoque no ve nada detrás (la viñeta aparecía vacía y el blur entraba de golpe).
 *
 * Entrada lenta con arranque suave (ease): el desenfoque se funde sin salto.
 * Salida más corta: al volver arriba el hero recupera la nitidez enseguida.
 * `visibility` cambia al final de la salida: en reposo la capa no se pinta ni se
 * compone, así el backdrop-filter no cuesta GPU mientras no se ve.
 * Solo se anima opacity, que corre en el compositor sin tocar layout ni paint.
 */
const FADE_IN: React.CSSProperties = {
    opacity: 1,
    visibility: "visible",
    transition: "opacity var(--duration-slow) var(--ease-smooth), visibility 0s",
}
const FADE_OUT: React.CSSProperties = {
    opacity: 0,
    visibility: "hidden",
    transition: "opacity var(--duration-fast) var(--ease-smooth), visibility 0s linear var(--duration-fast)",
}

const GLASS_MASK = "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)"
const GLASS_SURFACE: React.CSSProperties = {
    WebkitMaskImage: GLASS_MASK,
    maskImage: GLASS_MASK,
    background: "linear-gradient(to bottom, rgba(10, 10, 14, 0.75) 0%, rgba(10, 10, 14, 0.35) 60%, transparent 100%)",
}

interface ScrollEdgeBlurProps {
    /** Contenedor de scroll personalizado; por defecto busca el elemento activo en scroll. */
    container?: HTMLElement | null
    /** Clases CSS adicionales. */
    className?: string
    /** Altura de la viñeta superior en Tailwind (default: "h-24 md:h-28"). */
    heightClass?: string
}

/**
 * Viñeta de desenfoque progresivo en el borde superior (estilo macOS / Linear).
 * - Genera una transición óptica gradual para que el contenido que sube por detrás de las barras
 *   de navegación flotantes se disuelva suavemente en lugar de cortarse de forma abrupta.
 * - Z-Index 450: se ubica por encima de todo el contenido de página (z-20, z-30, z-sticky),
 *   pero estrictamente por debajo de las islas de navegación (z-navbar: 500).
 * - Detección universal: escucha con captura pasiva a nivel window, detectando scroll tanto
 *   en #main-content (/home, /movies) como en contenedores internos (/series, /settings).
 * - Reactiva: permanece 100% oculta (opacity 0 + visibility hidden) cuando el usuario se encuentra al tope (scrollTop <= 8px),
 *   garantizando que afiches Hero y cabeceras brillen con nitidez absoluta.
 */
export function ScrollEdgeBlur({
    container,
    className,
    heightClass = "h-24 md:h-28",
}: ScrollEdgeBlurProps) {
    const tier = useMotionTier()
    const scrollBlurEnabled = useUIStore((s) => s.scrollBlurEnabled)
    const [scrolled, setScrolled] = React.useState(false)

    React.useEffect(() => {
        let raf = 0

        // Chequeo inicial
        const checkInitial = () => {
            const scroller = container ?? document.querySelector<HTMLElement>('[data-scroll-container="true"]')
            if (scroller && scroller.scrollTop > 8) {
                setScrolled(true)
            }
        }
        checkInitial()

        // Último scrollTop visto por elemento: permite descartar scrolls que no son
        // verticales. Sin esto, mover un carrusel horizontal (scrollTop 0) ocultaba la
        // viñeta y el siguiente scroll vertical de la página la volvía a mostrar.
        const lastTop = new WeakMap<Element, number>()
        let pending: HTMLElement | null = null

        const onScroll = (e: Event) => {
            const target = e.target
            if (!(target instanceof HTMLElement)) return
            if (container && target !== container) return
            const top = target.scrollTop
            const prev = lastTop.get(target) ?? 0
            lastTop.set(target, top)
            if (top === prev) return
            // Listas internas chicas (menús, colas, popovers) no son el scroll de la página.
            if (!container && target.clientHeight < window.innerHeight * 0.5) return
            pending = target
            if (!raf) {
                raf = requestAnimationFrame(() => {
                    raf = 0
                    if (pending) setScrolled(pending.scrollTop > 8)
                })
            }
        }

        window.addEventListener("scroll", onScroll, { capture: true, passive: true })
        return () => {
            window.removeEventListener("scroll", onScroll, { capture: true })
            if (raf) cancelAnimationFrame(raf)
        }
    }, [container])

    if (!scrollBlurEnabled || tier === "off") {
        return null
    }

    const isFlat = typeof document !== "undefined" && document.documentElement.dataset.flat === "true"
    const isSubtle = tier === "subtle" || isFlat
    const fadeStyle = scrolled ? FADE_IN : FADE_OUT

    return (
        <div
            aria-hidden="true"
            className={cn(
                "pointer-events-none fixed inset-x-0 top-0 z-[450] select-none",
                heightClass,
                className,
            )}
        >
            {isSubtle ? (
                /* Fallback de ultra-bajo consumo: degradado puro sin backdrop-filter */
                <div
                    className="absolute inset-0 bg-gradient-to-b from-[var(--bg-primary)]/80 via-[var(--bg-primary)]/30 to-transparent"
                    style={fadeStyle}
                />
            ) : (
                /* Superficie GPU optimizada con refracción y máscara continua */
                <div
                    className="absolute inset-0 backdrop-blur-[20px] backdrop-saturate-[180%]"
                    style={{ ...GLASS_SURFACE, ...fadeStyle }}
                />
            )}
        </div>
    )
}
