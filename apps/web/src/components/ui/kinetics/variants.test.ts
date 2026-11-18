import { describe, expect, it } from "vitest"
import {
    heroContainerVariants,
    heroItemVariants,
    gridItemVariants,
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
    })

    describe("heroItemVariants", () => {
        it("animates from y: 10 with entrance spring 380/30/0.8", () => {
            expect(heroItemVariants.hidden).toEqual({ opacity: 0, y: 10 })
            expect(heroItemVariants.visible).toEqual({
                opacity: 1,
                y: 0,
                transition: {
                    default: { type: "spring", stiffness: 380, damping: 30, mass: 0.8 },
                    opacity: { duration: 0.35, ease: "easeInOut" },
                },
            })
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

        it("bounds stagger below 300ms even in long lists", () => {
            const visibleFn = gridItemVariants.visible as (i: number) => { transition: { delay: number } }
            expect(visibleFn(0).transition.delay).toBe(0)
            expect(visibleFn(5).transition.delay).toBeCloseTo(0.2)
            expect(visibleFn(12).transition.delay).toBeLessThan(0.3)
            expect(visibleFn(40).transition.delay).toBe(visibleFn(12).transition.delay)
            expect(visibleFn(100).transition.delay).toBe(visibleFn(12).transition.delay)
        })
    })
})
