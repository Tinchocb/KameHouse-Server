/**
 * Entrada escalonada de una página: lo principal aparece primero (hero) y el resto lo sigue
 * unos milisegundos después, en vez de que toda la pantalla cambie de una vez.
 *
 * - Solo `opacity` y `transform` por WAAPI: corren en el compositor, así que siguen suaves
 *   aunque el hilo principal esté ocupado montando la página.
 * - `fill: "backwards"` mantiene cada bloque oculto durante su retraso y, al terminar, no
 *   deja ningún transform que rompa los `position: fixed` de modales o del reproductor.
 * - Se escalonan los bloques de primer nivel que se ven al entrar (no los de abajo del
 *   pliegue: esos ya los revela el scroll) y se ignoran fondos fijos/absolutos y
 *   elementos que framer-motion maneja por su cuenta.
 */

/** Curva ease-out fuerte del sistema (--ease-out en animation.css). */
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)"
/** Duración de cada bloque: con el escalonado, toda la entrada cierra dentro del tope de 250 ms (navigation-transition.ts). */
const BLOCK_MS = 170
/** Desfase entre bloques: igual que --duration-stagger (animation.css). */
const STAGGER_MS = 40
const RISE_PX = 12
const MAX_BLOCKS = 3
/** Fin de la entrada escalonada: el último bloque arranca en (MAX_BLOCKS - 1) * STAGGER_MS. Tiene que quedar en 250 ms o menos. */
export const ENTER_STAGGER_TOTAL_MS = BLOCK_MS + (MAX_BLOCKS - 1) * STAGGER_MS
/** Bloques más bajos que esto (separadores, rieles) no valen una animación propia. */
const MIN_BLOCK_HEIGHT = 48

function eligibleChildren(parent: Element, viewportHeight: number): HTMLElement[] {
    const out: HTMLElement[] = []
    for (const child of parent.children) {
        if (!(child instanceof HTMLElement)) continue
        // Con transform en línea lo está animando framer-motion: pisarlo se vería como un salto.
        if (child.style.transform && child.style.transform !== "none") continue
        const cs = getComputedStyle(child)
        if (cs.display === "none" || cs.position === "fixed" || cs.position === "absolute") continue
        const rect = child.getBoundingClientRect()
        if (rect.height < MIN_BLOCK_HEIGHT || rect.top >= viewportHeight) continue
        out.push(child)
    }
    return out
}

/** Bloques a escalonar: los hijos visibles de la raíz; si hay una sola envoltura, un nivel más adentro. */
export function collectEnterBlocks(root: HTMLElement, viewportHeight: number): HTMLElement[] {
    let blocks = eligibleChildren(root, viewportHeight)
    for (let depth = 0; depth < 2 && blocks.length === 1; depth++) {
        const inner = eligibleChildren(blocks[0], viewportHeight)
        if (inner.length < 2) break
        blocks = inner
    }
    return blocks.slice(0, MAX_BLOCKS)
}

/**
 * Bloques que se escalonan al entrar, o ninguno si hay menos de dos: con un solo bloque no hay nada que
 * escalonar y alcanza el fundido de la página. Hay que saberlo ANTES de animar el contenedor, porque con
 * escalonado el contenedor no se funde (ver enterKeyframes en navigation-transition.ts).
 */
export function staggerBlocksOf(root: HTMLElement, viewportHeight = window.innerHeight): HTMLElement[] {
    const blocks = collectEnterBlocks(root, viewportHeight)
    return blocks.length < 2 ? [] : blocks
}

/**
 * Lanza la entrada escalonada de esos bloques (ver staggerBlocksOf). El primero arranca en `firstFromOpacity`,
 * la opacidad que dejó la salida (entryStartOpacity), y los demás desde 0. Devuelve las animaciones para
 * poder cancelarlas.
 */
export function staggerEnter(blocks: HTMLElement[], firstFromOpacity: number): Animation[] {
    return blocks.map((block, i) =>
        block.animate(
            [
                // El primer bloque nace ya visible: si todos arrancaran en 0 habría un cuadro vacío entre
                // la página vieja (que se corta) y la nueva (la "caída a negro" que PageTransition evita).
                { opacity: i === 0 ? firstFromOpacity : 0, transform: `translate3d(0, ${RISE_PX}px, 0)` },
                { opacity: 1, transform: "translate3d(0, 0, 0)" },
            ],
            { duration: BLOCK_MS, delay: i * STAGGER_MS, easing: EASE_OUT, fill: "backwards" },
        ),
    )
}
