/** Entrada tctil o lpiz (pointer coarse): el nico mouse conserva doble clic = pantalla completa. */
export function isTouchLikePointer(pointerType: string | undefined | null): boolean {
    return pointerType === "touch" || pointerType === "pen"
}

/** Umbral de arrastre para cerrar un panel lateral con el dedo. */
const PANEL_DISMISS_OFFSET = 80
const PANEL_DISMISS_VELOCITY = 500

export function shouldDismissPanelDrag(offsetX: number, velocityX: number): boolean {
    return offsetX > PANEL_DISMISS_OFFSET || velocityX > PANEL_DISMISS_VELOCITY
}
