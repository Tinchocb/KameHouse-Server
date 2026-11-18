import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EpisodeThumbnailImg } from './EpisodeThumbnailImg';

const sources = vi.hoisted(() => ({
  library: { thumbnailUrl: undefined as string | undefined, isExactFrame: false, settled: true },
  tmdb: { data: undefined as { stillPath?: string; stillUrl?: string } | undefined, isFetched: true },
}));
vi.mock('@/api/hooks/library-episode.hooks', () => ({ useGetLibraryEpisodeFile: () => sources.library }));
vi.mock('@/api/hooks/tmdb-episode.hooks', async (original) => ({
  ...await original<typeof import('@/api/hooks/tmdb-episode.hooks')>(),
  useGetTMDBEpisodeStill: () => sources.tmdb,
}));
vi.mock('@/api/hooks/anilist-episode.hooks', () => ({ useGetAniListEpisodeThumbnail: () => ({ data: undefined }) }));

const props = {
  volume: { id: 'db-pilaf', seriesTag: 'Dragon Ball Clásico' as const },
  milestone: { episode: 'Cap. 1', title: 'El encuentro', startSec: 30 },
};

beforeEach(() => {
  sources.library = { thumbnailUrl: undefined, isExactFrame: false, settled: true };
  sources.tmdb = { data: undefined, isFetched: true };
});

describe('EpisodeThumbnailImg', () => {
  it('muestra respaldo sin fuentes del episodio, incluso mientras espera la biblioteca', () => {
    sources.library.settled = false;
    render(<EpisodeThumbnailImg {...props} />);
    const image = screen.getByRole('img');
    expect(image).toHaveAttribute('src', '/sagas/pilaf.webp');
    fireEvent.load(image);
    expect(image).toHaveClass('opacity-100');
  });

  it('recupera un frame fallido con una portada y prueba otra si también falla', () => {
    sources.library = { thumbnailUrl: '/frame.jpg', isExactFrame: true, settled: true };
    render(<EpisodeThumbnailImg {...props} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/frame.jpg');
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByRole('img')).toHaveAttribute('src', '/sagas/pilaf.webp');
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByRole('img')).toHaveAttribute('src', '/sagas/original/busqueda-esferas.webp');
  });

  it('reemplaza el respaldo por la imagen del episodio cuando llega', () => {
    const view = render(<EpisodeThumbnailImg {...props} />);
    fireEvent.load(screen.getByRole('img'));
    sources.library.thumbnailUrl = '/episode.jpg';
    view.rerender(<EpisodeThumbnailImg {...props} milestone={{ ...props.milestone }} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/episode.jpg');
    expect(screen.getByRole('img')).toHaveClass('opacity-0');
    fireEvent.load(screen.getByRole('img'));
    expect(screen.getByRole('img')).toHaveClass('opacity-100');
  });
});
