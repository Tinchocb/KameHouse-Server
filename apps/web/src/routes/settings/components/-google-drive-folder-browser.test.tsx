import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { GoogleDriveFolderBrowser } from "./-google-drive-folder-browser"

const listings = vi.hoisted(() => ({
    root: {
        parentId: "root",
        path: [{ id: "root", name: "Mi unidad" }],
        folders: [
            { id: "series", name: "Series" },
            { id: "vacia", name: "Vacía" },
        ],
    },
    series: {
        parentId: "series",
        path: [
            { id: "root", name: "Mi unidad" },
            { id: "series", name: "Series" },
        ],
        folders: [{ id: "db", name: "Dragon Ball" }],
    },
    vacia: {
        parentId: "vacia",
        path: [
            { id: "root", name: "Mi unidad" },
            { id: "vacia", name: "Vacía" },
        ],
        folders: [],
    },
}))

vi.mock("@/lib/drive-status", () => ({
    DRIVE_ROOT_FOLDER_ID: "root",
    useDriveFolders: (parentId: string) => ({
        data: listings[parentId as keyof typeof listings],
        isPending: false,
        isError: false,
        refetch: vi.fn(),
    }),
}))

describe("selector de carpetas de Google Drive", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("empieza en Mi unidad y elige la carpeta en la que está", () => {
        const onSelect = vi.fn()
        render(<GoogleDriveFolderBrowser startFolderId="" selecting={false} onSelect={onSelect} />)
        expect(screen.getByRole("button", { name: "Series" })).toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "Usar esta carpeta" }))
        expect(onSelect).toHaveBeenCalledWith("root")
    })

    it("navega por las subcarpetas y las migas de pan vuelven atrás", () => {
        const onSelect = vi.fn()
        render(<GoogleDriveFolderBrowser startFolderId="root" selecting={false} onSelect={onSelect} />)
        fireEvent.click(screen.getByRole("button", { name: "Series" }))
        expect(screen.getByRole("button", { name: "Mi unidad" })).toBeInTheDocument()
        expect(screen.getByText("Dragon Ball")).toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "Usar esta carpeta" }))
        expect(onSelect).toHaveBeenLastCalledWith("series")
        fireEvent.click(screen.getByRole("button", { name: "Mi unidad" }))
        fireEvent.click(screen.getByRole("button", { name: "Usar esta carpeta" }))
        expect(onSelect).toHaveBeenLastCalledWith("root")
    })

    it("una carpeta sin subcarpetas lo dice", () => {
        render(<GoogleDriveFolderBrowser startFolderId="root" selecting={false} onSelect={vi.fn()} />)
        fireEvent.click(screen.getByRole("button", { name: "Vacía" }))
        expect(screen.getByText("No hay subcarpetas aquí.")).toBeInTheDocument()
    })

    it("cancelar solo aparece si hay una carpeta a la que volver", () => {
        const { rerender } = render(<GoogleDriveFolderBrowser startFolderId="root" selecting={false} onSelect={vi.fn()} />)
        expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument()
        const onCancel = vi.fn()
        rerender(<GoogleDriveFolderBrowser startFolderId="root" selecting={false} onSelect={vi.fn()} onCancel={onCancel} />)
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
        expect(onCancel).toHaveBeenCalled()
    })
})
