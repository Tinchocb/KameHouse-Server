import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { usePerformanceStore } from "@/lib/hardware/performance-store"
import { useAppStore } from "@/lib/stores"
import { EraRail } from "./era-rail"
import type { EraRailItem } from "./era-rail-model"

// Cada capa con `layout` o `layoutId` anota su `transition`: es lo que decide si el riel anima con el resorte
// o salta con duración 0. El resto de props pasa tal cual al DOM.
const railTransitions = vi.hoisted(() => [] as Array<{ type?: string; duration?: number }>)

vi.mock("framer-motion", async (importOriginal) => {
    const actual = await importOriginal<typeof import("framer-motion")>()
    const { createElement } = await import("react")
    const layered = (tag: "div" | "span") =>
        function Layered({ layout, layoutId, transition, ...rest }: Record<string, unknown>) {
            if (layout || layoutId) railTransitions.push(transition as { type?: string; duration?: number })
            return createElement(tag, rest)
        }
    return { ...actual, m: { div: layered("div"), span: layered("span") } }
})

const ERAS: EraRailItem<"all" | "db" | "dbz" | "dbgt">[] = [
    { id: "all", label: "Todas las eras", kanji: "全", accent: "white", badge: "9", detail: "9 títulos" },
    { id: "db", label: "Dragon Ball", kanji: "亀", accent: "orange", years: "1986–1989", badge: "7", detail: "7 títulos" },
    { id: "dbz", label: "Dragon Ball Z", kanji: "悟", accent: "gold", years: "1989–1996", badge: "2", detail: "2 títulos", progress: { done: 1, total: 4 } },
    { id: "dbgt", label: "Dragon Ball GT", kanji: "星", accent: "red", years: "1996–1997", disabled: true },
]

function Harness({ variant = "rail" as "rail" | "bar", initial = "db" as "all" | "db" | "dbz" | "dbgt", onSelect = vi.fn() }) {
    const [active, setActive] = React.useState(initial)
    return (
        <EraRail
            eras={ERAS}
            activeId={active}
            onSelect={(id) => { onSelect(id); setActive(id) }}
            label="Eras de Dragon Ball"
            variant={variant}
        />
    )
}

const radios = () => screen.getAllByRole("radio")

afterEach(() => {
    cleanup()
    vi.useRealTimers()
    expect(document.documentElement.dataset.eraRail).toBeUndefined()
})

describe("EraRail · semántica", () => {
    it("es un radiogroup con nombre y un radio por era", () => {
        const { unmount } = render(<Harness />)
        const group = screen.getByRole("radiogroup", { name: "Eras de Dragon Ball" })
        expect(within(group).getAllByRole("radio")).toHaveLength(4)
        unmount()
    })

    it("cada era tiene nombre accesible con nombre, años y dato, también colapsado", () => {
        const { unmount } = render(<Harness />)
        expect(screen.getByRole("radio", { name: "Dragon Ball Z, 1989–1996, 2 títulos" })).toBeTruthy()
        expect(screen.getByRole("radio", { name: "Dragon Ball GT, 1996–1997, sin contenido" })).toBeTruthy()
        unmount()
    })

    it("marca la era activa con aria-checked", () => {
        const { unmount } = render(<Harness initial="dbz" />)
        expect(screen.getByRole("radio", { name: /^Dragon Ball Z/ }).getAttribute("aria-checked")).toBe("true")
        expect(screen.getByRole("radio", { name: /^Dragon Ball,/ }).getAttribute("aria-checked")).toBe("false")
        unmount()
    })

    it("la era sin contenido queda aria-disabled y no se elige", () => {
        const onSelect = vi.fn()
        const { unmount } = render(<Harness onSelect={onSelect} />)
        const gt = screen.getByRole("radio", { name: /GT/ })
        expect(gt.getAttribute("aria-disabled")).toBe("true")
        fireEvent.click(gt)
        expect(onSelect).not.toHaveBeenCalled()
        unmount()
    })
})

