import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { useState } from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { LazyMotion, domAnimation } from "framer-motion"
import { usePerformanceStore } from "@/lib/hardware/performance-store"
import { SegmentedControl, type SegmentedControlProps } from "./segmented-control"

type Mode = "sagas" | "movies" | "specials"

const options = [
    { value: "sagas", label: "Sagas", count: 12 },
    { value: "movies", label: "Películas" },
    { value: "specials", label: "Especiales", disabled: true },
] as const

function renderControl(overrides: Partial<SegmentedControlProps<Mode>> = {}) {
    const onChange = vi.fn()
    render(
        <LazyMotion features={domAnimation}>
            <SegmentedControl<Mode>
                options={options}
                value="sagas"
                onChange={onChange}
                layoutId="test-indicator"
                aria-label="Contenido"
                {...overrides}
            />
        </LazyMotion>,
    )
    return { onChange }
}

describe("SegmentedControl", () => {
    it("expone radiogroup con aria-checked y el contador", () => {
        renderControl()
        expect(screen.getByRole("radiogroup", { name: "Contenido" })).toBeInTheDocument()
        expect(screen.getByRole("radio", { name: /Sagas/ })).toHaveAttribute("aria-checked", "true")
        expect(screen.getByRole("radio", { name: /Películas/ })).toHaveAttribute("aria-checked", "false")
        expect(screen.getByText("(12)")).toBeInTheDocument()
    })

    it("con semantics=tablist usa tab + aria-selected", () => {
        renderControl({ semantics: "tablist" })
        expect(screen.getByRole("tablist")).toBeInTheDocument()
        expect(screen.getByRole("tab", { name: /Sagas/ })).toHaveAttribute("aria-selected", "true")
    })

    it("asocia las pestañas con los identificadores provistos por el consumidor", () => {
        renderControl({
            semantics: "tablist",
            options: options.map(option => ({ ...option, id: `tab-${option.value}`, panelId: "contenido-panel" })),
        })
        expect(screen.getByRole("tab", { name: /Sagas/ })).toHaveAttribute("id", "tab-sagas")
        expect(screen.getByRole("tab", { name: /Películas/ })).toHaveAttribute("aria-controls", "contenido-panel")
    })

    it("no aplica asociaciones de panel a los filtros radiogroup", () => {
        renderControl({ options: options.map(option => ({ ...option, id: `tab-${option.value}`, panelId: "panel" })) })
        expect(screen.getByRole("radio", { name: /Sagas/ })).not.toHaveAttribute("aria-controls")
    })

    it("solo la opción seleccionada entra en el orden de tabulación", () => {
        renderControl()
        expect(screen.getByRole("radio", { name: /Sagas/ })).toHaveAttribute("tabindex", "0")
        expect(screen.getByRole("radio", { name: /Películas/ })).toHaveAttribute("tabindex", "-1")
    })

    it("las flechas saltan opciones deshabilitadas y dan la vuelta", () => {
        const { onChange } = renderControl({ value: "movies" })
        fireEvent.keyDown(screen.getByRole("radio", { name: /Películas/ }), { key: "ArrowRight" })
        expect(onChange).toHaveBeenLastCalledWith("sagas")
        fireEvent.keyDown(screen.getByRole("radio", { name: /Sagas/ }), { key: "ArrowLeft" })
        expect(onChange).toHaveBeenLastCalledWith("movies")
        fireEvent.keyDown(screen.getByRole("radio", { name: /Sagas/ }), { key: "End" })
        expect(onChange).toHaveBeenLastCalledWith("movies")
    })

    it("no emite cambios al clickear una opción deshabilitada", () => {
        const { onChange } = renderControl()
        fireEvent.click(screen.getByRole("radio", { name: /Especiales/ }))
        expect(onChange).not.toHaveBeenCalled()
    })
})

