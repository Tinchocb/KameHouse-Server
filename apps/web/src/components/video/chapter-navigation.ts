import type { Chapter } from "./skip-windows"
import { isIntroChapter, isOutroChapter, isValidOpeningWindow } from "./skip-windows"

// Palabras clave de segmentos intermedios auto-saltables (eyecatch, avisos,
// recaps, avances). Misma lista que usaba processTimeUpdates.
const SKIPPABLE_KEYWORDS = [
    "eyecatch",
    "eye-catch",
    "commercial",
    "sponsor",
    "sponsors",
    "recap",
    "resumen",
    "preview",
    "avance",
    "adelanto",
    "title card",
    "titlecard",
    "title",
    "título",
    "publicidad",
    "patrocinio",
    "intermedio",
    "prologue",
    "prólogo",
]

const SKIPPABLE_TYPES = new Set(["sponsor", "recap", "preview"])

export const getChapterSkipKey = (c: Chapter): string => `${c.name}_${c.startTime}`

/** Capítulo que contiene a `curr` (para resaltar el activo). */
export function findActiveChapter(chapters: Chapter[], curr: number): Chapter | null {
    return chapters.find((c) => curr >= c.startTime && curr < c.endTime) ?? null
}

interface SkippablePrefs {
    autoSkipIntroPref: boolean
    autoSkipOutroPref: boolean
    /** Segmentos intermedios (resumen, recap, eyecatch…). Si falta, sigue a autoSkipIntroPref. */
    skipIntermediates?: boolean
}

/**
 * Primer capítulo intermedio auto-saltable bajo el cursor que aún no se saltó.
 * Respeta las preferencias de OP/ED para capítulos intro/outro.
 */
export function findSkippableChapter(
    chapters: Chapter[],
    curr: number,
    skipped: ReadonlySet<string>,
    prefs: SkippablePrefs,
): Chapter | null {
    return chapters.find((c) => {
        if (!(curr >= c.startTime && curr < c.endTime - 0.5)) return false
        if (skipped.has(getChapterSkipKey(c))) return false
        if (isIntroChapter(c)) return prefs.autoSkipIntroPref && isValidOpeningWindow(c)
        if (isOutroChapter(c)) return prefs.autoSkipOutroPref
        const n = c.name.toLowerCase()
        return (
            (prefs.skipIntermediates ?? prefs.autoSkipIntroPref) &&
            (SKIPPABLE_KEYWORDS.some((k) => n.includes(k)) || SKIPPABLE_TYPES.has(c.type ?? ""))
        )
    }) ?? null
}
