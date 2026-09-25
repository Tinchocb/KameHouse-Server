import { describe, expect, it } from "vitest"
import {
    heroContainerVariants,
    heroContentContainerVariants,
    heroItemVariants,
    heroFadeOnlyVariants,
    gridContainerVariants,
    gridItemVariants,
    swapTextVariants,
} from "./variants"

describe("kinetics variants", () => {
    describe("heroContainerVariants", () => {
        it("has canonical stagger 40ms and delay 20ms", () => {
            expect(heroContainerVariants.visible).toMatchObject({
                opacity: 1,
                transition: {
                    staggerChildren: 0.04,
                    delayChildren: 0.02,
                },
            })
        })

        it("heroContentContainerVariants aliases heroContainerVariants", () => {
            expect(heroContentContainerVariants).toBe(heroContainerVariants)
        })
    })

    describe("heroItemVariants", () => {
        it("animates from y: 10 with entrance spring 380/30/0.8", () => {
            expect(heroItemVariants.hidden).toEqual({ opacity: 0, y: 10 })
            expect(heroItemVariants.visible).toEqual({
                opacity: 1,
                y: 0,
                transition: {
                    type: "spring",
                    stiffness: 380,
                    damping: 30,
                    mass: 0.8,
                },
            })
        })
    })

    describe("heroFadeOnlyVariants", () => {
        it("only animates opacity without y/x movement", () => {
            expect(heroFadeOnlyVariants.hidden).toEqual({ opacity: 0 })
            expect(heroFadeOnlyVariants.visible).toMatchObject({ opacity: 1 })
        })
    })

    describe("gridItemVariants", () => {
        it("contains NO filter or blur property", () => {
            const hidden = heroItemVariants.hidden as Record<string, unknown>
            expect(hidden.filter).toBeUndefined()
            const exit = gridItemVariants.exit as Record<string, unknown>
            expect(exit.filter).toBeUndefined()
            const visibleFn = gridItemVariants.visible as (i: number) => Record<string, unknown>
            const visible = visibleFn(0)
            expect(visible.filter).toBeUndefined()
        })

        it("caps stagger delay at 12 items (max 0.48s)", () => {
            const visibleFn = gridItemVariants.visible as (i: number) => { transition: { delay: number } }
            expect(visibleFn(0).transition.delay).toBe(0)
            expect(visibleFn(5).transition.delay).toBeCloseTo(0.2)
            expect(visibleFn(12).transition.delay).toBeCloseTo(0.48)
            expect(visibleFn(40).transition.delay).toBeCloseTo(0.48)
            expect(visibleFn(100).transition.delay).toBeCloseTo(0.48)
        })
    })

    describe("gridContainerVariants", () => {
        it("configures 40ms stagger for grid items", () => {
            expect(gridContainerVariants.visible).toMatchObject({
                transition: { staggerChildren: 0.04 },
            })
        })
    })

    describe("swapTextVariants", () => {
        it("matches transitions-polish scale (4px micro distance, 150ms quick duration)", () => {
            expect(swapTextVariants.initial).toEqual({ opacity: 0, y: 4 })
            expect(swapTextVariants.animate).toMatchObject({
                opacity: 1,
                y: 0,
                transition: { duration: 0.15 },
            })
            expect(swapTextVariants.exit).toEqual({
                opacity: 0,
                y: -4,
                transition: { duration: 0.12, ease: "easeIn" },
            })
        })
    })
})
