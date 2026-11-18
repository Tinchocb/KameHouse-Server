import { describe, expect, it } from "vitest"
import { isTouchLikePointer, shouldDismissPanelDrag } from "./player-touch"
import { PLAYER_ICON_BTN } from "./player-theme"

describe("player-touch", () => {
    it("trata touch y pen como táctil, mouse no", () => {
        expect(isTouchLikePointer("touch")).toBe(true)
        expect(isTouchLikePointer("pen")).toBe(true)
        expect(isTouchLikePointer("mouse")).toBe(false)
        expect(isTouchLikePointer(undefined)).toBe(false)
    })
    it("cierra el panel por distancia o por velocidad hacia la derecha", () => {
        expect(shouldDismissPanelDrag(120, 0)).toBe(true)
        expect(shouldDismissPanelDrag(10, 900)).toBe(true)
        expect(shouldDismissPanelDrag(30, 100)).toBe(false)
        expect(shouldDismissPanelDrag(-200, -900)).toBe(false)
    })
    it("botones: 44 px base, 40 con puntero fino", () => {
        expect(PLAYER_ICON_BTN).toContain("w-11 h-11")
        expect(PLAYER_ICON_BTN).toContain("[@media(pointer:fine)]:w-10")
        expect(PLAYER_ICON_BTN).not.toContain("w-9 ")
    })
})
