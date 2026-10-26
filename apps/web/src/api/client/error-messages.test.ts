import { describe, expect, it } from "vitest"
import { errorText, isFeatureDisabledError, translateServerError } from "./error-messages"

describe("translateServerError", () => {
    it.each([
        ["media not found in library for ID 12", /No se encontró/],
        ["episode not found in library", /No se encontró/],
        ["library not available", /biblioteca aún no está disponible/],
        ["access denied: file is not within configured library folders", /No se puede acceder/],
        ["google drive integration is not active", /Google Drive no está activo/],
        ["valid positive tmdbId is required", /solicitud no es válida/],
        ["Too many requests", /demasiadas solicitudes/],
        ["Failed to fetch", /No se pudo conectar con el servidor/],
        ["database not initialized", /se está iniciando/],
    ])("%s → español", (raw, expected) => {
        expect(translateServerError(raw)).toMatch(expected)
    })

    it("lo desconocido conserva el detalle detrás de un prefijo en español", () => {
        expect(translateServerError("disk exploded")).toBe("Error del servidor: disk exploded")
    })
})

describe("errorText", () => {
    it("traduce mensajes conocidos del servidor", () => {
        expect(errorText(new Error("media file not found"), "x")).toMatch(/No se encontró/)
    })

    it("deja pasar un aviso que ya viene en español", () => {
        expect(errorText(new Error("ya hay un escaneo de Google Drive en progreso"), "x"))
            .toBe("ya hay un escaneo de Google Drive en progreso")
    })

    it("sin red explica que no hay conexión con el servidor", () => {
        expect(errorText(new TypeError("Failed to fetch"), "x")).toMatch(/No se pudo conectar/)
    })

    it("un HTTP Error genérico o algo que no es Error usa el texto de respaldo", () => {
        expect(errorText(new Error("HTTP Error 500"), "No se pudo guardar")).toBe("No se pudo guardar")
        expect(errorText("boom", "No se pudo guardar")).toBe("No se pudo guardar")
    })
})

describe("isFeatureDisabledError", () => {
    it("reconoce el aviso de función apagada", () => {
        expect(isFeatureDisabledError("feature disabled: cloud")).toBe(true)
        expect(isFeatureDisabledError("media not found")).toBe(false)
    })
})
