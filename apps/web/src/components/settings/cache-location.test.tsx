import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock("@/api/client/requests", () => ({ buildApiQuery: api.request }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/components/shared/directory-selector", () => ({
    DirectorySelector: ({ onSelect, ...props }: Record<string, unknown>) => <input {...props} />,
}))

import { CacheLocationField } from "./cache-location"

const initial = { activeDirectory: "C:/cache", directory: "C:/cache", restartRequired: false, managedByEnvironment: false }

function mount() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(<QueryClientProvider client={client}><CacheLocationField /></QueryClientProvider>)
}

describe("CacheLocationField", () => {
    beforeEach(() => { api.request.mockReset() })

    it("guarda la ruta escrita y muestra que sigue usando la anterior hasta reiniciar", async () => {
        api.request.mockImplementation(async ({ method, data }) => method === "GET" ? initial : {
            ...initial, directory: data.directory, restartRequired: true,
        })
        mount()
        const input = await screen.findByDisplayValue("C:/cache")
        fireEvent.change(input, { target: { value: "D:/KameHouse-cache" } })
        fireEvent.click(screen.getByRole("button", { name: "Guardar carpeta" }))
        await waitFor(() => expect(api.request).toHaveBeenCalledWith({
            endpoint: "/api/v1/system/cache/location", method: "PATCH", data: { directory: "D:/KameHouse-cache" },
        }))
        expect(await screen.findByText(/Cambio pendiente.*C:\/cache/)).toBeTruthy()
        expect((screen.getByLabelText("Carpeta de caché") as HTMLInputElement).value).toBe("D:/KameHouse-cache")
    })

    it("conserva la ruta escrita si falla el guardado", async () => {
        api.request.mockImplementation(async ({ method }) => {
            if (method === "GET") return initial
            throw new Error("La unidad no está disponible")
        })
        mount()
        fireEvent.change(await screen.findByDisplayValue("C:/cache"), { target: { value: "D:/cache" } })
        fireEvent.click(screen.getByRole("button", { name: "Guardar carpeta" }))
        await waitFor(() => expect(screen.getByRole("button", { name: "Guardar carpeta" }).hasAttribute("disabled")).toBe(false))
        expect((screen.getByLabelText("Carpeta de caché") as HTMLInputElement).value).toBe("D:/cache")
        expect(screen.queryByText(/Cambio pendiente/)).toBeNull()
    })

    it("no permite cambiar una ruta administrada por el entorno", async () => {
        api.request.mockResolvedValue({ ...initial, managedByEnvironment: true })
        mount()
        const input = await screen.findByDisplayValue("C:/cache")
        expect(input.hasAttribute("disabled")).toBe(true)
        expect(screen.getByRole("button", { name: "Guardar carpeta" }).hasAttribute("disabled")).toBe(true)
    })
})
