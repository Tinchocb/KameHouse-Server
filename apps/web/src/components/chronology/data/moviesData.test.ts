import { describe, it, expect } from 'vitest';
import {
  CHRONOLOGY_MOVIES_DATA,
  getMoviesForFilter,
} from './moviesData';
import { SPAN_VOLUMES, compareInUniverse } from './spansToVolumes';

describe('Chronology Movies & Specials Data', () => {
  it('exposes 26 movies and specials with valid metadata', () => {
    expect(CHRONOLOGY_MOVIES_DATA.length).toBe(26);

    for (const movie of CHRONOLOGY_MOVIES_DATA) {
      expect(movie.id).toMatch(/^movie-(m\d+|sp\d+)$/);
      expect(movie.title).toBeTruthy();
      expect(movie.officialYear).toMatch(/^Año \d{3,4}$/);
      expect(movie.officialYearNumber).toBeGreaterThan(700);
      expect(movie.isMovie).toBe(true);
      expect(['MOVIE', 'SPECIAL']).toContain(movie.mediaType);
      expect(movie.tmdbId).toBeGreaterThan(0);
      expect(movie.detailedStory).toBeDefined();
      expect(movie.detailedStory?.episodeMilestones.length).toBeGreaterThan(0);
    }
  });

  it('filters correctly for "none", "canon", and "all"', () => {
    expect(getMoviesForFilter('none')).toEqual([]);

    const canonMovies = getMoviesForFilter('canon');
    expect(canonMovies.length).toBe(7);
    expect(canonMovies.every((m) => m.isCanonMovie)).toBe(true);

    const canonIds = canonMovies.map((m) => m.id);
    expect(canonIds).toContain('movie-sp1'); // Bardock
    expect(canonIds).toContain('movie-sp2'); // Futuro de Trunks
    expect(canonIds).toContain('movie-sp3'); // Tarble
    expect(canonIds).toContain('movie-m18'); // Batalla de los Dioses
    expect(canonIds).toContain('movie-m19'); // Resurrección de F
    expect(canonIds).toContain('movie-m20'); // DBS Broly
    expect(canonIds).toContain('movie-m21'); // Super Hero

    const allMovies = getMoviesForFilter('all');
    expect(allMovies.length).toBe(26);
  });

  it('positions movies chronologically with compareInUniverse', () => {
    const canonMovies = getMoviesForFilter('canon');
    const combined = [...SPAN_VOLUMES, ...canonMovies].sort(compareInUniverse);

    // Bardock (Año 737) debe ser el primerísimo elemento de toda la franquicia
    expect(combined[0].id).toBe('movie-sp1');
    expect(combined[0].officialYearNumber).toBe(737);

    // El segundo elemento debe ser el inicio de Dragon Ball (Año 749 - Pilaf)
    expect(combined[1].id).toBe('db-pilaf');

    // DBS: Broly (Año 780) debe quedar inmediatamente después del Torneo del Poder (dbs-torneo-del-poder)
    const topIdx = combined.findIndex((v) => v.id === 'dbs-torneo-del-poder');
    const brolyIdx = combined.findIndex((v) => v.id === 'movie-m20');
    expect(topIdx).toBeGreaterThan(-1);
    expect(brolyIdx).toBe(topIdx + 1);

    // DBS: Super Hero (Año 783) debe estar después de Broly
    const superHeroIdx = combined.findIndex((v) => v.id === 'movie-m21');
    expect(superHeroIdx).toBe(brolyIdx + 1);

    // Los años oficiales son siempre no decrecientes
    for (let i = 1; i < combined.length; i++) {
      expect(combined[i].officialYearNumber).toBeGreaterThanOrEqual(combined[i - 1].officialYearNumber);
    }
  });

  it('correctly maps Dragon Ball Z classic movies to Year 761 - 774', () => {
    const allMovies = getMoviesForFilter('all');
    const deadZone = allMovies.find((m) => m.id === 'movie-m5'); // Devuélvanme a mi Gohan
    expect(deadZone).toBeDefined();
    expect(deadZone?.officialYearNumber).toBe(761);
    expect(deadZone?.seriesId).toBe('z');

    const fusion = allMovies.find((m) => m.id === 'movie-m16'); // Janemba & Gogeta
    expect(fusion).toBeDefined();
    expect(fusion?.officialYearNumber).toBe(774);
    expect(fusion?.seriesId).toBe('z');
  });
});
