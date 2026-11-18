import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGetLibraryEpisodeFile } from './library-episode.hooks';

const response = vi.hoisted(() => ({
  data: { path: 'gdrive://file/episode.mkv', hasImage: false, absoluteEpisode: 1 },
}));
vi.mock('@/api/client/requests', () => ({
  buildApiQuery: vi.fn(),
  useServerQuery: () => ({ data: response.data, isFetched: true }),
}));

beforeEach(() => {
  response.data = { path: 'gdrive://file/episode.mkv', hasImage: false, absoluteEpisode: 1 };
});

describe('useGetLibraryEpisodeFile', () => {
  it('no presenta la vista previa fija de Drive como un fotograma exacto', () => {
    const { result } = renderHook(() => useGetLibraryEpisodeFile(12609, 1, 315));
    expect(result.current.thumbnailUrl).toBeUndefined();
    expect(result.current.isExactFrame).toBe(false);
    expect(result.current.settled).toBe(true);
  });

  it('conserva la extracción en el segundo solicitado para archivos locales', () => {
    response.data.path = 'E:/Videos/episode.mkv';
    const { result } = renderHook(() => useGetLibraryEpisodeFile(12609, 1, 315));
    expect(result.current.thumbnailUrl).toContain('t=315');
    expect(result.current.isExactFrame).toBe(true);
  });

  it('conserva los stills del episodio guardados en la biblioteca', () => {
    response.data = { path: 'https://image.tmdb.org/t/p/w780/frame.jpg', hasImage: true, absoluteEpisode: 1 };
    const { result } = renderHook(() => useGetLibraryEpisodeFile(12609, 1, 315));
    expect(result.current.thumbnailUrl).toBe(response.data.path);
    expect(result.current.isExactFrame).toBe(false);
  });
});
