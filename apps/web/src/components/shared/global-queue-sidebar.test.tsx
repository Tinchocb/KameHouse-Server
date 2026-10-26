import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { GlobalQueueSidebar, entradaFilaCola, salidaDeFila } from "./global-queue-sidebar"
import { useQueueStore, type PlaylistItem } from "@/lib/stores/queue-store"
import { useUIStore } from "@/lib/stores/ui-store"

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }))

// happy-dom no hace layout: el virtualizador mide con offsetHeight. Se fija el alto del
// scroller (800 px) y el de cada fila (104 px, la misma estimación que usa el componente).
const VIEWPORT_PX = 800
const ROW_PX = 104
let rowPx = ROW_PX
const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight")

beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
        configurable: true,
        get(this: HTMLElement) {
            if (this.classList.contains("overflow-y-auto")) return VIEWPORT_PX
            if (this.hasAttribute("data-index")) return rowPx
            return 0
        },
    })
})

afterAll(() => {
    if (originalOffsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight)
})

function makeQueue(count: number): PlaylistItem[] {
    return Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        title: `Item ${i + 1}`,
        playableUrl: `/v/${i + 1}.mp4`,
        mediaId: 1,
        episodeNumber: i + 1,
    }))
}

// La cola de más de 50 ítems no puede cortarse: el último ítem tiene que poder reproducirse,
// reordenarse y quitarse. La lista está virtualizada, así que hay que hacer scroll hasta él.
function renderQueue(count: number) {
    useQueueStore.setState({ playlistQueue: makeQueue(count), currentQueueIndex: 0 })
    useUIStore.setState({ globalQueueOpen: true })
    render(<GlobalQueueSidebar />)
    const dialog = screen.getByRole("dialog", { name: "Mi Lista" })
    const scroller = dialog.querySelector(".overflow-y-auto") as HTMLElement
    return { dialog, scroller }
}

function scrollTo(scroller: HTMLElement, offset: number) {
    Object.defineProperty(scroller, "scrollTop", { configurable: true, value: offset })
    act(() => {
        fireEvent.scroll(scroller)
    })
}

// Al fondo del todo: alto total de la lista virtual menos el alto visible.
function scrollToEnd(scroller: HTMLElement) {
    const total = Number.parseFloat((scroller.firstElementChild as HTMLElement).style.height)
    scrollTo(scroller, total - VIEWPORT_PX)
}

describe("GlobalQueueSidebar con cola larga", () => {
    beforeEach(() => {
        useQueueStore.setState({ playlistQueue: [], currentQueueIndex: -1 })
        useUIStore.setState({ globalQueueOpen: false })
    })

    it("no monta todas las filas de una vez: solo las visibles", () => {
        renderQueue(120)
        const rendered = screen.queryAllByRole("button", { name: /^Reproducir Item / })
        expect(rendered.length).toBeGreaterThan(0)
        expect(rendered.length).toBeLessThan(120)
        expect(screen.queryByRole("button", { name: "Reproducir Item 120" })).toBeNull()
    })

    it("al hacer scroll aparece el último ítem y reproducirlo lo deja como actual", async () => {
        const { scroller } = renderQueue(120)
        scrollToEnd(scroller)
        const last = await screen.findByRole("button", { name: "Reproducir Item 120" })
        fireEvent.click(last)
        expect(useQueueStore.getState().currentQueueIndex).toBe(119)
        expect(useUIStore.getState().globalQueueOpen).toBe(false)
    })

    it("quitar el último ítem lo saca de la cola", async () => {
        const { scroller } = renderQueue(120)
        scrollToEnd(scroller)
        fireEvent.click(await screen.findByRole("button", { name: "Quitar Item 120 de Mi Lista" }))
        expect(useQueueStore.getState().playlistQueue).toHaveLength(119)
        expect(useQueueStore.getState().playlistQueue.some(i => i.title === "Item 120")).toBe(false)
    })

    it("mover arriba el último ítem cambia su posición en la cola", async () => {
        const { scroller } = renderQueue(120)
        scrollToEnd(scroller)
        const row = (await screen.findByRole("button", { name: "Reproducir Item 120" })).closest("[data-index]") as HTMLElement
        fireEvent.click(within(row).getByRole("button", { name: "Mover arriba" }))
        const titles = useQueueStore.getState().playlistQueue.map(i => i.title)
        expect(titles[118]).toBe("Item 120")
        expect(titles[119]).toBe("Item 119")
    })

    it("el contador de la cabecera cuenta la cola entera", () => {
        renderQueue(120)
        expect(useQueueStore.getState().playlistQueue).toHaveLength(120)
        expect(screen.getByText(/120/)).toBeTruthy()
    })
})

// La cascada de entrada corre solo la primera vez que una fila aparece en la apertura. La lista virtualizada
// desmonta las filas que salen del scroll: al volver a montarse no deben repetir la cascada.
// La salida de una fila solo corre cuando el usuario la quita o vacía la cola. Las filas que el scroll saca de la
// ventana no tienen salida: con salida se acumulaban en el DOM mientras corría su animación.
describe("salidaDeFila (salida de las filas de Mi Lista)", () => {
    it("una fila que no se quita no tiene salida: el scroll la desmonta de golpe", () => {
        expect(salidaDeFila(false, false)).toBeUndefined()
        expect(salidaDeFila(false, true)).toBeUndefined()
    })

    it("una fila que se quita sale con desplazamiento, o con fundido si el movimiento está reducido", () => {
        expect(salidaDeFila(true, false)).toMatchObject({ opacity: 0, x: 24 })
        expect(salidaDeFila(true, true)).toEqual({ opacity: 0 })
    })
})

