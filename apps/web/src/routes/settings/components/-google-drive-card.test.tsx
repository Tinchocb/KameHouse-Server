import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { FormProvider, useForm } from "react-hook-form"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { GoogleDriveCard } from "./-google-drive-card"

const fixture = vi.hoisted(() => ({
    configured: true,
    status: null as Record<string, unknown> | null,
    refetch: vi.fn(),
    request: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    selectFolder: vi.fn(),
    updateSync: vi.fn(),
    triggerScan: vi.fn(),
    folders: {
        parentId: "root",
        path: [{ id: "root", name: "Mi unidad" }],
        folders: [{ id: "series", name: "Series" }],
    },
}))
vi.mock("@/api/client/requests", () => ({ buildApiQuery: fixture.request }))
vi.mock("@/api/client/server-url", () => ({ getServerBaseUrl: () => "http://127.0.0.1:43212" }))
vi.mock("@/lib/drive-status", () => ({
    DRIVE_ROOT_FOLDER_ID: "root",
    formatRelativeEs: () => "hace un momento",
    useDriveStatus: () => ({
        data: fixture.status ?? { connected: false, oauthConfigured: fixture.configured },
        refetch: fixture.refetch,
    }),
    useDriveFolders: () => ({ data: fixture.folders, isPending: false, isError: false, refetch: vi.fn() }),
    useSelectDriveFolder: () => ({ mutate: fixture.selectFolder, isPending: false }),
    useUpdateDriveSync: () => ({ mutate: fixture.updateSync, isPending: false }),
    useTriggerDriveScan: () => ({ mutate: fixture.triggerScan, isPending: false }),
}))
vi.mock("sonner", () => ({ toast: { success: fixture.success, info: fixture.info, error: vi.fn() } }))
vi.mock("@/components/ui/sectionbar", () => ({
    SectionBar: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}))

function Fixture() {
    const form = useForm({ defaultValues: { googleDrive: { clientId: "", clientSecret: "", folderId: "" } } })
    return (
        <QueryClientProvider client={new QueryClient()}>
            <FormProvider {...form}>
                <GoogleDriveCard />
            </FormProvider>
        </QueryClientProvider>
    )
}

const connectedStatus = {
    connected: true,
    oauthConfigured: true,
    userEmail: "cuenta@example.com",
    displayName: "Cuenta de prueba",
    folderId: "",
    folderName: "",
    indexedEpisodes: 0,
    isScanning: false,
    autoSync: true,
    scanIntervalMinutes: 60,
}

beforeEach(() => {
    vi.clearAllMocks()
    fixture.configured = true
    fixture.status = null
    fixture.refetch.mockResolvedValue({ data: { connected: false } })
    fixture.request.mockResolvedValue({
        url: "https://accounts.google.com/o/oauth2/auth?fixture",
        redirectUri: "http://127.0.0.1:43212/api/v1/drive/callback",
    })
    vi.spyOn(window, "open").mockReturnValue(null)
})
afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
})

describe("conexión sencilla con Google Drive", () => {
    it("abre Google con las credenciales del servidor, sin pedirlas ni guardarlas desde el formulario", async () => {
        render(<Fixture />)
        expect(screen.getByText("Configuración avanzada").closest("details")).not.toHaveAttribute("open")
        fireEvent.click(screen.getByRole("button", { name: "Conectar con Google" }))
        await waitFor(() => expect(window.open).toHaveBeenCalled())
        expect(fixture.request).toHaveBeenCalledTimes(1)
        expect(fixture.request).toHaveBeenCalledWith(expect.objectContaining({ method: "GET", endpoint: "/api/v1/drive/auth-url" }))
        expect(fixture.request.mock.calls[0][0]).not.toHaveProperty("params")
        expect(screen.getByRole("button", { name: "Copiar enlace" })).toBeInTheDocument()
    })

    it("explica la activación pendiente y muestra el apartado avanzado sin intentar una autorización imposible", () => {
        fixture.configured = false
        render(<Fixture />)
        fireEvent.click(screen.getByRole("button", { name: "Configurar acceso a Drive" }))
        expect(fixture.request).not.toHaveBeenCalled()
        expect(fixture.info).toHaveBeenCalled()
        expect(screen.getByText("Configuración avanzada").closest("details")).toHaveAttribute("open")
    })

    it("detecta la conexión desde el navegador externo y deja de consultar al terminar", async () => {
        vi.useFakeTimers()
        fixture.refetch.mockResolvedValue({ data: { connected: true } })
        render(<Fixture />)
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Conectar con Google" }))
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(3000)
        })
        expect(fixture.refetch).toHaveBeenCalledTimes(1)
        expect(fixture.success).toHaveBeenCalledWith("Google Drive conectado")
        await act(async () => {
            await vi.advanceTimersByTimeAsync(9000)
        })
        expect(fixture.refetch).toHaveBeenCalledTimes(1)
    })

    it("ignora mensajes de conexión de otro origen", async () => {
        render(<Fixture />)
        fireEvent.click(screen.getByRole("button", { name: "Conectar con Google" }))
        await waitFor(() => expect(window.open).toHaveBeenCalled())
        await act(async () => {
            window.dispatchEvent(
                new MessageEvent("message", { origin: "https://unrelated.example", data: { type: "KAMEHOUSE_DRIVE_CONNECTED" } }),
            )
        })
        expect(fixture.refetch).not.toHaveBeenCalled()
    })
})

