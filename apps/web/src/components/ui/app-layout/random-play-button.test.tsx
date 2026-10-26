import { act, fireEvent, render, screen } from '@testing-library/react'
import { LazyMotion, domAnimation, MotionConfig } from 'framer-motion'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), queue: vi.fn(), tv: vi.fn(), closeQueue: vi.fn(), success: vi.fn(), error: vi.fn() }))
vi.mock('@/api/hooks/anime_collection.hooks', () => ({ useGetLibraryCollection: () => ({ data: { lists: [{ entries: [{ mediaId: 7, media: { format: 'TV', titleRomaji: 'Serie' }, libraryData: { mainFileCount: 1 } }] }] } }) }))
vi.mock('@/api/hooks/anime_entries.hooks', () => ({ fetchAnimeEntryLocalFiles: mocks.fetch }))
vi.mock('@/hooks/use-sound', () => ({ useSound: () => ({ playSound: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }))
vi.mock('@/lib/store', () => ({
    useAppStore: (select: (state: unknown) => unknown) => select({ tvMode: false }),
    usePlayerStore: (select: (state: unknown) => unknown) => select({ setTvMode: mocks.tv }),
    useQueueStore: { setState: mocks.queue },
    useUIStore: { getState: () => ({ setGlobalQueueOpen: mocks.closeQueue }) },
}))
import { RandomPlayButton } from './random-play-button'

function setup() {
    const view = render(<LazyMotion features={domAnimation}><MotionConfig reducedMotion="always"><RandomPlayButton modalOnly /></MotionConfig></LazyMotion>)
    act(() => window.dispatchEvent(new CustomEvent('open-random-picker')))
    return view
}
function deferred() {
    let resolve!: (value: unknown[]) => void
    let reject!: (error: Error) => void
    const promise = new Promise<unknown[]>((yes, no) => { resolve = yes; reject = no })
    return { promise, resolve, reject }
}
const files = [{ path: 'test-only.mkv', metadata: { episode: 1 } }]

describe('Sorpréndeme: vigencia del lanzamiento', () => {
    beforeEach(() => vi.clearAllMocks())
    it.each(['Escape', 'Cerrar', 'velo', 'desmontar'])('descarta la respuesta después de %s', async (method) => {
        const pending = deferred()
        mocks.fetch.mockReturnValue(pending.promise)
        const view = setup()
        const series = screen.getByRole('button', { name: /Series Empieza/ })
        fireEvent.click(series)
        expect(mocks.fetch).toHaveBeenCalledTimes(1)
        if (method === 'Escape') fireEvent.keyDown(window, { key: 'Escape' })
        else if (method === 'Cerrar') fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
        else if (method === 'velo') {
            const backdrop = view.container.querySelector('.cursor-pointer.backdrop-blur-overlay-xs')
            if (!backdrop) throw new Error('No se encontró el velo del diálogo')
            fireEvent.click(backdrop)
        }
        else view.unmount()
        // AnimatePresence conserva temporalmente el botón durante la salida.
        fireEvent.click(series)
        expect(mocks.fetch).toHaveBeenCalledTimes(1)
        await act(async () => pending.resolve(files))
        expect(mocks.queue).not.toHaveBeenCalled()
        expect(mocks.tv).not.toHaveBeenCalled()
        expect(mocks.success).not.toHaveBeenCalled()
    })
    it('solo permite que la nueva apertura lance y no libera su pending al terminar la anterior', async () => {
        const old = deferred(), current = deferred()
        mocks.fetch.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
        setup()
        fireEvent.click(screen.getByRole('button', { name: /Series Empieza/ }))
        fireEvent.keyDown(window, { key: 'Escape' })
        act(() => window.dispatchEvent(new CustomEvent('open-random-picker')))
        const series = screen.getByRole('button', { name: /Series Empieza/ })
        fireEvent.click(series)
        await act(async () => old.resolve(files))
        expect(series).toBeDisabled()
        expect(mocks.queue).not.toHaveBeenCalled()
        await act(async () => current.resolve(files))
        expect(mocks.queue).toHaveBeenCalledTimes(1)
        expect(mocks.tv).toHaveBeenCalledExactlyOnceWith(true)
        expect(mocks.success).toHaveBeenCalledTimes(1)
    })
    it('silencia el error de una elección cancelada', async () => {
        const pending = deferred()
        mocks.fetch.mockReturnValue(pending.promise)
        setup()
        fireEvent.click(screen.getByRole('button', { name: /Series Empieza/ }))
        fireEvent.keyDown(window, { key: 'Escape' })
        await act(async () => pending.reject(new Error('cancelada')))
        expect(mocks.error).not.toHaveBeenCalled()
    })
    it('declara rol dialog y aria-modal="true" para accesibilidad', () => {
        setup()
        const dialog = screen.getByRole('dialog')
        expect(dialog).toBeInTheDocument()
        expect(dialog).toHaveAttribute('aria-modal', 'true')
        expect(dialog).toHaveAttribute('aria-labelledby', 'tv-mode-dialog-title')
    })
})
