import { describe, it, expect } from "vitest"
import { getSpineConfig, SPINE_IDLE_ART_URLS } from "./goku-panorama"
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import path from "node:path"

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

describe("arte de estantería", () => {
    const allArtUrls = [
        ...new Set(
            ['dragon_ball', 'dragon_ball_z', 'dragon_ball_gt', 'dragon_ball_kai', 'dragon_ball_super', 'dragon_ball_daima']
                .map(id => getSpineConfig(id, 0))
                .flatMap(t => [t.rawImg, t.rawImgAtaque]),
        ),
    ]

    it("precarga globalmente solo las seis poses de reposo", () => {
        const themes = ['dragon_ball', 'dragon_ball_z', 'dragon_ball_gt', 'dragon_ball_kai', 'dragon_ball_super', 'dragon_ball_daima'].map(id => getSpineConfig(id, 0))
        expect(new Set(SPINE_IDLE_ART_URLS)).toEqual(new Set(themes.map(t => t.rawImg)))
        expect(SPINE_IDLE_ART_URLS).toHaveLength(6)
        for (const theme of themes) expect(SPINE_IDLE_ART_URLS).not.toContain(theme.rawImgAtaque)
    })
    it("lista cada imagen de la estantería una sola vez", () => {
        expect(allArtUrls).toContain("/icons/series-icons/db/reposo-guardia-sin-texto.png")
        expect(allArtUrls).toContain("/icons/series-icons/db/combate-kamehameha.png")
        expect(new Set(allArtUrls).size).toBe(allArtUrls.length)
        // Normal y ataque por serie (GT incluido, con su pose SSJ4 de ataque)
        expect(allArtUrls.length).toBe(12)
    })

    it("sirve los archivos verificados sin pérdida y conserva las fuentes originales", () => {
        const report = JSON.parse(readFileSync(path.resolve("../../docs/auditoria/shelf-art-optimization.json"), "utf8")) as {
            rows: { source: string; optimized: string; originalSha256: string; servedSha256: string; alphaAndVisibleRgbIdentical: boolean }[]
        }
        expect(new Set(report.rows.map(row => row.optimized))).toEqual(new Set(allArtUrls))
        const hash = (url: string) => createHash("sha256").update(readFileSync(path.resolve("public", url.slice(1)))).digest("hex")
        for (const row of report.rows) {
            expect(row.alphaAndVisibleRgbIdentical).toBe(true)
            expect(hash(row.source)).toBe(row.originalSha256)
            expect(hash(row.optimized)).toBe(row.servedSha256)
        }
    })
})
