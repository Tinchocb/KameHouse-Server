import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PwaRegistry } from "./pwa-registry"

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
})
