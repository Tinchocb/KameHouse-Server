import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LazyMotion, domAnimation } from 'framer-motion';
import { ContralateralDetailsCard } from './ContralateralDetailsCard';
import { SPAN_VOLUMES } from './data/spansToVolumes';

const sampleVolume = SPAN_VOLUMES[0];

describe('ContralateralDetailsCard', () => {
  it('renderiza la cabecera esencial y la información básica del lapso', () => {
    const onClose = vi.fn();
    render(
      <LazyMotion features={domAnimation}>
        <ContralateralDetailsCard
          volume={sampleVolume}
          onClose={onClose}
        />
      </LazyMotion>
    );

    // Título y saga
    expect(screen.getByText(sampleVolume.title)).toBeInTheDocument();
    expect(screen.getByText(sampleVolume.sagaLabel)).toBeInTheDocument();

    // Tabs básicas presentes
    expect(screen.getByRole('tab', { name: /Conflicto/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Clímax/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Trasfondo/i })).toBeInTheDocument();

    // Botón de cierre
    const closeBtn = screen.getByRole('button', { name: /Cerrar detalles/i });
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('permite cambiar entre pestañas y muestra los datos esenciales', () => {
    const onTabChange = vi.fn();
    render(
      <LazyMotion features={domAnimation}>
        <ContralateralDetailsCard
          volume={sampleVolume}
          onClose={vi.fn()}
          onTabChange={onTabChange}
        />
      </LazyMotion>
    );

    // En 'conflicto', se ve Inicio y Quiebre
    expect(screen.getByText(/Inicio:/i)).toBeInTheDocument();
    expect(screen.getByText(/Quiebre:/i)).toBeInTheDocument();

    // Cambiar a Clímax
    const climaxTab = screen.getByRole('tab', { name: /Clímax/i });
    fireEvent.click(climaxTab);
    expect(onTabChange).toHaveBeenCalledWith('climax');

    // Cambiar a Trasfondo
    const loreTab = screen.getByRole('tab', { name: /Trasfondo/i });
    fireEvent.click(loreTab);
    expect(onTabChange).toHaveBeenCalledWith('lore');
  });

  it('las pestañas son un tablist de SegmentedControl: la seleccionada tiene aria-selected y las flechas la mueven', () => {
    const onTabChange = vi.fn();
    render(
      <LazyMotion features={domAnimation}>
        <ContralateralDetailsCard
          volume={sampleVolume}
          onClose={vi.fn()}
          onTabChange={onTabChange}
        />
      </LazyMotion>
    );

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    const conflicto = screen.getByRole('tab', { name: /Conflicto/i });
    expect(conflicto).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Clímax/i })).toHaveAttribute('aria-selected', 'false');

    fireEvent.keyDown(conflicto, { key: 'ArrowRight' });
    expect(onTabChange).toHaveBeenCalledWith('climax');
  });

  it('dentro de otra tarjeta glass (embedded) no lleva .sectionbar; suelta sí', () => {
    const { container, unmount } = render(
      <LazyMotion features={domAnimation}>
        <ContralateralDetailsCard volume={sampleVolume} onClose={vi.fn()} embedded />
      </LazyMotion>
    );
    const embebida = container.querySelector('article');
    expect(embebida).toBeInTheDocument();
    expect(embebida).not.toHaveClass('sectionbar');
    expect(embebida?.className).not.toContain('backdrop');
    unmount();

    const { container: suelta } = render(
      <LazyMotion features={domAnimation}>
        <ContralateralDetailsCard volume={sampleVolume} onClose={vi.fn()} />
      </LazyMotion>
    );
    expect(suelta.querySelector('article')).toHaveClass('sectionbar');
  });
});
