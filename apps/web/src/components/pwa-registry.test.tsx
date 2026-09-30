import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PwaRegistry, APPLY_UPDATE_WINDOW_MS } from "./pwa-registry"

const toastMock = vi.hoisted(() => vi.fn())
vi.mock("sonner", () => ({ toast: toastMock }))

function mockServiceWorker(controller: object | null) {
    const listeners = new Map<string, () => void>()
    const sw = {
        controller,
        register: vi.fn(async () => ({ waiting: null, addEventListener: vi.fn() })),
        addEventListener: vi.fn((type: string, fn: () => void) => listeners.set(type, fn)),
        getRegistrations: vi.fn(async () => []),
    }
    Object.defineProperty(navigator, "serviceWorker", { value: sw, configurable: true })
    return { fire: (type: string) => listeners.get(type)?.() }
}

describe("PwaRegistry", () => {
    const reload = vi.fn()
    const originalLocation = window.location

    beforeEach(() => {
        vi.stubEnv("DEV", false)
        Object.defineProperty(window, "location", { value: { ...originalLocation, reload }, configurable: true })
    })
    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllEnvs()
        reload.mockReset()
        Object.defineProperty(window, "location", { value: originalLocation, configurable: true })
    })

    it("no recarga cuando el SW toma control en la primera instalación", () => {
        const sw = mockServiceWorker(null)
        render(<PwaRegistry />)
        sw.fire("controllerchange")
        expect(reload).not.toHaveBeenCalled()
    })

    it("recarga una sola vez cuando un SW nuevo reemplaza al anterior", () => {
        const sw = mockServiceWorker({})
        render(<PwaRegistry />)
        sw.fire("controllerchange")
        sw.fire("controllerchange")
        expect(reload).toHaveBeenCalledTimes(1)
    })

    // ── Actualización de una versión nueva ──────────────────────────────────────
    function mockUpdate(opts: { waiting?: boolean }) {
        const worker = { postMessage: vi.fn(), state: "installed", addEventListener: vi.fn() }
        const registrationListeners = new Map<string, () => void>()
        const registration = {
            waiting: opts.waiting ? worker : null,
            installing: opts.waiting ? null : worker,
            addEventListener: vi.fn((type: string, fn: () => void) => registrationListeners.set(type, fn)),
        }
        const swListeners = new Map<string, () => void>()
        Object.defineProperty(navigator, "serviceWorker", {
            value: {
                controller: {},
                register: vi.fn(async () => registration),
                addEventListener: vi.fn((type: string, fn: () => void) => swListeners.set(type, fn)),
                getRegistrations: vi.fn(async () => []),
            },
            configurable: true,
        })
        // Un SW nuevo que termina de instalarse mientras hay uno controlando la página.
        const finishInstall = async () => {
            await vi.waitFor(() => expect(registrationListeners.has("updatefound")).toBe(true))
            registrationListeners.get("updatefound")?.()
            const statechange = worker.addEventListener.mock.calls.find(c => c[0] === "statechange")?.[1] as (() => void) | undefined
            statechange?.()
        }
        return { worker, finishInstall }
    }

    function playVideo() {
        const video = document.createElement("video")
        Object.defineProperty(video, "paused", { value: false })
        Object.defineProperty(video, "ended", { value: false })
        Object.defineProperty(video, "readyState", { value: 4 })
        document.body.appendChild(video)
        return () => video.remove()
    }

    beforeEach(() => toastMock.mockReset())

    it("aplica sola la actualización recién abierta la app y sin video", async () => {
        const { worker, finishInstall } = mockUpdate({ waiting: false })
        vi.spyOn(performance, "now").mockReturnValue(2_000)
        render(<PwaRegistry />)
        await finishInstall()
        expect(worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" })
        expect(toastMock).not.toHaveBeenCalled()
    })

    it("aplica sola la que ya estaba esperando al abrir la app", async () => {
        const { worker } = mockUpdate({ waiting: true })
        vi.spyOn(performance, "now").mockReturnValue(1_000)
        render(<PwaRegistry />)
        await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" }))
        expect(toastMock).not.toHaveBeenCalled()
    })

    it("con la app abierta hace rato solo avisa: no recarga sola", async () => {
        const { worker, finishInstall } = mockUpdate({ waiting: false })
        vi.spyOn(performance, "now").mockReturnValue(APPLY_UPDATE_WINDOW_MS + 1)
        render(<PwaRegistry />)
        await finishInstall()
        expect(worker.postMessage).not.toHaveBeenCalled()
        expect(toastMock).toHaveBeenCalledTimes(1)
        expect(toastMock.mock.calls[0][0]).toBe("Nueva versión disponible")
    })

    it("con un video reproduciéndose nunca la aplica sola", async () => {
        const removeVideo = playVideo()
        const { worker, finishInstall } = mockUpdate({ waiting: false })
        vi.spyOn(performance, "now").mockReturnValue(1_000)
        render(<PwaRegistry />)
        await finishInstall()
        removeVideo()
        expect(worker.postMessage).not.toHaveBeenCalled()
        expect(toastMock).toHaveBeenCalledTimes(1)
    })

    it("el botón Actualizar del aviso aplica la versión nueva", async () => {
        const { worker, finishInstall } = mockUpdate({ waiting: false })
        vi.spyOn(performance, "now").mockReturnValue(APPLY_UPDATE_WINDOW_MS + 1)
        render(<PwaRegistry />)
        await finishInstall()
        const action = toastMock.mock.calls[0][1].action as { onClick: () => void }
        action.onClick()
        expect(worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" })
    })
})
