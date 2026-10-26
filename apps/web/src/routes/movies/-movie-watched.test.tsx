import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { LazyMotion, domAnimation } from 'framer-motion'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_ENDPOINTS } from '@/api/generated/endpoints'

const mocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), sound: vi.fn(), noop: vi.fn(), navigate: vi.fn() }))
vi.mock('@tanstack/react-router', async (original) => ({ ...await original<typeof import('@tanstack/react-router')>(), useNavigate: () => mocks.navigate }))
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }))
vi.mock('@/hooks/use-sound', () => ({ useSound: () => ({ playSound: mocks.sound }) }))
vi.mock('@/hooks/use-home-intelligence', () => ({ useIntelligenceStore: (select: (state: unknown) => unknown) => select({ setBackdropUrl: mocks.noop }) }))
vi.mock('@/lib/theme/theme-hooks', () => ({ useThemeSettings: () => ({ effectiveMode: 'neutral' }) }))
vi.mock('@/components/media-detail/detail-hero', () => ({ DetailHero: ({ actions }: { actions: React.ReactNode }) => <div>{actions}</div> }))
vi.mock('@/api/hooks/continuity.hooks', () => ({ useGetContinuityWatchHistoryItem: () => ({ data: null, refetch: mocks.noop }) }))
vi.mock('@/api/hooks/mediastream.hooks', () => ({ usePreloadMediastreamMediaContainer: () => ({ mutate: mocks.noop }) }))
vi.mock('@/api/hooks/anime_entries.hooks', async (original) => ({
    ...await original<typeof import('@/api/hooks/anime_entries.hooks')>(),
    useGetAnimeEntry: (id: string) => useQuery({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, id], enabled: false, queryFn: async () => initialEntry }),
    useGetAnimeEntrySource: () => ({ data: null }),
}))
import { Route } from './$movieId.lazy'
const key = [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, '7']
const initialEntry = { mediaId: 7, media: { id: 7, titleRomaji: 'Película', format: 'MOVIE', totalEpisodes: 1 }, listData: { progress: 0 }, episodes: [{ watched: false }], localFiles: [] }

function setup() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    client.setQueryData(key, initialEntry)
    vi.spyOn(Route, 'useParams').mockReturnValue({ movieId: '7' })
    const Component = Route.options.component as React.ComponentType
    const view = render(<QueryClientProvider client={client}><LazyMotion features={domAnimation}><Component /></LazyMotion></QueryClientProvider>)
    return { ...view, client, Component }
}

describe('película: confirmación de visto con la mutación y caché reales', () => {
    beforeEach(() => vi.clearAllMocks())
    afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
    it('espera la respuesta, bloquea clic doble y conserva el resultado confirmado al remontar', async () => {
        let resolve!: (res: Response) => void
        const fetch = vi.fn(() => new Promise<Response>(done => { resolve = done }))
        vi.stubGlobal('fetch', fetch)
        const view = setup()
        const button = screen.getByRole('button', { name: 'Marcar como vista' })
        fireEvent.click(button)
        fireEvent.click(button)
        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
        expect(button).toBeDisabled()
        expect(button).toHaveAttribute('aria-busy', 'true')
        expect(button).toHaveAttribute('aria-pressed', 'false')
        expect(mocks.success).not.toHaveBeenCalled()
        await act(async () => resolve(new Response(JSON.stringify({ data: true }), { status: 200 })))
        await waitFor(() => expect(mocks.success).toHaveBeenCalledExactlyOnceWith('Marcada como vista'))
        expect(button).toHaveAttribute('aria-pressed', 'true')
        view.unmount()
        render(<QueryClientProvider client={view.client}><LazyMotion features={domAnimation}><view.Component /></LazyMotion></QueryClientProvider>)
        expect(screen.getByRole('button', { name: 'Quitar de vistas' })).toHaveAttribute('aria-pressed', 'true')
    })
    it('restaura el estado y la caché ante rechazo y permite reintentar', async () => {
        let resolve!: (res: Response) => void
        const fetch = vi.fn(() => new Promise<Response>(done => { resolve = done }))
        vi.stubGlobal('fetch', fetch)
        const { client } = setup()
        fireEvent.click(screen.getByRole('button', { name: 'Marcar como vista' }))
        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
        await act(async () => resolve(new Response(JSON.stringify({ error: 'Prueba de rechazo' }), { status: 500 })))
        await waitFor(() => expect(screen.getByRole('button', { name: 'Marcar como vista' })).toBeEnabled())
        expect(screen.getByRole('button', { name: 'Marcar como vista' })).toHaveAttribute('aria-pressed', 'false')
        expect(client.getQueryData(key)).toEqual(initialEntry)
        expect(mocks.success).not.toHaveBeenCalled()
        expect(mocks.error).toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Marcar como vista' }))
        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
        await act(async () => resolve(new Response(JSON.stringify({ data: true }), { status: 200 })))
        await waitFor(() => expect(mocks.success).toHaveBeenCalledTimes(1))
    })
})
