import { describe, expect, it } from "vitest"
import {
    INITIAL_NAV_SCROLL_STATE,
    NAV_COMPACT_MIN_Y,
    NAV_DOWN_RUN,
    NAV_TOP_ZONE,
    NAV_UP_RUN,
    isNavDensity,
    nextNavScrollState,
    resolveNavCompact,
    type NavScrollState,
} from "./nav-compact"

/** Recorre una secuencia de posiciones de scroll y devuelve el estado final y cada cambio de `compact`. */
function run(positions: number[], from: NavScrollState = INITIAL_NAV_SCROLL_STATE) {
    let state = from
    const flips: Array<{ y: number; compact: boolean }> = []
    for (const y of positions) {
        const next = nextNavScrollState(state, y)
        if (next.compact !== state.compact) flips.push({ y, compact: next.compact })
        state = next
    }
    return { state, flips }
}

describe("nextNavScrollState", () => {
    it("empieza expandida y no se compacta en la zona superior", () => {
        expect(run([0, 4, 10, NAV_TOP_ZONE]).state.compact).toBe(false)
    })

    it("se compacta al bajar lo suficiente, pasado el mínimo de posición", () => {
        const down = Array.from({ length: 30 }, (_, i) => i * 10)
        const { flips } = run(down)
        expect(flips).toHaveLength(1)
        expect(flips[0].compact).toBe(true)
        expect(flips[0].y).toBeGreaterThanOrEqual(NAV_COMPACT_MIN_Y)
    })

    it("no se compacta por un movimiento chico aunque pase el mínimo de posición", () => {
        const parked: NavScrollState = { compact: false, lastY: NAV_COMPACT_MIN_Y + 40, run: 0 }
        const { state } = run([NAV_COMPACT_MIN_Y + 40 + NAV_DOWN_RUN - 1], parked)
        expect(state.compact).toBe(false)
    })

    it("no titila en el umbral: el vaivén chico no cambia el estado", () => {
        const base = NAV_COMPACT_MIN_Y + 200
        const jitter = Array.from({ length: 40 }, (_, i) => base + (i % 2 === 0 ? 0 : 10))
        const { flips, state } = run([0, 50, 150, base, ...jitter])
        // Se compacta una sola vez al bajar y el temblor de 10 px no lo revierte.
        expect(flips.filter((f) => !f.compact)).toHaveLength(0)
        expect(state.compact).toBe(true)
    })

    it("se expande al subir lo suficiente y exige un recorrido continuo", () => {
        const compacted = run([0, 60, 120, 200, 300]).state
        expect(compacted.compact).toBe(true)

        const small = run([300 - (NAV_UP_RUN - 1)], compacted)
        expect(small.state.compact).toBe(true)

        const enough = run([300 - 10, 300 - NAV_UP_RUN - 5], compacted)
        expect(enough.state.compact).toBe(false)
    })

    it("un cambio de sentido reinicia el recorrido acumulado", () => {
        const compacted = run([0, 60, 120, 200, 300]).state
        // Sube 20, baja 5, sube 20: nunca llegan 24 seguidos.
        const { state } = run([280, 285, 265], compacted)
        expect(state.compact).toBe(true)
    })

    it("vuelve a expandirse al llegar al tope, sin importar el recorrido", () => {
        const compacted = run([0, 60, 120, 200, 300]).state
        expect(run([NAV_TOP_ZONE], compacted).state.compact).toBe(false)
        expect(run([0], compacted).state.compact).toBe(false)
    })

    it("ignora posiciones negativas (rebote en el borde)", () => {
        expect(run([-20, -5, 0]).state).toEqual({ compact: false, lastY: 0, run: 0 })
    })

    it("devuelve el mismo objeto si no hay cambios", () => {
        const s = nextNavScrollState(INITIAL_NAV_SCROLL_STATE, 200)
        expect(nextNavScrollState(s, 200)).toBe(s)
    })
})

describe("resolveNavCompact", () => {
    it("Automática sigue el scroll y se abre con el puntero o el foco", () => {
        expect(resolveNavCompact({ density: "auto", scrollCompact: true, engaged: false })).toBe(true)
        expect(resolveNavCompact({ density: "auto", scrollCompact: true, engaged: true })).toBe(false)
        expect(resolveNavCompact({ density: "auto", scrollCompact: false, engaged: false })).toBe(false)
    })

    it("Expandida nunca se compacta", () => {
        expect(resolveNavCompact({ density: "expanded", scrollCompact: true, engaged: false })).toBe(false)
    })

    it("Compacta siempre muestra solo íconos, aunque haya puntero o foco", () => {
        expect(resolveNavCompact({ density: "compact", scrollCompact: false, engaged: true })).toBe(true)
    })
})

describe("isNavDensity", () => {
    it("acepta solo los tres valores guardables", () => {
        expect(isNavDensity("auto")).toBe(true)
        expect(isNavDensity("expanded")).toBe(true)
        expect(isNavDensity("compact")).toBe(true)
        expect(isNavDensity("tiny")).toBe(false)
        expect(isNavDensity(undefined)).toBe(false)
    })
})
