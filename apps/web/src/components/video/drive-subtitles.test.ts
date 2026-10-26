import { describe, expect, it } from "vitest"
import { ApiError } from "@/api/client/requests"
import {
    describeDriveExtractionError,
    isDrivePath,
    needsSubtitleRefresh,
    nextWindowPollMs,
    statusFromApiError,
    toDriveStatus,
    type DriveWindowResponse,
} from "./drive-subtitles"
import { SubtitleFetchError, describeSubtitleError } from "./subtitle-messages"

describe("drive-subtitles", () => {
    it("reconoce rutas de Drive", () => {
        expect(isDrivePath("gdrive://abc/Serie/ep.mkv")).toBe(true)
        expect(isDrivePath("D:\\Anime\\ep.mkv")).toBe(false)
        expect(isDrivePath(undefined)).toBe(false)
    })

    it("toDriveStatus acota el porcentaje y traduce el error", () => {
        expect(toDriveStatus(undefined)).toEqual({ state: "none", percent: 0 })
        expect(toDriveStatus({ state: "running", percent: 140 }).percent).toBe(100)
        expect(toDriveStatus({ state: "running", percent: -3 }).percent).toBe(0)
        const failed = toDriveStatus({ state: "error", error: "drive file too large to extract subtitles" })
        expect(failed.error).toMatch(/demasiado grande/)
        expect(toDriveStatus({ state: "done", percent: 100 }).error).toBeUndefined()
    })

    it("traduce los errores de la extracción", () => {
        expect(describeDriveExtractionError(undefined, 413)).toMatch(/8 GB/)
        expect(describeDriveExtractionError("cancelled")).toMatch(/cancelada/)
        expect(describeDriveExtractionError("downloadQuotaExceeded quota")).toMatch(/limitó/)
        expect(describeDriveExtractionError("boom")).toMatch(/Puedes reintentar/)
        expect(statusFromApiError(new ApiError("x", 413)).state).toBe("error")
        expect(statusFromApiError(new Error("red")).error).toMatch(/reintentar/)
    })
})

describe("subtitle-messages", () => {
    it("explica el motivo según el estado HTTP o el error", () => {
        expect(describeSubtitleError(new SubtitleFetchError("x", 404))).toMatch(/no está disponible/)
        expect(describeSubtitleError(new SubtitleFetchError("x", 503))).toMatch(/sigue extrayendo/)
        expect(describeSubtitleError(new Error("subtitle file too large"))).toMatch(/demasiado grande/)
        expect(describeSubtitleError(new Error("subtitle file empty"))).toMatch(/vacío/)
        expect(describeSubtitleError(new Error("subtitle never became available"))).toMatch(/tardaron demasiado/)
        expect(describeSubtitleError("???")).toMatch(/No se pudo cargar/)
    })
})

const win = (over: Partial<DriveWindowResponse> = {}): DriveWindowResponse => ({
    state: "ready",
    version: 5,
    coveredFrom: 0,
    coveredUntil: 150,
    percent: 10,
    ...over,
})

describe("lectura de subtítulos de Drive por franjas", () => {
    it("no recarga la pista si el servidor todavía no cubre la posición", () => {
        expect(needsSubtitleRefresh(null, win({ coveredFrom: -1, coveredUntil: -1 }), 0)).toBe(false)
    })

    it("la primera vez que hay datos, recarga", () => {
        expect(needsSubtitleRefresh(null, win(), 0)).toBe(true)
    })

    it("no recarga si no hay nada nuevo en el servidor", () => {
        const held = { from: 0, until: 150, version: 5 }
        expect(needsSubtitleRefresh(held, win({ version: 5 }), 140)).toBe(false)
    })

    it("no recarga mientras lo cargado alcanza más allá del margen", () => {
        const held = { from: 0, until: 150, version: 5 }
        expect(needsSubtitleRefresh(held, win({ version: 9, coveredUntil: 200 }), 60)).toBe(false)
    })

    it("recarga cuando falta menos del margen para que se acabe lo cargado", () => {
        const held = { from: 0, until: 150, version: 5 }
        expect(needsSubtitleRefresh(held, win({ version: 9, coveredUntil: 220 }), 135)).toBe(true)
    })

    it("recarga tras un salto fuera del tramo cargado, una vez que el servidor lo cubre", () => {
        const held = { from: 0, until: 150, version: 5 }
        expect(needsSubtitleRefresh(held, win({ version: 8, coveredFrom: 500, coveredUntil: 650 }), 520)).toBe(true)
        // Mientras el destino no está cubierto, nada que recargar.
        expect(needsSubtitleRefresh(held, win({ version: 8, coveredFrom: -1, coveredUntil: -1 }), 520)).toBe(false)
    })

    it("consulta más seguido si la posición no está cubierta o se está leyendo", () => {
        expect(nextWindowPollMs(win({ coveredFrom: -1, coveredUntil: -1 }), null)).toBe(1000)
        expect(nextWindowPollMs(win({ state: "loading" }), null)).toBe(2000)
        expect(nextWindowPollMs(win(), null)).toBe(4000)
    })

    it("deja de consultar cuando el archivo entero ya está cargado", () => {
        const held = { from: 0, until: 1e12, version: 9 }
        expect(nextWindowPollMs(win({ state: "complete", coveredUntil: 1e12 }), held)).toBeNull()
        // Completo en el servidor pero lo cargado todavía no lo incluye: sigue.
        expect(nextWindowPollMs(win({ state: "complete", coveredUntil: 1e12 }), { from: 0, until: 150, version: 5 })).toBe(4000)
    })
})
