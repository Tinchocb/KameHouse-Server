import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { effectiveOpacity, findSharedPoster, liftSharedPoster, noteActivation, restoreFocusWhenReady } from "./shared-element"

/** Caja simulada por atributos data-x/y/w/h (jsdom no hace layout). */
function stubLayout() {
    const original = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function () {
        const left = Number(this.dataset.x ?? 0)
        const top = Number(this.dataset.y ?? 0)
        const width = Number(this.dataset.w ?? 0)
        const height = Number(this.dataset.h ?? 0)
        return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} } as DOMRect
    }
    return () => {
        HTMLElement.prototype.getBoundingClientRect = original
    }
}

describe("findSharedPoster con posicion de referencia", () => {
    let restore: () => void
    beforeEach(() => {
        restore = stubLayout()
    })
    afterEach(() => {
        restore()
        document.body.innerHTML = ""
    })

    it("con dos copias de la misma pelicula elige la que estaba en ese lugar, no la mas visible", () => {
        document.body.innerHTML = `
            <div id="fila" data-shared-poster="movies:7" data-x="0" data-y="100" data-w="200" data-h="300"></div>
            <div id="grilla" data-shared-poster="movies:7" data-x="0" data-y="400" data-w="200" data-h="300"></div>`
        const grilla = { left: 0, top: 400, width: 200, height: 300 }
        expect(findSharedPoster("movies:7", document, grilla)?.id).toBe("grilla")
        // Sin referencia, la mas visible (la de la fila, de arriba en pantalla).
        expect(findSharedPoster("movies:7")?.id).toBe("fila")
    })

    it("con referencia no exige estar a la vista (al volver, la tarjeta puede estar fuera de pantalla)", () => {
        document.body.innerHTML = `<div id="fuera" data-shared-poster="series:3" data-x="0" data-y="5000" data-w="200" data-h="300"></div>`
        expect(findSharedPoster("series:3")).toBeNull()
        expect(findSharedPoster("series:3", document, { left: 0, top: 5000, width: 200, height: 300 })?.id).toBe("fuera")
    })
})

describe("liftSharedPoster y el clic", () => {
    let restore: () => void
    beforeEach(() => {
        restore = stubLayout()
    })
    afterEach(() => {
        restore()
        document.body.innerHTML = ""
    })

    /** Imagen "cargada" para que liftSharedPoster no descarte la copia. */
    function loadedImg(el: Element): HTMLImageElement {
        const img = el.querySelector("img") as HTMLImageElement
        Object.defineProperty(img, "complete", { value: true, configurable: true })
        Object.defineProperty(img, "naturalWidth", { value: 300, configurable: true })
        return img
    }

    it("levanta la tarjeta que se toco aunque la otra copia de la misma pelicula este mas a la vista", () => {
        document.body.innerHTML = `
            <div id="fila" data-shared-poster="movies:7" data-x="0" data-y="100" data-w="200" data-h="300"><img src="a.jpg" alt=""></div>
            <div id="grilla" data-shared-poster="movies:7" data-x="0" data-y="400" data-w="200" data-h="300"><img src="a.jpg" alt=""></div>`
        loadedImg(document.getElementById("fila") as HTMLElement)
        loadedImg(document.getElementById("grilla") as HTMLElement)
        // La de la fila esta mas a la vista; el usuario toco la de la grilla.
        noteActivation(document.getElementById("grilla"))
        const ghost = liftSharedPoster("movies:7")
        expect(ghost?.origin.top).toBe(400)
        ghost?.destroy()
    })

    it("la copia es la tarjeta entera (sus textos), sin identificadores ni claves y no interactiva", () => {
        document.body.innerHTML = `
            <button id="tarjeta" data-shared-poster="series:9" data-x="0" data-y="100" data-w="200" data-h="300">
                <img src="p.jpg" alt=""><span id="titulo">Dragon Ball</span>
            </button>`
        loadedImg(document.getElementById("tarjeta") as HTMLElement)
        const ghost = liftSharedPoster("series:9")
        expect(ghost).not.toBeNull()
        const wrapper = document.querySelector("[data-shared-ghost]") as HTMLElement
        expect(wrapper.textContent).toContain("Dragon Ball")
        // La copia no compite con la portada real: ni id, ni clave, ni interactiva.
        expect(wrapper.querySelector("[data-shared-poster]")).toBeNull()
        expect(wrapper.querySelector("#titulo")).toBeNull()
        expect(wrapper.querySelector("[inert]")).not.toBeNull()
        // La unica portada con esa clave en el documento es la original.
        expect(document.querySelectorAll('[data-shared-poster="series:9"]').length).toBe(1)
        ghost?.destroy()
        expect(document.querySelector("[data-shared-ghost]")).toBeNull()
    })
})

describe("effectiveOpacity", () => {
    afterEach(() => {
        document.body.innerHTML = ""
    })

    it("multiplica la opacidad del elemento por la de sus ancestros", () => {
        document.body.innerHTML = `<div style="opacity: 0.5"><div style="opacity: 0.5"><img id="i" alt=""></div></div>`
        expect(effectiveOpacity(document.getElementById("i"))).toBeCloseTo(0.25)
    })

    it("sin opacidades en linea vale 1", () => {
        document.body.innerHTML = `<div><span id="s"></span></div>`
        expect(effectiveOpacity(document.getElementById("s"))).toBe(1)
    })
})

describe("restoreFocusWhenReady", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
        document.body.innerHTML = ""
    })

    it("espera a que la tarjeta aparezca en la lista y enfoca el boton entonces", async () => {
        const restoreLayout = stubLayout()
        // Un frame simulado de 16 ms (jsdom no siempre trae requestAnimationFrame).
        vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => window.setTimeout(() => cb(performance.now()), 16) as unknown as number)
        vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id))
        document.body.innerHTML = `<main id="main" tabindex="-1"></main>`
        const main = document.getElementById("main") as HTMLElement
        main.focus()
        const cancel = restoreFocusWhenReady("movies:5", main, undefined, 400)
        // La tarjeta llega a los 60 ms (como un DeferredMount), con caja a la vista.
        window.setTimeout(() => {
            main.insertAdjacentHTML("beforeend", `<div><div data-shared-poster="movies:5" data-x="0" data-y="100" data-w="200" data-h="300"></div><button id="btn" aria-label="Pelicula"></button></div>`)
        }, 60)
        await new Promise((r) => window.setTimeout(r, 150))
        expect(document.activeElement?.id).toBe("btn")
        cancel()
        restoreLayout()
    })

    it("se rinde al cabo del tope si la tarjeta nunca aparece", async () => {
        vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => window.setTimeout(() => cb(performance.now()), 16) as unknown as number)
        vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id))
        document.body.innerHTML = `<main id="main" tabindex="-1"></main>`
        const main = document.getElementById("main") as HTMLElement
        main.focus()
        const cancel = restoreFocusWhenReady("movies:6", main, undefined, 80)
        await new Promise((r) => window.setTimeout(r, 200))
        expect(document.activeElement?.id).toBe("main")
        cancel()
    })
})
