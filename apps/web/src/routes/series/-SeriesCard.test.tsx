import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SeriesCard } from './-SeriesCard';
import type { SeriesItem } from './-series-model';

vi.mock('@/hooks/use-prefetch-anime-entry', () => ({ usePrefetchAnimeEntry: () => () => {} }));
vi.mock('@/lib/theme/use-classic-mode', () => ({ useIsClassicMode: () => false, useIsMinimalistMode: () => false }));
const saving = vi.hoisted(() => ({ enabled: false }));
vi.mock('@/lib/network-preferences', () => ({ isDataSavingEnabled: () => saving.enabled }));

const item: SeriesItem = {
    id: 21, title: 'Dragon Ball', seriesId: 'dragon_ball', eps: 153,
    year: 1986, progress: 0, img: '', poster: '', desc: '',
};
const props = { item, isSelected: false, eager: true, onNavigate: vi.fn(), onSelect: vi.fn() };
const attack = (container: HTMLElement) => container.querySelector('[data-pose="attack"] img');
const requiredAttack = (container: HTMLElement) => {
    const img = attack(container);
    if (!img) throw new Error('Expected attack image');
    return img;
};

afterEach(() => { cleanup(); saving.enabled = false; vi.restoreAllMocks(); });

describe('SeriesCard: combate por intención', () => {
    it('no monta combate en una tarjeta cerrada aunque sea eager', () => {
        const { container } = render(<SeriesCard {...props} />);
        expect(container.querySelector('[data-pose="idle"] img')).not.toBeNull();
        expect(attack(container)).toBeNull();
    });

    it.each(['focus', 'mouseEnter', 'click'] as const)('prepara combate con %s', (event) => {
        vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList);
        const { container, getByRole } = render(<SeriesCard {...props} />);
        fireEvent[event](getByRole('option'));
        expect(attack(container)?.getAttribute('loading')).toBe('eager');
        expect(container.querySelector('[data-pose="idle"]')?.getAttribute('data-visible')).toBe('true');
    });

    it('conserva reposo hasta cargar combate y reutiliza la pose al volver a seleccionar', () => {
        const { container, rerender } = render(<SeriesCard {...props} isSelected />);
        const img = requiredAttack(container);
        expect(container.querySelector('[data-pose="idle"]')?.getAttribute('data-visible')).toBe('true');
        fireEvent.load(img);
        expect(container.querySelector('[data-pose="attack"]')?.getAttribute('data-visible')).toBe('true');
        rerender(<SeriesCard {...props} />);
        expect(attack(container)).toBe(img);
        rerender(<SeriesCard {...props} isSelected />);
        expect(attack(container)).toBe(img);
    });

    it('mantiene reposo cuando combate falla', () => {
        const { container } = render(<SeriesCard {...props} isSelected />);
        fireEvent.error(requiredAttack(container));
        expect(container.querySelector('[data-pose="idle"]')?.getAttribute('data-visible')).toBe('true');
    });

    it('con ahorro de datos espera la selección, incluso tras hover o foco', () => {
        saving.enabled = true;
        vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList);
        const { container, getByRole, rerender } = render(<SeriesCard {...props} />);
        fireEvent.mouseEnter(getByRole('option'));
        fireEvent.focus(getByRole('option'));
        expect(attack(container)).toBeNull();
        rerender(<SeriesCard {...props} isSelected />);
        expect(attack(container)).not.toBeNull();
    });

    it('no transfiere la intención a otra serie al reutilizar la tarjeta', () => {
        const { container, getByRole, rerender } = render(<SeriesCard {...props} />);
        fireEvent.focus(getByRole('option'));
        fireEvent.load(requiredAttack(container));
        rerender(<SeriesCard {...props} item={{ ...item, seriesId: 'dragon_ball_z' }} />);
        expect(attack(container)).toBeNull();
    });

    it('iguala ratio de reposo entre los 3 Goku niños (DB, GT, Daima) y entre los adultos', () => {
        const getIdleRatio = (seriesId: string) => {
            const { container, unmount } = render(<SeriesCard {...props} item={{ ...item, seriesId }} />);
            const el = container.querySelector<HTMLElement>('[data-pose="idle"]');
            const ratio = el?.style.getPropertyValue('--shelf-character-ratio');
            unmount();
            return ratio;
        };

        const dbRatio = getIdleRatio('dragon_ball');
        const gtRatio = getIdleRatio('dragon_ball_gt');
        const daimaRatio = getIdleRatio('dragon_ball_daima');

        // Los tres Goku pequeños tienen el mismo ratio para idéntico tamaño y altura
        expect(Number(dbRatio)).toBeCloseTo(0.70 / 0.9);
        expect(gtRatio).toBe(dbRatio);
        expect(daimaRatio).toBe(dbRatio);

        // Adultos iguales entre sí y aproximadamente un 62% más altos que los niños en el lomo cerrado.
        const zRatio = parseFloat(getIdleRatio('dragon_ball_z') || '1');
        const kaiRatio = parseFloat(getIdleRatio('dragon_ball_kai') || '1');
        const superRatio = parseFloat(getIdleRatio('dragon_ball_super') || '1');

        expect(zRatio).toBe(0.48);
        expect(kaiRatio).toBe(zRatio);
        expect(superRatio).toBe(zRatio);
        const closedHeight = (ratio: number) => 400 * Math.min(1, 136 / (400 * ratio));
        expect(closedHeight(zRatio) / closedHeight(Number(dbRatio))).toBeCloseTo((0.70 / 0.9) / 0.48);
    });
});
