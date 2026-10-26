import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OsToggle } from './components'

describe('OsToggle dependiente', () => {
    it('expone deshabilitado y bloquea clic, Enter y Espacio hasta que se habilita', () => {
        const onChange = vi.fn()
        const view = render(<OsToggle label="Avisos del escáner" checked disabled onChange={onChange} />)
        const toggle = screen.getByRole('switch', { name: 'Avisos del escáner' })
        expect(toggle).toHaveAttribute('aria-disabled', 'true')
        expect(toggle).toHaveAttribute('tabindex', '-1')
        fireEvent.click(toggle)
        fireEvent.keyDown(toggle, { key: 'Enter' })
        fireEvent.keyDown(toggle, { key: ' ' })
        expect(onChange).not.toHaveBeenCalled()
        view.rerender(<OsToggle label="Avisos del escáner" checked onChange={onChange} />)
        expect(toggle).not.toHaveAttribute('aria-disabled')
        fireEvent.keyDown(toggle, { key: ' ' })
        expect(onChange).toHaveBeenCalledExactlyOnceWith(false)
    })
})
