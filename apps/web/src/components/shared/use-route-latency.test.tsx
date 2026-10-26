import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRouteLatency } from './use-route-latency'

type Event = { toLocation: { href: string } }
const events = vi.hoisted(() => new Map<string, (event: Event) => void>())
const router = vi.hoisted(() => ({
    subscribe: (type: string, listener: (event: Event) => void) => {
        events.set(type, listener)
        return () => { events.delete(type) }
    },
}))
vi.mock('@tanstack/react-router', () => ({ useRouter: () => router }))

let now: number
let frames: Map<number, FrameRequestCallback>
let nextId: number
function emit(type: string, href: string) {
    act(() => { events.get(type)?.({ toLocation: { href } }) })
}
function frame(at: number) {
    now = at
    const ready = [...frames.values()]
    frames.clear()
    act(() => { ready.forEach(callback => callback(at)) })
}

beforeEach(() => {
    now = 0
    frames = new Map()
    nextId = 0
    events.clear()
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        const id = ++nextId
        frames.set(id, callback)
        return id
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id) })
})
afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

describe('route latency', () => {
    it('incluye la carga previa al montaje y espera una oportunidad de pintado', () => {
        const { result } = renderHook(useRouteLatency)
        emit('onBeforeNavigate', '/series')
        now = 300
        emit('onRendered', '/series')
        frame(316)
        expect(result.current).toBeNull()
        frame(332)
        expect(result.current).toBe(332)
    })

    it('descarta el pintado de una navegación interrumpida', () => {
        const { result } = renderHook(useRouteLatency)
        emit('onBeforeNavigate', '/series')
        emit('onRendered', '/series')
        frame(16)
        now = 20
        emit('onBeforeNavigate', '/movies')
        emit('onRendered', '/series')
        frame(32)
        expect(result.current).toBeNull()
        emit('onRendered', '/movies')
        frame(48)
        frame(64)
        expect(result.current).toBe(44)
    })

    it('descarta la navegación si pierde el foco en medio de la medición', () => {
        const { result } = renderHook(useRouteLatency)
        emit('onBeforeNavigate', '/series')
        act(() => { window.dispatchEvent(new Event('blur')) })
        emit('onRendered', '/series')
        frame(2000)
        frame(2016)
        expect(result.current).toBeNull()
    })

    it('al desmontar elimina suscripciones y cuadros pendientes', () => {
        const { unmount } = renderHook(useRouteLatency)
        emit('onBeforeNavigate', '/series')
        emit('onRendered', '/series')
        unmount()
        expect(events.size).toBe(0)
        expect(frames.size).toBe(0)
    })
})
