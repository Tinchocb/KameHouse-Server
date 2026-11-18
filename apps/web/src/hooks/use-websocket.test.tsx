import { act, render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { WSEvents } from "@/lib/server/ws-events"
import { useWebSocket } from "./use-websocket"

// Socket de mentira: react-use-websocket asigna onmessage directamente sobre la instancia.
class FakeSocket {
    static instances: FakeSocket[] = []
    readyState = 1
    onopen: ((ev: unknown) => void) | null = null
    onmessage: ((ev: { data: string }) => void) | null = null
    onclose: ((ev: unknown) => void) | null = null
    onerror: ((ev: unknown) => void) | null = null
    constructor(public url: string) {
        FakeSocket.instances.push(this)
    }
    send() {}
    close() {}
}

function Passive({ url, onRender, onMsg }: { url: string; onRender: () => void; onMsg: (data: unknown) => void }) {
    onRender()
    useWebSocket(url, onMsg as never)
    return null
}

describe("suscriptor WS pasivo (DT-06)", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
        FakeSocket.instances = []
    })

    it("una ráfaga de 20 mensajes no re-renderiza al suscriptor pasivo y todos llegan a onMessage", async () => {
        vi.stubGlobal("WebSocket", FakeSocket)
        const url = "ws://localhost:43211/api/v1/ws-dt06"
        const onRender = vi.fn()
        const onMsg = vi.fn()
        render(<Passive url={url} onRender={onRender} onMsg={onMsg} />)
        await waitFor(() => expect(FakeSocket.instances.length).toBeGreaterThan(0))
        const socket = FakeSocket.instances.at(-1)
        expect(socket).toBeDefined()
        const before = onRender.mock.calls.length
        const type = Object.values(WSEvents)[0]
        const data = JSON.stringify({ type, payload: {} })
        await act(async () => {
            for (let i = 0; i < 20; i++) socket?.onmessage?.({ data })
        })
        expect(onMsg).toHaveBeenCalledTimes(20)
        expect(onRender.mock.calls.length - before).toBeLessThanOrEqual(4)
    })
})
