import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'framer-motion'
import { describe, expect, it, vi } from 'vitest'
import { MoreActionsMenu, RoundAction } from './detail-actions'

describe('acciones de detalle', () => {
    it('abre Más opciones en la primera acción y devuelve el foco al cerrar con Escape', async () => {
        render(<LazyMotion features={domAnimation}><MoreActionsMenu items={[{ label: 'Primera acción', onSelect: vi.fn() }, { label: 'Segunda acción', onSelect: vi.fn() }]} /></LazyMotion>)
        const trigger = screen.getByRole('button', { name: 'Más opciones' })
        trigger.focus()
        fireEvent.click(trigger)
        const first = screen.getByRole('button', { name: 'Primera acción' })
        await waitFor(() => expect(first).toHaveFocus())
        fireEvent.keyDown(first, { key: 'Escape' })
        await waitFor(() => expect(trigger).toHaveFocus())
    })

    it('no muestra un disparador sin opciones', () => {
        render(<MoreActionsMenu items={[]} />)
        expect(screen.queryByRole('button')).toBeNull()
    })

    it('bloquea una acción pendiente con semántica nativa', () => {
        const click = vi.fn()
        render(<RoundAction label="Vista" icon={null} disabled aria-busy onClick={click} />)
        const button = screen.getByRole('button', { name: 'Vista' })
        expect(button).toBeDisabled()
        expect(button).toHaveAttribute('aria-busy', 'true')
        fireEvent.click(button)
        expect(click).not.toHaveBeenCalled()
    })
})