describe("carpeta de la biblioteca", () => {
    it("tras conectar sin carpeta, abre el selector para elegirla", () => {
        fixture.status = { ...connectedStatus }
        render(<Fixture />)
        expect(screen.getByRole("region", { name: "Elegir carpeta de Google Drive" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Usar esta carpeta" })).toBeInTheDocument()
        expect(screen.getByText("Todavía no has elegido una carpeta")).toBeInTheDocument()
        expect(screen.getByText("Elige una carpeta para empezar a sincronizar.")).toBeInTheDocument()
    })

    it("elegir una subcarpeta y confirmarla la guarda en el servidor", () => {
        fixture.status = { ...connectedStatus, folderId: "root", folderName: "Mi unidad" }
        render(<Fixture />)
        fireEvent.click(screen.getByRole("button", { name: "Cambiar carpeta" }))
        fireEvent.click(screen.getByRole("button", { name: "Series" }))
        fireEvent.click(screen.getByRole("button", { name: "Usar esta carpeta" }))
        expect(fixture.selectFolder).toHaveBeenCalledWith("series", expect.any(Object))
    })

    it("con carpeta elegida muestra su nombre y deja el selector cerrado hasta pedirlo", () => {
        fixture.status = { ...connectedStatus, folderId: "series", folderName: "Anime" }
        render(<Fixture />)
        expect(screen.getByText("Anime")).toBeInTheDocument()
        expect(screen.queryByRole("region", { name: "Elegir carpeta de Google Drive" })).not.toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Cambiar carpeta" })).toBeInTheDocument()
    })

    it("pegar un enlace de carpeta lo elige al salir del campo, con el ID extraído", () => {
        fixture.status = { ...connectedStatus, folderId: "root", folderName: "Mi unidad" }
        render(<Fixture />)
        const input = screen.getByLabelText("¿Tienes el enlace de la carpeta? Pégalo aquí")
        fireEvent.change(input, { target: { value: "https://drive.google.com/drive/folders/abc_DEF-123?usp=sharing" } })
        fireEvent.blur(input)
        expect(fixture.selectFolder).toHaveBeenCalledWith("abc_DEF-123", expect.any(Object))
    })
})

describe("sincronización automática", () => {
    it("apagar el interruptor envía la preferencia al servidor", () => {
        fixture.status = { ...connectedStatus, folderId: "series", folderName: "Anime" }
        render(<Fixture />)
        fireEvent.click(screen.getByRole("switch", { name: "Escanear Drive automáticamente" }))
        expect(fixture.updateSync).toHaveBeenCalledWith({ disableAutoSync: true })
    })

    it("«Sincronizar ahora» lanza un escaneo", () => {
        fixture.status = { ...connectedStatus, folderId: "series", folderName: "Anime" }
        render(<Fixture />)
        fireEvent.click(screen.getByRole("button", { name: "Sincronizar ahora" }))
        expect(fixture.triggerScan).toHaveBeenCalled()
    })

    it("muestra la última sincronización y la próxima", () => {
        fixture.status = {
            ...connectedStatus,
            folderId: "series",
            folderName: "Anime",
            nextScanAt: "2026-11-17T13:00:00Z",
            progress: { phase: "done", indexed: 12, finishedAt: "2026-11-17T12:00:00Z", startedAt: "2026-11-17T11:59:00Z" },
        }
        render(<Fixture />)
        expect(screen.getByText("Última sincronización: hace un momento (12 episodios) · Próxima: hace un momento")).toBeInTheDocument()
    })

    it("un escaneo fallido se nombra en la tarjeta", () => {
        fixture.status = {
            ...connectedStatus,
            folderId: "series",
            folderName: "Anime",
            progress: { phase: "error", indexed: 0, error: "red caída", startedAt: "2026-11-17T11:59:00Z" },
        }
        render(<Fixture />)
        expect(screen.getByText(/El último escaneo falló: red caída/)).toBeInTheDocument()
    })
})
