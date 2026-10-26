import { describe, expect, it, vi } from 'vitest'
import { createIdlePreloadQueue } from './idle-preload-queue'

function setup() {
    let allowed = true
    let turn: ((budget: number) => void) | null = null
    const cancel = vi.fn(() => { turn = null })
    const queue = createIdlePreloadQueue(callback => { turn = callback; return cancel }, () => allowed)
    const flush = async (budget = 10) => {
        const callback = turn
        turn = null
        callback?.(budget)
        // Completar la cadena de resolución/catch/finally de una tarea síncrona.
        for (let i = 0; i < 8; i++) await Promise.resolve()
    }
    return { queue, flush, cancel, allow(value: boolean) { allowed = value }, hasTurn: () => turn !== null }
}

describe('idle preload queue', () => {
    it('da prioridad a rutas sobre player e imágenes y arranca una por turno', async () => {
        const { queue, flush } = setup()
        const order: string[] = []
        queue.enqueue('image', () => { order.push('image') }, 2)
        queue.enqueue('player', () => { order.push('player') }, 1)
        queue.enqueue('route', () => { order.push('route') }, 0)
        await flush()
        expect(order).toEqual(['route'])
        await flush()
        expect(order).toEqual(['route', 'player'])
        await flush()
        expect(order).toEqual(['route', 'player', 'image'])
    })

    it('espera descarga y decodificación antes de iniciar otra precarga', async () => {
        const { queue, flush, hasTurn } = setup()
        let finish: (() => void) | undefined
        queue.enqueue('slow', () => new Promise<void>(resolve => { finish = resolve }))
        const next = vi.fn()
        queue.enqueue('next', next)
        await flush()
        expect(hasTurn()).toBe(false)
        expect(next).not.toHaveBeenCalled()
        finish?.()
        for (let i = 0; i < 8; i++) await Promise.resolve()
        expect(hasTurn()).toBe(true)
        await flush()
        expect(next).toHaveBeenCalledOnce()
    })

    it('cede el turno sin presupuesto y pausa en segundo plano o ahorro de datos', async () => {
        const state = setup()
        const run = vi.fn()
        state.queue.enqueue('a', run)
        await state.flush(0)
        expect(run).not.toHaveBeenCalled()
        state.allow(false)
        await state.flush()
        expect(run).not.toHaveBeenCalled()
        expect(state.hasTurn()).toBe(false)
        state.allow(true)
        state.queue.wake()
        await state.flush()
        expect(run).toHaveBeenCalledOnce()
    })

    it('deduplica pendientes y tareas en vuelo', async () => {
        const { queue, flush } = setup()
        let finish: (() => void) | undefined
        const duplicate = vi.fn()
        queue.enqueue('a', () => new Promise<void>(resolve => { finish = resolve }))
        queue.enqueue('a', duplicate)
        await flush()
        queue.enqueue('a', duplicate)
        finish?.()
        await flush()
        expect(duplicate).not.toHaveBeenCalled()
    })

    it('un fallo no bloquea tareas siguientes; permite cancelar las pendientes', async () => {
        const { queue, flush } = setup()
        queue.enqueue('fail', () => { throw new Error('offline') })
        const cancelled = vi.fn()
        queue.enqueue('cancelled', cancelled)()
        const next = vi.fn()
        queue.enqueue('next', next)
        await flush()
        await flush()
        expect(next).toHaveBeenCalledOnce()
        expect(cancelled).not.toHaveBeenCalled()
    })

    it('al descartar la cola cancela el turno pendiente', async () => {
        const { queue, flush, cancel } = setup()
        const run = vi.fn()
        queue.enqueue('a', run)
        queue.dispose()
        await flush()
        expect(cancel).toHaveBeenCalledOnce()
        expect(run).not.toHaveBeenCalled()
    })
})
