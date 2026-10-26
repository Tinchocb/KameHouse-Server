import * as React from 'react';
import { ERA_COLOR_MAP } from '@/lib/config/eras';
import { EraRail, type EraRailItem } from '@/components/ui/era-rail';
import type { EraFilter } from './types';
import { eraTextColor } from './utils/eraColor';
import { AIR_YEARS_BY_ERA, eraKeysForOrder, type TimelineOrder } from './data/releaseOrder';

interface ChronoEraItem {
  id: EraFilter;
  title: string;
  shortTitle: string;
  years: string;
  kanji: string;
  colors: {
    accent: string;
    glow: string;
    glowStrong: string;
    textBrand: string;
    ambientGlow1: string;
    ambientGlow2: string;
  };
}

const CHRONO_ERAS: ChronoEraItem[] = [
  {
    id: 'all',
    title: 'Todas las eras',
    shortTitle: 'Todas',
    years: '749–790',
    kanji: '全',
    colors: {
      accent: 'rgba(255, 255, 255, 0.95)',
      glow: 'rgba(255, 255, 255, 0.35)',
      glowStrong: 'rgba(255, 255, 255, 0.6)',
      textBrand: 'text-black',
      ambientGlow1: '#ffffff',
      ambientGlow2: '#e4e4e7',
    },
  },
  {
    id: 'db-clasico',
    title: 'Dragon Ball',
    shortTitle: 'DB Original',
    years: '749–753',
    kanji: '亀',
    colors: ERA_COLOR_MAP.db,
  },
  {
    id: 'db-z',
    title: 'Dragon Ball Z',
    shortTitle: 'Dragon Ball Z',
    years: '761–774',
    kanji: '悟',
    colors: ERA_COLOR_MAP.dbz,
  },
  {
    id: 'db-daima',
    title: 'Dragon Ball Daima',
    shortTitle: 'DB Daima',
    years: '774–775',
    kanji: '魔',
    colors: ERA_COLOR_MAP.dbdaima,
  },
  {
    id: 'db-super',
    title: 'Dragon Ball Super',
    shortTitle: 'DB Super',
    years: '778–780',
    kanji: '超',
    colors: ERA_COLOR_MAP.dbs,
  },
  {
    id: 'db-gt',
    title: 'Dragon Ball GT',
    shortTitle: 'DB GT',
    years: '789–790',
    kanji: '星',
    colors: ERA_COLOR_MAP.dbgt,
  },
];

/** "Todas" primero y luego las eras en el orden elegido. */
function orderedEras(order: TimelineOrder): ChronoEraItem[] {
  if (order === 'chronological') return CHRONO_ERAS;
  const byId = new Map(CHRONO_ERAS.map((era) => [era.id, era]));
  return ['all' as EraFilter, ...eraKeysForOrder(order)].flatMap((id) => byId.get(id) ?? []);
}

export interface EraProgress {
  count: number;
  read: number;
  /** Episodios de la era y vistos: el tramo relleno de la barra los usa si están. */
  episodes?: number;
  watchedEpisodes?: number;
}

interface ChronologyEraNavProps {
  /** Opción elegida: "Todas" o la era a la que está filtrada la línea de tiempo. */
  activeEraId: EraFilter;
  onSelectEra: (eraId: EraFilter) => void;
  eraProgress?: Record<EraFilter, EraProgress>;
  /** Era que se está viendo al desplazarse (scroll-spy): el resalte la sigue. */
  spyEraId?: EraFilter;
  /** Orden de la línea de tiempo: las eras de la barra siguen ese orden y muestran sus años de emisión. */
  order?: TimelineOrder;
}

/**
 * Barra única de eras de la cronología. Envoltorio fino de `EraRail`: aporta las eras del universo,
 * sus años, el avance (tramo relleno con el color de la era) y la era visible según el scroll.
 */
export const ChronologyEraNav = React.memo(function ChronologyEraNav({
  activeEraId,
  onSelectEra,
  eraProgress,
  spyEraId,
  order = 'chronological',
}: ChronologyEraNavProps) {
  const eras = React.useMemo<EraRailItem<EraFilter>[]>(
    () =>
      orderedEras(order).map((era) => {
        const progress = eraProgress?.[era.id];
        const hasEpisodes = progress?.episodes !== undefined && progress.episodes > 0;
        return {
          id: era.id,
          label: era.title,
          kanji: era.kanji,
          accent: era.id === 'all' ? 'var(--label-1)' : era.colors.accent,
          textAccent: era.id === 'all' ? undefined : eraTextColor(era.colors.accent),
          years: order === 'release' && era.id !== 'all' ? `Emitida ${AIR_YEARS_BY_ERA[era.id]}` : `Años ${era.years}`,
          badge: progress ? `${progress.read}/${progress.count}` : undefined,
          detail: progress
            ? `${progress.read} de ${progress.count} ${progress.count === 1 ? 'lapso visto' : 'lapsos vistos'}`
            : undefined,
          progress: progress
            ? hasEpisodes
              ? { done: progress.watchedEpisodes ?? 0, total: progress.episodes ?? 0 }
              : { done: progress.read, total: progress.count }
            : undefined,
        };
      }),
    [eraProgress, order],
  );

  return (
    <EraRail
      eras={eras}
      activeId={activeEraId}
      spyId={spyEraId}
      progressStyle="track"
      onSelect={onSelectEra}
      label="Eras de la línea de tiempo"
    />
  );
});
