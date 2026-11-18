import { describe, expect, it } from "vitest"
import {
    CLASSIC_MINIMALIST_THEME,
    ERA_THEME,
    ERA_THEME_PRESETS,
    KAMEHOUSE_THEMES,
    resolveDomThemeContract,
    normalizeThemePreference,
} from "./themes-registry"
import { resolveThemeMode } from "./theme-hooks"

describe("themes-registry — Contrato de los 2 Diseños (Minimalista y Por Era con diseño Neutro)", () => {
    it("declara exactamente los 2 diseños visibles en KAMEHOUSE_THEMES", () => {
        expect(Object.keys(KAMEHOUSE_THEMES)).toEqual(["classic-minimalist", "era"])
        expect(CLASSIC_MINIMALIST_THEME.stylesheet).toBe("apps/web/src/styles/themes/classic-minimalist.css")
        expect(ERA_THEME.stylesheet).toBe("apps/web/src/styles/themes/era.css")
        expect(ERA_THEME_PRESETS).toHaveLength(8)
    })

    it("restaura el contrato DOM de Minimalista", () => {
        expect(resolveDomThemeContract("classic-minimalist", "classic", true)).toEqual({
            mode: "classic",
            theme: "classic",
            uiStyle: "classic-minimalist",
        })
    })

    it("resuelve el contrato DOM de Por Era limpiando data-ui-style y asignando paleta", () => {
        expect(resolveDomThemeContract("era", "era-dbz", true)).toEqual({
            mode: "era",
            theme: "era-dbz",
            uiStyle: undefined,
        })
        expect(resolveDomThemeContract("era", "", false)).toEqual({
            mode: "era",
            theme: "era-universe",
            uiStyle: undefined,
        })
    })

    it("convierte el valor compatible de entrada 'classic' a Por era con Universo DB", () => {
        expect(resolveDomThemeContract("classic", "classic", false)).toEqual({
            mode: "era",
            theme: "era-universe",
            uiStyle: undefined,
        })
        expect(resolveDomThemeContract("classic", "era-db", true)).toEqual({
            mode: "era",
            theme: "era-universe",
            uiStyle: undefined,
        })
    })

    it("resolveThemeMode prioriza los dos modos y convierte preferencias antiguas de Neutro a Por era", () => {
        expect(resolveThemeMode({ themeMode: "classic-minimalist", themeEra: "classic", themeEnableBlurringEffects: true })).toBe("classic-minimalist")
        expect(resolveThemeMode({ themeMode: "era", themeEra: "era-dbs", themeEnableBlurringEffects: false })).toBe("era")
        // Preferencia antigua "classic" (Neutro independiente) se convierte a "era"
        expect(resolveThemeMode({ themeMode: "classic", themeEra: "classic", themeEnableBlurringEffects: true })).toBe("era")
        // Preferencia antigua "advanced" se convierte a "era"
        expect(resolveThemeMode({ themeMode: "advanced", themeEra: "classic", themeEnableBlurringEffects: true })).toBe("era")
        expect(resolveThemeMode({ themeMode: "", themeEra: "era-daima", themeEnableBlurringEffects: false })).toBe("era")
        expect(resolveThemeMode({ themeMode: "", themeEra: "classic", themeEnableBlurringEffects: false })).toBe("era")
    })
})


describe("persisted theme compatibility", () => {
    it.each(["classic", "advanced"])("migrates %s to Universo DB preserving effects and unknown settings", themeMode => {
        const legacy = { themeMode, themeEra: "era-db", themeEnableLiquidGlass: false, themeEnableBlurringEffects: false, custom: "keep" }
        const migrated = normalizeThemePreference(legacy)
        expect(migrated).toEqual({ ...legacy, themeMode: "era", themeEra: "era-universe" })
        expect(normalizeThemePreference(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated)
        expect(legacy.themeMode).toBe(themeMode)
    })
    it.each(ERA_THEME_PRESETS)("preserves the $themeEra palette", preset => {
        expect(normalizeThemePreference({ themeMode: "era", themeEra: preset.themeEra }).themeEra).toBe(preset.themeEra)
    })
    it("falls back to Universo for an unknown palette and retains legacy era-only preferences", () => {
        expect(normalizeThemePreference({ themeMode: "era", themeEra: "era-unknown" }).themeEra).toBe("era-universe")
        expect(normalizeThemePreference({ themeEra: "era-dbz" })).toEqual({ themeMode: "era", themeEra: "era-dbz" })
    })
})
