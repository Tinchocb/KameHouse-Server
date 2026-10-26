import React, { memo, useMemo, useState } from 'react';
import type { VolumeData } from './types';
import { ERA_FILTER_BY_SERIES } from './data/eraBar';
import { CHRONOLOGY_INTERLUDES } from './data/interludes';
import { buildYearScale, nearestMark, type EraBand } from './data/yearScale';
import { cn } from '@/components/ui/core/styling';

const ERA_COLOR_VAR: Record<string, string> = {
  'db-clasico': 'var(--era-db-hex, #F2762E)',
  'db-z': 'var(--era-dbz-hex, #F5C242)',
  'db-daima': 'var(--era-daima-hex, #A56EF0)',
  'db-super': 'var(--era-dbs-hex, #3D8BFF)',
  'db-gt': 'var(--era-dbgt-hex, #E23A55)',
};

interface YearScaleProps {
  /** Lapsos visibles, en orden in-universe. */
  volumes: VolumeData[];
  /** Colores de cada era tal como los usa la línea de tiempo (Neutro los apaga). */
  accentByEra: Partial<Record<string, string>>;
  /** Lleva la vista al lapso más cercano al punto tocado. */
  onJumpToVolume: (volumeId: string) => void;
  className?: string;
}

function bandColor(band: EraBand, accentByEra: YearScaleProps['accentByEra']): string {
  if (!band.era) return 'var(--label-3)';
  return accentByEra[band.era] ?? ERA_COLOR_VAR[band.era] ?? 'var(--label-2)';
}

/**
 * Eje de años con escala real: cada año ocupa el mismo ancho, así se notan los huecos entre eras.
 * Las bandas llevan el color de su era; los puntos son los lapsos; las líneas finas de abajo, los
 * interludios anclados a su rango de años. Es una ayuda visual: tocar el eje salta al lapso más
 * cercano (el teclado y los lectores usan la barra de eras y las tarjetas).
 */
export const YearScale: React.FC<YearScaleProps> = memo(({ volumes, accentByEra, onJumpToVolume, className }) => {
  const model = useMemo(() => buildYearScale(volumes, CHRONOLOGY_INTERLUDES), [volumes]);
  // Último lapso elegido en el eje (con puntero o teclado): se marca y es el valor del control.
  const [pickedId, setPickedId] = useState<string | null>(null);
  if (!model || volumes.length < 2) return null;

  const pickedIndex = Math.max(0, model.marks.findIndex((m) => m.id === pickedId));
  const pickedVolume = volumes[pickedIndex];
  const pick = (index: number) => {
    const mark = model.marks[Math.min(model.marks.length - 1, Math.max(0, index))];
    if (!mark) return;
    setPickedId(mark.id);
    onJumpToVolume(mark.id);
  };

  const pct = (x: number) => `${(x * 100).toFixed(3)}%`;
  const summary = `Escala de años ${model.minYear} a ${model.maxYear}: ${volumes.length} lapsos${
    model.gaps.length > 0 ? `, con ${model.gaps.length} ${model.gaps.length === 1 ? 'hueco' : 'huecos'} de varios años entre eras` : ''
  }.`;

  return (
    <div className={cn('relative select-none', className)}>
      <div
        // Un solo control: tocar el eje elige el lapso más cercano; con el teclado, las flechas lo recorren.
        role="slider"
        tabIndex={0}
        aria-label="Escala de años: elegir un lapso"
        aria-description={summary}
        aria-valuemin={0}
        aria-valuemax={model.marks.length - 1}
        aria-valuenow={pickedIndex}
        aria-valuetext={`${pickedVolume?.title ?? ''}, ${pickedVolume?.officialYear.replace(/^años?\s*/i, 'año ') ?? ''}`}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const target = nearestMark(model.marks, (e.clientX - rect.left) / rect.width);
          if (target) {
            setPickedId(target.id);
            onJumpToVolume(target.id);
          }
        }}
        onKeyDown={(e) => {
          const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
          if (step !== 0) pick(pickedIndex + step);
          else if (e.key === 'Home') pick(0);
          else if (e.key === 'End') pick(model.marks.length - 1);
          else return;
          e.preventDefault();
        }}
        className="relative h-14 w-full cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
      >
        {/* Eje y bandas por era */}
        <div aria-hidden="true" className="absolute inset-x-0 top-5 h-0.5 rounded-full bg-[color-mix(in_srgb,var(--label-1)_14%,transparent)]" />
        {model.bands.map((band, i) => (
          <span
            key={`${band.era}-${i}`}
            aria-hidden="true"
            data-era-band={band.era ?? 'sin-era'}
            className="absolute top-[18px] h-1.5 rounded-full opacity-80"
            style={{ left: pct(band.x0), width: pct(band.x1 - band.x0), background: bandColor(band, accentByEra) }}
          />
        ))}

        {/* Huecos entre eras, con sus años */}
        {model.gaps.map((gap) => (
          <span
            key={gap.fromYear}
            aria-hidden="true"
            data-year-gap={gap.years}
            className="absolute top-0 flex h-5 items-center justify-center overflow-hidden text-2xs text-label-2 tabular-nums"
            style={{ left: pct(gap.x0), width: pct(gap.x1 - gap.x0) }}
          >
            <span className="truncate">{gap.years} años</span>
          </span>
        ))}

        {/* Lapsos */}
        {model.marks.map((mark) => (
          <span
            key={mark.id}
            aria-hidden="true"
            className={cn(
              'absolute top-[17px] size-2 -translate-x-1/2 rounded-full border border-[var(--neutral-elev-0)]',
              mark.id === pickedId && 'scale-150 ring-2 ring-[var(--label-1)]',
            )}
            style={{ left: pct(mark.x), background: mark.era ? (accentByEra[mark.era] ?? ERA_COLOR_VAR[mark.era]) : 'var(--label-2)' }}
          />
        ))}

        {/* Interludios anclados a su rango de años */}
        {model.interludes.map((il) => (
          <span
            key={il.id}
            aria-hidden="true"
            data-interlude-bar={il.id}
            className="absolute top-[33px] h-px bg-[color-mix(in_srgb,var(--label-1)_28%,transparent)]"
            style={{ left: pct(il.x0), width: pct(il.x1 - il.x0) }}
          />
        ))}

        {/* Marcas de años */}
        {model.ticks.map((tick) => (
          <span
            key={tick.year}
            aria-hidden="true"
            className="absolute top-9 -translate-x-1/2 text-2xs leading-none text-label-2 tabular-nums"
            style={{ left: pct(tick.x) }}
          >
            {tick.year}
          </span>
        ))}
      </div>
    </div>
  );
});

YearScale.displayName = 'YearScale';

/** Era de un lapso, para pintar las bandas con el color que usa la línea de tiempo. */
export function accentByEraFrom(volumes: readonly VolumeData[]): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {};
  for (const v of volumes) {
    const era = v.seriesId ? ERA_FILTER_BY_SERIES[v.seriesId] : null;
    if (era && !out[era]) out[era] = v.coverArt.accentHex;
  }
  return out;
}
