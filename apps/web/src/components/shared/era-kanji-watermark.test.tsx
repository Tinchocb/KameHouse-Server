import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { EraKanjiWatermark, resolveWatermarkKanji } from "./era-kanji-watermark"
import { useScreenEraStore } from "@/lib/theme/screen-era"

const mocks = vi.hoisted(() => ({
    theme: {
        themeMode: "era",
        themeEra: "era-universe",
        themeEnableBlurringEffects: true,
        themeEnableLiquidGlass: true,
    } as Record<string, unknown>,
    flat: false,
}))

vi.mock("@/api/hooks/settings.hooks", () => ({
    useGetSettings: () => ({ data: { theme: mocks.theme } }),
}))

vi.mock("@/lib/store", () => ({
    useAppStore: (select: (s: { themeVisual: Record<string, unknown> }) => unknown) =>
        select({ themeVisual: {} }),
}))

vi.mock("@/lib/theme/apply-custom-theme", () => ({
    useTransparencyState: () => ({
        flat: mocks.flat,
        reason: mocks.flat ? "manual" : null,
        systemSuggestsReduce: false,
    }),
}))

describe("resolveWatermarkKanji", () => {
    it("resuelve el kanji de cada era y usa 龍 para Universo DB", () => {
        expect(resolveWatermarkKanji("era-universe")).toBe("龍")
        expect(resolveWatermarkKanji("era-db")).toBe("亀")
        expect(resolveWatermarkKanji("era-dbz")).toBe("悟")
        expect(resolveWatermarkKanji("era-dbgt")).toBe("星")
        expect(resolveWatermarkKanji("era-dbkai")).toBe("改")
        expect(resolveWatermarkKanji("era-dbs")).toBe("超")
        expect(resolveWatermarkKanji("era-daima")).toBe("魔")
        expect(resolveWatermarkKanji(undefined)).toBe("龍")
    })
})

describe("EraKanjiWatermark", () => {
    beforeEach(() => {
        mocks.theme = {
            themeMode: "era",
            themeEra: "era-universe",
            themeEnableBlurringEffects: true,
            themeEnableLiquidGlass: true,
        }
        mocks.flat = false
        useScreenEraStore.setState({ entries: [], fade: false })
    })

    afterEach(() => {
        cleanup()
        useScreenEraStore.setState({ entries: [], fade: false })
    })

    it("se portalea en document.body con z-index -2 y dos planos SVG (eco y glifo)", () => {
        render(<EraKanjiWatermark />)

        const watermark = document.body.querySelector(".era-kanji-watermark")
        expect(watermark).not.toBeNull()
        expect(watermark?.getAttribute("aria-hidden")).toBe("true")
        expect(watermark?.getAttribute("style")).toContain("z-index: -2")
        expect(watermark?.getAttribute("data-era-kanji-watermark")).toBe("era-universe")

        const echo = watermark?.querySelector('[data-active="true"] .era-kanji-watermark__echo')
        const glyph = watermark?.querySelector('[data-active="true"] .era-kanji-watermark__glyph')
        expect(echo?.textContent).toBe("龍")
        expect(echo?.getAttribute("transform")).toBe("translate(3.8 3.8)")
        expect(glyph?.textContent).toBe("龍")
    })

    it("sigue la era publicada en pantalla cuando Universo DB está activo", () => {
        render(<EraKanjiWatermark />)
        expect(document.body.querySelector('[data-active="true"] .era-kanji-watermark__glyph')?.textContent).toBe("龍")

        act(() => {
            useScreenEraStore.setState({ entries: [{ id: 1, era: "era-dbz" }], fade: true })
        })

        const watermark = document.body.querySelector(".era-kanji-watermark")
        expect(watermark?.getAttribute("data-era-kanji-watermark")).toBe("era-dbz")
        expect(watermark?.querySelector('[data-active="true"] .era-kanji-watermark__echo')?.textContent).toBe("悟")
        expect(watermark?.querySelector('[data-active="true"] .era-kanji-watermark__glyph')?.textContent).toBe("悟")
    })

    it("no se renderiza en Minimalista, en modo plano ni en la paleta Negro (era-black)", () => {
        mocks.theme = { themeMode: "classic-minimalist", themeEra: "classic" }
        const view = render(<EraKanjiWatermark />)
        expect(document.body.querySelector(".era-kanji-watermark")).toBeNull()

        mocks.theme = { themeMode: "era", themeEra: "era-dbz" }
        mocks.flat = true
        view.rerender(<EraKanjiWatermark />)
        expect(document.body.querySelector(".era-kanji-watermark")).toBeNull()

        mocks.flat = false
        mocks.theme = { themeMode: "era", themeEra: "era-black" }
        view.rerender(<EraKanjiWatermark />)
        expect(document.body.querySelector(".era-kanji-watermark")).toBeNull()
    })
})
