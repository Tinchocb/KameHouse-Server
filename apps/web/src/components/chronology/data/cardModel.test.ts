import { describe, expect, it } from 'vitest';
import {
  buildSegments,
  episodesLabel,
  formatEpisodeRange,
  playTargetFor,
  progressCaption,
  spanStatus,
} from './cardModel';

const vol = { episodesCount: 5, startEpisode: 10, endEpisode: 14, fillerEpisodes: [12], recommendedStartEpisode: undefined, episodesRange: 'Caps 10 al 14' };

describe('buildSegments', () => {
  it('pinta exacto con la lista de episodios vistos y marca el siguiente y el relleno', () => {
    expect(buildSegments(vol, false, 20, 11, [10])).toEqual(['seen', 'next', 'filler', 'pending', 'pending']);
  });
  it('sin lista estima por porcentaje', () => {
    expect(buildSegments({ ...vol, startEpisode: undefined, fillerEpisodes: [] }, false, 40)).toEqual(['seen', 'seen', 'pending', 'pending', 'pending']);
  });
  it('visto lo pinta todo', () => {
    expect(buildSegments(vol, true, 100)?.every((s) => s === 'seen')).toBe(true);
  });
  it('un lapso demasiado largo no tiene segmentos', () => {
    expect(buildSegments({ ...vol, episodesCount: 31 }, false, 0)).toBeNull();
    expect(buildSegments({ ...vol, episodesCount: 0 }, false, 0)).toBeNull();
  });
});

describe('spanStatus', () => {
  it('cubre visto, en curso, pendiente y sin archivos', () => {
    expect(spanStatus(true, 100, true)).toBe('seen');
    expect(spanStatus(false, 40, true)).toBe('in-progress');
    expect(spanStatus(false, 0, true)).toBe('pending');
    expect(spanStatus(false, 0, false)).toBe('unavailable');
    expect(spanStatus(false, 100, true)).toBe('pending');
  });
});

describe('playTargetFor', () => {
  it('empieza en el episodio recomendado o en el primero', () => {
    expect(playTargetFor({ startEpisode: 10, recommendedStartEpisode: 12 }, false, 0)).toEqual({ label: 'Empezar · Ep. 12', episode: 12 });
    expect(playTargetFor({ startEpisode: 10 }, false, 0)).toEqual({ label: 'Empezar · Ep. 10', episode: 10 });
  });
  it('continúa en el siguiente episodio cuando está en curso', () => {
    expect(playTargetFor({ startEpisode: 10 }, false, 40, 12)).toEqual({ label: 'Continuar · Ep. 12', episode: 12 });
  });
  it('visto se repite desde el principio', () => {
    expect(playTargetFor({ startEpisode: 10, recommendedStartEpisode: 12 }, true, 100, 14)).toEqual({ label: 'Ver de nuevo', episode: 10 });
  });
});

describe('textos', () => {
  it('rango de episodios', () => {
    expect(formatEpisodeRange(vol)).toBe('10–14');
    expect(formatEpisodeRange({ startEpisode: 7, endEpisode: 7, episodesRange: '' })).toBe('7');
    expect(formatEpisodeRange({ episodesRange: 'Caps 01 al 013' })).toBe('1–13');
  });
  it('plurales y pie de la barra', () => {
    expect(episodesLabel(1)).toBe('1 episodio');
    expect(episodesLabel(13)).toBe('13 episodios');
    expect(progressCaption('seen', null, 100, 13)).toBe('Visto');
    expect(progressCaption('in-progress', 3, 23, 13)).toBe('3/13 vistos');
    expect(progressCaption('in-progress', null, 23, 40)).toBe('23% visto');
    expect(progressCaption('pending', null, 0, 13)).toBe('13 episodios');
  });
});
