import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { SagaDTO } from "@/api/types/series.types"
import { DRAGON_BALL_SERIES, DRAGON_BALL_SAGAS } from "@/lib/config/dragonball_sagas"
import { SagaSelector } from "./saga-selector"

// Caracterización de los botones migrados a Button/IconButton: nombre accesible,
// rol de botón y el handler que dispara cada uno.
const SAGAS = [
    { id: "saiyan", name: "Saga Saiyan", startEp: 1, endEp: 27, episodeRange: "1-27", subSagas: [] },
    {
        id: "frieza",
        name: "Saga Frieza",
        startEp: 28,
        endEp: 66,
        episodeRange: "28-66",
        subSagas: [{ id: "frieza-arco", name: "Arco Frieza", startEp: 28, endEp: 40, episodeRange: "28-40" }],
    },
] as SagaDTO[]

describe("SagaSelector: botones del sistema", () => {
    it("vista compacta: el botón de expandir llama a onToggleCollapse", () => {
        const onToggle = vi.fn()
        render(
            <SagaSelector
                sagas={SAGAS}
                activeSagaId="saiyan"
                onSelectSaga={vi.fn()}
                isCollapsed
                onToggleCollapse={onToggle}
            />,
        )
        fireEvent.click(screen.getByRole("button", { name: "Expandir panel de sagas" }))
        expect(onToggle).toHaveBeenCalledTimes(1)
    })

    it("vista compacta: cada saga es un botón con su nombre y la selecciona", () => {
        const onSelect = vi.fn()
        render(<SagaSelector sagas={SAGAS} activeSagaId="saiyan" onSelectSaga={onSelect} isCollapsed />)
        fireEvent.click(screen.getByRole("button", { name: "Saga Frieza" }))
        expect(onSelect).toHaveBeenCalledWith("frieza")
    })

    it("vista expandida: el botón de colapsar llama a onToggleCollapse", () => {
        const onToggle = vi.fn()
        render(
            <SagaSelector
                sagas={SAGAS}
                activeSagaId="saiyan"
                onSelectSaga={vi.fn()}
                onToggleCollapse={onToggle}
            />,
        )
        fireEvent.click(screen.getByRole("button", { name: "Colapsar panel de sagas" }))
        expect(onToggle).toHaveBeenCalledTimes(1)
    })

    it("sub-menú: 'Volver a sagas' quita el arco activo", () => {
        const onSelectSub = vi.fn()
        render(
            <SagaSelector
                sagas={SAGAS}
                activeSagaId="frieza"
                activeSubSagaId="frieza-arco"
                onSelectSaga={vi.fn()}
                onSelectSubSaga={onSelectSub}
            />,
        )
        fireEvent.click(screen.getByRole("button", { name: "Volver a sagas" }))
        expect(onSelectSub).toHaveBeenCalledWith("")
    })

    it("sidebar de sagas: renderiza las 7 sagas completas para DBZ", () => {
        const dbzSagas = DRAGON_BALL_SAGAS[DRAGON_BALL_SERIES.Z].map(s => ({
            id: s.id,
            name: s.title,
            startEp: s.startEp,
            endEp: s.endEp,
            episodeRange: `${s.startEp}-${s.endEp}`,
            subSagas: s.subSagas?.map(ss => ({ id: ss.id, name: ss.title, startEp: ss.startEp, endEp: ss.endEp, episodeRange: `${ss.startEp}-${ss.endEp}` }))
        })) as SagaDTO[]

        render(
            <SagaSelector
                sagas={dbzSagas}
                activeSagaId="saiyajin"
                onSelectSaga={vi.fn()}
            />
        )

        expect(screen.getByText("Saga de los Saiyajin")).toBeInTheDocument()
        expect(screen.getByText("Saga Namek y Freezer")).toBeInTheDocument()
        expect(screen.getByText("Saga de Garlic Jr.")).toBeInTheDocument()
        expect(screen.getByText("Saga de los Androides")).toBeInTheDocument()
        expect(screen.getByText("Saga de Cell")).toBeInTheDocument()
        expect(screen.getByText("Saga del Torneo del Otro Mundo")).toBeInTheDocument()
        expect(screen.getByText("Saga de Majin Buu")).toBeInTheDocument()
        // Las sagas de relleno se muestran sin etiqueta "Relleno" en el tab.
        expect(screen.queryByText(/relleno/i)).not.toBeInTheDocument()
    })

    it("sidebar de sagas: cambia a las 4 sagas cuando se activa DB Kai", () => {
        const kaiSagas = DRAGON_BALL_SAGAS[DRAGON_BALL_SERIES.KAI].map(s => ({
            id: s.id,
            name: s.title,
            startEp: s.startEp,
            endEp: s.endEp,
            episodeRange: `${s.startEp}-${s.endEp}`,
            subSagas: s.subSagas?.map(ss => ({ id: ss.id, name: ss.title, startEp: ss.startEp, endEp: ss.endEp, episodeRange: `${ss.startEp}-${ss.endEp}` }))
        })) as SagaDTO[]

        render(
            <SagaSelector
                sagas={kaiSagas}
                activeSagaId="saiyajin"
                onSelectSaga={vi.fn()}
            />
        )

        expect(screen.getByText("Saga de los Saiyajin")).toBeInTheDocument()
        expect(screen.getByText("Saga de Freezer")).toBeInTheDocument()
        expect(screen.getByText("Saga de los Androides y Cell")).toBeInTheDocument()
        expect(screen.getByText("Saga de Majin Buu")).toBeInTheDocument()
        // Garlic Jr y Torneo de Otro Mundo NO deben existir en Kai
        expect(screen.queryByText(/Garlic Jr/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/Torneo del Otro Mundo/i)).not.toBeInTheDocument()
    })

    it("tarjeta activa: renderiza el indicador con geometría concéntrica y sin doble anillo", () => {
        render(
            <SagaSelector
                sagas={SAGAS}
                activeSagaId="frieza"
                onSelectSaga={vi.fn()}
            />,
        )

        const activeBtn = screen.getByRole("button", { name: /Saga Frieza/i })
        const inactiveBtn = screen.getByRole("button", { name: /Saga Saiyan/i })

        const indicator = activeBtn.querySelector<HTMLElement>(".arc-card-active-indicator")
        expect(indicator).not.toBeNull()
        expect(indicator).toHaveClass("rounded-lg")
        expect(indicator?.className).not.toContain("ring-1")
        expect(indicator?.style.borderRadius).toBe("16px")
        expect(inactiveBtn.querySelector(".arc-card-active-indicator")).toBeNull()
    })
})
