import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { SHARED_FLIGHT_MS, canFly, departureStillValid, findSharedPoster, flightTransform, getDeparture, liftSharedPoster, pickPosterImage, rememberDeparture, restoreFocusToPoster, visibleFraction } from "./shared-element"

const VIEWPORT = { width: 1280, height: 720 }
const card = { left: 100, top: 200, width: 200, height: 300 }
const poster = { left: 80, top: 260, width: 240, height: 360 }

describe("visibleFraction", () => {
    it("1 si está entero dentro, 0 si está fuera", () => {
        expect(visibleFraction(card, VIEWPORT)).toBe(1)
        expect(visibleFraction({ left: 0, top: 800, width: 100, height: 100 }, VIEWPORT)).toBe(0)
    })

    it("fracción parcial cuando asoma por un borde", () => {
        expect(visibleFraction({ left: 0, top: 670, width: 100, height: 100 }, VIEWPORT)).toBeCloseTo(0.5)
    })

    it("0 para cajas vacías", () => {
        expect(visibleFraction({ left: 0, top: 0, width: 0, height: 10 }, VIEWPORT)).toBe(0)
    })
})

describe("flightTransform", () => {
    it("lleva la caja de origen hasta la de destino (origen arriba-izquierda)", () => {
        const { dx, dy, scale } = flightTransform(card, poster)
        expect(dx).toBe(-20)
        expect(dy).toBe(60)
        expect(scale).toBeCloseTo(1.2)
    })

    it("es la identidad cuando origen y destino coinciden", () => {
        expect(flightTransform(card, card)).toEqual({ dx: 0, dy: 0, scale: 1 })
    })
})

describe("canFly", () => {
    it("vuela entre dos portadas 2:3 a la vista", () => {
        expect(canFly(card, poster, VIEWPORT)).toBe(true)
    })

    it("no vuela si el origen o el destino quedan fuera de pantalla", () => {
        expect(canFly({ ...card, top: 900 }, poster, VIEWPORT)).toBe(false)
        expect(canFly(card, { ...poster, top: 900 }, VIEWPORT)).toBe(false)
    })

    it("no vuela si las proporciones difieren (se deformaría)", () => {
        expect(canFly(card, { left: 0, top: 0, width: 400, height: 300 }, VIEWPORT)).toBe(false)
    })

    it("no vuela con cajas diminutas", () => {
        expect(canFly({ left: 0, top: 0, width: 10, height: 15 }, poster, VIEWPORT)).toBe(false)
    })

    it("el vuelo cabe en el tope de 250 ms de las entradas de navegación", () => {
        expect(SHARED_FLIGHT_MS).toBeLessThanOrEqual(250)
    })
})

describe("portadas compartidas en el DOM", () => {
    afterEach(() => {
        document.body.innerHTML = ""
    })

    it("sin layout (jsdom) no hay portada a la vista, aunque la clave exista", () => {
        document.body.innerHTML = `<div data-shared-poster="movies:42" id="a"></div><div data-shared-poster="movies:43" id="b"></div>`
        expect(findSharedPoster("movies:42")).toBeNull()
    })

    it("no levanta una copia si la portada no está a la vista o no tiene imagen cargada", () => {
        document.body.innerHTML = `<div data-shared-poster="movies:42"><img src="x.jpg" alt=""></div>`
        expect(liftSharedPoster("movies:42")).toBeNull()
    })
})

describe("copia al levantar la portada (liftSharedPoster)", () => {
    let original: typeof HTMLElement.prototype.getBoundingClientRect

    beforeEach(() => {
        original = HTMLElement.prototype.getBoundingClientRect
        // jsdom no hace layout: toda caja mide 200x300 y está a la vista.
        HTMLElement.prototype.getBoundingClientRect = function () {
            return { top: 100, left: 100, bottom: 400, right: 300, width: 200, height: 300, x: 100, y: 100, toJSON() {} } as DOMRect
        }
    })

    afterEach(() => {
        HTMLElement.prototype.getBoundingClientRect = original
        document.body.innerHTML = ""
    })

    it("la copia no hereda la animación de entrada de la portada: nace visible, sin fundido al iniciar el vuelo", () => {
        document.body.innerHTML = `<div class="animate-slide-up" data-shared-poster="movies:5"><img src="p.jpg" alt=""></div>`
        const img = document.querySelector("img") as HTMLImageElement
        // jsdom no carga imágenes: se simula una imagen ya cargada.
        Object.defineProperty(img, "complete", { value: true })
        Object.defineProperty(img, "naturalWidth", { value: 300 })
        const ghost = liftSharedPoster("movies:5")
        const copy = document.querySelector<HTMLElement>("[data-shared-ghost] > *")
        expect(ghost).not.toBeNull()
        expect(copy?.style.animation).toBe("none")
        ghost?.destroy()
    })
})

