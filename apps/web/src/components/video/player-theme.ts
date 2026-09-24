/**
 * Estilos compartidos del reproductor, derivados del lenguaje visual de la
 * plataforma (FloatingPillNav): cápsulas de vidrio, ítem activo en pastilla
 * blanca, texto xs semibold con tracking-wide. Minimalista: un solo blur por
 * superficie, sin decoraciones extra.
 */

/** Superficie de vidrio — misma receta que la navbar flotante. */
export const PLAYER_GLASS =
    "bg-surface-container-lowest/80 border border-white/20 border-t-white/40 border-b-white/10 backdrop-blur-overlay-2xl shadow-[shadow:var(--glass-highlight-lg),0_8px_24px_-4px_rgba(0,0,0,0.7)]"

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"

/** Botón de ícono dentro de una cápsula de vidrio. */
export const PLAYER_ICON_BTN =
    `flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0 text-white/85 hover:text-white hover:bg-white/[0.12] transition-[color,background-color,transform] duration-200 cursor-pointer active:scale-90 [&_svg]:w-[18px] [&_svg]:h-[18px] ${FOCUS_RING}`

/** Botón principal de la barra (play/pausa): pastilla blanca sólida. */
export const PLAYER_PLAY_BTN =
    `flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0 bg-white/95 text-black hover:bg-white hover:scale-105 transition-[background-color,transform] duration-200 cursor-pointer active:scale-95 shadow-[0_4px_14px_rgba(0,0,0,0.35)] [&_svg]:w-4 [&_svg]:h-4 ${FOCUS_RING}`

/** Estado activo: pastilla blanca como el ítem activo de la navbar. */
export const PLAYER_ICON_BTN_ACTIVE = "bg-white/95 text-black hover:bg-white hover:text-black"

/** Acción principal (Reproducir, Reintentar…). */
export const PLAYER_PRIMARY_BTN =
    `inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full bg-white/95 hover:bg-white text-black text-xs font-bold tracking-wide transition-colors duration-200 cursor-pointer active:scale-95 ${FOCUS_RING}`

/** Acción secundaria. */
export const PLAYER_SECONDARY_BTN =
    `inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold tracking-wide transition-colors duration-200 cursor-pointer active:scale-95 ${FOCUS_RING}`

/** Etiqueta pequeña sobre un título ("Episodio 5"). */
export const PLAYER_EYEBROW = "text-2xs font-semibold uppercase tracking-widest text-brand-accent"
