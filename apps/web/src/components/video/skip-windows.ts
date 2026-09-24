// Ventanas de skip OP/ED y detección de capítulos por nombre.
// Extraído de usePlayerSkip: funciones puras sin dependencias de React/stores.

const INTRO_REGEX = /^(op\d*|opening\d*|intro\d*)\b/i
const INTRO_WORD_REGEX = /\b(op\d*|opening\d*|intro\d*)\b/i
const OUTRO_REGEX = /^(ed\d*|ending\d*|credits|créditos|outro\d*)\b/i
const OUTRO_WORD_REGEX = /\b(ed\d*|ending\d*|credits|créditos|outro\d*)\b/i

export interface SkipWindow {
    startTime: number
    endTime: number
    source: string
}

export interface Chapter {
    startTime: number
    endTime: number
    name: string
    type?: string
}

export function resolveActiveOp(skipTimesOp: SkipWindow | undefined, total: number, mediaFormat?: string | null): SkipWindow | undefined {
    if (skipTimesOp) return skipTimesOp
    if (mediaFormat?.toUpperCase() === "MOVIE") return undefined
    // D8: Anime TV OPs usually last exactly 85-90s. The old 12% calculation
    // was crude. We apply this heuristic only if the video is >10 mins (600s).
    if (total > 600) return { startTime: 0, endTime: 85, source: "heuristic" }
    return undefined
}

/** Returns the effective ED/outro window: explicit AniSkip data → chapter → heuristic.
 * A real end mark that lands before the end of the file is trusted as-is: capping
 * it at `total - 5` made every skip land up to 5s short and the user watched the
 * tail of the outro. The 5s buffer only applies to placeholder/malformed ends
 * ("runs to the end of the file"), where we can't tell the outro's real end and
 * skipping to `total` would end the video. */
export function resolveActiveEd(skipTimesEd: SkipWindow | undefined, total: number, mediaFormat?: string | null): SkipWindow | undefined {
    const getHeuristicEd = (): SkipWindow | undefined => {
        if (mediaFormat?.toUpperCase() === "MOVIE") return undefined
        if (total > 300) {
            const edDuration = Math.min(95, total * 0.08)
            return { startTime: total - edDuration, endTime: total - 5, source: "heuristic" }
        }
        return undefined
    }

    if (skipTimesEd) {
        const start = skipTimesEd.startTime
        // Outro starting at/after the end of the video is unusable — fallback to heuristic.
        if (total > 0 && start >= total) return getHeuristicEd()

        let parsedEndTime = skipTimesEd.endTime
        // Many AniSkip entries have malformed ed.endTime (e.g., equal to startTime or just 1s later)
        if (parsedEndTime <= start + 10) {
            parsedEndTime = total - 5
        }

        // Placeholder end (>= total - 0.5): the mark says "until the end of the
        // file", which is indistinguishable from "unknown". Keep the 5s buffer so
        // the skip doesn't end the video. A measured end below that is exact —
        // land on it, clamped to the file duration.
        const cap = parsedEndTime >= total - 0.5 ? Math.max(start + 1, total - 5) : total
        const endTime = Math.min(Math.max(parsedEndTime, start + 1), cap)
        return { startTime: start, endTime, source: skipTimesEd.source }
    }
    return getHeuristicEd()
}

export function shouldAutoSkip(source: string): boolean {
    return ["manual", "fingerprint", "aniskip", "chapters", "propagated", "animethemes", "fpcross", "subtitle"].includes(source)
}

/** Outro auto-skip behaves the same as intro auto-skip.
 * Heuristic sources require manual user interaction and are not auto-skipped. */
export function shouldAutoSkipOutro(source: string): boolean {
    return shouldAutoSkip(source)
}

/** Returns true if the chapter name/type matches an intro/opening pattern */
export function isIntroChapter(c: Chapter): boolean {
    const n = c.name.toLowerCase()
    return c.type === "opening" || INTRO_REGEX.test(n) || INTRO_WORD_REGEX.test(n)
}

/** Returns true if the chapter name/type matches an outro/ending pattern */
export function isOutroChapter(c: Chapter): boolean {
    const n = c.name.toLowerCase()
    return c.type === "ending" || OUTRO_REGEX.test(n) || OUTRO_WORD_REGEX.test(n)
}

/** Finds the first chapter from the list that matches intro patterns */
export function findIntroChapter(chapters: Chapter[]): Chapter | undefined {
    return chapters.find(isIntroChapter)
}

/** Finds the first chapter from the list that matches outro patterns */
export function findOutroChapter(chapters: Chapter[]): Chapter | undefined {
    return chapters.find(isOutroChapter)
}

