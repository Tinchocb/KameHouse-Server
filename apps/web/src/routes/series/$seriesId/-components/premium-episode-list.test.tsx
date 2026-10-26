import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { LazyMotion, domAnimation } from "framer-motion"
import type { PremiumEpisode } from "@/api/types/series.types"
import { PremiumEpisodeList } from "./premium-episode-list"

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }))
vi.mock("@/lib/theme/theme-hooks", () => ({ useThemeSettings: () => ({}) }))
vi.mock("../-hooks/use-saga-episodes-ready", () => ({
    useSagaEpisodesReady: (episodes: PremiumEpisode[]) => ({ episodes, pending: false }),
}))
vi.mock("@tanstack/react-virtual", () => ({
    useVirtualizer: (options: { count: number }) => ({
        options: { scrollMargin: 0 },
        getTotalSize: () => 180,
        getVirtualItems: () => Array.from({ length: options.count }, (_, index) => ({ index, start: index * 180 })),
        measureElement: () => {},
        scrollToIndex: () => {},
    }),
}))

const mockEpisodes: PremiumEpisode[] = [
    {
        id: "1",
        number: 1,
        title: "Aparece un mini Goku",
        description: "Goku entrena en la montaña",
        thumbnailUrl: "/thumb1.jpg",
        episodeType: "Canon",
        isWatched: true,
        localFilePath: "/path/ep1.mkv",
    },
    {
        id: "2",
        number: 2,
        title: "El secreto de las esferas",
        description: "Bulma y Goku buscan esferas",
        thumbnailUrl: "/thumb2.jpg",
        episodeType: "Filler",
        isWatched: false,
        localFilePath: "/path/ep2.mkv",
    },
]

describe("PremiumEpisodeList - Buscador y posición", () => {
    it("renderiza el buscador con label accesible y placeholder correcto", () => {
        render(
            <LazyMotion features={domAnimation}>
                <PremiumEpisodeList episodes={mockEpisodes} />
            </LazyMotion>
        )

        const input = screen.getByRole("textbox", { name: "Buscar episodio" })
        expect(input).toBeInTheDocument()
        expect(input).toHaveClass("glass-frosted-pill")
        expect(input).toHaveClass("h-11")
    })

    it("filtra episodios al escribir en el buscador y muestra el contador", () => {
        render(
            <LazyMotion features={domAnimation}>
                <PremiumEpisodeList episodes={mockEpisodes} />
            </LazyMotion>
        )

        const input = screen.getByRole("textbox", { name: "Buscar episodio" })
        fireEvent.change(input, { target: { value: "mini Goku" } })

        expect(screen.getByText(/de 2 episodios/)).toBeInTheDocument()
        expect(screen.getByText(/Aparece un mini Goku/)).toBeInTheDocument()
        expect(screen.queryByText(/El secreto de las esferas/)).not.toBeInTheDocument()
    })

    it("permite limpiar la búsqueda con el botón dedicado", () => {
        render(
            <LazyMotion features={domAnimation}>
                <PremiumEpisodeList episodes={mockEpisodes} />
            </LazyMotion>
        )

        const input = screen.getByRole("textbox", { name: "Buscar episodio" })
        fireEvent.change(input, { target: { value: "mini Goku" } })

        const clearBtn = screen.getByRole("button", { name: "Limpiar búsqueda" })
        expect(clearBtn).toBeInTheDocument()

        fireEvent.click(clearBtn)
        expect(input).toHaveValue("")
        expect(screen.getByText(/Aparece un mini Goku/)).toBeInTheDocument()
        expect(screen.getByText(/El secreto de las esferas/)).toBeInTheDocument()
    })

    it("enfoca el buscador al presionar '/' en el teclado", () => {
        render(
            <LazyMotion features={domAnimation}>
                <PremiumEpisodeList episodes={mockEpisodes} />
            </LazyMotion>
        )

        const input = screen.getByRole("textbox", { name: "Buscar episodio" })
        expect(document.activeElement).not.toBe(input)

        fireEvent.keyDown(window, { key: "/" })
        expect(document.activeElement).toBe(input)
    })

    it("muestra estado vacío contextual y permite limpiar si no hay coincidencias", () => {
        render(
            <LazyMotion features={domAnimation}>
                <PremiumEpisodeList episodes={mockEpisodes} />
            </LazyMotion>
        )

        const input = screen.getByRole("textbox", { name: "Buscar episodio" })
        fireEvent.change(input, { target: { value: "episodio inexistente" } })

        expect(screen.getByText("No se encontraron episodios")).toBeInTheDocument()
        expect(screen.getByText(/No hay coincidencias para "episodio inexistente"/)).toBeInTheDocument()

        const clearButtons = screen.getAllByRole("button", { name: "Limpiar búsqueda" })
        expect(clearButtons.length).toBeGreaterThan(0)
        fireEvent.click(clearButtons[0])
        expect(input).toHaveValue("")
    })
})
