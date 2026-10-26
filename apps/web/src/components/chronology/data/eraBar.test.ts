import { describe, expect, it } from 'vitest';
import { computeEraBar, eraOfSectionId, eraOfVolume, sectionIdForEra } from './eraBar';
import { pickActiveSection } from '../utils/sectionSpy';

const vols = [
  { id: 'a', seriesId: 'classic' as const, episodesCount: 10 },
  { id: 'b', seriesId: 'classic' as const, episodesCount: 10 },
  { id: 'c', seriesId: 'z' as const, episodesCount: 20 },
  { id: 'd', seriesId: 'gt' as const, episodesCount: 5 },
];

describe('computeEraBar', () => {
  it('sin progreso todo es 0 pero cuenta lapsos y episodios', () => {
    const bar = computeEraBar(vols, undefined);
    expect(bar.all).toMatchObject({ count: 4, read: 0, episodes: 45, watchedEpisodes: 0, fraction: 0 });
    expect(bar['db-clasico'].count).toBe(2);
    expect(bar['db-daima'].episodes).toBe(0);
  });

  it('suma episodios vistos por era y global', () => {
    const progress = new Map([
      ['a', { watched: true, watchedEpisodes: 10, totalEpisodes: 10 }],
      ['b', { watched: false, watchedEpisodes: 4, totalEpisodes: 10 }],
      ['c', { watched: false, watchedEpisodes: 0, totalEpisodes: 20 }],
    ]);
    const bar = computeEraBar(vols, progress);
    expect(bar['db-clasico']).toMatchObject({ read: 1, watchedEpisodes: 14, episodes: 20, fraction: 0.7 });
    expect(bar['db-z'].fraction).toBe(0);
    expect(bar.all.watchedEpisodes).toBe(14);
    expect(bar.all.read).toBe(1);
  });

  it('una marca manual de visto cuenta todos los episodios aunque el historial no los tenga', () => {
    const progress = new Map([['c', { watched: true, watchedEpisodes: 3, totalEpisodes: 20 }]]);
    expect(computeEraBar(vols, progress)['db-z']).toMatchObject({ read: 1, watchedEpisodes: 20, fraction: 1 });
  });
});

describe('ids de era', () => {
  it('traduce serie, era y sección', () => {
    expect(eraOfVolume({ seriesId: 'daima' })).toBe('db-daima');
    expect(eraOfVolume({ seriesId: undefined })).toBeNull();
    expect(sectionIdForEra('db-gt')).toBe('era-section-gt');
    expect(eraOfSectionId('era-section-super')).toBe('db-super');
    expect(eraOfSectionId('otra-cosa')).toBeNull();
    expect(eraOfSectionId(undefined)).toBeNull();
  });
});

describe('pickActiveSection', () => {
  const ids = ['s1', 's2', 's3'];
  it('elige la última sección cuyo comienzo pasó la línea', () => {
    expect(pickActiveSection(ids, [-500, 120, 900], 300, false)).toBe('s2');
    expect(pickActiveSection(ids, [-500, -100, 900], 300, false)).toBe('s2');
    expect(pickActiveSection(ids, [400, 800, 1200], 300, false)).toBeUndefined();
  });
  it('al fondo gana la última, aunque su comienzo no llegue a la línea', () => {
    expect(pickActiveSection(ids, [-3000, -2000, 700], 300, true)).toBe('s3');
  });
  it('ignora secciones que no están en el DOM', () => {
    expect(pickActiveSection(ids, [-10, null, null], 300, false)).toBe('s1');
    expect(pickActiveSection([], [], 300, false)).toBeUndefined();
  });
});