describe("SegmentedControl: foco tras una flecha", () => {
    afterEach(() => vi.restoreAllMocks())

    it("el radio seleccionado recibe el foco tras ArrowRight", () => {
        function Controlled() {
            const [value, setValue] = useState<Mode>("sagas")
            return (
                <LazyMotion features={domAnimation}>
                    <SegmentedControl<Mode> options={options} value={value} onChange={setValue} layoutId="test-foco-misma" aria-label="Contenido" />
                </LazyMotion>
            )
        }
        render(<Controlled />)
        const sagas = screen.getByRole("radio", { name: /Sagas/ })
        sagas.focus()
        fireEvent.keyDown(sagas, { key: "ArrowRight" })
        expect(screen.getByRole("radio", { name: /Películas/ })).toHaveAttribute("aria-checked", "true")
        expect(document.activeElement).toBe(screen.getByRole("radio", { name: /Películas/ }))
    })

    it("un control que se remonta tras una flecha recoge el foco en el radio seleccionado", () => {
        const first = render(
            <LazyMotion features={domAnimation}>
                <SegmentedControl<Mode> options={options} value="sagas" onChange={vi.fn()} layoutId="test-foco-remonte" aria-label="Contenido" />
            </LazyMotion>,
        )
        fireEvent.keyDown(screen.getByRole("radio", { name: /Sagas/ }), { key: "ArrowRight" })
        first.unmount()
        render(
            <LazyMotion features={domAnimation}>
                <SegmentedControl<Mode> options={options} value="movies" onChange={vi.fn()} layoutId="test-foco-remonte" aria-label="Contenido" />
            </LazyMotion>,
        )
        expect(document.activeElement).toBe(screen.getByRole("radio", { name: /Películas/ }))
    })

    it("el encargo de foco caduca y no roba el foco más tarde", () => {
        const now = vi.spyOn(Date, "now").mockReturnValue(1_000)
        const first = render(
            <LazyMotion features={domAnimation}>
                <SegmentedControl<Mode> options={options} value="sagas" onChange={vi.fn()} layoutId="test-foco-caduca" aria-label="Contenido" />
            </LazyMotion>,
        )
        fireEvent.keyDown(screen.getByRole("radio", { name: /Sagas/ }), { key: "ArrowRight" })
        first.unmount()
        now.mockReturnValue(1_000 + 6_000)
        render(
            <LazyMotion features={domAnimation}>
                <SegmentedControl<Mode> options={options} value="movies" onChange={vi.fn()} layoutId="test-foco-caduca" aria-label="Contenido" />
            </LazyMotion>,
        )
        expect(document.activeElement).not.toBe(screen.getByRole("radio", { name: /Películas/ }))
    })
})

describe("SegmentedControl y el nivel de rendimiento", () => {
    const indicatorOf = (name: RegExp) =>
        screen.getByRole("radio", { name }).querySelector<HTMLElement>(".absolute.inset-0")

    afterEach(() => usePerformanceStore.setState({ performanceProfile: "auto", autoThrottleActive: false }))

    it("con efectos permitidos la pill usa la elevación y el fondo de selección, sin resplandor", () => {
        usePerformanceStore.setState({ performanceProfile: "ultra" })
        renderControl()
        const cls = indicatorOf(/Sagas/)?.className ?? ""
        expect(cls).toContain("shadow-elevation-1")
        expect(cls).toContain("--selected-bg")
        expect(cls).not.toContain("shadow-[0_2px_14px")
    })

    it("en el perfil eco la pill tampoco lleva resplandor", () => {
        usePerformanceStore.setState({ performanceProfile: "eco" })
        renderControl()
        expect(indicatorOf(/Sagas/)?.className ?? "").not.toContain("shadow-[0_2px_14px")
    })

    it("con el throttle automático activo también se apagan los efectos", () => {
        usePerformanceStore.setState({ performanceProfile: "ultra", autoThrottleActive: true })
        renderControl()
        expect(indicatorOf(/Sagas/)?.className ?? "").not.toContain("shadow-[0_2px_14px")
    })

    it("la selección sigue funcionando sin efectos", () => {
        usePerformanceStore.setState({ performanceProfile: "eco" })
        const { onChange } = renderControl()
        fireEvent.click(screen.getByRole("radio", { name: /Películas/ }))
        expect(onChange).toHaveBeenCalledWith("movies")
        expect(indicatorOf(/Sagas/)).not.toBeNull()
    })
})

describe("SegmentedControl y el perfil de ahorro", () => {
    // Antes de cada caso y no al salir: al salir el control sigue montado y el cambio de store lo re-renderiza fuera de act.
    beforeEach(() => {
        usePerformanceStore.setState({ performanceProfile: "auto", autoThrottleActive: false })
    })

    // La pill animada es un m.div con layoutId y su radio en style; sin animación es un div plano sin style.
    const pillOf = (name: RegExp) =>
        screen.getByRole("radio", { name }).querySelector<HTMLElement>(".absolute.inset-0")

    it("con hardware capaz la pill es la capa animada", () => {
        usePerformanceStore.setState({ performanceProfile: "ultra" })
        renderControl()
        expect(pillOf(/Sagas/)?.style.borderRadius).toBe("9999px")
    })

    it("con perfil de ahorro la pill no anima, aunque el hardware sea capaz", () => {
        usePerformanceStore.setState({ performanceProfile: "ultra" })
        usePerformanceStore.setState({ performanceProfile: "eco" })
        renderControl()
        expect(pillOf(/Sagas/)?.style.borderRadius).toBe("")
    })
})