describe("EraRail · teclado (roving tabindex)", () => {
    it("solo la era activa entra en el orden de Tab", () => {
        const { unmount } = render(<Harness initial="dbz" />)
        expect(radios().map((r) => r.getAttribute("tabindex"))).toEqual(["-1", "-1", "0", "-1"])
        unmount()
    })

    it("flecha abajo elige y enfoca la siguiente, y el tabindex la sigue", () => {
        const onSelect = vi.fn()
        const { unmount } = render(<Harness initial="db" onSelect={onSelect} />)
        const db = screen.getByRole("radio", { name: /^Dragon Ball,/ })
        db.focus()
        fireEvent.keyDown(db, { key: "ArrowDown" })
        expect(onSelect).toHaveBeenCalledWith("dbz")
        const dbz = screen.getByRole("radio", { name: /^Dragon Ball Z/ })
        expect(document.activeElement).toBe(dbz)
        expect(dbz.getAttribute("tabindex")).toBe("0")
        expect(db.getAttribute("tabindex")).toBe("-1")
        unmount()
    })

    it("flecha abajo salta la era deshabilitada y da la vuelta", () => {
        const onSelect = vi.fn()
        const { unmount } = render(<Harness initial="dbz" onSelect={onSelect} />)
        const dbz = screen.getByRole("radio", { name: /^Dragon Ball Z/ })
        dbz.focus()
        fireEvent.keyDown(dbz, { key: "ArrowDown" })
        expect(onSelect).toHaveBeenCalledWith("all")
        unmount()
    })

    it("flecha arriba retrocede; Inicio y Fin van a los extremos habilitados", () => {
        const onSelect = vi.fn()
        const { unmount } = render(<Harness initial="dbz" onSelect={onSelect} />)
        const dbz = screen.getByRole("radio", { name: /^Dragon Ball Z/ })
        dbz.focus()
        fireEvent.keyDown(dbz, { key: "ArrowUp" })
        expect(onSelect).toHaveBeenLastCalledWith("db")
        fireEvent.keyDown(document.activeElement as HTMLElement, { key: "End" })
        expect(onSelect).toHaveBeenLastCalledWith("dbz")
        fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Home" })
        expect(onSelect).toHaveBeenLastCalledWith("all")
        unmount()
    })

    it("otras teclas no hacen nada", () => {
        const onSelect = vi.fn()
        const { unmount } = render(<Harness onSelect={onSelect} />)
        fireEvent.keyDown(screen.getByRole("radio", { name: /^Dragon Ball,/ }), { key: "a" })
        expect(onSelect).not.toHaveBeenCalled()
        unmount()
    })

    it("la barra móvil usa el mismo teclado", () => {
        const onSelect = vi.fn()
        const { unmount } = render(<Harness variant="bar" initial="db" onSelect={onSelect} />)
        const db = screen.getByRole("radio", { name: /^Dragon Ball,/ })
        db.focus()
        fireEvent.keyDown(db, { key: "ArrowRight" })
        expect(onSelect).toHaveBeenCalledWith("dbz")
        unmount()
    })
})

/** Caja del riel que recibe el puntero: el padre del grupo de radios. Si falta, el test falla aquí con mensaje claro. */
function railBox(rail: HTMLElement): HTMLElement {
    const group = rail.querySelector<HTMLElement>("[role='radiogroup']")
    if (!group?.parentElement) throw new Error("el riel no tiene grupo de radios con padre")
    return group.parentElement
}

describe("EraRail · colapsado y expandido (riel)", () => {
    it("arranca colapsado y se expande con el puntero encima", () => {
        const { unmount } = render(<Harness />)
        const rail = document.querySelector("[data-era-selector='rail']") as HTMLElement
        expect(rail.getAttribute("data-expanded")).toBe("false")
        fireEvent.pointerEnter(railBox(rail), { pointerType: "mouse" })
        expect(rail.getAttribute("data-expanded")).toBe("true")
        unmount()
    })

    it("un toque con el dedo no lo deja abierto", () => {
        const { unmount } = render(<Harness />)
        const rail = document.querySelector("[data-era-selector='rail']") as HTMLElement
        fireEvent.pointerEnter(railBox(rail), { pointerType: "touch" })
        expect(rail.getAttribute("data-expanded")).toBe("false")
        unmount()
    })

    it("se colapsa un instante después de sacar el puntero", () => {
        vi.useFakeTimers()
        const { unmount } = render(<Harness />)
        const rail = document.querySelector("[data-era-selector='rail']") as HTMLElement
        const box = railBox(rail)
        fireEvent.pointerEnter(box, { pointerType: "mouse" })
        fireEvent.pointerLeave(box)
        expect(rail.getAttribute("data-expanded")).toBe("true")
        act(() => { vi.advanceTimersByTime(200) })
        expect(rail.getAttribute("data-expanded")).toBe("false")
        vi.useRealTimers()
        unmount()
    })

    it("el texto visible (nombre, años, cifra) está en el DOM pero oculto a lectores: el nombre sale del aria-label", () => {
        const { unmount } = render(<Harness />)
        const dbz = screen.getByRole("radio", { name: /^Dragon Ball Z/ })
        expect(within(dbz).getByText("Dragon Ball Z")).toBeTruthy()
        expect(within(dbz).getByText("1989–1996")).toBeTruthy()
        expect(dbz.querySelector("[aria-hidden='true']")).toBeTruthy()
        unmount()
    })

    it("dibuja el anillo de avance solo en las eras con progreso", () => {
        const { unmount } = render(<Harness />)
        expect(screen.getByRole("radio", { name: /^Dragon Ball Z/ }).querySelector("svg")).toBeTruthy()
        expect(screen.getByRole("radio", { name: /^Dragon Ball,/ }).querySelector("svg")).toBeNull()
        unmount()
    })
})