describe("lugar de salida (para el regreso a la lista)", () => {
    it("recuerda dónde estaba la tarjeta, con el scroll y el tamaño de ventana de ese momento", () => {
        rememberDeparture("movies:1", card, 760)
        const dep = getDeparture("movies:1")
        expect(dep?.box).toEqual(card)
        expect(dep?.scrollTop).toBe(760)
        expect(dep?.viewport).toEqual({ width: window.innerWidth, height: window.innerHeight })
    })

    it("solo conserva las últimas (la memoria no crece sin límite)", () => {
        for (let i = 0; i < 40; i++) rememberDeparture(`movies:${1000 + i}`, card, 0)
        expect(getDeparture("movies:1000")).toBeUndefined()
        expect(getDeparture("movies:1039")).toBeDefined()
    })

    it("volver a salir por la misma ficha reemplaza el lugar anterior", () => {
        rememberDeparture("series:9", card, 0)
        rememberDeparture("series:9", poster, 300)
        expect(getDeparture("series:9")?.box).toEqual(poster)
    })

    it("el regreso solo vuela si el scroll y la ventana coinciden", () => {
        const dep = { box: card, scrollTop: 760, viewport: { width: 1280, height: 720 } }
        expect(departureStillValid(dep, 760, { width: 1280, height: 720 })).toBe(true)
        expect(departureStillValid(dep, 761, { width: 1280, height: 720 })).toBe(true)
        expect(departureStillValid(dep, 0, { width: 1280, height: 720 })).toBe(false)
        expect(departureStillValid(dep, 760, { width: 390, height: 844 })).toBe(false)
    })
})

describe("restoreFocusToPoster", () => {
    let original: typeof HTMLElement.prototype.getBoundingClientRect

    beforeEach(() => {
        original = HTMLElement.prototype.getBoundingClientRect
        // jsdom no hace layout: toda caja mide 200x300 y está a la vista.
        HTMLElement.prototype.getBoundingClientRect = function () {
            return { top: 100, left: 100, bottom: 400, right: 300, width: 200, height: 300, x: 100, y: 100, toJSON() {} } as DOMRect
        }
    })

    afterEach(() => {
        HTMLElement.prototype.getBoundingClientRect = original
        document.body.innerHTML = ""
    })

    it("devuelve el foco al botón de la tarjeta (hermano de la portada) si el foco se perdió", () => {
        document.body.innerHTML = `<div id="main"><div class="card"><button id="btn" aria-label="Película"></button><div data-shared-poster="movies:7"></div></div></div>`
        ;(document.activeElement as HTMLElement | null)?.blur()
        expect(restoreFocusToPoster("movies:7", document.getElementById("main"))).toBe(true)
        expect(document.activeElement?.id).toBe("btn")
    })

    it("si la portada es el propio botón, enfoca ese botón", () => {
        document.body.innerHTML = `<button id="poster" data-shared-poster="series:3"></button>`
        expect(restoreFocusToPoster("series:3", null)).toBe(true)
        expect(document.activeElement?.id).toBe("poster")
    })

    it("no le quita el foco a quien ya lo reclamó", () => {
        document.body.innerHTML = `<input id="otro"><div class="card"><button id="btn"></button><div data-shared-poster="movies:7"></div></div>`
        document.getElementById("otro")?.focus()
        expect(restoreFocusToPoster("movies:7", null)).toBe(false)
        expect(document.activeElement?.id).toBe("otro")
    })

    it("sin tarjeta con esa clave no hace nada", () => {
        document.body.innerHTML = `<div data-shared-poster="movies:1"></div>`
        expect(restoreFocusToPoster("movies:99", null)).toBe(false)
    })
})

describe("pickPosterImage", () => {
    afterEach(() => {
        document.body.innerHTML = ""
    })

    it("elige la imagen real, no el placeholder borroso (aria-hidden) que va antes", () => {
        document.body.innerHTML = `<div id="p"><img id="lqip" aria-hidden="true" src="a.jpg"><img id="real" src="b.jpg"></div>`
        expect(pickPosterImage(document.getElementById("p") as Element)?.id).toBe("real")
    })

    it("con una sola imagen, esa", () => {
        document.body.innerHTML = `<div id="p"><img id="solo" src="a.jpg"></div>`
        expect(pickPosterImage(document.getElementById("p") as Element)?.id).toBe("solo")
    })

    it("sin imágenes (portada de reemplazo con texto) no hay nada que copiar", () => {
        document.body.innerHTML = `<div id="p"><span>Sin portada</span></div>`
        expect(pickPosterImage(document.getElementById("p") as Element)).toBeNull()
    })
})
