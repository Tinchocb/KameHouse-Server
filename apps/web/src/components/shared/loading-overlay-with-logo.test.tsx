import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { LoadingOverlayWithLogo } from "./loading-overlay-with-logo"

describe("LoadingOverlayWithLogo · caja de error", () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("muestra la ilustración de error recortada a la mitad inferior tras el timeout", () => {
        // Forzamos que el arranque ya supere el timeout, como pasa cuando el servidor no responde.
        vi.spyOn(performance, "now").mockReturnValue(10 * 60 * 1000)
        const { container } = render(<LoadingOverlayWithLogo isError />)

        expect(screen.getByText("Sin conexión con el servidor")).toBeTruthy()
        const img = container.querySelector('img[src="/illustrations/error-character.png"]')
        expect(img).not.toBeNull()
        // Decorativa: el texto ya explica el error.
        expect(img?.getAttribute("alt")).toBe("")
        expect(img?.getAttribute("aria-hidden")).toBe("true")
        // Recorte: la proporción de la mitad inferior de la imagen (900x512 -> 900x256).
        expect(img?.className).toContain("aspect-[900/256]")
        expect(img?.className).toContain("object-bottom")
    })

    it("no muestra la ilustración mientras no hay timeout", () => {
        vi.spyOn(performance, "now").mockReturnValue(0)
        const { container } = render(<LoadingOverlayWithLogo />)

        expect(container.querySelector('img[src="/illustrations/error-character.png"]')).toBeNull()
    })

    it("no declara «Sin conexión» si no hay error, aunque haya pasado el timeout", () => {
        // Ajustes y el onboarding montan el overlay sin isError: una carga lenta no es un servidor caído.
        vi.spyOn(performance, "now").mockReturnValue(10 * 60 * 1000)
        const { container } = render(<LoadingOverlayWithLogo />)

        expect(screen.queryByText("Sin conexión con el servidor")).toBeNull()
        expect(container.querySelector('img[src="/illustrations/error-character.png"]')).toBeNull()
        expect(container.querySelector('[role="status"]')).not.toBeNull()
        expect(container.querySelector('[role="alert"]')).toBeNull()
    })

    it("muestra las 7 esferas del dragón (1 a 7 estrellas) mientras carga", () => {
        vi.spyOn(performance, "now").mockReturnValue(0)
        const { container } = render(<LoadingOverlayWithLogo />)

        const balls = Array.from(container.querySelectorAll("img.animate-ball-charge"))
        expect(balls.map((img) => img.getAttribute("src"))).toEqual(
            [1, 2, 3, 4, 5, 6, 7].map((n) => `/icons/dragon-balls/star-${n}.png`)
        )
    })
})
