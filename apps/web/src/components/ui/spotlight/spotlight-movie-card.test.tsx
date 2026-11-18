import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { LazyMotion, domAnimation } from "framer-motion"
import { ERA_COLOR_MAP } from "@/lib/config/eras"
import { SpotlightMovieCard } from "./spotlight-movie-card"
import type { SwimlaneItem } from "@/components/ui/swimlane"

vi.mock("@/components/shared/deferred-image", () => ({
    DeferredImage: ({ alt }: { alt: string }) => <img alt={alt} data-testid="poster-img" />,
}))

const sampleMovie: SwimlaneItem = {
    id: "movie-1",
    title: "Dragon Ball Super: Broly (2018)",
    description: "La batalla definitiva contra el legendario Super Saiyan.",
    image: "/mock-poster.webp",
    badge: "Película",
    year: "2018",
    subtitle: "LAT / JPN",
    onClick: vi.fn(),
}

describe("SpotlightMovieCard", () => {
    it("renderiza el título limpio y metadatos", () => {
        render(
            <LazyMotion features={domAnimation}>
                <SpotlightMovieCard
                    movie={sampleMovie}
                    index={1}
                    colors={ERA_COLOR_MAP.dbs}
                    onNavigate={vi.fn()}
                    onHover={vi.fn()}
                />
            </LazyMotion>
        )

        // Limpia el (2018)
        expect(screen.getAllByText("Dragon Ball Super: Broly").length).toBeGreaterThan(0)
        expect(screen.getByText("2018")).toBeInTheDocument()
        expect(screen.getAllByText("Película").length).toBeGreaterThan(0)
        expect(screen.getByText("LAT / JPN")).toBeInTheDocument()
    })

    it("aplica la paleta en el borde, sombra y drawer al estar activa o expandida", () => {
        const { container } = render(
            <LazyMotion features={domAnimation}>
                <SpotlightMovieCard
                    movie={sampleMovie}
                    index={1}
                    colors={ERA_COLOR_MAP.dbs}
                    isActive={true}
                    onNavigate={vi.fn()}
                    onHover={vi.fn()}
                />
            </LazyMotion>
        )

        const movieBox = container.querySelector(".movie-box") as HTMLElement
        expect(movieBox).not.toBeNull()
        // Tiene asignadas las variables de borde y sombra reactivas a la paleta
        expect(movieBox.style.getPropertyValue("--movie-hover-border")).not.toBe("")
        expect(movieBox.style.getPropertyValue("--movie-hover-shadow")).not.toBe("")

        const drawerPanel = container.querySelector(".drawer-panel") as HTMLElement
        expect(drawerPanel).not.toBeNull()
        expect(drawerPanel.style.getPropertyValue("--drawer-bg")).toContain("radial-gradient")
    })

    it("expone un botón nativo y navega al activarlo", () => {
        const onNavigate = vi.fn()
        render(
            <LazyMotion features={domAnimation}>
                <SpotlightMovieCard
                    movie={sampleMovie}
                    index={1}
                    colors={ERA_COLOR_MAP.dbs}
                    onNavigate={onNavigate}
                    onHover={vi.fn()}
                />
            </LazyMotion>
        )

        const trigger = screen.getByRole("button", { name: /Ver Dragon Ball Super: Broly/i })
        expect(trigger.tagName).toBe("BUTTON")
        expect(trigger).toHaveAttribute("type", "button")

        fireEvent.click(trigger)
        expect(onNavigate).toHaveBeenCalledExactlyOnceWith(sampleMovie)
    })
})
