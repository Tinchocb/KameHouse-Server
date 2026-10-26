import { ApiError } from "@/api/client/requests"
import type { DriveExtractionState, DriveExtractionStatus } from "./subtitle-load-store"

/** Los endpoints de extracción de subtítulos embebidos de Google Drive. */
export const DRIVE_SUBTITLES_ENDPOINTS = {
    status: "/api/v1/drive/subtitles/status",
    extract: "/api/v1/drive/subtitles/extract",
    cancel: "/api/v1/drive/subtitles/cancel",
    window: "/api/v1/drive/subtitles/window",
} as const

export interface DriveSubtitlesResponse {
    state: DriveExtractionState
    percent?: number
    error?: string
    /** Fuentes embebidas (solo cuando la extracción terminó). */
    fonts?: string[]
}

export function isDrivePath(path: string | undefined | null): boolean {
    return !!path && path.startsWith("gdrive://")
}

/** Traduce el error de la extracción a un mensaje para el panel. */
export function describeDriveExtractionError(raw: string | undefined, status?: number): string {
    const msg = (raw ?? "").toLowerCase()
    if (status === 413 || msg.includes("too large")) {
        return "El archivo es demasiado grande para extraer sus subtítulos (tope de 8 GB)."
    }
    if (msg.includes("cancel")) return "Extracción cancelada."
    if (msg.includes("quota")) return "Google Drive limitó las descargas de este archivo. Inténtalo de nuevo más tarde."
    if (status === 503) return "Google Drive no está disponible en este momento."
    if (status === 502) return "No se pudo leer el archivo de Drive."
    return "No se pudieron extraer los subtítulos. Puedes reintentar."
}

export function toDriveStatus(res: DriveSubtitlesResponse | undefined): DriveExtractionStatus {
    if (!res) return { state: "none", percent: 0 }
    return {
        state: res.state,
        percent: Math.max(0, Math.min(100, res.percent ?? 0)),
        error: res.state === "error" ? describeDriveExtractionError(res.error) : undefined,
    }
}

export function statusFromApiError(err: unknown): DriveExtractionStatus {
    if (err instanceof ApiError) {
        return { state: "error", percent: 0, error: describeDriveExtractionError(err.message, err.status) }
    }
    return { state: "error", percent: 0, error: describeDriveExtractionError(undefined) }
}

/** Respuesta de `POST /drive/subtitles/window` (lectura por franjas de tiempo). */
export interface DriveWindowResponse {
    state: "loading" | "ready" | "complete" | "error"
    /** Sube cada vez que el servidor lee subtítulos nuevos. */
    version: number
    /** Tramo del video (segundos) con subtítulos leídos que contiene la posición; -1 si no hay. */
    coveredFrom: number
    coveredUntil: number
    percent: number
    error?: string
    /** Clase de la falla de lectura: quota, rate, auth, notfound, server, network, changed, format. */
    errorKind?: string
    errorStatus?: number
    /** Texto corto en español de la falla. */
    errorMessage?: string
    /** El servidor va a reintentar solo. */
    retrying?: boolean
    diag?: DriveWindowDiag
}

/** Detalle de lo que leyó el servidor (panel de diagnóstico). */
export interface DriveWindowDiag {
    positionSec: number
    fromSec: number
    toSec: number
    backfillSec: number
    longestEventSec: number
    clusters: number
    reads: number
    avgReadMs: number
    parsedBytes: number
    fileBytes: number
    cues: number
    laced: number
    dropped: number
    failures: number
    moves: number
    opens: number
    lastError?: string
    lastErrorKind?: string
    lastErrorStatus?: number
    slotsBusy: number
    tracks: { index: number; codec: string; language?: string; supported: boolean; events: number }[]
}

/** Mensaje del panel para una falla de lectura de la franja. */
export function describeWindowError(res: Pick<DriveWindowResponse, "errorMessage" | "retrying">): string {
    const base = res.errorMessage || "No se pudo leer desde Drive"
    return `${base.charAt(0).toUpperCase()}${base.slice(1)}${res.retrying ? ": reintentando…" : ""}`
}

/** Mensaje para un archivo que no admite la lectura por franjas (501 + motivo). */
export function describeWindowUnsupported(raw: string | undefined): string {
    const m = raw ?? ""
    if (m.includes("no-cues")) return "Este video no trae índice (Cues): los subtítulos incrustados se extraen con el botón, bajando el archivo."
    if (m.includes("not-matroska")) return "Este formato (no es MKV) no permite leer los subtítulos por franjas: se extraen con el botón."
    return "Este archivo no admite leer los subtítulos por franjas: usa «Extraer subtítulos»."
}

/** Lo que tiene la pista cargada en JASSUB: el tramo cubierto cuando se la pidió. */
export interface HeldCoverage {
    from: number
    until: number
    version: number
}

/** Cuántos segundos antes de que se acabe lo cargado conviene pedir la pista de nuevo. */
const SUBTITLE_REFRESH_MARGIN_S = 20

/**
 * ¿Hay que volver a pedir la pista? Solo si el servidor ya cubre la posición, trae algo
 * nuevo y lo cargado no alcanza (la posición salió del tramo o falta menos del margen).
 * Así, con la lectura 90 s por delante, la pista se recarga cada ~70 s y no cada poco.
 */
export function needsSubtitleRefresh(held: HeldCoverage | null, res: DriveWindowResponse, position: number): boolean {
    if (res.coveredUntil < 0) return false
    if (!held) return true
    if (res.version === held.version) return false
    return position < held.from || position + SUBTITLE_REFRESH_MARGIN_S > held.until
}

/** Cada cuánto consultar (ms); null: ya está todo cargado, no hace falta seguir. */
export function nextWindowPollMs(res: DriveWindowResponse, held: HeldCoverage | null): number | null {
    if (res.coveredUntil < 0) return 1000 // la posición todavía no está cubierta (salto)
    if (res.state === "complete" && held && held.until >= res.coveredUntil) return null
    if (res.state === "loading") return 2000
    return 4000
}
