import { describe, expect, it } from "vitest"
import {
    NAV_DIM_OPACITY,
    NAV_ENTER_MS,
    NAV_EXIT_MS,
    ROUTE_PENDING_ATTR,
    classifyNavigation,
    enterKeyframes,
    entryStartOpacity,
    exitKeyframes,
    isRoutePendingPlaceholder,
    routeShape,
    sharedPosterKey,
} from "./navigation-transition"

describe("isRoutePendingPlaceholder", () => {
    it("reconoce el placeholder de carga de la ruta por su marca", () => {
        const el = document.createElement("div")
        el.setAttribute(ROUTE_PENDING_ATTR, "")
        expect(isRoutePendingPlaceholder(el)).toBe(true)
    })

    it("una pagina normal o la falta de raiz no son placeholder", () => {
        expect(isRoutePendingPlaceholder(document.createElement("main"))).toBe(false)
        expect(isRoutePendingPlaceholder(null)).toBe(false)
    })
})

describe("classifyNavigation", () => {
    it("entrar a una ficha desde una lista es drill-in", () => {
        expect(classifyNavigation("/movies", "/movies/42").kind).toBe("drill-in")
        expect(classifyNavigation("/series", "/series/7").kind).toBe("drill-in")
        expect(classifyNavigation("/home", "/movies/42").kind).toBe("drill-in")
    })

    it("volver de una ficha es drill-out", () => {
        expect(classifyNavigation("/movies/42", "/movies").kind).toBe("drill-out")
        expect(classifyNavigation("/series/7", "/home").kind).toBe("drill-out")
    })

    it("entre pestañas principales da el sentido según el orden de la barra", () => {
        expect(classifyNavigation("/home", "/series")).toEqual({ kind: "tab", direction: 1 })
        expect(classifyNavigation("/settings", "/chronology")).toEqual({ kind: "tab", direction: -1 })
    })

    it("de ficha a ficha o entre rutas fuera de la barra es estándar", () => {
        expect(classifyNavigation("/movies/1", "/movies/2").kind).toBe("standard")
        expect(classifyNavigation("/home", "/mylist").kind).toBe("standard")
        expect(classifyNavigation("/series", "/series").kind).toBe("standard")
    })
})

describe("sharedPosterKey", () => {
    it("une tarjeta y ficha por tipo e id", () => {
        expect(sharedPosterKey("/movies/1039144")).toBe("movies:1039144")
        expect(sharedPosterKey("/series/12609")).toBe("series:12609")
        expect(sharedPosterKey("/series/12609/")).toBe("series:12609")
    })

    it("no comparte portada en listas ni en rutas más profundas", () => {
        expect(sharedPosterKey("/movies")).toBeNull()
        expect(sharedPosterKey("/series/12/episodes")).toBeNull()
        expect(sharedPosterKey("/chronology")).toBeNull()
    })
})

describe("routeShape", () => {
    it("trata ids numéricos como la misma ruta", () => {
        expect(routeShape("/series/1")).toBe(routeShape("/series/456"))
        expect(routeShape("/series/1")).not.toBe(routeShape("/movies/1"))
    })
})

describe("enterKeyframes", () => {
    it("solo anima opacity y transform", () => {
        for (const nav of [classifyNavigation("/home", "/series"), classifyNavigation("/series", "/series/1"), classifyNavigation("/series/1", "/series"), classifyNavigation("/a", "/b")]) {
            for (const frame of enterKeyframes(nav, 0.6)) {
                expect(Object.keys(frame).sort()).toEqual(["opacity", "transform"])
            }
        }
    })

    it("termina siempre en opacidad 1 y sin desplazamiento", () => {
        const last = enterKeyframes(classifyNavigation("/home", "/series"), 0.6).at(-1)
        expect(last?.opacity).toBe(1)
        expect(String(last?.transform)).toContain("translate3d(0, 0, 0)")
    })

    it("la pestaña de la derecha entra desde la derecha y la de la izquierda desde la izquierda", () => {
        const right = enterKeyframes({ kind: "tab", direction: 1 }, 0.6)[0].transform
        const left = enterKeyframes({ kind: "tab", direction: -1 }, 0.6)[0].transform
        expect(right).toContain("translate3d(8px")
        expect(left).toContain("translate3d(-8px")
    })

    it("el drill-out es la inversa del drill-in (llega desde arriba en vez de desde abajo)", () => {
        const drillIn = String(enterKeyframes({ kind: "drill-in", direction: 0 }, 0.6)[0].transform)
        const drillOut = String(enterKeyframes({ kind: "drill-out", direction: 0 }, 0.6)[0].transform)
        expect(drillIn).toContain("10px")
        expect(drillOut).toContain("-6px")
    })

    it("con portada compartida la página solo se funde (sin movimiento que mueva el destino)", () => {
        const frames = enterKeyframes({ kind: "drill-in", direction: 0 }, 0.8, true)
        expect(frames[0]).toEqual({ opacity: 0.8, transform: "translate3d(0, 0, 0)" })
    })

    it("respeta la opacidad de partida que se le da", () => {
        expect(enterKeyframes({ kind: "standard", direction: 0 }, 0.85)[0].opacity).toBe(0.85)
    })

    it("con escalonado, el contenedor no baja la opacidad", () => {
        // Los bloques se funden solos; si el contenedor también bajara, el primer cuadro se multiplicaría (0,6 × 0,6).
        for (const nav of [classifyNavigation("/home", "/series"), classifyNavigation("/series", "/series/1"), classifyNavigation("/series/1", "/series"), classifyNavigation("/a", "/b")]) {
            const frames = enterKeyframes(nav, NAV_DIM_OPACITY, false, true)
            for (const frame of frames) {
                expect(Object.keys(frame)).toEqual(["transform"])
            }
            expect(String(frames.at(-1)?.transform)).toContain("translate3d(0, 0, 0)")
        }
    })
})

describe("salida y continuidad", () => {
    it("la salida solo baja la opacidad", () => {
        const frames = exitKeyframes()
        expect(frames.map((f) => Object.keys(f))).toEqual([["opacity"], ["opacity"]])
        expect(frames[0].opacity).toBe(1)
        expect(frames[1].opacity).toBe(NAV_DIM_OPACITY)
    })

    it("respeta los topes de motion de navegación (entrada ≤ 250 ms, salida ≤ 120 ms)", () => {
        expect(NAV_ENTER_MS).toBeLessThanOrEqual(250)
        expect(NAV_EXIT_MS).toBeLessThanOrEqual(120)
    })

    it("la entrada continúa desde la opacidad de la salida y nunca baja del mínimo", () => {
        expect(entryStartOpacity(0.9)).toBe(0.9)
        expect(entryStartOpacity(0.3)).toBe(NAV_DIM_OPACITY)
    })

    it("si la salida no llegó a verse (seguía en 1) la entrada arranca desde la opacidad base", () => {
        expect(entryStartOpacity(1)).toBe(NAV_DIM_OPACITY)
        expect(entryStartOpacity(0.99)).toBe(NAV_DIM_OPACITY)
    })

    it("sin salida previa (o con valor inválido) arranca en el mínimo", () => {
        expect(entryStartOpacity(null)).toBe(NAV_DIM_OPACITY)
        expect(entryStartOpacity(Number.NaN)).toBe(NAV_DIM_OPACITY)
    })
})
