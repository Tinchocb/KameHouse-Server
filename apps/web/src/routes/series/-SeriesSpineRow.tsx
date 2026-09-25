import { memo, useCallback, useState } from 'react';
import { IconMediaPlay, IconUiCheckCircle2 } from '@/components/ui/icons';
import { cn } from '@/components/ui/core/styling';
import { getSpineConfig } from '@/lib/helpers/goku-panorama';
import { getLowResImage, getMediumResImage } from '@/lib/helpers/images';
import { getSeriesEraAccent } from '@/lib/helpers/series';
import { usePrefetchAnimeEntry } from '@/hooks/use-prefetch-anime-entry';
import { getVhsColor, type SeriesItem } from './-SeriesCard';

/**
 * Cinta VHS acostada para la estantería móvil: las cintas se apilan una sobre otra
 * y la que tocás se abre hacia abajo con el póster y los accesos directos.
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
    const volLabel = `VOL. ${spineCfg?.vol ?? index + 1}`;
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

    return (
        <li
            id={`series-card-${item.id}`}
            className={cn(
                'relative overflow-hidden rounded-xl border bg-[#07080c] transition-[border-color,box-shadow] duration-300',
                isOpen ? 'border-white/20 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.9)]' : 'border-white/[0.07]'
            )}
        >
            {/* Filete de color de la era a lo largo del lomo */}
            <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 z-10" style={{ background: accent }} />

            <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={regionId}
                aria-label={`${item.title}, ${volLabel}, ${item.year}, ${watched} de ${item.eps} episodios vistos`}
                onClick={handleToggle}
                className="relative w-full flex items-center gap-3 min-h-[72px] pl-4 pr-3 py-2.5 text-left cursor-pointer active:bg-white/[0.04]"
            >
                {/* Velo de era muy suave sobre el lomo */}
                <span
                    aria-hidden
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${accent} 16%, transparent), transparent 55%)` }}
                />
                {/* Kanji de la era como marca de agua del lomo */}
                <span
                    aria-hidden
                    className="absolute right-12 top-1/2 -translate-y-1/2 font-kanji font-black text-5xl leading-none text-white/[0.05] select-none pointer-events-none"
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
                    <span className="flex items-center gap-2 font-mono text-2xs font-bold uppercase tracking-widest">
                        <span style={{ color: accent }}>{volLabel}</span>
                        <span className="text-white/40">{item.year}</span>
                    </span>
                    <span className="font-display text-base leading-tight tracking-wide text-white truncate">
                        {item.title}
                    </span>
                    <span className="font-mono text-2xs font-semibold uppercase tracking-wider text-white/60 tabular-nums">
                        {isComplete ? 'Completa' : `${watched}/${item.eps || '?'} caps · ${item.progress}%`}
                    </span>
                </span>

                {isComplete ? (
                    <IconUiCheckCircle2 aria-hidden className="relative h-5 w-5 shrink-0 text-brand-success" />
                ) : (
                    <svg
                        aria-hidden
                        viewBox="0 0 24 24"
                        className={cn(
                            'relative h-5 w-5 shrink-0 text-white/50 transition-transform duration-300',
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

            {/* Progreso a lo largo del borde inferior del lomo */}
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-white/[0.06]">
                <div
                    className="h-full origin-left"
                    style={{ transform: `scaleX(${Math.min(Math.max(item.progress, 0), 100) / 100})`, background: accent }}
                />
            </div>

            {/* Cinta abierta: se despliega hacia abajo */}
            <div
                id={regionId}
                role="region"
                aria-label={item.title}
                inert={!isOpen}
                className={cn(
                    'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
                    isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                )}
            >
                <div className="min-h-0 overflow-hidden">
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
                            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#07080c] via-[#07080c]/80 to-[#07080c]/40 pointer-events-none" />

                            <p className="relative text-sm leading-relaxed text-white/75 line-clamp-3">{item.desc}</p>

                            <div className="relative flex gap-2">
                                {nextEpisode !== null && (
                                    <button
                                        type="button"
                                        onClick={() => onPlay(item.id, nextEpisode)}
                                        className="flex-1 inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-full font-display text-xs font-bold uppercase tracking-wider text-black active:scale-[0.97] transition-transform cursor-pointer"
                                        style={{ background: accent }}
                                    >
                                        <IconMediaPlay className="h-4 w-4" aria-hidden />
                                        {watched > 0 ? 'Continuar' : 'Empezar'} · Cap. {nextEpisode}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => onNavigate(item.id.toString())}
                                    className={cn(
                                        'inline-flex items-center justify-center min-h-[44px] px-4 rounded-full border border-white/20 bg-white/[0.06] font-display text-xs font-bold uppercase tracking-wider text-white active:scale-[0.97] transition-transform cursor-pointer',
                                        nextEpisode === null && 'flex-1'
                                    )}
                                >
                                    Ver serie
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </li>
    );
});
