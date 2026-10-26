// "Nuevo": película añadida a la biblioteca después del escaneo inicial.
// `media.createdAt` es la fecha real de alta en la base. El primer escaneo mete
// casi todo el catálogo el mismo día, así que se compara contra el alta más
// antigua: solo cuenta lo que llegó después, y solo mientras sea reciente.

const DAY_MS = 24 * 60 * 60 * 1000
/** Cuánto tiempo una película añadida se sigue mostrando como nueva. */
const NEW_WINDOW_DAYS = 30

type AddedEntry = { media?: { createdAt?: string | null } | null } | null | undefined

function addedAt(entry: AddedEntry): number {
    const t = entry?.media?.createdAt ? Date.parse(entry.media.createdAt) : NaN
    return Number.isFinite(t) && t > 0 ? t : 0
}

/** Fecha de alta más antigua de la biblioteca (0 si ninguna trae fecha). */
export function getAddedBaseline(entries: readonly AddedEntry[]): number {
    let min = 0
    for (const e of entries) {
        const t = addedAt(e)
        if (t > 0 && (min === 0 || t < min)) min = t
    }
    return min
}

export function isNewlyAdded(entry: AddedEntry, baseline: number, now: number = Date.now()): boolean {
    const t = addedAt(entry)
    if (t === 0 || baseline === 0) return false
    return t > baseline + DAY_MS && now - t <= NEW_WINDOW_DAYS * DAY_MS
}
