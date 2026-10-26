import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const loaded = vi.hoisted(() => ({ player: vi.fn(), orchestrator: vi.fn() }))
const queued = vi.hoisted(() => [] as { key: string; run: () => Promise<void>; priority: number }[])
vi.mock('@/lib/idle-preload-queue', () => ({
    queueIdlePreload: (key: string, run: () => Promise<void>, priority: number) => { queued.push({ key, run, priority }); return () => {} },
}))
vi.mock('./player', () => { loaded.player(); return {} })
vi.mock('./player-orchestrator', () => { loaded.orchestrator(); return {} })

let connection: { saveData: boolean }
async function runIdle() {
    const task = queued.shift()
    if (!task) throw new Error('Falta la tarea ociosa')
    await task.run()
}
beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    queued.length = 0
    connection = { saveData: false }
    vi.stubGlobal('navigator', { connection })
})
afterEach(() => vi.unstubAllGlobals())

describe('prewarmVideoPlayer', () => {
    it('no programa descargas si el navegador pide ahorrar datos', async () => {
        connection.saveData = true
        const { prewarmVideoPlayer } = await import('./prewarm')
        prewarmVideoPlayer()
        expect(queued).toHaveLength(0)
        expect(loaded.player).not.toHaveBeenCalled()
    })

    it('recomprueba ahorro de datos cuando llega su turno ocioso', async () => {
        const { prewarmVideoPlayer } = await import('./prewarm')
        prewarmVideoPlayer()
        connection.saveData = true
        await runIdle()
        expect(loaded.player).not.toHaveBeenCalled()
    })

    it('mantiene shell y orquestador en tareas separadas de prioridad player', async () => {
        const { prewarmVideoPlayer } = await import('./prewarm')
        prewarmVideoPlayer()
        prewarmVideoPlayer()
        expect(queued).toHaveLength(1)
        expect(queued[0].priority).toBe(1)
        await runIdle()
        expect(queued).toHaveLength(1)
        expect(loaded.player).toHaveBeenCalledOnce()
        expect(loaded.orchestrator).not.toHaveBeenCalled()
        expect(queued[0].priority).toBe(1)
        // Si la preferencia cambia antes de la segunda etapa, se omite ese payload.
        connection.saveData = true
        await runIdle()
        expect(loaded.orchestrator).not.toHaveBeenCalled()
    })
})
