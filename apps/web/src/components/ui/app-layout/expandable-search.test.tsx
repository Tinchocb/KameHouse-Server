import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'framer-motion'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ search: { query: 'dragon', setQuery: vi.fn(), results: [{ mediaId: 1, media: { titleSpanish: 'Uno', format: 'TV' } }, { mediaId: 2, media: { titleSpanish: 'Dos', format: 'MOVIE' } }], isLoading: false, isSearchActive: true }, navigate: vi.fn() }))
vi.mock('@/hooks/use-global-search', () => ({ useGlobalSearch: () => mocks.search }))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }))
vi.mock('@/hooks/use-sound', () => ({ useSound: () => ({ playSound: vi.fn() }) }))
import { ExpandableSearch } from './expandable-search'
const tree = () => <LazyMotion features={domAnimation}><ExpandableSearch /></LazyMotion>

describe('búsqueda compacta: selección accesible', () => {
    beforeEach(() => vi.clearAllMocks())
    it('devuelve foco con Escape y restaura interacción si se reabre durante la salida', async () => {
        render(tree())
        const trigger = screen.getByRole('button', { name: 'Buscar' })
        fireEvent.click(trigger)
        const input = screen.getByRole('combobox')
        input.focus()
        const results = screen.getByRole('listbox')
        fireEvent.keyDown(input, { key: 'Escape' })
        expect(trigger).toHaveFocus()
        expect(results.closest('[inert]')).not.toBeNull()
        expect(results.closest('[aria-hidden="true"]')).not.toBeNull()
        fireEvent.click(trigger)
        await waitFor(() => expect(screen.getByRole('listbox').closest('[inert]')).toBeNull())
        expect(screen.getByRole('listbox')).toBe(results)
    })
    it('mantiene foco en el input y expone exactamente la opción que Enter activa', () => {
        render(tree())
        fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
        const input = screen.getByRole('combobox')
        input.focus()
        expect(input).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByRole('listbox').id).toBe(input.getAttribute('aria-controls'))
        fireEvent.keyDown(input, { key: 'ArrowDown' })
        fireEvent.keyDown(input, { key: 'ArrowDown' })
        const selected = screen.getByRole('option', { selected: true })
        expect(selected).toHaveTextContent('Dos')
        expect(input).toHaveAttribute('aria-activedescendant', selected.id)
        expect(input).toHaveFocus()
        fireEvent.keyDown(input, { key: 'Enter' })
        expect(mocks.navigate).toHaveBeenCalledWith({ to: '/movies/$movieId', params: { movieId: '2' } })
    })
    it('resetea selección con resultados nuevos, anuncia carga/vacío y cierra con Escape', () => {
        const original = mocks.search.results
        const view = render(tree())
        fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
        const input = screen.getByRole('combobox')
        fireEvent.keyDown(input, { key: 'ArrowDown' })
        mocks.search.results = [...original].reverse()
        view.rerender(tree())
        expect(input).not.toHaveAttribute('aria-activedescendant')
        expect(screen.queryByRole('option', { selected: true })).toBeNull()
        mocks.search.isLoading = true
        view.rerender(tree())
        expect(screen.getByRole('status')).toHaveTextContent('Buscando')
        mocks.search.isLoading = false
        mocks.search.results = []
        view.rerender(tree())
        fireEvent.keyDown(input, { key: 'ArrowDown' })
        expect(input).not.toHaveAttribute('aria-activedescendant')
        expect(screen.getByRole('status')).toHaveTextContent('0 resultados')
        fireEvent.keyDown(input, { key: 'Escape' })
        mocks.search.results = original
    })
})
