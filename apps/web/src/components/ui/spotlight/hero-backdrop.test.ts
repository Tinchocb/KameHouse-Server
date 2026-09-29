import { describe, expect, it } from "vitest"
import { heroCompactRect, heroRightRect, isCompactArt } from "./hero-backdrop"

describe("heroRightRect", () => {
    it("stage más ancho que el 16:9: imagen entera a la altura del stage, pegada a la derecha", () => {
        expect(heroRightRect({}, { width: 1840, height: 748 })).toEqual({ left: 510, top: 0, width: 1330, height: 748 })
    })

    it("stage más angosto que el arte: se achica hasta el ancho (entera, sin recorte ni zoom)", () => {
        expect(heroRightRect({}, { width: 1226, height: 745 })).toEqual({ left: 0, top: 28, width: 1226, height: 690 })
    })

    it("contenedor angosto (mobile/tablet vertical): sigue cover", () => {
        expect(heroRightRect({}, { width: 1000, height: 800 })).toBeNull()
    })

    it("póster vertical de respaldo: entero a la derecha", () => {
        expect(heroRightRect({ aspect: 2 / 3 }, { width: 1440, height: 700 })).toEqual({ left: 973, top: 0, width: 467, height: 700 })
    })

    it("sin medidas todavía: nada", () => {
        expect(heroRightRect({}, null)).toBeNull()
        expect(heroRightRect({}, { width: 0, height: 0 })).toBeNull()
    })
})

describe("heroCompactRect", () => {
    it("arte chico en stage panorámico: 84% del alto, pegado a la derecha y algo arriba", () => {
        expect(heroCompactRect({}, { width: 1840, height: 748 })).toEqual({ left: 687, top: 42, width: 1116, height: 628 })
    })

    it("stage angosto: no compacta (queda cover)", () => {
        expect(heroCompactRect({}, { width: 1000, height: 700 })).toBeNull()
    })

    it("solo el arte con origen chico es compacto", () => {
        expect(isCompactArt({ sourceWidth: 1280 })).toBe(true)
        expect(isCompactArt({ sourceWidth: 1920 })).toBe(false)
        expect(isCompactArt({})).toBe(false)
    })
})
