import * as React from "react"
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
    // --duration-base (250 ms): el valor que antes tenía --duration-fast en CSS. Esa variable
    // ahora vale 150 ms, igual que la clase duration-fast de Tailwind.
    transition: "opacity var(--duration-base) var(--ease-smooth), visibility 0s linear var(--duration-base)",
}

const GLASS_MASK = "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)"
const GLASS_SURFACE: React.CSSProperties = {
    WebkitMaskImage: GLASS_MASK,
    maskImage: GLASS_MASK,
    background: "linear-gradient(to bottom, rgba(10, 10, 14, 0.75) 0%, rgba(10, 10, 14, 0.35) 60%, transparent 100%)",
}

function subscribeFlatMode(onStoreChange: () => void) {
    if (typeof MutationObserver === "undefined" || typeof document === "undefined") {
        return () => {}
    }
    const observer = new MutationObserver(onStoreChange)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-flat"] })
    return () => observer.disconnect()
}

const getFlatSnapshot = () =>
    typeof document !== "undefined" && document.documentElement.dataset.flat === "true"
const getFlatServerSnapshot = () => false

/**
 * Viñeta de desenfoque progresivo en el borde superior (estilo macOS / Linear).
 * - Genera una transición óptica gradual para que el contenido que sube por detrás de las barras
 *   de navegación flotantes se disuelva suavemente en lugar de cortarse de forma abrupta.
 * - Capa z-dropdown (100): se ubica por encima del contenido de página (z-10..z-30),
 *   pero por debajo de selectores sticky como EraRail (z-sticky: 200) y las islas (z-navbar: 500).
 * - Detección universal: escucha con captura pasiva a nivel window, detectando scroll tanto
 *   en #main-content (/home, /movies) como en contenedores internos (/series, /settings).
 * - Reactiva: permanece 100% oculta (opacity 0 + visibility hidden) cuando el usuario se encuentra al tope (scrollTop <= 8px),
 *   garantizando que afiches Hero y cabeceras brillen con nitidez absoluta.
 */
export function ScrollEdgeBlur() {
    const tier = useMotionTier()
    const scrollBlurEnabled = useUIStore((s) => s.scrollBlurEnabled)
    const blurDisabledInStore = useUIStore((s) => s.themeVisual?.themeEnableBlurringEffects === false)
    const isFlatAttr = React.useSyncExternalStore(subscribeFlatMode, getFlatSnapshot, getFlatServerSnapshot)
    const [scrolled, setScrolled] = React.useState(false)

    React.useEffect(() => {
        if (!scrollBlurEnabled || tier === "off") return
        let raf = 0

        // Chequeo inicial
        const checkInitial = () => {
            const scroller = document.querySelector<HTMLElement>('[data-scroll-container="true"]')
            setScrolled(!!scroller && scroller.scrollTop > 8)
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
            // Fast-path sin lecturas de layout cuando un contenedor secundario horizontal está en y=0.
            if (target.dataset.scrollContainer !== "true" && target.scrollTop === 0 && !lastTop.has(target)) return
            if (target.dataset.scrollContainer === "true" || pending === null || pending.dataset.scrollContainer !== "true") {
                pending = target
            }
            if (!raf) {
                raf = requestAnimationFrame(() => {
                    raf = 0
                    const current = pending
                    pending = null
                    if (!current) return
                    const top = current.scrollTop
                    const prev = lastTop.get(current) ?? 0
                    lastTop.set(current, top)
                    if (top === prev) return
                    // Listas internas chicas (menús, colas, popovers) no son el scroll de la página.
                    if (current.dataset.scrollContainer !== "true" && current.clientHeight < window.innerHeight * 0.5) return
                    setScrolled(top > 8)
                })
            }
        }

        window.addEventListener("scroll", onScroll, { capture: true, passive: true })
        return () => {
            window.removeEventListener("scroll", onScroll, { capture: true })
            if (raf) cancelAnimationFrame(raf)
        }
    }, [scrollBlurEnabled, tier])

    if (!scrollBlurEnabled || tier === "off") {
        return null
    }

    const isFlat = isFlatAttr || blurDisabledInStore
    const isSubtle = tier === "subtle" || isFlat
    const fadeStyle = scrolled ? FADE_IN : FADE_OUT

    return (
        <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-x-0 top-0 z-dropdown select-none h-20 md:h-24"
        >
            {isSubtle ? (
                /* Fallback de ultra-bajo consumo: degradado puro sin backdrop-filter */
                <div
                    className="absolute inset-0 bg-gradient-to-b from-[color-mix(in_srgb,var(--bg-primary)_80%,transparent)] via-[color-mix(in_srgb,var(--bg-primary)_30%,transparent)] to-transparent"
                    style={fadeStyle}
                />
            ) : (
                /* Superficie GPU optimizada con refracción y máscara continua */
                <div
                    className="absolute inset-0 backdrop-blur-overlay-xs"
                    style={{ ...GLASS_SURFACE, ...fadeStyle }}
                />
            )}
        </div>
    )
}
