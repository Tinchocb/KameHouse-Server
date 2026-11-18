import { describe, expect, it } from 'vitest';
import { buildTmdbStillUrl } from './tmdb-episode.hooks';

describe('buildTmdbStillUrl', () => {
  it('acepta stillPath y stillUrl sin duplicar el host', () => {
    expect(buildTmdbStillUrl('/frame.jpg', 'w300')).toBe('https://image.tmdb.org/t/p/w300/frame.jpg');
    expect(buildTmdbStillUrl('https://image.tmdb.org/t/p/w780/frame.jpg', 'w300'))
      .toBe('https://image.tmdb.org/t/p/w300/frame.jpg');
  });

  it('descarta imágenes vacías', () => {
    expect(buildTmdbStillUrl(null)).toBeUndefined();
    expect(buildTmdbStillUrl('  ')).toBeUndefined();
  });
});
