import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import postcss from "postcss"
import { renderHook } from "@testing-library/react"
import { useSpringPreset } from "@/components/ui/kinetics/hooks"
import { cardMotionProps } from "@/components/ui/kinetics/motion-tier"
import { useThemeSettings } from "@/lib/theme/theme-hooks"

const state = vi.hoisted(() => ({
    theme: undefined as Record<string, unknown> | undefined,
    visual: {} as Record<string, unknown>,
}))

vi.mock("@/api/hooks/settings.hooks", () => ({
    useGetSettings: () => ({ data: { theme: state.theme } }),
}))

vi.mock("@/lib/store", () => ({
    useAppStore: (select: (s: { themeVisual: Record<string, unknown> }) => unknown) =>
        select({ themeVisual: state.visual }),
}))

describe("classic-minimalist · regresión de diseño y contratos definitivos", () => {
    const tokensPath = join(__dirname, "classic-minimalist", "tokens.css")
    const tokensContent = existsSync(tokensPath) ? readFileSync(tokensPath, "utf8") : ""
    const root = postcss.parse(tokensContent)

    function getDeclValue(prop: string): string | undefined {
        let found: string | undefined
        root.walkRules((rule) => {
            if (rule.parent?.type !== "atrule") {
                rule.walkDecls(prop, (decl) => {
                    found = decl.value
                })
            }
        })
        return found
    }

    it("elimina sombras exteriores de tarjetas y hero en tokens", () => {
        expect(getDeclValue("--minimal-card-edge")).toBe("none")
        expect(getDeclValue("--minimal-card-edge-hover")).toBe("none")
        expect(getDeclValue("--minimal-hero-shadow")).toBe("none")
    })

    it("fija la selección tenue con texto claro sin pastilla blanca ni texto oscuro", () => {
        expect(getDeclValue("--selected-bg")).toBe("var(--minimal-fill-3)")
        expect(getDeclValue("--selected-fg")).toBe("var(--minimal-text-1)")
        expect(getDeclValue("--selected-border")).toBe("var(--minimal-line-4)")
    })

    it("fija los tokens de tiempo y aceleración sin rebote", () => {
        expect(getDeclValue("--minimal-duration-fast")).toBe("160ms")
        expect(getDeclValue("--minimal-duration")).toBe("180ms")
        expect(getDeclValue("--minimal-ease")).toBe("cubic-bezier(0.23, 1, 0.32, 1)")
        expect(getDeclValue("--minimal-press")).toBe("scale(0.98)")
    })
})

describe("classic-minimalist · perfil de movimiento en Kinetics", () => {
    beforeEach(() => {
        document.documentElement.dataset.uiStyle = "classic-minimalist"
    })

    afterEach(() => {
        delete document.documentElement.dataset.uiStyle
    })

    it("retorna transiciones tween exactas de 160ms para feedback y 180ms para entrada", () => {
        const { result: feedbackResult } = renderHook(() => useSpringPreset("press"))
        expect(feedbackResult.current).toEqual({
            type: "tween",
            duration: 0.16,
            ease: [0.23, 1, 0.32, 1],
        })

        const { result: entranceResult } = renderHook(() => useSpringPreset("entrance"))
        expect(entranceResult.current).toEqual({
            type: "tween",
            duration: 0.18,
            ease: [0.23, 1, 0.32, 1],
        })
    })

    it("retira la elevación en tarjetas (whileHover undefined) y aplica pulsación scale(0.98)", () => {
        const props = cardMotionProps("full", false, true)
        expect(props.whileHover).toBeUndefined()
        expect(props.whileTap).toEqual({ scale: 0.98 })
        expect(props.transition).toMatchObject({ duration: 0.16 })
    })
})

describe("classic-minimalist · recorrido y persistencia de preferencias", () => {
    beforeEach(() => {
        state.theme = undefined
        state.visual = {}
    })

    it("preserva la paleta Negro (era-black) y preferencias de vidrio en el recorrido Minimalista → Por era", () => {
        // Estado inicial: Por era con paleta Negro y Liquid Glass activado
        state.theme = {
            themeMode: "era",
            themeEra: "era-black",
            themeEnableLiquidGlass: true,
            themeEnableBlurringEffects: true,
        }

        const { result, rerender } = renderHook(() => useThemeSettings())
        expect(result.current.effectiveMode).toBe("era")
        expect(result.current.themeEra).toBe("era-black")
        expect(result.current.themeEnableLiquidGlass).toBe(true)

        // El usuario navega a Minimalista
        state.visual = {
            themeMode: "classic-minimalist",
            themeEra: "classic",
        }
        rerender()

        // Minimalista es plano por contrato: 0px de desenfoque, cero Liquid Glass
        expect(result.current.effectiveMode).toBe("classic-minimalist")
        expect(result.current.themeEnableLiquidGlass).toBe(false)

        // El usuario regresa a Por era: se conservan intactos la era Negro y Liquid Glass
        state.visual = {
            themeMode: "era",
            themeEra: "era-black",
        }
        rerender()

        expect(result.current.effectiveMode).toBe("era")
        expect(result.current.themeEra).toBe("era-black")
        expect(result.current.themeEnableLiquidGlass).toBe(true)
    })
})
