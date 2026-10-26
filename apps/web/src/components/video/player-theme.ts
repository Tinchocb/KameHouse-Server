/**
 * Estilos compartidos del reproductor. Todo flota sobre el vídeo, así que sigue la regla
 * de vidrio del sistema de botones: grafito `--neutral-elev-1` al 88 % (hojas y cápsulas), un solo blur por
 * superficie y sin saturar (el vidrio no tiñe de color). Al 88 % el texto secundario (`--label-2`) queda ≥ 4,5:1
 * incluso sobre un fotograma blanco puro, también en "Por era"; con "Reducir transparencia" (`data-flat`) la
 * superficie pasa a sólida `--neutral-elev-2`, sin blur.
 */

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"

/** Superficie de vidrio sobre el vídeo (cápsulas, HUD, hojas). */
export const PLAYER_GLASS =
    "bg-[color-mix(in_srgb,var(--neutral-elev-1)_88%,transparent)] border border-white/10 border-t-white/20 backdrop-blur-overlay-md shadow-elevation-2 [[data-flat=true]_&]:bg-[var(--neutral-elev-2)] [[data-flat=true]_&]:border-[var(--neutral-separator)]"

/** Botón de ícono dentro de una cápsula de vidrio. */
export const PLAYER_ICON_BTN =
    `flex items-center justify-center w-11 h-11 [@media(pointer:fine)]:w-10 [@media(pointer:fine)]:h-10 [[data-tv=true]_&]:w-14 [[data-tv=true]_&]:h-14 rounded-full shrink-0 text-label-1 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)] transition-[color,background-color,transform] duration-fast ease-smooth-out cursor-pointer active:scale-95 [&_svg]:w-[18px] [&_svg]:h-[18px] [[data-tv=true]_&]:[&_svg]:w-7 [[data-tv=true]_&]:[&_svg]:h-7 ${FOCUS_RING}`

/** Botón sobre vídeo SIN cápsula (controles centrales): vidrio translúcido refinado,
 *  ligero para no entorpecer la visualización del fotograma. */
export const PLAYER_GLASS_BTN =
    `flex items-center justify-center rounded-full shrink-0 text-white/90 bg-black/40 border border-white/10 backdrop-blur-overlay-xs shadow-elevation-1 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-black/60 [@media(hover:hover)_and_(pointer:fine)]:hover:text-white [[data-flat=true]_&]:bg-[var(--neutral-elev-2)] [[data-flat=true]_&]:border-[var(--neutral-separator)] transition-[background-color,border-color,transform,color] duration-fast ease-smooth-out cursor-pointer active:scale-95 ${FOCUS_RING}`

/** Estado activo: pastilla "seleccionado" como el ítem activo de la navbar. */
export const PLAYER_ICON_BTN_ACTIVE = "bg-[var(--selected-bg)] text-[var(--selected-fg)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--selected-bg)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[var(--selected-fg)]"

/** Etiqueta pequeña sobre un título ("Episodio 5"). */
export const PLAYER_EYEBROW = "text-xs font-semibold text-brand-accent-readable [text-shadow:0_1px_4px_rgba(0,0,0,0.7)]"

