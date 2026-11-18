/**
 * Estilos compartidos del reproductor. Todo flota sobre el vídeo, así que sigue la regla
 * de vidrio del sistema de botones: grafito `--neutral-elev-1` al 88 % (hojas y cápsulas), un solo blur por
 * superficie y sin saturar (el vidrio no tiñe de color). Al 88 % el texto secundario (`--label-2`) queda ≥ 4,5:1
 * incluso sobre un fotograma blanco puro, también en "Por era"; con "Reducir transparencia" (`data-flat`) la
 * superficie pasa a sólida `--neutral-elev-2`, sin blur.
 */

export const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"

/** Superficie de vidrio sobre el vídeo (cápsulas, HUD, hojas) con Double-Bezel Specular Border. */
export const PLAYER_GLASS =
    "player-hud-capsule bg-[color-mix(in_srgb,var(--neutral-elev-1)_88%,transparent)] border border-[var(--glass-frosted-border)] border-t-[var(--glass-frosted-border-top)] backdrop-blur-overlay-md shadow-[shadow:var(--double-bezel-shadow)] [[data-flat=true]_&]:bg-[var(--neutral-elev-2)] [[data-flat=true]_&]:border-[var(--neutral-separator)]"

/** Botón de ícono dentro de una cápsula de vidrio. */
export const PLAYER_ICON_BTN =
    `player-icon-button flex items-center justify-center w-11 h-11 [@media(pointer:fine)]:w-10 [@media(pointer:fine)]:h-10 rounded-full shrink-0 text-label-1 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)] transition-[color,background-color,transform] duration-fast ease-smooth-out cursor-pointer motion-safe:active:scale-[0.97] [&_svg]:w-[18px] [&_svg]:h-[18px] ${FOCUS_RING}`

/** Estado activo: pastilla "seleccionado" como el ítem activo de la navbar. */
export const PLAYER_ICON_BTN_ACTIVE = "player-icon-active bg-[var(--selected-bg)] text-[var(--selected-fg)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--selected-bg)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[var(--selected-fg)]"

/** Etiqueta pequeña sobre un título ("Episodio 5"). */
export const PLAYER_EYEBROW = "player-eyebrow-text text-xs font-semibold text-brand-accent-readable [text-shadow:0_1px_4px_rgba(0,0,0,0.7)]"

