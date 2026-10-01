import { describe, expect, it } from "vitest"
import { auroraBackground, fillTone, heroCompactRect, heroRightRect, isCompactArt, seamFadePx } from "./hero-backdrop"

describe("seamFadePx", () => {
    it("sujeto a la derecha: fundido largo, cortado antes de llegar al sujeto", () => {
        // foco 66% - 20% de medio sujeto = 46% de 1330 = 612 → tope 420
        expect(seamFadePx({ focal: { x: 66, y: 38 }, subject: "right" }, 1330)).toBe(399)
        // sujeto más a la izquierda: margen menor (40% - 20% = 20% de 1000 = 200)
        expect(seamFadePx({ focal: { x: 40, y: 40 }, subject: "right" }, 1000)).toBe(200)
    })

    it("grupo, centro o izquierda: queda el fundido corto de siempre", () => {
        expect(seamFadePx({ focal: { x: 50, y: 48 }, subject: "group" }, 1330)).toBe(120)
        expect(seamFadePx({ focal: { x: 50, y: 48 }, subject: "center" }, 500)).toBe(60)
    })

    it("nunca baja del fundido corto", () => {
        expect(seamFadePx({ focal: { x: 25, y: 40 }, subject: "right" }, 1330)).toBe(120)
    })

    it("con recorte lateral mide el foco sobre la imagen entera", () => {
        // visible 745 de 1330 (recorte 585): 72% - 20% = 52% de 1330 = 692 - 585 = 107 → mínimo 89 (12%) vs 107
        expect(seamFadePx({ focal: { x: 72, y: 45 }, subject: "right" }, 745, 585)).toBe(107)
    })
})

describe("fillTone", () => {
    it("oscurece al nivel pedido sin perder el matiz", () => {
        expect(fillTone("rgb(100, 100, 100)", 0.5, 1)).toEqual([50, 50, 50])
    })

    it("realza la saturación alrededor del gris", () => {
        const [r, , b] = fillTone("rgb(200, 100, 50)", 1, 1.4)
        expect(r).toBeGreaterThan(200)
        expect(b).toBeLessThan(50)
    })

    it("color inválido: usa un gris oscuro", () => {
        expect(fillTone("nada", 1, 1)).toEqual([20, 20, 24])
    })
})

describe("auroraBackground", () => {
    const zones = Array.from({ length: 48 }, (_, i) => `rgb(${i * 10}, 80, 120)`)
    const rect = { left: 510, top: 0, width: 1330, height: 748 }

    it("un foco por cada zona de las dos columnas de la costura", () => {
        const bg = auroraBackground({ left: "rgb(60, 80, 120)", zones }, rect)
        expect(bg?.backgroundImage.match(/radial-gradient/g)).toHaveLength(12)
        expect(bg?.backgroundColor).toMatch(/^rgb\(\d+,\d+,\d+\)$/)
    })

    it("sin la grilla completa: nada", () => {
        expect(auroraBackground({ left: "rgb(0, 0, 0)", zones: [] }, rect)).toBeNull()
    })
})

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
