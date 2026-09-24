import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { PlayerSettingsMenu } from "./PlayerSettingsMenu"
import type { AudioTrack, SubtitleTrack } from "./track-types"

function mockViewport(isDesktop: boolean) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("min-width") ? isDesktop : false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    }))
}

const audioTracks = [
    { index: 0, language: "jpn", title: "Japonés" },
    { index: 1, language: "spa", title: "Español" },
] as unknown as AudioTrack[]

const subtitleTracks = [
    { index: 0, language: "spa", title: "Español" },
] as unknown as SubtitleTrack[]

function renderMenu(overrides: Partial<React.ComponentProps<typeof PlayerSettingsMenu>> = {}) {
    const props = {
        audioTracks,
        activeAudioIndex: 0,
        onSelectAudio: vi.fn(),
        subtitleTracks,
        activeSubtitleIndex: null,
        onSelectSubtitle: vi.fn(),
        open: true,
        onOpenChange: vi.fn(),
        ...overrides,
    }
    render(<PlayerSettingsMenu {...props} />)
    return props
}

describe("PlayerSettingsMenu", () => {
    beforeEach(() => {
        document.body.removeAttribute("style")
    })

    it("en escritorio no monta la hoja de Vaul (su overlay bloqueaba los clics)", () => {
        mockViewport(true)
        renderMenu()
        expect(document.querySelector("[data-vaul-overlay]")).toBeNull()
        expect(document.querySelector("[data-vaul-drawer]")).toBeNull()
        expect(document.body.style.pointerEvents).not.toBe("none")
    })

    it("en escritorio las opciones responden: Audio abre su submenú y selecciona pista", () => {
        mockViewport(true)
        const props = renderMenu()
        fireEvent.click(screen.getByRole("button", { name: /Audio/ }))
        fireEvent.click(screen.getByRole("button", { name: /Español/ }))
        expect(props.onSelectAudio).toHaveBeenCalledWith(audioTracks[1])
    })

    it("en escritorio Subtítulos permite elegir una pista", () => {
        mockViewport(true)
        const props = renderMenu()
        fireEvent.click(screen.getByRole("button", { name: /Subtítulos/ }))
        fireEvent.click(screen.getByRole("button", { name: /Español/ }))
        expect(props.onSelectSubtitle).toHaveBeenCalledWith(subtitleTracks[0])
    })

    it("se monta en panelContainer cuando se provee", () => {
        mockViewport(true)
        const host = document.createElement("div")
        document.body.appendChild(host)
        renderMenu({ panelContainer: host })
        expect(host.textContent).toContain("Configuración")
        host.remove()
    })
})
