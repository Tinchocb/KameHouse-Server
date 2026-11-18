import { afterEach, describe, expect, it } from "vitest"
import { usePlayerStore } from "./player-store"

afterEach(() => {
    usePlayerStore.setState(usePlayerStore.getInitialState(), true)
    localStorage.removeItem("kamehouse-player-settings")
})

async function rehydrateWith(state: Record<string, unknown>) {
    localStorage.setItem("kamehouse-player-settings", JSON.stringify({ version: 0, state }))
    await usePlayerStore.persist.rehydrate()
    return usePlayerStore.getState().preferredSubtitleLang
}

// Antes, elegir una pista sin idioma guardaba "und" como idioma preferido de subtítulos.
describe("idioma de subtítulos guardado por un bug anterior", () => {
    it.each(["und", "UND", "unknown", "", "und-Latn"])(
        'descarta "%s" al arrancar y vuelve al idioma por defecto',
        async (saved) => {
            expect(await rehydrateWith({ preferredSubtitleLang: saved })).toBe("spa")
        },
    )

    it.each(["eng", "es-MX", "spa-lat"])('conserva "%s"', async (saved) => {
        expect(await rehydrateWith({ preferredSubtitleLang: saved })).toBe(saved)
    })

    it("sin valor guardado queda el idioma por defecto y se respetan las demás preferencias", async () => {
        expect(await rehydrateWith({ playerVolume: 0.4 })).toBe("spa")
        expect(usePlayerStore.getState().playerVolume).toBe(0.4)
    })
})
