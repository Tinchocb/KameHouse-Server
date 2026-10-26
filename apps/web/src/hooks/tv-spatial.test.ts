import { describe, expect, it } from "vitest"
import { pickNext, scoreCandidate, type SpatialCandidate, type SpatialDir } from "./tv-spatial"

type Box = [id: string, left: number, top: number, width: number, height: number]

const layout = (boxes: Box[]): SpatialCandidate<string>[] =>
    boxes.map(([el, left, top, width, height]) => ({ el, rect: { left, top, width, height } }))

/** Rectángulo de un nodo del layout. Un nodo inexistente es un error del test. */
function rectOf(nodes: SpatialCandidate<string>[], el: string) {
    const node = nodes.find((n) => n.el === el)
    if (!node) throw new Error(`nodo inexistente en el layout: ${el}`)
    return node.rect
}

/** Recorre el layout con una secuencia de flechas desde `start`. */
function walk(nodes: SpatialCandidate<string>[], start: string, dirs: SpatialDir[]): string[] {
    const path = [start]
    let cur = start
    for (const d of dirs) {
        const from = rectOf(nodes, cur)
        cur = pickNext(from, nodes, d, cur) ?? cur
        path.push(cur)
    }
    return path
}

// 1920×1080: skip-link arriba a la izquierda, botón "volver" bajo el logo,
// CTA + sagas + episodios, y la barra TV fija abajo.
const seriesPage = layout([
    ["back", 40, 16, 44, 44],
    ["play", 500, 420, 220, 56],
    ["saga1", 500, 560, 300, 80],
    ["saga2", 820, 560, 300, 80],
    ["ep1", 500, 700, 300, 120],
    ["ep2", 820, 700, 300, 120],
    ["nav-home", 600, 990, 120, 60],
    ["nav-series", 740, 990, 120, 60],
    ["nav-exit", 1060, 990, 120, 60],
])

// Ajustes: menú lateral a la izquierda (apilado) y panel de campos a la derecha.
const settingsPage = layout([
    ["menu1", 40, 200, 240, 48],
    ["menu2", 40, 256, 240, 48],
    ["menu3", 40, 312, 240, 48],
    ["field1", 400, 200, 600, 56],
    ["field2", 400, 300, 600, 56],
    ["field3", 400, 400, 600, 56],
    ["nav", 300, 990, 120, 60],
])

describe("pickNext", () => {
    it("filtra estrictamente por semiplano: un vecino detrás nunca gana", () => {
        const nodes = layout([
            ["a", 100, 100, 50, 50],
            ["behind", 90, 100, 50, 50],
            ["far", 600, 100, 50, 50],
        ])
        expect(pickNext(nodes[0].rect, nodes, "right", "a")).toBe("far")
        expect(pickNext(nodes[0].rect, nodes, "left", "a")).toBe("behind")
    })

    it("no mueve el foco si no hay candidatos en la dirección (sin fallback hacia atrás)", () => {
        const nodes = layout([
            ["top", 100, 100, 50, 50],
            ["bottom", 100, 300, 50, 50],
        ])
        expect(pickNext(nodes[0].rect, nodes, "up", "top")).toBeNull()
        expect(pickNext(nodes[1].rect, nodes, "down", "bottom")).toBeNull()
    })

    it("prefiere el alineado lejano frente al cercano desviado", () => {
        const nodes = layout([
            ["a", 100, 100, 50, 50],
            ["offAxis", 160, 400, 50, 50],
            ["aligned", 700, 100, 50, 50],
        ])
        expect(pickNext(nodes[0].rect, nodes, "right", "a")).toBe("aligned")
    })

    it("usa el semiplano como fallback cuando nada cae dentro del cono", () => {
        const nodes = layout([
            ["a", 100, 100, 50, 50],
            ["steep", 400, 900, 50, 50],
        ])
        expect(pickNext(nodes[0].rect, nodes, "right", "a")).toBe("steep")
    })

    it("devuelve null con lista vacía y no se devuelve a sí mismo", () => {
        const nodes = layout([["a", 0, 0, 10, 10]])
        expect(pickNext(nodes[0].rect, nodes, "down", "a")).toBeNull()
        expect(scoreCandidate(nodes[0].rect, nodes[0].rect, "down")).toBeNull()
    })
})

describe("ficha de serie", () => {
    it("desde 'volver' las flechas llegan a Reproducir (no oscilan)", () => {
        expect(walk(seriesPage, "back", ["down"])).toEqual(["back", "play"])
    })

    it("recorre CTA → saga → episodios → barra TV solo con ↓", () => {
        expect(walk(seriesPage, "play", ["down", "down", "down"])).toEqual([
            "play",
            "saga1",
            "ep1",
            "nav-home",
        ])
    })

    it("→ y ← se mueven dentro de la fila de sagas, ↑ vuelve al CTA", () => {
        expect(walk(seriesPage, "saga1", ["right", "left", "up"])).toEqual(["saga1", "saga2", "saga1", "play"])
    })

    it("en la barra TV: ↑ sube al contenido, → recorre los ítems", () => {
        expect(walk(seriesPage, "nav-home", ["right", "up"])[1]).toBe("nav-series")
        expect(pickNext(seriesPage[6].rect, seriesPage, "up", "nav-home")).toBe("ep1")
    })

    it("alcanza todos los elementos con una caminata sistemática", () => {
        const seen = new Set<string>(["back"])
        const queue = ["back"]
        for (let cur = queue.pop(); cur !== undefined; cur = queue.pop()) {
            const from = rectOf(seriesPage, cur)
            for (const d of ["up", "down", "left", "right"] as SpatialDir[]) {
                const next = pickNext(from, seriesPage, d, cur)
                if (next && !seen.has(next)) {
                    seen.add(next)
                    queue.push(next)
                }
            }
        }
        expect(seen.size).toBe(seriesPage.length)
    })
})

describe("menú lateral de Ajustes", () => {
    it("→ desde un ítem del menú va al campo de su misma altura, no al ítem siguiente", () => {
        expect(walk(settingsPage, "menu1", ["right"])[1]).toBe("field1")
        expect(["field1", "field2"]).toContain(walk(settingsPage, "menu2", ["right"])[1])
    })

    it("↓ en el último ítem no sube", () => {
        const from = settingsPage[2].rect
        expect(pickNext(from, settingsPage, "down", "menu3")).toBe("nav")
        expect(pickNext(from, settingsPage, "up", "menu3")).toBe("menu2")
    })

    it("← desde el panel vuelve al menú y el contenido llega a la barra", () => {
        expect(walk(settingsPage, "field1", ["left"])[1]).toBe("menu1")
        expect(walk(settingsPage, "field3", ["down"])[1]).toBe("nav")
    })
})
