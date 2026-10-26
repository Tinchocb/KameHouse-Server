import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PersistedClient } from "@tanstack/react-query-persist-client"

const setMock = vi.fn(async () => {})
const delMock = vi.fn(async () => {})
vi.mock("idb-keyval", () => ({
    get: vi.fn(async () => undefined),
    set: (...args: unknown[]) => setMock(...(args as [])),
    del: (...args: unknown[]) => delMock(...(args as [])),
}))

import { createIDBPersister } from "./query-persister"

const client = (n: number) => ({ timestamp: n, buster: "b", clientState: { queries: [], mutations: [] } }) as unknown as PersistedClient

describe("createIDBPersister", () => {
    beforeEach(() => {
        vi.useFakeTimers()
        setMock.mockClear()
        delMock.mockClear()
    })
    afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

    function controlIdle() {
        const callbacks = new Map<number, IdleRequestCallback>()
        let nextId = 0
        const request = vi.fn((callback: IdleRequestCallback) => {
            callbacks.set(++nextId, callback)
            return nextId
        })
        const cancel = vi.fn((id: number) => { callbacks.delete(id) })
        vi.stubGlobal('requestIdleCallback', request)
        vi.stubGlobal('cancelIdleCallback', cancel)
        const run = () => {
            for (const [id, callback] of callbacks) {
                callbacks.delete(id)
                callback({ didTimeout: false, timeRemaining: () => 10 })
            }
        }
        return { request, cancel, run }
    }

    it('mantiene un solo turno idle durante actividad continua y escribe el estado más reciente', async () => {
        const idle = controlIdle()
        const p = createIDBPersister('idle-burst', 1000)
        for (let i = 1; i <= 5; i++) {
            await p.persistClient(client(i))
            await vi.advanceTimersByTimeAsync(1000)
        }
        expect(idle.request).toHaveBeenCalledTimes(1)
        expect(setMock).not.toHaveBeenCalled()
        idle.run()
        expect(setMock).toHaveBeenCalledWith('idle-burst', client(5))
    })

    it('cancela el turno idle al borrar y respeta el plazo del siguiente guardado', async () => {
        const idle = controlIdle()
        const p = createIDBPersister('idle-remove', 1000)
        await p.persistClient(client(1))
        await vi.advanceTimersByTimeAsync(1000)
        await p.removeClient()
        expect(idle.cancel).toHaveBeenCalledTimes(1)
        await p.persistClient(client(2))
        idle.run()
        expect(setMock).not.toHaveBeenCalled()
        await vi.advanceTimersByTimeAsync(1000)
        idle.run()
        expect(setMock).toHaveBeenCalledWith('idle-remove', client(2))
    })

    it('pagehide guarda inmediatamente y cancela el turno idle anterior', async () => {
        const idle = controlIdle()
        const p = createIDBPersister('idle-exit', 1000)
        await p.persistClient(client(1))
        await vi.advanceTimersByTimeAsync(1000)
        window.dispatchEvent(new Event('pagehide'))
        expect(idle.cancel).toHaveBeenCalledTimes(1)
        expect(setMock).toHaveBeenCalledWith('idle-exit', client(1))
        idle.run()
        expect(setMock).toHaveBeenCalledTimes(1)
    })

    it("agrupa ráfagas de eventos en una sola escritura con el último estado", async () => {
        const p = createIDBPersister("k", 1000)
        for (let i = 1; i <= 6; i++) await p.persistClient(client(i))
        expect(setMock).not.toHaveBeenCalled()

        await vi.advanceTimersByTimeAsync(3500)
        expect(setMock).toHaveBeenCalledTimes(1)
        expect(setMock).toHaveBeenCalledWith("k", client(6))
    })

    it("escribe enseguida al ocultar la ventana", async () => {
        const p = createIDBPersister("k2", 1000)
        await p.persistClient(client(1))
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" })
        document.dispatchEvent(new Event("visibilitychange"))
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
        await vi.advanceTimersByTimeAsync(0)
        expect(setMock).toHaveBeenCalledWith("k2", client(1))
    })

    it("removeClient descarta la escritura pendiente", async () => {
        const p = createIDBPersister("k3", 1000)
        await p.persistClient(client(1))
        await p.removeClient()
        await vi.advanceTimersByTimeAsync(3500)
        expect(setMock).not.toHaveBeenCalledWith("k3", expect.anything())
        expect(delMock).toHaveBeenCalledWith("k3")
    })
})
