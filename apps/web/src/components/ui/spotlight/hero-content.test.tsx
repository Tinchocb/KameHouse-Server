import { render, screen } from "@testing-library/react"
import { AnimatePresence, LazyMotion, domAnimation } from "framer-motion"
import { describe, expect, it } from "vitest"
import { HeroContent } from "./hero-content"

describe("HeroContent", () => {
    it("muestra el nuevo contenido sin esperar y desactiva el saliente", () => {
        const view = (id: string) => (
            <LazyMotion features={domAnimation}>
                <div className="grid">
                    <AnimatePresence initial={false}>
                        <HeroContent key={id} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                            <button>{id}</button>
                        </HeroContent>
                    </AnimatePresence>
                </div>
            </LazyMotion>
        )
        const { rerender, unmount } = render(view("Anterior"))
        rerender(view("Actual"))
        expect(screen.getByText("Anterior").parentElement).toHaveAttribute("inert")
        expect(screen.getByText("Anterior").parentElement).toHaveAttribute("aria-hidden", "true")
        expect(screen.getByRole("button", { name: "Actual" }).parentElement).not.toHaveAttribute("inert")
        unmount()
    })
})
