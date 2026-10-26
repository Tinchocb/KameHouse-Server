import { act, render, screen, waitFor } from '@testing-library/react'
import { createRootRoute, createRoute, createRouter, createMemoryHistory, Outlet, RouterProvider } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'
import { TvNavBar } from './tv-nav-bar'

describe('TvNavBar con el router real y su normalización predeterminada', () => {
    it.each(['/chronology', '/chronology/'])('marca Cronología al entrar por %s y navegar internamente', async (url) => {
        const root = createRootRoute({ component: () => <><TvNavBar /><Outlet /></> })
        const chronology = createRoute({ getParentRoute: () => root, path: '/chronology', component: () => <p>Cronología abierta</p> })
        const home = createRoute({ getParentRoute: () => root, path: '/home', component: () => <p>Inicio abierto</p> })
        const router = createRouter({ routeTree: root.addChildren([chronology, home]), history: createMemoryHistory({ initialEntries: [url] }) })
        await router.load()
        render(<RouterProvider router={router} />)
        const link = await screen.findByRole('link', { name: 'Cronología' })
        await waitFor(() => expect(link).toHaveAttribute('aria-current', 'page'))
        expect(link).toHaveClass('bg-white')
        await act(async () => { await router.navigate({ to: '/home' }) })
        expect(link).not.toHaveAttribute('aria-current')
        await act(async () => { await router.navigate({ to: '/chronology' }) })
        expect(link).toHaveAttribute('aria-current', 'page')
        expect(link).toHaveClass('bg-white')
    })
})
