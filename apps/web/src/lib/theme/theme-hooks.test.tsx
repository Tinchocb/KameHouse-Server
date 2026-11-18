import { cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useThemeSettings } from "./theme-hooks"

const state = vi.hoisted(() => ({
    theme: undefined as Record<string, unknown> | undefined,
    visual: {} as Record<string, unknown>,
}))
vi.mock("@/api/hooks/settings.hooks", () => ({ useGetSettings: () => ({ data: { theme: state.theme } }) }))
vi.mock("@/lib/store", () => ({
    useAppStore: (select: (s: { themeVisual: Record<string, unknown> }) => unknown) => select({ themeVisual: state.visual }),
}))
beforeEach(() => { state.theme = undefined; state.visual = {} })
afterEach(cleanup)

describe("effective theme preferences", () => {
    it("migrates Neutro with Universo DB and preserves disabled glass", () => {
        state.theme = { themeMode: "classic", themeEra: "era-db", themeEnableLiquidGlass: false, themeEnableBlurringEffects: false }
        const { result } = renderHook(useThemeSettings)
        expect(result.current).toMatchObject({ themeMode: "era", effectiveMode: "era", themeEra: "era-universe", themeEnableLiquidGlass: false, themeEnableBlurringEffects: false })
    })
    it.each([true, false])("preserves the Liquid Glass preference %s through Minimalista", enabled => {
        state.theme = { themeMode: "era", themeEra: "era-dbz", themeEnableLiquidGlass: enabled }
        const { result, rerender } = renderHook(useThemeSettings)
        expect(result.current.themeEnableLiquidGlass).toBe(enabled)
        state.visual = { themeMode: "classic-minimalist", themeEra: "classic" }
        rerender()
        expect(result.current.themeEnableLiquidGlass).toBe(false)
        state.visual = { themeMode: "era", themeEra: "era-dbz" }
        rerender()
        expect(result.current.themeEnableLiquidGlass).toBe(enabled)
        expect(result.current.themeEra).toBe("era-dbz")
    })
    it("uses Por era offline and follows era-only legacy settings", () => {
        const { result, rerender } = renderHook(useThemeSettings)
        expect(result.current.effectiveMode).toBe("era")
        state.theme = { themeEra: "era-dbs" }
        rerender()
        expect(result.current.effectiveMode).toBe("era")
        expect(result.current.themeEra).toBe("era-dbs")
    })
})
