import { describe, expect, it } from "vitest"
import { ERA_THEME_PRESETS } from "@/lib/theme/era.theme"
import { ERAS, eraIdFromThemeEra, themeEraFromEraId } from "./eras"

describe("eraIdFromThemeEra", () => {
    it("traduce Daima, cuyo tema no coincide con su EraId", () => {
        expect(eraIdFromThemeEra("era-daima")).toBe("dbdaima")
    })

    // Cada saga de Apariencia tiene que caer en una era real del hero de Inicio;
    // Universo DB es la única sin era propia.
    it.each(ERA_THEME_PRESETS.filter(p => p.themeEra !== "era-universe" && p.themeEra !== "era-black"))("$themeEra → era existente", (preset) => {
        const id = eraIdFromThemeEra(preset.themeEra)
        expect(id).not.toBeNull()
        expect(ERAS.some(e => e.id === id)).toBe(true)
    })

    it.each(ERAS.map(e => e.id))("ida y vuelta con themeEraFromEraId: %s", (id) => {
        const theme = themeEraFromEraId(id)
        expect(ERA_THEME_PRESETS.some(p => p.themeEra === theme)).toBe(true)
        expect(eraIdFromThemeEra(theme)).toBe(id)
    })

    it("devuelve null para Universo DB y temas que no son de era", () => {
        expect(eraIdFromThemeEra("era-universe")).toBeNull()
        expect(eraIdFromThemeEra("classic")).toBeNull()
        expect(eraIdFromThemeEra("")).toBeNull()
        expect(eraIdFromThemeEra(undefined)).toBeNull()
    })
})
