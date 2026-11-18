import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { useSpringPreset as useSpringPresetHook } from "./hooks"
import { renderHook, act, waitFor } from "@testing-library/react"

function useSpringPreset(...args: Parameters<typeof useSpringPresetHook>) {
    const hook = renderHook(function usePresetSnapshot() { return useSpringPresetHook(...args) })
    const value = hook.result.current
    hook.unmount()
    return value
}

vi.mock("@/hooks/use-reduced-motion", () => ({
    useReducedMotion: vi.fn(() => false),
}))

import { useReducedMotion } from "@/hooks/use-reduced-motion"

describe("kinetics hooks", () => {
    describe("useSpringPreset", () => {
        it("returns entrance preset by default", () => {
            const spring = useSpringPreset()
            expect(spring).toEqual({
                type: "spring",
                stiffness: 380,
                damping: 30,
                mass: 0.8,
            })
        })

        it("returns tabIndicator preset with canonical stiffness 480 and damping 34", () => {
            const spring = useSpringPreset("tabIndicator")
            expect(spring).toEqual({
                type: "spring",
                stiffness: 480,
                damping: 34,
            })
        })

        it("returns tabContent preset with canonical stiffness 280 and damping 28", () => {
            const spring = useSpringPreset("tabContent")
            expect(spring).toEqual({
                type: "spring",
                stiffness: 280,
                damping: 28,
            })
        })

        it("returns press preset with canonical stiffness 520 and damping 32", () => {
            const spring = useSpringPreset("press")
            expect(spring).toEqual({
                type: "spring",
                stiffness: 520,
                damping: 32,
            })
        })

        it("returns elasticCounter preset with canonical stiffness 400 and damping 25", () => {
            const spring = useSpringPreset("elasticCounter")
            expect(spring).toEqual({
                type: "spring",
                stiffness: 400,
                damping: 25,
            })
        })

        it("returns cardHover preset with stiffness 380 and damping 30", () => {
            const spring = useSpringPreset("cardHover")
            expect(spring).toEqual({
                type: "spring",
                stiffness: 380,
                damping: 30,
            })
        })

        it("returns island preset with stiffness 400 and damping 30 (islas del nav)", () => {
            const spring = useSpringPreset("island")
            expect(spring).toEqual({
                type: "spring",
                stiffness: 400,
                damping: 30,
            })
        })

        it("falls back to tween 0.15s when reduced motion is preferred", () => {
            vi.mocked(useReducedMotion).mockReturnValueOnce(true)
            const fallback = useSpringPreset("tabIndicator")
            expect(fallback).toEqual({
                type: "tween",
                duration: 0.15,
            })
        })

        describe("perfil Minimalista", () => {
            beforeEach(() => {
                document.documentElement.dataset.uiStyle = "classic-minimalist"
            })

            afterEach(() => {
                delete document.documentElement.dataset.uiStyle
            })

            it("aplica 160 ms para feedback sin rebote (press, cardHover, switch)", () => {
                const press = useSpringPreset("press")
                expect(press).toEqual({
                    type: "tween",
                    duration: 0.16,
                    ease: [0.23, 1, 0.32, 1],
                })
                const cardHover = useSpringPreset("cardHover")
                expect(cardHover).toEqual({
                    type: "tween",
                    duration: 0.16,
                    ease: [0.23, 1, 0.32, 1],
                })
            })

            it("aplica 180 ms para entradas o cambios de estado sin rebote (entrance, tabIndicator, selector)", () => {
                const entrance = useSpringPreset("entrance")
                expect(entrance).toEqual({
                    type: "tween",
                    duration: 0.18,
                    ease: [0.23, 1, 0.32, 1],
                })
                const tab = useSpringPreset("tabIndicator")
                expect(tab).toEqual({
                    type: "tween",
                    duration: 0.18,
                    ease: [0.23, 1, 0.32, 1],
                })
            })

            it("aplica transición inmediata (duración 0) con movimiento reducido", () => {
                vi.mocked(useReducedMotion).mockReturnValueOnce(true)
                const reduced = useSpringPreset("entrance")
                expect(reduced).toEqual({
                    type: "tween",
                    duration: 0,
                })
            })
        })
    })
})


describe("motion profile subscriptions", () => {
    it("reacts to theme changes and keeps TV on the default profile", async () => {
        delete document.documentElement.dataset.uiStyle
        const hook = renderHook(() => useSpringPresetHook("press"))
        expect(hook.result.current.type).toBe("spring")
        act(() => { document.documentElement.dataset.uiStyle = "classic-minimalist" })
        await waitFor(() => expect(hook.result.current).toMatchObject({ type: "tween", duration: 0.16 }))
        act(() => { document.documentElement.setAttribute("data-tv", "true") })
        hook.rerender()
        expect(hook.result.current).toMatchObject({ type: "spring", stiffness: 520 })
        hook.unmount()
        delete document.documentElement.dataset.uiStyle
        delete document.documentElement.dataset.tv
    })
})
