import { describe, expect, it } from "vitest"
import { applySettingsPatch, changedSettings } from "./settings-patch"

describe("applySettingsPatch", () => {
    it("aplica solo los campos cambiados y no modifica el original", () => {
        const base = { library: { autoScan: false, tmdbLanguage: "es-MX" }, theme: { uiSoundsEnabled: true } }
        const merged = applySettingsPatch(base, { library: { autoScan: true } })

        expect(merged).toEqual({ library: { autoScan: true, tmdbLanguage: "es-MX" }, theme: { uiSoundsEnabled: true } })
        expect(base.library.autoScan).toBe(false)
    })

    it("reemplaza listas y nulos tal cual", () => {
        const base = { library: { seriesPaths: ["D:/a", "D:/b"], tmdbApiKey: "clave" } }
        const merged = applySettingsPatch(base, { library: { seriesPaths: ["D:/c"], tmdbApiKey: null } })

        expect(merged).toEqual({ library: { seriesPaths: ["D:/c"], tmdbApiKey: null } })
    })

    it("recupera exactamente lo editado a partir de changedSettings", () => {
        const saved = { library: { autoScan: false, seriesPaths: ["D:/a"] }, theme: { uiSoundsEnabled: true } }
        const edited = { library: { autoScan: true, seriesPaths: ["D:/a"] }, theme: { uiSoundsEnabled: false } }

        expect(applySettingsPatch(saved, changedSettings(edited, saved))).toEqual(edited)
    })
})