describe("EraRail · barra móvil", () => {
    it("muestra el nombre solo en la era activa", () => {
        const { unmount } = render(<Harness variant="bar" initial="dbz" />)
        const bar = document.querySelector("[data-era-selector='bar']") as HTMLElement
        expect(within(bar).getAllByText("Dragon Ball Z")).toHaveLength(1)
        // La etiqueta inactiva sigue montada para que su salida se anime: colapsada y oculta a lectores de pantalla.
        const inactive = within(bar).getByText("Dragon Ball")
        expect(inactive.closest("[aria-hidden='true']")).not.toBeNull()
        expect(inactive.parentElement?.className).toContain("max-w-0")
        unmount()
    })
})

describe("EraRail · reserva de margen", () => {
    it("marca <html> mientras está montado y lo limpia al desmontar", () => {
        const { unmount } = render(<Harness variant="rail" />)
        expect(document.documentElement.dataset.eraRail).toBe("rail")
        unmount()
        expect(document.documentElement.dataset.eraRail).toBeUndefined()
    })

    it("la barra reserva alto en vez de ancho", () => {
        const { unmount } = render(<Harness variant="bar" />)
        expect(document.documentElement.dataset.eraRail).toBe("bar")
        unmount()
    })

    it("se monta fuera del contenido (portal al body)", () => {
        const { container, unmount } = render(<Harness />)
        expect(container.querySelector("[data-era-selector]")).toBeNull()
        expect(document.body.querySelector("[data-era-selector='rail']")).toBeTruthy()
        unmount()
    })
})

describe("EraRail · barra única (spyId, progressStyle)", () => {
    it("sin spyId el resalte sigue a activeId y no hay aria-current", () => {
        const { unmount } = render(<Harness initial="dbz" />)
        expect(document.querySelector("[aria-current='location']")).toBeNull()
        unmount()
    })

    it("con spyId la opción elegida sigue en aria-checked y la era vista lleva aria-current", () => {
        const { unmount } = render(
            <EraRail eras={ERAS} activeId="all" spyId="dbz" onSelect={() => {}} label="Eras" variant="rail" />,
        )
        expect(screen.getByRole("radio", { name: /^Todas/ }).getAttribute("aria-checked")).toBe("true")
        expect(screen.getByRole("radio", { name: /^Dragon Ball Z/ }).getAttribute("aria-current")).toBe("location")
        expect(screen.getByRole("radio", { name: /^Dragon Ball,/ }).getAttribute("aria-current")).toBeNull()
        unmount()
    })

    it("progressStyle=track dibuja el tramo relleno con la fracción de avance, sin anillo", () => {
        const { unmount } = render(
            <EraRail eras={ERAS} activeId="all" onSelect={() => {}} label="Eras" variant="rail" progressStyle="track" />,
        )
        const fills = document.querySelectorAll<HTMLElement>("[data-era-progress-fill]")
        expect(fills).toHaveLength(1)
        expect(fills[0].style.transform).toBe("scaleX(0.25)")
        expect(document.querySelector("svg circle")).toBeNull()
        unmount()
    })

    it("por defecto sigue dibujando el anillo", () => {
        const { unmount } = render(<Harness />)
        expect(document.querySelector("svg circle")).toBeTruthy()
        expect(document.querySelector("[data-era-progress-fill]")).toBeNull()
        unmount()
    })
})

describe("EraRail · gate de movimiento (useMotionTier)", () => {
    // Se reinicia antes de cada caso y no al salir: al salir el riel sigue montado y el cambio de store lo re-renderiza fuera de act.
    beforeEach(() => {
        railTransitions.length = 0
        usePerformanceStore.setState({ performanceProfile: "auto", autoThrottleActive: false })
        useAppStore.setState({ tvMode: false })
    })

    it("con hardware capaz el cambio de era usa el resorte del riel", () => {
        usePerformanceStore.setState({ performanceProfile: "ultra" })
        const { unmount } = render(<Harness />)
        expect(railTransitions.length).toBeGreaterThan(0)
        expect(railTransitions.every((t) => t.type === "spring")).toBe(true)
        unmount()
    })

    it("en modo TV no anima aunque el hardware sea capaz", () => {
        usePerformanceStore.setState({ performanceProfile: "ultra" })
        useAppStore.setState({ tvMode: true })
        const { unmount } = render(<Harness />)
        expect(railTransitions.length).toBeGreaterThan(0)
        expect(railTransitions.every((t) => t.duration === 0)).toBe(true)
        unmount()
    })

    it("con perfil eco (hardware justo) tampoco anima", () => {
        usePerformanceStore.setState({ performanceProfile: "eco" })
        const { unmount } = render(<Harness />)
        expect(railTransitions.length).toBeGreaterThan(0)
        expect(railTransitions.every((t) => t.duration === 0)).toBe(true)
        unmount()
    })
})
