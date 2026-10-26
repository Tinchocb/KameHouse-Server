import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LazyMotion, domAnimation } from 'framer-motion';
import { TimelineControls } from './TimelineControls';

describe('TimelineControls', () => {
  it('renderiza el control de vista con blur (glass-frosted-pill) sin el selector cronológico', () => {
    const onViewChange = vi.fn();

    const { container } = render(
      <LazyMotion features={domAnimation}>
        <TimelineControls
          view="detailed"
          onViewChange={onViewChange}
        />
      </LazyMotion>
    );

    const glassPills = container.querySelectorAll('.glass-frosted-pill');
    expect(glassPills).toHaveLength(1);

    expect(screen.queryByRole('radiogroup', { name: /Orden de la línea de tiempo/i })).not.toBeInTheDocument();

    const detailedOption = screen.getByRole('radio', { name: /Detallada/i });
    const compactOption = screen.getByRole('radio', { name: /Compacta/i });
    expect(detailedOption).toBeInTheDocument();
    expect(compactOption).toBeInTheDocument();
    expect(detailedOption).toHaveAttribute('aria-checked', 'true');
    expect(compactOption).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(compactOption);
    expect(onViewChange).toHaveBeenCalledWith('compact');
  });

  it('muestra solo los íconos de Detallada y Compacta de forma fija sin expandirse al hacer hover', () => {
    render(
      <LazyMotion features={domAnimation}>
        <TimelineControls
          view="detailed"
          onViewChange={vi.fn()}
        />
      </LazyMotion>
    );

    const viewGroup = screen.getByRole('radiogroup', { name: 'Vista de la línea de tiempo' });
    expect(viewGroup).toHaveAttribute('data-compact', 'true');
    expect(screen.queryByText('Detallada')).not.toBeInTheDocument();
    expect(screen.queryByText('Compacta')).not.toBeInTheDocument();

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    for (const radio of radios) {
      expect(radio.querySelector('svg')).not.toBeNull();
    }

    // Al pasar el puntero sobre el control de vista, sigue compacto (solo íconos, sin expandir texto)
    fireEvent.pointerEnter(viewGroup, { pointerType: 'mouse' });
    expect(viewGroup).toHaveAttribute('data-compact', 'true');
    expect(screen.queryByText('Detallada')).not.toBeInTheDocument();
    expect(screen.queryByText('Compacta')).not.toBeInTheDocument();
  });
});
