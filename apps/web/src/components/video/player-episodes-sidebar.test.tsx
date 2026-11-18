import { render, screen, fireEvent } from "@testing-library/react"
import { LazyMotion, domAnimation } from "framer-motion"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { PlayerEpisodesSidebar } from "./player-episodes-sidebar"

vi.mock("@tanstack/react-virtual", () => ({
    useVirtualizer: (options: { count: number }) => ({
        options: { scrollMargin: 0 },
        getTotalSize: () => options.count * 236,
        getVirtualItems: () =>
            Array.from({ length: Math.min(options.count, 10) }, (_, index) => ({
                key: index,
                index,
                start: index * 236,
                size: 224,
            })),
        measureElement: () => {},
        scrollToIndex: vi.fn(),
    }),
}))

const MOCK_EPISODES = Array.from({ length: 30 }, (_, i) => ({
    episodeNumber: i + 1,
    title: `Episodio ${i + 1}`,
    thumbnail: `/thumbs/${i + 1}.jpg`,
}))

describe("PlayerEpisodesSidebar", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Element.prototype.scrollBy = vi.fn()
        Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
            configurable: true,
            value: 7080,
        })
        Object.defineProperty(HTMLElement.prototype, "clientWidth", {
            configurable: true,
            value: 1000,
        })
        Object.defineProperty(HTMLElement.prototype, "scrollLeft", {
            configurable: true,
            writable: true,
            value: 500,
        })
    })

    const renderSidebar = (props: Partial<React.ComponentProps<typeof PlayerEpisodesSidebar>> = {}) => {
        return render(
            <LazyMotion features={domAnimation}>
                <PlayerEpisodesSidebar
                    isOpen={true}
                    onClose={vi.fn()}
                    episodes={MOCK_EPISODES}
                    currentEpisodeNumber={1}
                    onSelectEpisode={vi.fn()}
                    {...props}
                />
            </LazyMotion>
        )
    }

    it("renderiza el diálogo de episodios con sus botones de desplazamiento", () => {
        renderSidebar()
        expect(screen.getByRole("dialog", { name: "Episodios" })).toBeInTheDocument()

        const scrollRightFloating = screen.getByRole("button", {
            name: /Desplazar episodios hacia la derecha/i,
        })
        expect(scrollRightFloating).toBeInTheDocument()

        const scrollLeftFloating = screen.getByRole("button", {
            name: /Desplazar episodios hacia la izquierda/i,
        })
        expect(scrollLeftFloating).toBeInTheDocument()

        // Botones en la cabecera
        const headerPrev = screen.getByRole("button", { name: /Episodios anteriores/i })
        const headerNext = screen.getByRole("button", { name: /Siguientes episodios/i })
        expect(headerPrev).toBeInTheDocument()
        expect(headerNext).toBeInTheDocument()
    })

    it("llama a scrollBy al pulsar las flechas de desplazamiento", () => {
        renderSidebar()

        const scrollRightBtn = screen.getByRole("button", {
            name: /Desplazar episodios hacia la derecha/i,
        })

        // El botón está habilitado porque scrollLeft = 500 y scrollWidth = 7080
        expect(scrollRightBtn).not.toBeDisabled()
        fireEvent.click(scrollRightBtn)
        expect(Element.prototype.scrollBy).toHaveBeenCalledWith(
            expect.objectContaining({
                behavior: "smooth",
            })
        )
    })

    it("cierra el diálogo al pulsar la tecla Escape", () => {
        const onClose = vi.fn()
        renderSidebar({ onClose })

        fireEvent.keyDown(window, { key: "Escape" })
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it("llama a onSelectEpisode y onClose al pulsar un episodio", () => {
        const onSelectEpisode = vi.fn()
        const onClose = vi.fn()
        renderSidebar({ onSelectEpisode, onClose })

        const epBtn = screen.getByRole("button", { name: /^Episodio 1:/i })
        fireEvent.click(epBtn)

        expect(onSelectEpisode).toHaveBeenCalledWith(1)
        expect(onClose).toHaveBeenCalledTimes(1)
    })
})
