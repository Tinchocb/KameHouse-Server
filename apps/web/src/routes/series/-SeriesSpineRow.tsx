import { memo, useCallback, useState } from 'react';
import { IconMediaPlay, IconUiCheckCircle2 } from '@/components/ui/icons';
import { cn } from '@/components/ui/core/styling';
import { Button } from '@/components/ui/button';
import { getSpineConfig } from '@/lib/helpers/goku-panorama';
import { getLowResImage, getMediumResImage } from '@/lib/helpers/images';
import { getSeriesEraAccent } from '@/lib/helpers/series';
import { usePrefetchAnimeEntry } from '@/hooks/use-prefetch-anime-entry';
import { getVhsColor } from './-SeriesCard';
import type { SeriesItem } from './-series-model';
import { ElasticCounter } from '@/components/ui/kinetics/elastic-counter';
import { useIsClassicMode } from '@/lib/theme/use-classic-mode';

/**
 * Cinta VHS acostada para la estantería móvil: las cintas se apilan una sobre otra
 * y la que tocas se abre hacia abajo con el póster y los accesos directos.
 * Sin blur ni animaciones continuas: el scroll tiene que ir fluido en celulares modestos.
 */
export const SeriesSpineRow = memo(function SeriesSpineRow({
    item,
    index,
    watched,
    isOpen,
    onToggle,
    onNavigate,
    onPlay,
}: {
    item: SeriesItem;
    index: number;
    /** Episodios vistos (el progreso en % no alcanza para saber cuál sigue). */
    watched: number;
    isOpen: boolean;
    onToggle: (id: number) => void;
    onNavigate: (id: string) => void;
    onPlay: (id: number, episode: number) => void;
}) {
    const handlePrefetch = usePrefetchAnimeEntry(item.id);
    const spineCfg = getSpineConfig(item.seriesId || '', item.id, item.title);
    const accent = spineCfg?.accent || getSeriesEraAccent(item.seriesId, getVhsColor(item.id));
    // Neutro: el color de saga queda en el kanji (identidad); filete, velo y progreso van en gris.
    const isClassic = useIsClassicMode();
    const chrome = isClassic ? 'var(--neutral-separator)' : accent;
    const volLabel = `Vol. ${spineCfg?.vol ?? index + 1}`;
    const kanji = spineCfg?.kanji ?? '★';
    const thumbSrc = getLowResImage(item.poster || item.img) || item.poster || item.img;
    const artSrc = getMediumResImage(item.img || item.poster);
    const isComplete = item.progress >= 100;
    const nextEpisode = item.eps > 0 && watched >= item.eps ? null : watched + 1;
    const regionId = `series-spine-${item.id}`;

    // El arte grande se monta recién la primera vez que se abre la cinta.
    const [hasOpened, setHasOpened] = useState(isOpen);
    if (isOpen && !hasOpened) setHasOpened(true);

    const handleToggle = useCallback(() => {
        handlePrefetch();
        onToggle(item.id);
    }, [handlePrefetch, onToggle, item.id]);

    // Sin overflow-hidden: el anillo de foco del botón cae fuera de la fila. Lo que sí debe
    // recortarse (filete, progreso, fondos) lleva su propio radio.
    return (
        <li
            id={`series-card-${item.id}`}
            className={cn(
                'relative rounded-xl border bg-[var(--surface-content)] transition-[border-color,box-shadow] duration-base ease-smooth-out',
                isOpen ? 'border-white/25 shadow-elevation-3' : 'border-[var(--surface-content-border)]'
            )}
        >
            <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={regionId}
                aria-label={`${item.title}, ${volLabel}, ${item.year}, ${watched} de ${item.eps} ${item.eps === 1 ? 'episodio visto' : 'episodios vistos'}`}
                onClick={handleToggle}
                className="relative w-full flex items-center gap-3 min-h-[72px] pl-4 pr-3 py-2.5 text-left cursor-pointer active:bg-[var(--neutral-elev-1)] active:scale-[0.985] transition-[background-color,transform] duration-fast ease-out-strong rounded-xl"
            >
                {/* Velo de era muy suave sobre el lomo */}
                {!isClassic && (
                    <span
                        aria-hidden
                        className="absolute inset-0 pointer-events-none rounded-xl"
                        style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${accent} 16%, transparent), transparent 55%)` }}
                    />
                )}
                {/* Kanji de la era como marca de agua del lomo */}
                <span
                    aria-hidden
                    className="absolute right-12 top-1/2 -translate-y-1/2 font-kanji font-black text-5xl leading-none select-none pointer-events-none transition-opacity duration-base"
                    style={{
                        color: accent,
                        opacity: isOpen ? 0.35 : 0.18,
                        textShadow: isClassic ? 'none' : `0 0 20px color-mix(in srgb, ${accent} 40%, transparent)`,
                    }}
                >
                    {kanji}
                </span>

                {thumbSrc ? (
                    <img
                        src={thumbSrc}
                        alt=""
                        aria-hidden
                        loading={index < 6 ? 'eager' : 'lazy'}
                        decoding="async"
                        draggable={false}
                        className="relative w-11 h-[60px] shrink-0 rounded-md object-cover border border-white/10"
                    />
                ) : (
                    <span aria-hidden className="relative w-11 h-[60px] shrink-0 rounded-md bg-white/5" />
                )}

                <span className="relative flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-xs font-semibold tabular-nums">
                        <span style={{ color: isClassic ? 'var(--label-1)' : `color-mix(in oklab, ${accent} 70%, white)` }}>{volLabel}</span>
                        <span className="text-label-2">{item.year}</span>
                    </span>
                    <span className="font-display text-base leading-tight text-label-1 truncate" title={item.title}>
                        {item.title}
                    </span>
                    <span className="text-xs font-medium text-label-2 tabular-nums flex items-center gap-0">
                        {isComplete ? 'Completa' : (
                            <>
                                <ElasticCounter value={watched} /><span>&nbsp;de {item.eps || '?'} episodios · {item.progress}%</span>
                            </>
                        )}
                    </span>
                </span>

                {isComplete ? (
                    <IconUiCheckCircle2 aria-hidden className="relative h-5 w-5 shrink-0 text-brand-success" />
                ) : (
                    <svg
                        aria-hidden
                        viewBox="0 0 24 24"
                        className={cn(
                            'relative h-5 w-5 shrink-0 text-label-2 transition-transform duration-base ease-smooth-out',
                            isOpen && 'rotate-180'
                        )}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="m6 9 6 6 6-6" />
                    </svg>
                )}
            </button>

            {/* Filete y progreso: van en un recorte con el radio del lomo, fuera del botón, para que
                el anillo de foco del botón no quede cortado. */}
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                {/* Filete de color de la era a lo largo del lomo */}
                <span className="absolute inset-y-0 left-0 w-1.5 z-10" style={{ background: chrome }} />
                {/* Progreso a lo largo del borde inferior del lomo */}
                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/[0.06]">
                    <div
                        className="h-full origin-left"
                        style={{ transform: `scaleX(${Math.min(Math.max(item.progress, 0), 100) / 100})`, background: isClassic ? 'var(--selected-bg)' : accent }}
                    />
                </div>
            </div>

            {/* Cinta abierta: se despliega hacia abajo */}
            <div
                id={regionId}
                role="region"
                aria-label={item.title}
                inert={!isOpen}
                className={cn(
                    'grid transition-[grid-template-rows] duration-base ease-smooth-out motion-reduce:transition-none',
                    isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                )}
            >
                <div className="min-h-0 overflow-hidden rounded-b-xl">
                    {hasOpened && (
                        <div className="relative px-4 pt-3 pb-4 flex flex-col gap-3">
                            {artSrc && (
                                <img
                                    src={artSrc}
                                    alt=""
                                    aria-hidden
                                    decoding="async"
                                    draggable={false}
                                    className="absolute inset-0 w-full h-full object-cover object-[center_25%] opacity-35 pointer-events-none"
                                />
                            )}
                            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-[color-mix(in_srgb,var(--bg-primary)_80%,transparent)] to-[color-mix(in_srgb,var(--bg-primary)_40%,transparent)] pointer-events-none" />

                            <p className="relative text-sm leading-relaxed text-label-1 line-clamp-3 text-pretty">{item.desc}</p>

                            <div className="relative flex gap-2">
                                {nextEpisode !== null && (
                                    <Button
                                        intent="primary"
                                        className="flex-1"
                                        leftIcon={<IconMediaPlay className="h-4 w-4" aria-hidden />}
                                        onClick={() => onPlay(item.id, nextEpisode)}
                                    >
                                        {watched > 0 ? 'Continuar' : 'Reproducir'} · ep. {nextEpisode}
                                    </Button>
                                )}
                                <Button
                                    intent={nextEpisode === null ? 'primary' : 'secondary'}
                                    className={cn(nextEpisode === null && 'flex-1')}
                                    onClick={() => onNavigate(item.id.toString())}
                                >
                                    Ver serie
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </li>
    );
});
