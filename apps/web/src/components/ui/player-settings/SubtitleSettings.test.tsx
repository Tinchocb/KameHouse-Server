import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { SubtitleSettings } from "./SubtitleSettings"
import { useSubtitleLoadStore } from "@/components/video/subtitle-load-store"
import type { SubtitleTrack } from "../track-types"

const friendly = (l: string) => l

function renderPanel(tracks: SubtitleTrack[], active: number | null = null, onSelect = vi.fn()) {
    render(
        <SubtitleSettings
            subtitleTracks={tracks}
            activeSubtitleIndex={active}
            onSelectSubtitle={onSelect}
            getFriendlyLanguage={friendly}
        />
    )
    return onSelect
}

afterEach(() => {
    cleanup() // desmontar antes de reiniciar el store: evita updates fuera de act
    useSubtitleLoadStore.getState().reset()
})

describe("SubtitleSettings: estados (nunca silencio)", () => {
    it("sin pistas en un archivo local explica qué hacer", () => {
        renderPanel([])
        expect(screen.getByRole("status").textContent).toMatch(/no tiene subtítulos/)
        expect(screen.getByRole("status").textContent).toMatch(/junto a él/)
    })

    it("sin pistas en un archivo de Drive lo dice", () => {
        useSubtitleLoadStore.getState().setSource("drive")
        renderPanel([])
        expect(screen.getByRole("status").textContent).toMatch(/carpeta de Drive/)
    })

    it("lista las pistas y marca las externas", () => {
        renderPanel([{ index: 1000, language: "spa", title: "Español", codec: "subrip", url: "/x" }])
        expect(screen.getByText("Español")).toBeTruthy()
        expect(screen.getByText(/Archivo externo/)).toBeTruthy()
    })

    it("pista activa cargando: spinner y texto de extracción en curso", () => {
        useSubtitleLoadStore.getState().setTrackLoad("extracting", 0)
        renderPanel([{ index: 0, language: "spa", title: "Español", codec: "ass", url: "/x" }], 0)
        expect(screen.getByText(/Extrayendo… puede tardar/)).toBeTruthy()
        expect(screen.getByRole("button", { name: /Español/ }).getAttribute("aria-busy")).toBe("true")
    })

    it("pista activa con error: muestra el mensaje", () => {
        useSubtitleLoadStore.getState().setTrackLoad("error", 0, "Este subtítulo no está disponible en el servidor.")
        renderPanel([{ index: 0, language: "spa", title: "Español", codec: "ass", url: "/x" }], 0)
        expect(screen.getByRole("alert").textContent).toMatch(/no está disponible/)
    })

    it("el error de otra pista no se muestra en esta", () => {
        useSubtitleLoadStore.getState().setTrackLoad("error", 5, "falló")
        renderPanel([{ index: 0, language: "spa", title: "Español", codec: "ass", url: "/x" }], 0)
        expect(screen.queryByRole("alert")).toBeNull()
    })
})

describe("SubtitleSettings: subtítulos embebidos de Drive", () => {
    const pending: SubtitleTrack[] = [
        { index: 0, language: "spa", title: "Español", codec: "ass", needsExtraction: true },
        { index: 1, language: "eng", title: "English", codec: "ass", needsExtraction: true },
    ]

    function withActions() {
        const extract = vi.fn()
        const cancel = vi.fn()
        useSubtitleLoadStore.getState().setSource("drive")
        useSubtitleLoadStore.getState().setDriveActions({ extract, cancel })
        return { extract, cancel }
    }

    it("ofrece extraer y deja las pistas deshabilitadas", () => {
        const { extract } = withActions()
        const onSelect = renderPanel(pending)
        expect(screen.getByText(/2 pistas de subtítulos incrustadas/)).toBeTruthy()

        const spa = screen.getByRole("button", { name: /Español/ }) as HTMLButtonElement
        expect(spa.disabled).toBe(true)
        fireEvent.click(spa)
        expect(onSelect).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole("button", { name: "Extraer subtítulos" }))
        expect(extract).toHaveBeenCalledTimes(1)
    })

    it("muestra progreso y permite cancelar", () => {
        const { cancel } = withActions()
        useSubtitleLoadStore.getState().setDrive({ state: "running", percent: 42 })
        renderPanel(pending)
        expect(screen.getByText("Extrayendo subtítulos…")).toBeTruthy()
        expect(screen.getByText("42%")).toBeTruthy()
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
        expect(cancel).toHaveBeenCalledTimes(1)
    })

    it("tras un error muestra el motivo y permite reintentar", () => {
        const { extract } = withActions()
        useSubtitleLoadStore.getState().setDrive({ state: "error", percent: 0, error: "Google Drive limitó las descargas." })
        renderPanel(pending)
        expect(screen.getByRole("alert").textContent).toMatch(/limitó las descargas/)
        fireEvent.click(screen.getByRole("button", { name: "Reintentar extracción" }))
        expect(extract).toHaveBeenCalledTimes(1)
    })

    it("cuando las pistas ya están disponibles no hay tarjeta de extracción", () => {
        withActions()
        renderPanel([{ index: 0, language: "spa", title: "Español", codec: "ass", url: "/x" }])
        expect(screen.queryByRole("group", { name: /Extraer subtítulos/ })).toBeNull()
    })
})
