import { type ClassValue, clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * Escalas tipográficas propias definidas en `styles/tokens/typography.css` como
 * utilidades `.text-*` con el shorthand `font:`.
 *
 * Hay que declarárselas a tailwind-merge: al no ser tamaños conocidos de
 * Tailwind, las clasificaba como **color de texto** y cualquier
 * `text-on-surface` posterior dentro del mismo `cn()` borraba el tamaño en
 * silencio. El síntoma era un label que heredaba el tamaño del contenedor
 * (p. ej. las tabs de /series se veían enormes) sin nada raro en el código.
 */
const TYPOGRAPHY_SCALE = [
    "display-xl", "display-lg", "display-md", "display-sm", "display-xs",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "body-lg", "body-md", "body-sm", "body-xs",
    "button-lg", "button-md", "button-sm", "button-xs",
    "label-lg", "label-md", "label-sm",
    "badge", "caption", "overline",
    "numeric", "numeric-lg",
    // Micro-tipografía de tailwind.config.ts (fontSize)
    "2xs", "3xs", "4xs", "5xs",
]

/**
 * Sombras propias de `tailwind.config.ts` (boxShadow). Mismo problema: las
 * `brand-*` se llaman igual que los colores, así que tailwind-merge las tomaba
 * por **color de sombra** y no descartaba el `shadow-sm` base de `Button`. El
 * resultado era una sombra de 1 px teñida en lugar del glow del token.
 * Límite: tailwind-merge ignora el `/20` al clasificar, así que
 * `cn("shadow-md shadow-brand-x/20")` (tinte, no glow) perdería el `shadow-md`.
 * Para teñir una sombra dentro de `cn()`, usar un color que no sea token de
 * sombra (`shadow-brand-accent/20`) o ponerlo en otra variante (`hover:`).
 */
const SHADOW_SCALE = [
    "glass", "glass-liquid",
    "glass-highlight-sm", "glass-highlight-md", "glass-highlight-lg",
    "elevation-1", "elevation-2", "elevation-3", "elevation-4", "elevation-5",
    "brand-primary", "brand-secondary", "brand-destructive", "brand-success", "brand-magic", "brand-focus",
    "modal", "player", "overlay",
]

const twMerge = extendTailwindMerge({
    extend: {
        classGroups: {
            "font-size": [{ text: TYPOGRAPHY_SCALE }],
            shadow: [{ shadow: SHADOW_SCALE }],
        },
    },
})

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function defineStyleAnatomy<T extends Record<string, unknown>>(parts: T): T {
    return parts
}

export type ComponentAnatomy<T extends Record<string, unknown>> = {
    [K in keyof T as `${string & K}Class`]?: string
}
