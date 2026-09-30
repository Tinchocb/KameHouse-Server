import { describe, it, expect, vi, afterEach } from "vitest"
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

describe("SegmentedControl y el nivel de rendimiento", () => {
    const indicatorOf = (name: RegExp) =>
        screen.getByRole("radio", { name }).querySelector<HTMLElement>(".absolute.inset-0")

    afterEach(() => usePerformanceStore.setState({ performanceProfile: "auto", autoThrottleActive: false }))

    it("con efectos permitidos la pill lleva el brillo", () => {
        usePerformanceStore.setState({ performanceProfile: "ultra" })
        renderControl()
        expect(indicatorOf(/Sagas/)?.className).toContain("shadow-[0_2px_14px")
    })

    it("en el perfil eco la pill queda sin brillo", () => {
        usePerformanceStore.setState({ performanceProfile: "eco" })
        renderControl()
        const cls = indicatorOf(/Sagas/)?.className ?? ""
        expect(cls).not.toContain("shadow-[0_2px_14px")
        expect(cls).not.toContain("shadow-elevation-1") // versión sin animación
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
