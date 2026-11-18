import { describe, expect, it, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { useIsClassicMode, useIsEraMode, useIsMinimalistMode } from "./use-classic-mode"

describe("use-classic-mode — Coherencia de Temas", () => {
    beforeEach(() => {
        delete document.documentElement.dataset.mode
        delete document.documentElement.dataset.uiStyle
    })

    it("resuelve Modo Neutro (classic) con cromo acromático activo y sin era", () => {
        document.documentElement.dataset.mode = "classic"

        const { result: classicResult } = renderHook(() => useIsClassicMode())
        const { result: eraResult } = renderHook(() => useIsEraMode())
        const { result: minimalistResult } = renderHook(() => useIsMinimalistMode())

        expect(classicResult.current).toBe(true)
        expect(eraResult.current).toBe(false)
        expect(minimalistResult.current).toBe(false)
    })

    it("resuelve Modo Por Era (era) con cromo de saga activo y sin neutro", () => {
        document.documentElement.dataset.mode = "era"

        const { result: classicResult } = renderHook(() => useIsClassicMode())
        const { result: eraResult } = renderHook(() => useIsEraMode())
        const { result: minimalistResult } = renderHook(() => useIsMinimalistMode())

        expect(classicResult.current).toBe(false)
        expect(eraResult.current).toBe(true)
        expect(minimalistResult.current).toBe(false)
    })

    it("resuelve Clásico / Minimalista con cromo neutral y bandera minimalista", () => {
        document.documentElement.dataset.mode = "classic"
        document.documentElement.dataset.uiStyle = "classic-minimalist"

        const { result: classicResult } = renderHook(() => useIsClassicMode())
        const { result: eraResult } = renderHook(() => useIsEraMode())
        const { result: minimalistResult } = renderHook(() => useIsMinimalistMode())

        expect(classicResult.current).toBe(true)
        expect(eraResult.current).toBe(false)
        expect(minimalistResult.current).toBe(true)
    })
})
