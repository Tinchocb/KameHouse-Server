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
            duration: 0.35,
            ease: [0.22, 1, 0.36, 1],
        },
    },
    exit: (direction: number = 1) => ({
        opacity: 0,
        x: direction >= 0 ? -12 : 12,
        scale: 1,
        zIndex: 0,
        transition: {
            x: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
            opacity: { delay: 0.35, duration: 0.05 },
        },
    }),
}

/**
 * Transición de fundido cinematográfico para backdrops estáticos o sin dirección fija (ej. Películas).
 */
export const heroBackdropFadeVariants: Variants = {
    initial: { opacity: 0, scale: 1.01, zIndex: 1 },
    animate: { opacity: 1, scale: 1, zIndex: 1, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
    exit: { opacity: 0, zIndex: 0, transition: { opacity: { delay: 0.45, duration: 0.05 } } },
}

/**
 * Contenedor orquestador del contenido de los heroes (SpotlightHero, MoviesHero, SeriesHero).
 * Aplica stagger canónico de 40ms (--duration-stagger) entre los elementos hijos.
 */
export const heroContainerVariants: Variants = {
    hidden: { opacity: 0 },
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
        transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
    },
}

/** Alias retrocompatible para heroContainerVariants. */
export const heroContentContainerVariants: Variants = heroContainerVariants

/**
 * Ítems dentro del hero (título, metadatos, botones de acción).
 * Utiliza el spring canonical de entrada (380/30/0.8) con recorrido sutil de 10px.
 */
export const heroItemVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { type: "spring", stiffness: 380, damping: 30, mass: 0.8 },
    },
    exit: {
        opacity: 0,
        y: -4,
        transition: { duration: 0.15, ease: "easeIn" },
    },
}

/**
 * Elementos del hero que solo requieren desvanecimiento sin desplazamiento (tags, badges).
 */
export const heroFadeOnlyVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { duration: 0.25, ease: "easeOut" },
    },
    exit: {
        opacity: 0,
        transition: { duration: 0.15, ease: "easeIn" },
    },
}

// ─── Grid / List Variants ──────────────────────────────────────────────────────
/**
 * Contenedor de grids o swimlanes para animar entrada en cascada controlada.
 */
export const gridContainerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.04,
        },
    },
}

/**
 * Tarjeta individual dentro de un grid o swimlane.
 * Regla de oro de rendimiento:
 * 1. NUNCA blur por ítem (evita capas de composición pesadas en GPU).
 * 2. Delay con tope en min(i, 12) * 0.04 para evitar que filas lejanas demoren segundos.
 */
export const gridItemVariants: Variants = {
    hidden: { opacity: 0, y: 12 },
    visible: (i: number = 0) => ({
        opacity: 1,
        y: 0,
        transition: {
            type: "spring",
            stiffness: 280,
            damping: 28,
            delay: Math.min(i, 12) * 0.04,
        },
    }),
    exit: {
        opacity: 0,
        y: -6,
        transition: { duration: 0.15, ease: "easeIn" },
    },
}

// ─── Micro-Interactions / Text Swaps ──────────────────────────────────────────
/**
 * Transición canónica para intercambio de texto sin layout shift (filtros, contadores, estado).
 * Distancia micro de 4px (--distance-micro) y 150ms (--duration-quick).
 */
export const swapTextVariants: Variants = {
    initial: { opacity: 0, y: 4 },
    animate: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.15, ease: [0.22, 1, 0.36, 1] },
    },
    exit: {
        opacity: 0,
        y: -4,
        transition: { duration: 0.12, ease: "easeIn" },
    },
}
