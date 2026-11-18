import type { Variants } from "framer-motion"

// ─── Hero Variants ─────────────────────────────────────────────────────────────
/**
 * Transición de entrada direccional para backdrops de Hero (carrusel con rotación direccional).
 * Fundido "por encima": la entrante va arriba con ligero desplazamiento x; la saliente se queda
 * opaca debajo hasta que la nueva entra (evita parpadeo oscuro sobre el fondo negro).
 */
export const heroBackdropSlideVariants: Variants = {
    initial: (direction: number = 1) => ({
        opacity: 0,
        x: direction >= 0 ? 12 : -12,
        scale: 1.005,
        zIndex: 1,
    }),
    animate: {
        opacity: 1,
        x: 0,
        scale: 1,
        zIndex: 1,
        transition: {
            duration: 0.5,
            ease: "easeInOut",
        },
    },
    exit: (direction: number = 1) => ({
        opacity: 0,
        x: direction >= 0 ? -12 : 12,
        scale: 1,
        zIndex: 0,
        transition: {
            x: { duration: 0.5, ease: "easeInOut" },
            opacity: { delay: 0.5, duration: 0.05 },
        },
    }),
}

/**
 * Transición de fundido cinematográfico para backdrops estáticos o sin dirección fija (ej. Películas).
 */
export const heroBackdropFadeVariants: Variants = {
    initial: { opacity: 0, scale: 1.01, zIndex: 1 },
    animate: { opacity: 1, scale: 1, zIndex: 1, transition: { duration: 0.5, ease: "easeInOut" } },
    exit: { opacity: 0, zIndex: 0, transition: { opacity: { delay: 0.5, duration: 0.05 } } },
}

/** Ahorro de energía: conserva continuidad de imagen sin desplazamiento ni zoom. */
export const heroBackdropSubtleVariants: Variants = {
    initial: { opacity: 0, zIndex: 1 },
    animate: { opacity: 1, zIndex: 1, transition: { duration: 0.35, ease: "easeInOut" } },
    exit: { opacity: 0, zIndex: 0, transition: { opacity: { delay: 0.35, duration: 0.05 } } },
}

/**
 * Contenedor orquestador del contenido de los heroes (SpotlightHero, MoviesHero, SeriesHero).
 * Aplica stagger canónico de 40ms (--duration-stagger) entre los elementos hijos.
 * El contenedor no se funde al entrar: evita multiplicar su opacidad por la de cada hijo.
 */
export const heroContainerVariants: Variants = {
    hidden: { opacity: 1 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.04,
            delayChildren: 0.02,
        },
    },
    exit: {
        opacity: 0,
        y: -6,
        transition: { duration: 0.2, ease: "easeInOut" },
    },
}

/**
 * Ítems dentro del hero (título, metadatos, botones de acción).
 * Utiliza el spring canonical de entrada (380/30/0.8) con recorrido sutil de 10px.
 */
export const heroItemVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            default: { type: "spring", stiffness: 380, damping: 30, mass: 0.8 },
            opacity: { duration: 0.35, ease: "easeInOut" },
        },
    },
    exit: {
        opacity: 0,
        y: -4,
        transition: { duration: 0.25, ease: "easeInOut" },
    },
}

// ─── Grid / List Variants ──────────────────────────────────────────────────────
/**
 * Tarjeta individual dentro de un grid o swimlane.
 * Regla de oro de rendimiento:
 * 1. NUNCA blur por ítem (evita capas de composición pesadas en GPU).
 * 2. Delay con tope en min(i, 6) * 0.04 para evitar que filas lejanas demoren segundos.
 */
export const gridItemVariants: Variants = {
    hidden: { opacity: 0, y: 8 },
    visible: (i: number = 0) => ({
        opacity: 1,
        y: 0,
        transition: {
            type: "spring",
            stiffness: 280,
            damping: 28,
            delay: Math.min(i, 6) * 0.04,
        },
    }),
    exit: {
        opacity: 0,
        y: -6,
        transition: { duration: 0.15, ease: "easeIn" },
    },
}

// ─── Content Swaps ────────────────────────────────────────────────────────────
/**
 * Fundidos de carga: salida de 150ms y entrada de 250ms, concurrentes.
 * LoadSwap adapta el recorrido al tier y monta el contenido sin esperar la salida.
 */
export const loadSwapVariants: Variants = {
    initial: { opacity: 0, y: 6 },
    animate: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
    },
    exit: {
        opacity: 0,
        transition: { duration: 0.15, ease: "easeOut" },
    },
}

/**
 * Cambio de panel entre vistas hermanas (tabs de vista): sale con un fundido de
 * 150ms y el nuevo entra desde abajo en 250ms. Sin stagger interno: los grids
 * ya tienen el suyo.
 */
export const viewSwapVariants: Variants = {
    initial: { opacity: 0, y: 6 },
    animate: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
    },
    exit: {
        opacity: 0,
        transition: { duration: 0.15, ease: "easeOut" },
    },
}
