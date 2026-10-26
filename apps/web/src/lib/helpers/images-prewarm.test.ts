import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const jobs = vi.hoisted(() => [] as (() => Promise<void>)[])
vi.mock('@/lib/idle-preload-queue', () => ({
    queueIdlePreload: (_key: string, run: () => Promise<void>) => { jobs.push(run); return () => {} },
}))

class FakeImage {
    static instances: FakeImage[] = []
    src = ''
    decoding = ''
    fetchPriority = ''
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    decode = vi.fn(() => Promise.resolve())
    removeAttribute = vi.fn()
    constructor() { FakeImage.instances.push(this) }
}
beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    jobs.length = 0
    FakeImage.instances = []
    vi.stubGlobal('Image', FakeImage)
    vi.stubGlobal('navigator', { connection: { saveData: false } })
})
afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe('image prewarming', () => {
    it('deduplica URLs antes de crear imágenes y espera su decodificación', async () => {
        const { prewarmImages, isImageLoaded } = await import('./images')
        prewarmImages(['/a.webp', '/a.webp', null])
        expect(jobs).toHaveLength(1)
        expect(FakeImage.instances).toHaveLength(0)
        const finished = jobs[0]()
        const img = FakeImage.instances[0]
        expect(img.fetchPriority).toBe('low')
        let decoded: (() => void) | undefined
        img.decode.mockImplementation(() => new Promise<void>(resolve => { decoded = resolve }))
        img.onload?.()
        expect(isImageLoaded('/a.webp')).toBe(false)
        decoded?.()
        await finished
        expect(isImageLoaded('/a.webp')).toBe(true)
        expect(vi.getTimerCount()).toBe(0)
    })

    it('un error libera la cola y permite reintentar esa imagen', async () => {
        const { prewarmImages, isImageLoaded } = await import('./images')
        prewarmImages(['/broken.webp'])
        const finished = jobs[0]()
        FakeImage.instances[0].onerror?.()
        await finished
        expect(isImageLoaded('/broken.webp')).toBe(false)
        prewarmImages(['/broken.webp'])
        expect(jobs).toHaveLength(2)
    })

    it('una descarga colgada no detiene las precargas indefinidamente', async () => {
        const { prewarmImages, isImageLoaded } = await import('./images')
        prewarmImages(['/timeout.webp'])
        const finished = jobs[0]()
        await vi.advanceTimersByTimeAsync(15000)
        await finished
        expect(FakeImage.instances[0].removeAttribute).toHaveBeenCalledWith('src')
        expect(isImageLoaded('/timeout.webp')).toBe(false)
        prewarmImages(['/timeout.webp'])
        expect(jobs).toHaveLength(2)
    })

    it('no encola imágenes si el navegador solicita ahorro de datos', async () => {
        vi.stubGlobal('navigator', { connection: { saveData: true } })
        const { prewarmImages } = await import('./images')
        prewarmImages(['/a.webp'])
        expect(jobs).toHaveLength(0)
    })
})
