import { describe, expect, it, vi } from "vitest"
import { useSpringPreset, useSpring } from "./hooks"

vi.mock("framer-motion", () => ({
    useReducedMotion: vi.fn(() => false),
}))

import { useReducedMotion } from "framer-motion"

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

        it("returns selector preset with stiffness 350 and damping 26 (modal Sorpréndeme)", () => {
            const spring = useSpringPreset("selector")
            expect(spring).toEqual({
                type: "spring",
                stiffness: 350,
                damping: 26,
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
    })

    describe("useSpring", () => {
        it("constructs custom spring when reduced motion is false", () => {
            const spring = useSpring(350, 25, 1)
            expect(spring).toEqual({
                type: "spring",
                stiffness: 350,
                damping: 25,
                mass: 1,
            })
        })

        it("returns tween fallback when reduced motion is true", () => {
            vi.mocked(useReducedMotion).mockReturnValueOnce(true)
            const fallback = useSpring(350, 25)
            expect(fallback).toEqual({
                type: "tween",
                duration: 0.15,
            })
        })
    })
})
