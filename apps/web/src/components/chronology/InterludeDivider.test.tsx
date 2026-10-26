import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InterludeDivider } from './InterludeDivider';
import type { ChronologyInterlude } from './data/interludes';
import type { VolumeData } from './types';

const mockInterludeYears: ChronologyInterlude = {
  id: 'il-test-years',
  fromVolumeId: 'dbz-cell-games',
  toVolumeId: 'dbz-buu-inicio',
  gap: { label: '+7 años', scale: 'anios' },
  kind: 'time-jump',
  title: 'Siete años de paz en la Tierra',
  summary: 'Gohan crece y asiste a la preparatoria Estrella Naranja en Satán City.',
  offscreen: [
    'Nace Goten mientras Goku permanece en el Otro Mundo.',
    'Vegeta continúa su riguroso entrenamiento en solitario.',
  ],
  movieIds: ['m1', 'm2'],
};

const mockInterludeMonths: ChronologyInterlude = {
  id: 'il-test-months',
  fromVolumeId: 'dbs-batalla-dioses',
  toVolumeId: 'dbs-resurreccion-f',
  gap: { label: '+unos meses', scale: 'meses' },
  kind: 'training',
  title: 'El ki de los dioses y los restos del ejército',
  summary: 'Beerus perdona a la Tierra tras el combate con el Super Saiyajin Dios.',
  offscreen: ['Sorbet organiza la búsqueda de las esferas del dragón.'],
};

const mockToVolume = {
  id: 'dbs-resurreccion-f',
  order: 25,
  title: 'La Resurrección de Freezer',
  subtitle: 'El emperador regresa en dorado',
  seriesId: 'super',
  seriesTag: 'Dragon Ball Super',
  sagaCategory: 'super',
  sagaId: 'resurreccion-f',
  sagaLabel: 'Saga de Golden Freezer',
  volumeNumber: '02',
  inUniverseYears: 'Año 779',
  officialYear: 'Año 779',
  officialYearNumber: 779,
  startEpisode: 19,
  endEpisode: 27,
  episodeCount: 9,
  mediaId: 101,
  mediaType: 'series',
  threatLevel: 'Interplanetaria',
  dragonBallsStatus: 'Inactivas tras el deseo',
  coverArt: {
    dominantToneDescription: 'Azul divino y dorado',
    visualSummary: 'Golden Freezer y Goku SSGSS',
    kanjiTitle: '復活の「F」',
    kanjiSubtitle: '黄金の帝王',
    symbolGlyph: '界',
    auraGradient: 'from-blue-950 to-amber-950',
    spineColor: '#3b82f6',
    borderColor: 'border-blue-500',
    badgeBg: 'bg-blue-950 text-blue-300',
    tagColor: 'text-blue-400',
    accentHex: '#3D8BFF',
    themeClass: 'theme-super',
  },
} as unknown as VolumeData;

describe('InterludeDivider', () => {
  it('renderiza la pastilla sin .sectionbar (sin blur por separador) y sin bordes dashed', () => {
    const { container } = render(
      <InterludeDivider
        interlude={mockInterludeMonths}
        toVolume={mockToVolume}
        accentHex="#3D8BFF"
      />
    );

    // Hay una pastilla por separador de la línea de tiempo: no lleva el vidrio .sectionbar (§9)
    expect(container.querySelector('.sectionbar')).toBeNull();
    const pastilla = container.querySelector('[class*="group/interlude"]');
    expect(pastilla).toBeInTheDocument();
    expect(pastilla?.className).toContain('bg-surface-container-lowest');
    expect(pastilla?.className).not.toContain('backdrop');
    expect(pastilla?.className).not.toContain('border-dashed');

    // Título y Chip de gap
    expect(screen.getByText(mockInterludeMonths.title)).toBeInTheDocument();
    expect(screen.getByText('+unos meses')).toBeInTheDocument();
    expect(screen.getByText('Hacia Año 779')).toBeInTheDocument();
  });

  it('despliega el acordeón al hacer clic, mostrando detalles con tokens .surface-content', () => {
    const { container } = render(
      <InterludeDivider
        interlude={mockInterludeYears}
        toVolume={mockToVolume}
        accentHex="#F5C242"
      />
    );

    const triggerButton = screen.getByRole('button', { expanded: false });
    expect(triggerButton).toBeInTheDocument();

    // Clic para abrir
    fireEvent.click(triggerButton);
    expect(triggerButton).toHaveAttribute('aria-expanded', 'true');

    // Resumen visible
    expect(screen.getByText(mockInterludeYears.summary)).toBeInTheDocument();

    // Hechos fuera de pantalla
    expect(screen.getByText('Mientras tanto…')).toBeInTheDocument();
    expect(screen.getByText(/Nace Goten mientras Goku permanece/i)).toBeInTheDocument();

    // Cards internas usan .surface-content
    const surfaceCards = container.querySelectorAll('.surface-content');
    expect(surfaceCards.length).toBeGreaterThan(0);

    // Estado del universo del siguiente lapso
    expect(screen.getByText(/Al empezar el siguiente lapso:/i)).toBeInTheDocument();
    expect(screen.getByText('Interplanetaria')).toBeInTheDocument();
  });

  it('usa tone="era" para saltos de años y aplica el filete superior de la era', () => {
    const { container } = render(
      <InterludeDivider
        interlude={mockInterludeYears}
        toVolume={mockToVolume}
        accentHex="#F5C242"
      />
    );

    // Filete superior visible cuando isYears es verdadero
    const sheen = container.querySelector('span[class*="bg-gradient-to-r"]');
    expect(sheen).toBeInTheDocument();
  });
});