describe("entradaFilaCola (cascada de entrada de Mi Lista)", () => {
    it("escalona las primeras ocho filas la primera vez que aparecen", () => {
        const mostradas = new Set<string>()
        expect(entradaFilaCola(mostradas, "a", 0)).toEqual({ animar: true, retraso: 0 })
        expect(entradaFilaCola(mostradas, "b", 3).retraso).toBeCloseTo(0.18)
        expect(entradaFilaCola(mostradas, "c", 8)).toEqual({ animar: true, retraso: 0 })
    })

    it("una fila ya mostrada en esta apertura entra sin animar ni esperar al remontarse", () => {
        const mostradas = new Set<string>()
        expect(entradaFilaCola(mostradas, "a", 2).animar).toBe(true)
        // Lo que hace el componente después de montar la fila.
        mostradas.add("a")
        expect(entradaFilaCola(mostradas, "a", 2)).toEqual({ animar: false, retraso: 0 })
    })

    it("una fila nueva que aparece al hacer scroll sigue entrando, sin esperar", () => {
        const mostradas = new Set(["a"])
        expect(entradaFilaCola(mostradas, "z", 40)).toEqual({ animar: true, retraso: 0 })
    })
})

// Respaldo: con la cola vacía no hay lista virtual ni filas.
// El primer render usa la altura estimada (104 px) y la medición (120 px) achica la ventana: la última fila que
// ese primer render montó sale del DOM. Esa fila tiene que quedar registrada como mostrada; si no, al volver a
// montarse entra con la cascada de siempre.
describe("GlobalQueueSidebar: filas que la medición saca de la ventana", () => {
    beforeEach(() => {
        rowPx = 120
        useQueueStore.setState({ playlistQueue: [], currentQueueIndex: -1 })
        useUIStore.setState({ globalQueueOpen: false })
    })
    afterEach(() => {
        rowPx = ROW_PX
    })

    it.each([
        [120, 1],
        [150, 2],
    ])("con filas de %i px, las que el primer render monta y la medición descarta no se animan al volver (al menos %i)", (alto, minimo) => {
        rowPx = alto
        // Cada fila se crea con su data-index: se registran todas las que React crea, también las del primer render
        // que después salen del DOM (un MutationObserver solo ve el nodo de primer nivel insertado).
        const creadas = new Set<number>()
        const setAttribute = Element.prototype.setAttribute
        const espia = vi.spyOn(Element.prototype, "setAttribute").mockImplementation(function (this: Element, nombre: string, valor: string) {
            if (nombre === "data-index") creadas.add(Number(valor))
            return setAttribute.call(this, nombre, valor)
        })
        const { scroller } = renderQueue(60)
        espia.mockRestore()

        const visibles = new Set([...scroller.querySelectorAll<HTMLElement>("[data-index]")].map((fila) => Number(fila.dataset.index)))
        const descartadas = [...creadas].filter((idx) => !visibles.has(idx))
        // Sin esto el test no prueba nada: el escenario tiene que darse (el primer render monta filas de más).
        expect(descartadas.length).toBeGreaterThanOrEqual(minimo)

        for (const idx of descartadas) {
            scrollToEnd(scroller)
            scrollTo(scroller, Math.max(0, 20 + idx * (alto + 12) - 100))
            const fila = scroller.querySelector<HTMLElement>(`[data-index="${idx}"]`)
            expect(fila, `la fila ${idx} vuelve a montarse`).not.toBeNull()
            expect(fila?.style.opacity, `la fila ${idx} no entra con opacidad 0`).not.toBe("0")
        }
    })
})

// La cascada de Mi Lista: cada apertura del panel hace entrar las primeras filas desde opacidad 0, también la
// primera vez y también después de cerrar y volver a abrir.
describe("GlobalQueueSidebar: cascada de Mi Lista al abrir", () => {
    beforeEach(() => {
        rowPx = ROW_PX
        useQueueStore.setState({ playlistQueue: [], currentQueueIndex: -1 })
        useUIStore.setState({ globalQueueOpen: false })
    })

    it("la primera apertura hace entrar las filas desde opacidad 0", () => {
        renderQueue(20)
        const primera = document.querySelector<HTMLElement>('[role="dialog"] [data-index="0"]')
        expect(primera?.style.opacity).toBe("0")
    })

    it("cerrar y volver a abrir el panel vuelve a hacer entrar las filas", () => {
        renderQueue(20)
        act(() => {
            useUIStore.setState({ globalQueueOpen: false })
        })
        act(() => {
            useUIStore.setState({ globalQueueOpen: true })
        })
        const reabierta = document.querySelector<HTMLElement>('[role="dialog"] [data-index="0"]')
        expect(reabierta?.style.opacity).toBe("0")
    })
})

describe("GlobalQueueSidebar vacío", () => {
    it("muestra el estado vacío sin filas", async () => {
        useQueueStore.setState({ playlistQueue: [], currentQueueIndex: -1 })
        useUIStore.setState({ globalQueueOpen: true })
        render(<GlobalQueueSidebar />)
        await waitFor(() => expect(screen.getByText("Mi Lista está vacía")).toBeTruthy())
        expect(screen.queryAllByRole("button", { name: /^Reproducir / })).toHaveLength(0)
    })
})
