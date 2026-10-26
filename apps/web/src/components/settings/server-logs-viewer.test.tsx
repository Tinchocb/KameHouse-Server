import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

const LOG_LINES = [
    "2026-10-14 15:22:17 |INF| app > arranque correcto",
    "2026-10-14 15:22:18 |WRN| cache > disco casi lleno",
    "2026-10-14 15:22:19 |ERR| db > no se pudo abrir la base",
    "2026-10-14 15:22:20 |DBG| scan > revisando carpeta",
].join("\n")

const state = vi.hoisted(() => ({ content: undefined as string | undefined }))

vi.mock("@/api/hooks/diagnostics.hooks", () => ({
    useGetLogFilenames: () => ({ data: ["KameHouse-2026-10-14_15-22-17.log"], isLoading: false }),
    useGetLogContent: () => ({ data: state.content, isLoading: false, isFetching: false, refetch: vi.fn() }),
    useDeleteLogs: () => ({ mutate: vi.fn(), isPending: false }),
}))

import { ServerLogsViewer } from "./server-logs-viewer"

describe("ServerLogsViewer", () => {
    it("muestra todas las líneas y marca los errores y avisos", () => {
        state.content = LOG_LINES
        render(<ServerLogsViewer />)

        const error = screen.getByText(/no se pudo abrir la base/)
        const warn = screen.getByText(/disco casi lleno/)
        expect(screen.getByText(/arranque correcto/)).toBeTruthy()
        expect(error.className).toContain("text-status-error")
        expect(warn.className).toContain("text-status-warning")
    })

    it("con 'Solo avisos y errores' oculta INF y DBG", () => {
        state.content = LOG_LINES
        render(<ServerLogsViewer />)

        fireEvent.click(screen.getByRole("button", { name: "Solo avisos y errores" }))

        expect(screen.queryByText(/arranque correcto/)).toBeNull()
        expect(screen.queryByText(/revisando carpeta/)).toBeNull()
        expect(screen.getByText(/disco casi lleno/)).toBeTruthy()
        expect(screen.getByText(/no se pudo abrir la base/)).toBeTruthy()
        expect(screen.getByRole("button", { name: "Mostrar todo" })).toBeTruthy()
    })

    it("sin avisos en el filtro, lo dice en vez de quedar vacío", () => {
        state.content = "2026-10-14 15:22:17 |INF| app > arranque correcto"
        render(<ServerLogsViewer />)

        fireEvent.click(screen.getByRole("button", { name: "Solo avisos y errores" }))

        expect(screen.getByText("No hay avisos ni errores en este archivo.")).toBeTruthy()
    })

    it("sin contenido muestra el mensaje vacío", () => {
        state.content = ""
        render(<ServerLogsViewer />)

        expect(screen.getByText("Sin contenido.")).toBeTruthy()
    })

    it("fuera de la app de escritorio no ofrece abrir la carpeta", () => {
        state.content = LOG_LINES
        render(<ServerLogsViewer />)

        expect(screen.queryByRole("button", { name: "Abrir carpeta" })).toBeNull()
    })
})
