import { describe, expect, it } from "vitest"
import { formatRelativeEs } from "./drive-status"

describe("formatRelativeEs", () => {
    const now = Date.parse("2026-11-17T12:00:00Z")

    it("expresa el pasado en minutos y en horas", () => {
        expect(formatRelativeEs(new Date(now - 5 * 60_000), now)).toBe("hace 5 minutos")
        expect(formatRelativeEs(new Date(now - 2 * 3_600_000), now)).toBe("hace 2 horas")
    })

    it("expresa el futuro, que es lo que muestra la próxima sincronización", () => {
        expect(formatRelativeEs(new Date(now + 48 * 60_000), now)).toBe("dentro de 48 minutos")
    })

    it("lo que ocurre justo ahora", () => {
        expect(formatRelativeEs(new Date(now), now)).toBe("ahora")
    })
})
