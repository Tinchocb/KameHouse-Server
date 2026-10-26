import { Profiler, useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'framer-motion';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { VolumeInspectorModal } from './VolumeInspectorModal';
import { VOLUMES_DATA } from './data/volumes';
import { useInspectorFocusReturn } from '@/routes/chronology/-hooks/use-inspector-focus-return';

vi.mock('./EpisodeThumbnailImg', () => ({ EpisodeThumbnailImg: () => null }));
beforeAll(() => { HTMLElement.prototype.scrollIntoView = vi.fn(); });

function Harness({ compact = false, removeTrigger = false }) {
  const [open, setOpen] = useState(false);
  const [volume, setVolume] = useState(VOLUMES_DATA[0]);
  const focus = useInspectorFocusReturn();
  const trigger = <button onClick={() => { focus.capture(VOLUMES_DATA[0].id); setOpen(true); }}>Abrir inspector</button>;
  return <LazyMotion features={domAnimation}>
    {compact
      ? <ol><li id={`timeline-node-${VOLUMES_DATA[0].id}`} tabIndex={-1}>{!open || !removeTrigger ? trigger : null}</li></ol>
      : <article id={`timeline-card-${VOLUMES_DATA[0].id}`} tabIndex={-1}>{!open || !removeTrigger ? trigger : null}</article>}
    <VolumeInspectorModal volume={volume} isOpen={open} onClose={() => setOpen(false)} onCloseAutoFocus={focus.restore}
      hasNext onNextVolume={() => setVolume(VOLUMES_DATA[1])} />
  </LazyMotion>;
}

describe('inspector: cierre y cambios de hito en escritorio', () => {
  it.each([false, true])('restaura el disparador después de cambiar de lapso (compacto=%s)', async (compact) => {
    render(<Harness compact={compact} />);
    const trigger = screen.getByRole('button', { name: 'Abrir inspector' });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Lapso siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar inspector del lapso' }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });
  it.each([false, true])('vuelve al lapso estable si desapareció el disparador (compacto=%s)', async (compact) => {
    const { container } = render(<Harness compact={compact} removeTrigger />);
    const trigger = screen.getByRole('button', { name: 'Abrir inspector' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(container.querySelector(compact ? 'li' : 'article')).toHaveFocus());
  });
  it('permite avanzar y retroceder rápidamente conservando selección y barra transformada', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir inspector' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'ArrowRight' });
    fireEvent.keyDown(dialog, { key: 'ArrowRight' });
    fireEvent.keyDown(dialog, { key: 'ArrowLeft' });
    const selected = screen.getByRole('button', { pressed: true });
    expect(selected).toHaveAttribute('aria-label', expect.stringContaining(VOLUMES_DATA[0].detailedStory?.episodeMilestones[1].title ?? 'hito ausente'));
    const bar = dialog.querySelector<HTMLElement>('.origin-left');
    expect(bar?.style.width).toBe('');
    expect(bar?.style.transform).toMatch(/^scaleX\(/);
  });

  it('confirma el primer hito directamente al cambiar de lapso y conserva la selección en renders ordinarios', () => {
    const commits: (string | null)[] = [];
    const onClose = vi.fn();
    const tree = (index: number, open = true) => (
      <LazyMotion features={domAnimation}>
        <Profiler id="inspector" onRender={() => {
          commits.push(document.querySelector('button[aria-pressed="true"]')?.getAttribute('aria-label') ?? null);
        }}>
          <VolumeInspectorModal volume={VOLUMES_DATA[index]} isOpen={open} onClose={onClose} />
        </Profiler>
      </LazyMotion>
    );
    const view = render(tree(0));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' });
    const previousSelection = screen.getByRole('button', { pressed: true }).getAttribute('aria-label');
    view.rerender(tree(0));
    expect(screen.getByRole('button', { pressed: true })).toHaveAttribute('aria-label', previousSelection);

    commits.length = 0;
    view.rerender(tree(1));
    const milestone = VOLUMES_DATA[1].detailedStory?.episodeMilestones[0];
    if (!milestone) throw new Error('La fixture requiere un hito en el segundo lapso');
    const firstLabel = `Ver episodio ${milestone.episode}: ${milestone.title}`;
    expect(commits.length).toBeGreaterThan(0);
    expect(commits.every(label => label === firstLabel)).toBe(true);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' });
    view.rerender(tree(1, false));
    view.rerender(tree(1, true));
    expect(screen.getByRole('button', { pressed: true })).toHaveAttribute('aria-label', firstLabel);
  });
});
