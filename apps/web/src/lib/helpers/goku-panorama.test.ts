import { describe, it, expect } from "vitest"
import { getSpineConfig } from "./goku-panorama"

describe("goku-panorama helper", () => {
    describe("getSpineConfig", () => {
        it("returns curated theme for canonical series", () => {
            const dbTheme = getSpineConfig("dragon_ball", 0)
            expect(dbTheme.subtitle).toBe("DRAGON BALL")
            expect(dbTheme.kanji).toBe("亀")
            expect(dbTheme.vol).toBe("1")

            const dbzTheme = getSpineConfig("dragon_ball_z", 1)
            expect(dbzTheme.subtitle).toBe("DBZ")
            expect(dbzTheme.kanji).toBe("悟")
            expect(dbzTheme.vol).toBe("2")

            const daimaTheme = getSpineConfig("dragon_ball_daima", 5)
            expect(daimaTheme.subtitle).toBe("DB DAIMA")
            expect(daimaTheme.kanji).toBe("魔")
            expect(daimaTheme.vol).toBe("6")
        })

        it("returns calculated fallback theme for unknown or custom series", () => {
            const fallbackTheme = getSpineConfig("other_series", 7, "My Custom Series")
            expect(fallbackTheme.subtitle).toBe("MY CUSTOM SERIES")
            expect(fallbackTheme.kanji).toBe("★")
            expect(fallbackTheme.vol).toBe(String((7 % 5) + 1))
            expect(fallbackTheme.colIndex).toBe(7 % 5)
            expect(fallbackTheme.rawImg).toBe("")
        })

        it("defaults fallback title to 'SERIE' when not provided", () => {
            const fallbackTheme = getSpineConfig("unlisted", 0)
            expect(fallbackTheme.subtitle).toBe("SERIE")
        })
    })
})
