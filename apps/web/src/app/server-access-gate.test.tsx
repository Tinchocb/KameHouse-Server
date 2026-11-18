import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ServerAccessGate, SessionLogout } from "./server-access-gate"
import { getServerSession, setServerSession } from "@/api/client/auth"

vi.mock("@/api/client/server-url", () => ({ getServerBaseUrl: () => "http://localhost:43211" }))
vi.mock("@/lib/query-persister", () => ({ queryPersistOptions: { persister: { removeClient: vi.fn() } } }))

function mount() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(<QueryClientProvider client={client}><ServerAccessGate><p>Biblioteca privada</p><SessionLogout /></ServerAccessGate></QueryClientProvider>)
}
const data = { required: true, sessionToken: "session", streamToken: "resource", expiresAt: Math.floor(Date.now() / 1000) + 300 }
function response(value: unknown) { return new Response(JSON.stringify({ data: value })) }

afterEach(() => { cleanup(); setServerSession(null); vi.unstubAllGlobals(); sessionStorage.clear(); vi.useRealTimers() })

describe("server access gate", () => {
    it("recovers automatically when the server starts after the first access check", async () => {
        vi.useFakeTimers()
        const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch"))
            .mockResolvedValueOnce(response({ required: false }))
        vi.stubGlobal("fetch", fetchMock)
        mount()
        await act(async () => {})
        expect(screen.getByText("Conectando con tu servidor")).toBeInTheDocument()
        expect(screen.queryByText("Biblioteca privada")).not.toBeInTheDocument()
        await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
        expect(screen.getByText("Biblioteca privada")).toBeInTheDocument()
        await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("stops connection retries on authentication failure and on unmount", async () => {
        vi.useFakeTimers()
        const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch"))
            .mockResolvedValueOnce(new Response("{}", { status: 401 }))
        vi.stubGlobal("fetch", fetchMock)
        const view = mount()
        await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
        expect(screen.getByLabelText(/Contraseña del servidor/)).toBeInTheDocument()
        await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
        expect(fetchMock).toHaveBeenCalledTimes(2)
        view.unmount()
        fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))
        const next = mount()
        await act(async () => {})
        next.unmount()
        await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
        expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it("withholds cached content until login, then logs out and removes credentials", async () => {
        setServerSession(null)
        const fetchMock = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 401 })).mockResolvedValueOnce(response(data))
        vi.stubGlobal("fetch", fetchMock)
        mount()
        expect(screen.queryByText("Biblioteca privada")).not.toBeInTheDocument()
        const input = await screen.findByLabelText(/Contraseña del servidor/)
        expect(screen.queryByText("Biblioteca privada")).not.toBeInTheDocument()
        fireEvent.change(input, { target: { value: "password" } })
        fireEvent.click(screen.getByRole("button", { name: "Entrar" }))
        expect(await screen.findByText("Biblioteca privada")).toBeInTheDocument()
        expect(getServerSession()?.sessionToken).toBe("session")
        fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión en este dispositivo" }))
        await waitFor(() => expect(screen.queryByText("Biblioteca privada")).not.toBeInTheDocument())
        expect(getServerSession()).toBeNull()
        expect(screen.getByLabelText(/Contraseña del servidor/)).toHaveValue("")
    })

    it("validates a restored session live with its credential before showing content", async () => {
        setServerSession(data)
        let resolve!: (response: Response) => void
        const fetchMock = vi.fn().mockImplementationOnce(() => new Promise<Response>(done => { resolve = done }))
        vi.stubGlobal("fetch", fetchMock)
        mount()
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
        expect(screen.queryByText("Biblioteca privada")).not.toBeInTheDocument()
        expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer session")
        await act(async () => { resolve(response(data)) })
        expect(await screen.findByText("Biblioteca privada")).toBeInTheDocument()
    })

    it("renews a five-minute API session before its expiry", async () => {
        vi.useFakeTimers()
        setServerSession(data)
        const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(response({ ...data, expiresAt: Math.floor(Date.now() / 1000) + 300 })))
        vi.stubGlobal("fetch", fetchMock)
        mount()
        await act(async () => {})
        expect(screen.getByText("Biblioteca privada")).toBeInTheDocument()
        expect(fetchMock).toHaveBeenCalledTimes(1)
        await act(async () => { await vi.advanceTimersByTimeAsync(151_000) })
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(getServerSession()?.expiresAt).toBeGreaterThan(data.expiresAt)
        expect(screen.getByText("Biblioteca privada")).toBeInTheDocument()
    })
})
