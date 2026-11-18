import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { LazyMotion, domAnimation } from "framer-motion"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SeriesHero } from "./series-hero"
import type { Anime_Entry } from "@/api/generated/types"

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
    },
    localFiles: [],
} as unknown as Anime_Entry

function renderWithProviders(ui: React.ReactElement) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    })

    return render(
        <QueryClientProvider client={queryClient}>
            <LazyMotion features={domAnimation}>
                {ui}
            </LazyMotion>
        </QueryClientProvider>
    )
}

describe("SeriesHero: estilo Apple TV+ Inmersivo (sin switch Z vs Kai)", () => {
    it("no renderiza ningún switch para cambiar entre Kai y Z", () => {
        renderWithProviders(
            <SeriesHero
                entry={mockEntry}
                backdropUrl={null}
                isZSeries={true}
                zVariant="z"
            />
        )

        expect(screen.queryByRole("radio", { name: /DBZ/i })).not.toBeInTheDocument()
        expect(screen.queryByRole("radio", { name: /Kai/i })).not.toBeInTheDocument()
    })

    it("muestra el Eyebrow Pill de la era Dragon Ball Z", () => {
        renderWithProviders(
            <SeriesHero
                entry={mockEntry}
                backdropUrl={null}
                isZSeries={true}
                zVariant="z"
            />
        )

        expect(screen.getByText(/ERA DRAGON BALL Z/i)).toBeInTheDocument()
    })

    it("refleja episodios y sagas de Kai en los metadatos cuando zVariant es kai", () => {
        renderWithProviders(
            <SeriesHero
                entry={mockEntry}
                backdropUrl={null}
                isZSeries={true}
                zVariant="kai"
            />
        )

        // Metadatos deben reflejar 167 episodios y 4 sagas sin switch
        expect(screen.getByText("167")).toBeInTheDocument()
        expect(screen.getByText("4")).toBeInTheDocument()
        expect(screen.getByText("episodios")).toBeInTheDocument()
        expect(screen.getByText("sagas")).toBeInTheDocument()
    })

    it("refleja episodios y sagas de DBZ en los metadatos cuando zVariant es z", () => {
        renderWithProviders(
            <SeriesHero
                entry={mockEntry}
                backdropUrl={null}
                isZSeries={true}
                zVariant="z"
            />
        )

        // Metadatos deben reflejar 291 episodios y 7 sagas
        expect(screen.getByText("291")).toBeInTheDocument()
        expect(screen.getByText("7")).toBeInTheDocument()
        expect(screen.getByText("episodios")).toBeInTheDocument()
        expect(screen.getByText("sagas")).toBeInTheDocument()
    })
})
