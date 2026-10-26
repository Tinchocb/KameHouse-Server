/**
 * Lógica pura del selector de era (EraRail): tipos, teclado y textos accesibles.
 * Sin DOM ni React para poder probarla directamente.
 */

export interface EraRailItem<Id extends string = string> {
    id: Id
    /** Nombre en sentence case ("Dragon Ball Z"). */
    label: string
    /** Un carácter: es el ícono de la era cuando el riel está colapsado. */
    kanji: string
    /** Si se pasa, reemplaza al kanji (selectores que no son eras). */
    icon?: import("react").ReactNode
    /** Color de la era (CSS). Solo pinta el kanji y el indicador del activo. */
    accent: string
    /** Color del texto del kanji cuando está activo, si no es el mismo que `accent` (p. ej. DBGT aclarada). */
    textAccent?: string
    /** Años legibles, con su prefijo si hace falta ("1989–1996", "Años 761–774"). */
    years?: string
    /** Cifra corta al final del nombre ("3", "12/40"). */
    badge?: string
    /** La misma cifra dicha con palabras, para el nombre accesible ("3 películas"). */
    detail?: string
    /** Avance de la era (0…total): dibuja un anillo fino alrededor del kanji. */
    progress?: { done: number; total: number }
    /** Sin contenido: se ve atenuada y no se puede elegir. */
    disabled?: boolean
}

export const DISABLED_ERA_TEXT = "Sin contenido"

/** Nombre accesible completo: nombre, años y dato. Es lo que oye quien no ve el riel expandido. */
export function eraAriaLabel(item: EraRailItem): string {
    const parts: string[] = [item.label]
    if (item.years) parts.push(item.years.charAt(0).toLowerCase() + item.years.slice(1))
    if (item.disabled) parts.push(DISABLED_ERA_TEXT.toLowerCase())
    else if (item.detail) parts.push(item.detail)
    return parts.join(", ")
}

/** Fracción 0–1 del avance, o null si no hay dato válido. */
export function eraProgressFraction(progress: EraRailItem["progress"]): number | null {
    if (!progress || progress.total <= 0) return null
    return Math.min(1, Math.max(0, progress.done / progress.total))
}

type EraRailKey ="ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Home" | "End"

const NEXT_KEYS = new Set(["ArrowDown", "ArrowRight"])
const PREV_KEYS = new Set(["ArrowUp", "ArrowLeft"])

export function isEraRailKey(key: string): key is EraRailKey {
    return NEXT_KEYS.has(key) || PREV_KEYS.has(key) || key === "Home" || key === "End"
}

/**
 * Índice al que mueve el foco una tecla (radiogroup de la guía APG): abajo/derecha avanzan,
 * arriba/izquierda retroceden, con vuelta al otro extremo; Inicio/Fin saltan a los extremos.
 * Salta las eras deshabilitadas. Devuelve -1 si no hay ninguna habilitada.
 */
export function nextEraIndex(
    items: readonly Pick<EraRailItem, "disabled">[],
    from: number,
    key: EraRailKey,
): number {
    const total = items.length
    const enabled = (i: number) => !items[i]?.disabled
    if (total === 0 || !items.some((_, i) => enabled(i))) return -1

    if (key === "Home") return items.findIndex((_, i) => enabled(i))
    if (key === "End") {
        for (let i = total - 1; i >= 0; i--) if (enabled(i)) return i
        return -1
    }

    const step = NEXT_KEYS.has(key) ? 1 : -1
    let index = from
    for (let n = 0; n < total; n++) {
        index = (index + step + total) % total
        if (enabled(index)) return index
    }
    return from
}

/**
 * Años de emisión de cada era de la app (Home y Películas). La cronología usa años
 * del universo, que llegan en su propio `years`.
 */
export const ERA_AIR_YEARS: Record<string, string> = {
    db: "1986–1989",
    dbz: "1989–1996",
    dbgt: "1996–1997",
    dbkai: "2009–2015",
    dbs: "2015–2018",
    dbdaima: "2024–2025",
}

/** "1 título" / "2 títulos". */
export function pluralize(count: number, one: string, many: string): string {
    return `${count} ${count === 1 ? one : many}`
}
