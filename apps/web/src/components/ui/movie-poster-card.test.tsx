import { fireEvent, render, screen } from "@testing-library/react"
import { LazyMotion, domAnimation } from "framer-motion"
import { describe, expect, it, vi } from "vitest"
import { MoviePosterCard } from "./movie-poster-card"
import { SpotlightMovieCard } from "./spotlight/spotlight-movie-card"
import { ERA_COLOR_MAP } from "@/lib/config/eras"

vi.mock("@/components/shared/deferred-image", () => ({ DeferredImage: () => null }))

describe("Acciones de póster", () => {
    it("el CTA compartido navega una sola vez sin propagar a la tarjeta", () => {
        const navigate = vi.fn()
        render(<LazyMotion features={domAnimation}>
            <MoviePosterCard image="" title="Película" synopsis="Sinopsis" initial={false} onClick={navigate} />
        </LazyMotion>)
        fireEvent.click(screen.getByRole("button", { name: "Ver" }))
        expect(navigate).toHaveBeenCalledOnce()
    })

    it("el CTA del Home conserva una única navegación", () => {
        const navigate = vi.fn()
        const movie = { id: "movie", title: "Película", image: "", onClick: vi.fn() }
        render(<LazyMotion features={domAnimation}>
            <SpotlightMovieCard movie={movie} colors={ERA_COLOR_MAP.db} onNavigate={navigate} onHover={() => {}} />
        </LazyMotion>)
        fireEvent.click(screen.getByRole("button", { name: "Reproducir Película" }))
        expect(navigate).toHaveBeenCalledExactlyOnceWith(movie)
    })
})
