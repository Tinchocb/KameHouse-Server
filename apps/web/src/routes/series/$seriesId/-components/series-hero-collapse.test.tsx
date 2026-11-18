import { fireEvent, render, screen, act } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as React from "react"
import { SeriesHeroCollapse } from "./series-hero-collapse"

describe("SeriesHeroCollapse", () => {
    beforeEach(() => {
        vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
            return setTimeout(() => cb(Date.now()), 0) as unknown as number
        })
        vi.stubGlobal("cancelAnimationFrame", (id: number) => {
            clearTimeout(id)
        })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it("renderiza el contenido hijo en flujo normal", () => {
        render(
            <SeriesHeroCollapse
                title="Dragon Ball Z"
                subtitle="Episodio 1 · 20 min"
                playLabel="Reproducir"
            >
                <div data-testid="hero-content">Hero Principal</div>
            </SeriesHeroCollapse>
        )

        expect(screen.getByTestId("hero-content")).toBeInTheDocument()
        expect(screen.getByText("Hero Principal")).toBeInTheDocument()
    })

    it("la píldora compacta refleja el episodio, título, subtítulo y dispara onPlay", () => {
        const onPlay = vi.fn()
        render(
            <SeriesHeroCollapse
                title="Aparece un misterioso guerrero"
                subtitle="Episodio 1 · 18 min restantes"
                episodeNumber={1}
                resumePercent={45}
                playLabel="Continuar episodio 1"
                onPlay={onPlay}
            >
                <div>Hero</div>
            </SeriesHeroCollapse>
        )

        expect(screen.getByText("1")).toBeInTheDocument()
        expect(screen.getByText("Aparece un misterioso guerrero")).toBeInTheDocument()
        expect(screen.getByText("Episodio 1 · 18 min restantes")).toBeInTheDocument()

        const playBtn = screen.getByRole("button", { name: "Continuar episodio 1", hidden: true })
        fireEvent.click(playBtn)
        expect(onPlay).toHaveBeenCalledTimes(1)
    })

    it("reacciona al scroll del contenedor activando la visibilidad", async () => {
        function ScrollHarness() {
            const containerRef = React.useRef<HTMLDivElement>(null)
            return (
                <div
                    ref={containerRef}
                    data-testid="scroll-container"
                    style={{ height: 400, overflowY: "auto" }}
                >
                    <SeriesHeroCollapse
                        scrollContainerRef={containerRef}
                        title="Dragon Ball"
                        subtitle="Episodio 5"
                        playLabel="Reproducir"
                    >
                        <div style={{ height: 800 }}>Contenido Alto</div>
                    </SeriesHeroCollapse>
                </div>
            )
        }

        render(<ScrollHarness />)

        const container = screen.getByTestId("scroll-container")
        const region = screen.getByRole("region", { hidden: true })

        // Inicialmente oculto
        expect(region).toHaveAttribute("aria-hidden", "true")

        // Simulamos scroll más allá del umbral (MIN_SCROLL_TRIGGER = 220)
        await act(async () => {
            Object.defineProperty(container, "scrollTop", { value: 350, writable: true })
            fireEvent.scroll(container)
            await new Promise((r) => setTimeout(r, 10))
        })

        // Tras scroll, se vuelve visible
        expect(region).toHaveAttribute("aria-hidden", "false")
    })
})
