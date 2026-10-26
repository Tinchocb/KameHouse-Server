import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PlayerErrorBoundary } from "./player-error-boundary"

describe("PlayerErrorBoundary", () => {
    it("explica el fallo en español, conserva el diagnóstico en el registro y permite reintentar", () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {})
        const close = vi.fn()
        const crash = new Error("Cannot read properties of undefined (reading 'track')")
        let shouldCrash = true
        function Video() {
            if (shouldCrash) throw crash
            return <div>Video listo</div>
        }
        try {
            render(<PlayerErrorBoundary onClose={close}><Video /></PlayerErrorBoundary>)
            expect(screen.getByText(/No pudimos continuar la reproducción/)).toBeInTheDocument()
            expect(screen.queryByText(crash.message)).not.toBeInTheDocument()
            expect(log).toHaveBeenCalledWith("[PlayerErrorBoundary] Player crashed:", crash, expect.anything())
            fireEvent.click(screen.getByRole("button", { name: "Cerrar reproductor" }))
            expect(close).toHaveBeenCalledOnce()
            shouldCrash = false
            fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))
            expect(screen.getByText("Video listo")).toBeInTheDocument()
        } finally {
            log.mockRestore()
        }
    })
})
