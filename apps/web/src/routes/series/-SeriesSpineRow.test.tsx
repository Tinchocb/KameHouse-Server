import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SeriesSpineRow } from './-SeriesSpineRow';
import type { SeriesItem } from './-series-model';

vi.mock('@/hooks/use-prefetch-anime-entry', () => ({ usePrefetchAnimeEntry: () => () => {} }));
vi.mock('@/lib/theme/use-classic-mode', () => ({ useIsClassicMode: () => false, useIsMinimalistMode: () => false, isMinimalistModeActive: () => false }));

const mockItem: SeriesItem = {
    id: 1,
    title: 'Dragon Ball Z',
    seriesId: 'dragon_ball_z',
    eps: 291,
    year: 1989,
    progress: 45,
    img: '/img/dbz-banner.webp',
    poster: '/img/dbz-poster.webp',
    desc: 'La historia de Goku adulto defendiendo la Tierra.',
};

describe('SeriesSpineRow · tarjeta horizontal mejorada', () => {
    it('separa los controles nativos y no interpreta las teclas de reproducción como despliegue', () => {
        const onToggle = vi.fn();
        const onPlay = vi.fn();
        render(<SeriesSpineRow item={mockItem} index={0} watched={130} isOpen={false} onToggle={onToggle} onNavigate={vi.fn()} onPlay={onPlay} />);
        const trigger = screen.getByRole('button', { name: /Dragon Ball Z, Vol/i });
        const quickPlay = screen.getByRole('button', { name: /Reproducir Dragon Ball Z episodio 131/i });
        expect(trigger.tagName).toBe('BUTTON');
        expect(trigger.contains(quickPlay)).toBe(false);
        for (const key of ['Enter', ' ']) fireEvent.keyDown(quickPlay, { key });
        fireEvent.click(quickPlay);
        expect(onToggle).not.toHaveBeenCalled();
        expect(onPlay).toHaveBeenCalledExactlyOnceWith(1, 131);
    });

    it('devuelve el foco a la cabecera al cerrar desde contenido y permite reabrir', () => {
        const view = (isOpen: boolean) => <SeriesSpineRow item={mockItem} index={0} watched={130} isOpen={isOpen} onToggle={vi.fn()} onNavigate={vi.fn()} onPlay={vi.fn()} />;
        const { rerender } = render(view(true));
        const action = screen.getByRole('button', { name: /Ver episodios/i });
        action.focus();
        rerender(view(false));
        const trigger = screen.getByRole('button', { name: /Dragon Ball Z, Vol/i });
        expect(trigger).toHaveFocus();
        expect(screen.queryByRole('region', { name: mockItem.title })).toBeNull();
        rerender(view(true));
        expect(screen.getByRole('region', { name: mockItem.title })).not.toHaveAttribute('inert');
        expect(screen.getByRole('button', { name: /Ver episodios/i })).toBe(action);
    });
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('usa la caché persistente local para la portada y el fondo de TMDB', () => {
        const { container } = render(
            <SeriesSpineRow
                item={{ ...mockItem, poster: 'https://image.tmdb.org/t/p/original/poster.jpg', img: 'https://image.tmdb.org/t/p/original/banner.jpg' }}
                index={0}
                watched={0}
                isOpen={true}
                onToggle={vi.fn()}
                onNavigate={vi.fn()}
                onPlay={vi.fn()}
            />
        );

        const images = container.querySelectorAll('img');
        expect(images).toHaveLength(2);
        for (const [index, source] of ['https://image.tmdb.org/t/p/w342/poster.jpg', 'https://image.tmdb.org/t/p/w780/banner.jpg'].entries()) {
            const url = new URL(images[index].src);
            expect(url.pathname).toBe('/api/v1/image-proxy');
            expect(url.searchParams.get('url')).toBe(source);
            expect(images[index]).toHaveAttribute('crossorigin', 'anonymous');
        }
    });

    it('renderiza título, año y estado colapsado inicialmente', () => {
        const onToggle = vi.fn();
        const onNavigate = vi.fn();
        const onPlay = vi.fn();

        render(
            <SeriesSpineRow
                item={mockItem}
                index={0}
                watched={130}
                isOpen={false}
                onToggle={onToggle}
                onNavigate={onNavigate}
                onPlay={onPlay}
            />
        );

        expect(screen.getByText('Dragon Ball Z')).toBeInTheDocument();
        expect(screen.getByText('1989')).toBeInTheDocument();
        const toggleBtn = screen.getByRole('button', { name: /Dragon Ball Z, Vol/i });
        expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    });

    it('dispara onToggle al presionar la tarjeta horizontal', () => {
        const onToggle = vi.fn();
        const onNavigate = vi.fn();
        const onPlay = vi.fn();

        render(
            <SeriesSpineRow
                item={mockItem}
                index={0}
                watched={130}
                isOpen={false}
                onToggle={onToggle}
                onNavigate={onNavigate}
                onPlay={onPlay}
            />
        );

        const toggleBtn = screen.getByRole('button', { name: /Dragon Ball Z, Vol/i });
        fireEvent.click(toggleBtn);
        expect(onToggle).toHaveBeenCalledWith(1);
    });

    it('al estar abierta muestra la sinopsis y los botones Continuar y Ver episodios', () => {
        const onToggle = vi.fn();
        const onNavigate = vi.fn();
        const onPlay = vi.fn();

        render(
            <SeriesSpineRow
                item={mockItem}
                index={0}
                watched={130}
                isOpen={true}
                onToggle={onToggle}
                onNavigate={onNavigate}
                onPlay={onPlay}
            />
        );

        expect(screen.getAllByText('La historia de Goku adulto defendiendo la Tierra.')[0]).toBeInTheDocument();

        const continueBtn = screen.getByRole('button', { name: /Continuar ep\. 131/i });
        expect(continueBtn).toBeInTheDocument();
        fireEvent.click(continueBtn);
        expect(onPlay).toHaveBeenCalledWith(1, 131);

        const viewEpisodesBtn = screen.getByRole('button', { name: /Ver episodios/i });
        expect(viewEpisodesBtn).toBeInTheDocument();
        fireEvent.click(viewEpisodesBtn);
        expect(onNavigate).toHaveBeenCalledWith('1');
    });

    it('permite reproducción rápida con el botón flotante en la tarjeta', () => {
        const onToggle = vi.fn();
        const onNavigate = vi.fn();
        const onPlay = vi.fn();

        render(
            <SeriesSpineRow
                item={mockItem}
                index={0}
                watched={130}
                isOpen={false}
                onToggle={onToggle}
                onNavigate={onNavigate}
                onPlay={onPlay}
            />
        );

        const quickPlayBtn = screen.getByRole('button', { name: /Reproducir Dragon Ball Z episodio 131/i });
        fireEvent.click(quickPlayBtn);
        expect(onPlay).toHaveBeenCalledWith(1, 131);
        expect(onToggle).not.toHaveBeenCalled();
    });
});
