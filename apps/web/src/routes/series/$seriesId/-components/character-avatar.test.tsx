import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CharacterAvatar } from "./character-avatar"

describe("CharacterAvatar", () => {
    it("renderiza el nombre y el rol del personaje", () => {
        render(
            <CharacterAvatar
                name="Son Goku"
                roleTag="Protagonista"
                avatarUrl="https://example.com/goku.jpg"
            />
        )

        expect(screen.getByText("Son Goku")).toBeInTheDocument()
        expect(screen.getByText("Protagonista")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Son Goku, Protagonista" })).toBeInTheDocument()
    })

    it("muestra la imagen cuando la URL es válida", () => {
        render(
            <CharacterAvatar
                name="Vegeta"
                avatarUrl="https://example.com/vegeta.jpg"
            />
        )

        const img = screen.getByRole("img", { name: "Vegeta" })
        expect(img).toBeInTheDocument()
        expect(img).toHaveAttribute("src", "https://example.com/vegeta.jpg")
    })

    it("muestra las iniciales cuando avatarUrl no está disponible", () => {
        render(
            <CharacterAvatar
                name="Piccolo Daimaku"
                avatarUrl={null}
            />
        )

        expect(screen.queryByRole("img")).not.toBeInTheDocument()
        expect(screen.getByText("PD")).toBeInTheDocument()
    })

    it("muestra las iniciales de respaldo si la imagen falla al cargar", () => {
        render(
            <CharacterAvatar
                name="Master Roshi"
                avatarUrl="https://example.com/broken.jpg"
            />
        )

        const img = screen.getByRole("img", { name: "Master Roshi" })
        fireEvent.error(img)

        expect(screen.queryByRole("img")).not.toBeInTheDocument()
        expect(screen.getByText("MR")).toBeInTheDocument()
    })

    it("dispara onSelect al hacer click", () => {
        const onSelect = vi.fn()
        render(
            <CharacterAvatar
                name="Gohan"
                onSelect={onSelect}
            />
        )

        fireEvent.click(screen.getByRole("button"))
        expect(onSelect).toHaveBeenCalledWith("Gohan")
    })
})
