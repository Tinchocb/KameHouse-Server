import { describe, expect, it } from "vitest"
import { getDotWindow } from "./hero-carousel-dots"

describe("getDotWindow", () => {
    it("shows every dot when the total fits", () => {
        expect(getDotWindow(2, 5)).toEqual([0, 1, 2, 3, 4])
    })

    it("centers the window on the active dot", () => {
        expect(getDotWindow(9, 19)).toEqual([6, 7, 8, 9, 10, 11, 12])
    })

    it("clamps the window at both edges", () => {
        expect(getDotWindow(0, 19)).toEqual([0, 1, 2, 3, 4, 5, 6])
        expect(getDotWindow(18, 19)).toEqual([12, 13, 14, 15, 16, 17, 18])
    })

    it("keeps the mobile window inside the desktop one and always includes the active dot", () => {
        for (let active = 0; active < 19; active++) {
            const desktop = getDotWindow(active, 19, 7)
            const mobile = getDotWindow(active, 19, 5)
            expect(mobile).toContain(active)
            for (const i of mobile) expect(desktop).toContain(i)
        }
    })
})
