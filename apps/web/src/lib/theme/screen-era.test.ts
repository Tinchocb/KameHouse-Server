import { describe, expect, it } from "vitest"
import { asEraThemeId, publishScreenEra, resolveFollowedTheme, selectScreenEra } from "./screen-era"

const empty = { entries: [], fade: false }

describe("publishScreenEra", () => {
    it("una pantalla que entra publica su era sin fundido", () => {
        const s = publishScreenEra(empty, 1, "era-dbz")
        expect(selectScreenEra(s)).toBe("era-dbz")
        expect(s.fade).toBe(false)
    })

    it("la misma pantalla que cambia de era funde (rotación del hero, scroll de la Cronología)", () => {
        const s = publishScreenEra(publishScreenEra(empty, 1, "era-db"), 1, "era-dbgt")
        expect(selectScreenEra(s)).toBe("era-dbgt")
        expect(s.fade).toBe(true)
    })

    it("manda la última pantalla montada y al salir vuelve la anterior, sin fundido", () => {
        let s = publishScreenEra(empty, 1, "era-db")
        s = publishScreenEra(s, 2, "era-daima")
        expect(selectScreenEra(s)).toBe("era-daima")
        s = publishScreenEra(s, 2, null)
        expect(selectScreenEra(s)).toBe("era-db")
        expect(s.fade).toBe(false)
    })

    it("un cambio de la pantalla de abajo no le gana a la de arriba", () => {
        let s = publishScreenEra(empty, 1, "era-db")
        s = publishScreenEra(s, 2, "era-dbs")
        s = publishScreenEra(s, 1, "era-dbz")
        expect(selectScreenEra(s)).toBe("era-dbs")
    })

    it("publicar la misma era no cambia el estado", () => {
        const s = publishScreenEra(empty, 1, "era-db")
        expect(publishScreenEra(s, 1, "era-db")).toBe(s)
        expect(publishScreenEra(empty, 7, null)).toBe(empty)
    })
})

describe("resolveFollowedTheme", () => {
    it("solo Universo DB en modo era sigue la pantalla", () => {
        expect(resolveFollowedTheme("era", "era-universe", "era-dbz")).toBe("era-dbz")
        expect(resolveFollowedTheme("era", "era-universe", null)).toBe("era-universe")
        expect(resolveFollowedTheme("era", "era-db", "era-dbz")).toBe("era-db")
        expect(resolveFollowedTheme("era", "era-black", "era-dbz")).toBe("era-black")
        expect(resolveFollowedTheme("classic", "classic", "era-dbz")).toBe("classic")
        expect(resolveFollowedTheme("classic-minimalist", "classic", "era-dbz")).toBe("classic")
    })
})

describe("asEraThemeId", () => {
    it("acepta solo temas de era conocidos", () => {
        expect(asEraThemeId("era-dbkai")).toBe("era-dbkai")
        expect(asEraThemeId("era-amoled")).toBeNull()
        expect(asEraThemeId(null)).toBeNull()
    })
})
