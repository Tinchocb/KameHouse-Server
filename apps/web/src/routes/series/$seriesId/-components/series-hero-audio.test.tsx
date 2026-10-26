import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { LazyMotion, domAnimation } from "framer-motion"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SeriesHero } from "./series-hero"
import { useUIStore } from "@/lib/stores/ui-store"
import type { Anime_Entry, Anime_LocalFile } from "@/api/generated/types"

const localFile = {
    technicalInfo: {
        videoStream: { width: 1920 },
        audioStreams: [{ language: "spa-lat" }, { language: "jpn" }],
        subtitleStreams: [{ language: "spa" }],
    },
} as unknown as Anime_LocalFile

const mockEntry = {
    mediaId: 12971,
    media: {
        id: 12971,
        tmdbId: 12971,
        titleSpanish: "Dragon Ball Z",
        titleRomaji: "Dragon Ball Z",
        format: "TV",
        year: 1989,
        totalEpisodes: 291,
        genres: ["Acción", "Animación"],
    },
    localFiles: [localFile],
} as unknown as Anime_Entry

function renderHero() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <LazyMotion features={domAnimation}>
                <SeriesHero entry={mockEntry} backdropUrl={null} />
            </LazyMotion>
        </QueryClientProvider>
    )
}

describe("SeriesHero: doblajes, subtítulos, calidad y géneros", () => {
    afterEach(() => {
        useUIStore.setState({ seriesHeroCardEnabled: true })
    })

    it("muestra el audio con el doblaje, los subtítulos, la calidad, los géneros y la píldora de episodio", () => {
        renderHero()

        expect(screen.getByText("Japonés · Latino")).toBeInTheDocument()
        expect(screen.getByText("Subs: Español")).toBeInTheDocument()
        expect(screen.getByText("1080p")).toBeInTheDocument()
        expect(screen.getByText("Acción · Animación")).toBeInTheDocument()
        expect(screen.getByText("Episodio 1")).toBeInTheDocument()
    })

    it("con la tarjeta desactivada en Ajustes no la renderiza, pero mantiene los datos del hero", () => {
        useUIStore.setState({ seriesHeroCardEnabled: false })
        renderHero()

        expect(screen.queryByText("Episodio 1")).not.toBeInTheDocument()
        expect(screen.getByText("Japonés · Latino")).toBeInTheDocument()
        expect(screen.getByText("Acción · Animación")).toBeInTheDocument()
    })
})
