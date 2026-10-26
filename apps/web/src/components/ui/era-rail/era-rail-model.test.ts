import { describe, expect, it } from "vitest"
import { eraAriaLabel, eraProgressFraction, isEraRailKey, nextEraIndex, pluralize, type EraRailItem } from "./era-rail-model"

const item = (over: Partial<EraRailItem> = {}): EraRailItem => ({ id: "dbz", label: "Dragon Ball Z", kanji: "悟", accent: "red", ...over })

describe("eraAriaLabel", () => {
    it("une nombre, años y dato en una frase", () => {
        expect(eraAriaLabel(item({ years: "1989–1996", detail: "17 títulos" }))).toBe("Dragon Ball Z, 1989–1996, 17 títulos")
    })

    it("baja la inicial del prefijo de años para que se lea de corrido", () => {
        expect(eraAriaLabel(item({ years: "Años 761–774", detail: "3 de 40 lapsos vistos" }))).toBe(
            "Dragon Ball Z, años 761–774, 3 de 40 lapsos vistos",
        )
    })

    it("avisa cuando la era no tiene contenido", () => {
        expect(eraAriaLabel(item({ disabled: true, detail: "0 títulos" }))).toBe("Dragon Ball Z, sin contenido")
    })

    it("solo el nombre si no hay más datos", () => {
        expect(eraAriaLabel(item())).toBe("Dragon Ball Z")
    })
})

describe("eraProgressFraction", () => {
    it("devuelve la fracción acotada entre 0 y 1", () => {
        expect(eraProgressFraction({ done: 10, total: 40 })).toBe(0.25)
        expect(eraProgressFraction({ done: 50, total: 40 })).toBe(1)
        expect(eraProgressFraction({ done: -1, total: 40 })).toBe(0)
    })

    it("es null sin dato o sin total", () => {
        expect(eraProgressFraction(undefined)).toBeNull()
        expect(eraProgressFraction({ done: 0, total: 0 })).toBeNull()
    })
})

describe("nextEraIndex", () => {
    const items = [{}, {}, { disabled: true }, {}] as const

    it("abajo y derecha avanzan; arriba e izquierda retroceden", () => {
        expect(nextEraIndex(items, 0, "ArrowDown")).toBe(1)
        expect(nextEraIndex(items, 0, "ArrowRight")).toBe(1)
        expect(nextEraIndex(items, 1, "ArrowUp")).toBe(0)
        expect(nextEraIndex(items, 1, "ArrowLeft")).toBe(0)
    })

    it("da la vuelta en los extremos", () => {
        expect(nextEraIndex(items, 3, "ArrowDown")).toBe(0)
        expect(nextEraIndex(items, 0, "ArrowUp")).toBe(3)
    })

    it("salta las eras deshabilitadas", () => {
        expect(nextEraIndex(items, 1, "ArrowDown")).toBe(3)
        expect(nextEraIndex(items, 3, "ArrowUp")).toBe(1)
    })

    it("Inicio y Fin van a la primera y la última habilitada", () => {
        expect(nextEraIndex([{ disabled: true }, {}, {}, { disabled: true }], 2, "Home")).toBe(1)
        expect(nextEraIndex([{ disabled: true }, {}, {}, { disabled: true }], 1, "End")).toBe(2)
    })

    it("devuelve -1 si no hay ninguna habilitada", () => {
        expect(nextEraIndex([{ disabled: true }], 0, "ArrowDown")).toBe(-1)
        expect(nextEraIndex([], 0, "Home")).toBe(-1)
    })
})

describe("isEraRailKey / pluralize", () => {
    it("reconoce solo las teclas de navegación", () => {
        expect(isEraRailKey("ArrowDown")).toBe(true)
        expect(isEraRailKey("End")).toBe(true)
        expect(isEraRailKey("Enter")).toBe(false)
        expect(isEraRailKey("a")).toBe(false)
    })

    it("concuerda el plural", () => {
        expect(pluralize(1, "título", "títulos")).toBe("1 título")
        expect(pluralize(0, "título", "títulos")).toBe("0 títulos")
        expect(pluralize(7, "título", "títulos")).toBe("7 títulos")
    })
})
