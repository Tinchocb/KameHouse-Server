import { memo, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { IconMediaPlay, IconUiCheckCircle2, IconArrowRight, IconNavigationChevronRight } from '@/components/ui/icons';
import { cn } from '@/components/ui/core/styling';
import { Button } from '@/components/ui/button';
import { getSpineConfig } from '@/lib/helpers/goku-panorama';
import { getMediumResImage, getHighResImage, localImage } from '@/lib/helpers/images';
import { getSeriesEraAccent, DRAGON_BALL_SERIES_INFO } from '@/lib/helpers/series';
import { usePrefetchAnimeEntry } from '@/hooks/use-prefetch-anime-entry';
import { getVhsColor } from './-SeriesCard';
import type { SeriesItem } from './-series-model';
import { ElasticCounter } from '@/components/ui/kinetics/elastic-counter';
import { useIsMinimalistMode } from '@/lib/theme/use-classic-mode';

/**
 * Tarjeta horizontal interactiva para la colección de series (diseñada para escritorio y móvil).
 * Muestra el póster a la izquierda, badges de era y volumen, título en Google Sans, barra de progreso
 * fluida y un panel desplegable cinematográfico con sinopsis y accesos directos de reproducción.
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
    /** Episodios vistos. */
    watched: number;
    isOpen: boolean;
    onToggle: (id: number) => void;
    onNavigate: (id: string) => void;
    onPlay: (id: number, episode: number) => void;
}) {
    const handlePrefetch = usePrefetchAnimeEntry(item.id);
    const spineCfg = getSpineConfig(item.seriesId || '', item.id, item.title);
    const accent = spineCfg?.accent || getSeriesEraAccent(item.seriesId, getVhsColor(item.id));
    const isMinimalist = useIsMinimalistMode();
    const chrome = isMinimalist ? 'var(--neutral-separator)' : accent;
    const volLabel = `Vol. ${spineCfg?.vol ?? index + 1}`;
    const kanji = spineCfg?.kanji ?? '★';

    // Compartir las URLs del proxy con la precarga y la estantería: quedan en disco
    // entre sesiones y evitan otra descarga de TMDB al abrir la tarjeta.
    const posterSrc = localImage(getMediumResImage(item.poster || item.img));
    const artSrc = localImage(getHighResImage(item.img || item.poster));

    const isComplete = item.progress >= 100;
    const nextEpisode = item.eps > 0 && watched >= item.eps ? null : watched + 1;
    const unwatchedCount = Math.max(0, item.eps - watched);
    const progressPct = Math.min(Math.max(item.progress, 0), 100);
    const regionId = `series-spine-${item.id}`;
    const triggerRef = useRef<HTMLButtonElement>(null);
    const regionRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (!isOpen && regionRef.current?.contains(document.activeElement)) {
            triggerRef.current?.focus({ preventScroll: true });
        }
    }, [isOpen]);

    const seriesInfo = item.seriesId ? DRAGON_BALL_SERIES_INFO[item.seriesId] : undefined;
    const synopsis = item.desc || seriesInfo?.description || 'Sin descripción disponible.';

    const [hasOpened, setHasOpened] = useState(isOpen);
    if (isOpen && !hasOpened) setHasOpened(true);

    const handleToggle = useCallback(() => {
        handlePrefetch();
        onToggle(item.id);
    }, [handlePrefetch, onToggle, item.id]);

    const handleQuickPlay = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (nextEpisode !== null) {
            onPlay(item.id, nextEpisode);
        } else {
            onPlay(item.id, 1);
        }
    }, [nextEpisode, onPlay, item.id]);

    return (
        <li
            id={`series-card-${item.id}`}
            className={cn(
                'group relative rounded-2xl border bg-[var(--surface-content)] transition-[border-color,box-shadow,background-color] duration-base ease-smooth-out select-none',
                isOpen
                    ? 'border-white/30 shadow-elevation-3'
                    : 'border-[var(--surface-content-border)] [@media(hover:hover)_and_(pointer:fine)]:hover:border-white/25 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-elevation-2 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/[0.02]'
            )}
            style={{
                borderColor: isOpen && !isMinimalist
                    ? `color-mix(in srgb, ${accent} 45%, rgba(255, 255, 255, 0.25))`
                    : undefined,
            }}
        >
            {/* Botón principal de la fila */}
            <div
                className="relative w-full flex items-center gap-4 sm:gap-6 lg:gap-7 min-h-[104px] sm:min-h-[124px] lg:min-h-[136px] p-3.5 sm:p-[18px] lg:p-[22px] text-left rounded-2xl"
            >
                <button
                    ref={triggerRef}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={regionId}
                    aria-label={`${item.title}, ${volLabel}, ${item.year}, ${watched} de ${item.eps} ${item.eps === 1 ? 'episodio visto' : 'episodios vistos'}`}
                    onClick={handleToggle}
                    className="absolute inset-0 z-10 cursor-pointer rounded-2xl active:bg-brand-accent/5 transition-colors duration-fast ease-out-strong outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                />
                {/* Velo suave con acento de la era */}
                {!isMinimalist && (
                    <span
                        aria-hidden
                        className="absolute inset-0 pointer-events-none rounded-2xl"
                        style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${accent} 14%, transparent), transparent 60%)` }}
                    />
                )}

                {/* Marca de agua artística con Kanji de la era */}
                <span
                    aria-hidden
                    className="absolute right-14 sm:right-24 lg:right-36 top-1/2 -translate-y-1/2 font-kanji font-black text-6xl sm:text-7xl lg:text-8xl leading-none select-none pointer-events-none transition-opacity duration-base"
                    style={{
                        color: isMinimalist ? 'var(--label-1)' : accent,
                        opacity: isOpen ? 0.3 : 0.14,
                        textShadow: isMinimalist ? 'none' : `0 0 24px color-mix(in srgb, ${accent} 35%, transparent)`,
                    }}
                >
                    {kanji}
                </span>

                {/* Miniatura / Carátula de la serie */}
                <div className="relative aspect-[2/3] w-[72px] sm:w-24 lg:w-28 shrink-0 rounded-xl overflow-hidden border border-[var(--surface-content-border)] bg-[var(--neutral-elev-1)]">
                    {posterSrc ? (
                        <img
                            src={posterSrc}
                            crossOrigin={posterSrc.includes('/api/v1/image-proxy?') ? 'anonymous' : undefined}
                            alt=""
                            aria-hidden
                            loading={index < 6 ? 'eager' : 'lazy'}
                            decoding="async"
                            draggable={false}
                            className="w-full h-full object-cover object-center transition-transform duration-base ease-smooth-out motion-reduce:transition-none motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.02]"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center font-kanji font-bold text-xl text-white/20">
                            {kanji}
                        </div>
                    )}
                </div>

                {/* Contenido central de información */}
                <div className="relative flex-1 min-w-0 flex flex-col justify-center gap-1 sm:gap-1.5">
                    {/* Fila superior: Badges y metadatos */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                            className="px-2 py-0.5 rounded-full font-mono text-3xs sm:text-2xs font-bold uppercase tracking-wider border shadow-[shadow:var(--elevation-1)]"
                            style={{
                                color: isMinimalist ? 'var(--label-1)' : `color-mix(in oklab, ${accent} 85%, white)`,
                                borderColor: isMinimalist ? 'var(--neutral-separator)' : `color-mix(in srgb, ${accent} 40%, transparent)`,
                                backgroundColor: isMinimalist ? 'var(--surface-content)' : `color-mix(in srgb, ${accent} 12%, transparent)`,
                            }}
                        >
                            {volLabel}
                        </span>

                        <span className="text-label-2 font-mono text-xs font-semibold tabular-nums">
                            {item.year}
                        </span>

                        <span className="text-white/20 hidden sm:inline" aria-hidden>•</span>

                        <span className="text-label-2 text-xs font-medium tabular-nums hidden sm:inline">
                            {item.eps} {item.eps === 1 ? 'episodio' : 'episodios'}
                        </span>

                        {/* Badge de estado */}
                        {isComplete ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs sm:text-2xs font-semibold bg-brand-success/15 text-brand-success border border-brand-success/30 ml-auto sm:ml-0">
                                <IconUiCheckCircle2 className="size-3" aria-hidden />
                                <span>Completa</span>
                            </span>
                        ) : watched > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs sm:text-2xs font-semibold bg-brand-accent/15 text-brand-accent border border-brand-accent/30 ml-auto sm:ml-0">
                                <span className="size-1.5 rounded-full bg-brand-accent animate-pulse motion-reduce:animate-none" aria-hidden />
                                <span>{unwatchedCount} sin ver</span>
                            </span>
                        ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-3xs sm:text-2xs font-medium bg-white/[0.04] text-label-2 border border-white/10 ml-auto sm:ml-0">
                                Sin comenzar
                            </span>
                        )}
                    </div>

                    {/* Título de la serie y sinopsis preview en pantallas amplias */}
                    <div className="flex flex-col gap-0.5 sm:gap-1 min-w-0">
                        <h2 className="font-display text-lg sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-on-surface group-hover:text-label-1 transition-colors line-clamp-2 text-balance" title={item.title}>
                            {item.title}
                        </h2>
                        {synopsis && (
                            <p className="hidden md:line-clamp-1 text-xs lg:text-sm text-label-2 text-pretty max-w-2xl lg:max-w-4xl">
                                {synopsis}
                            </p>
                        )}
                    </div>

                    {/* Barra de progreso y contador */}
                    <div className="flex items-center gap-3 w-full pt-0.5">
                        <div className="flex-1 max-w-xs sm:max-w-md lg:max-w-lg xl:max-w-xl h-1.5 sm:h-2 bg-white/[0.08] rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full origin-left transition-transform duration-base ease-smooth-out motion-reduce:transition-none"
                                style={{
                                    transform: `scaleX(${progressPct / 100})`,
                                    background: isMinimalist ? 'var(--minimal-accent)' : `linear-gradient(90deg, ${accent}, color-mix(in srgb, ${accent} 70%, white))`,
                                }}
                            />
                        </div>
                        <span className="text-2xs sm:text-xs font-mono font-medium text-label-2 shrink-0 tabular-nums">
                            <ElasticCounter value={watched} /> de {item.eps || '?'} eps · {Math.round(progressPct)}%
                        </span>
                    </div>
                </div>

                {/* Acciones del lado derecho: Quick Play al hover + Flecha desplegable */}
                <div className="relative z-20 pointer-events-none flex items-center gap-2 sm:gap-3 shrink-0">
                    {/* Botón rápido de reproducción (visible en hover para punteros finos) */}
                    {nextEpisode !== null && (
                        <Button
                            intent="secondary"
                            size="sm"
                            type="button"
                            aria-label={`Reproducir ${item.title} episodio ${nextEpisode}`}
                            onClick={handleQuickPlay}
                            leftIcon={<IconMediaPlay className="size-3.5 sm:size-4 fill-current" aria-hidden />}
                            className="pointer-events-auto hidden [@media(hover:hover)_and_(pointer:fine)]:flex opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                        >
                            <span>{watched > 0 ? `Episodio ${nextEpisode}` : 'Reproducir'}</span>
                        </Button>
                    )}

                    {/* Icono de chevron interactivo */}
                    <span
                        aria-hidden
                        className={cn(
                            'flex items-center justify-center size-8 sm:size-9 rounded-full bg-white/[0.04] border border-white/[0.08] text-label-2 transition-[transform,background-color,color] duration-base ease-smooth-out motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-white/[0.08] [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-on-surface',
                            isOpen && 'rotate-180 bg-white/15 text-on-surface border-white/25'
                        )}
                    >
                        <IconNavigationChevronRight className="size-4 rotate-90" />
                    </span>
                </div>
            </div>

            {/* Filete cromático de la era en el borde izquierdo */}
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                <span className="absolute inset-y-0 left-0 w-1.5 z-10" style={{ background: chrome }} />
            </div>

            {/* Sección desplegable cinematográfica */}
            <div
                ref={regionRef}
                id={regionId}
                role="region"
                aria-label={item.title}
                inert={!isOpen}
                aria-hidden={!isOpen}
                className={cn(
                    'grid transition-[grid-template-rows] duration-base ease-smooth-out motion-reduce:transition-none',
                    isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                )}
            >
                <div className="min-h-0 overflow-hidden rounded-b-2xl">
                    {hasOpened && (
                        <div className="relative px-5 sm:px-8 pt-4 sm:pt-6 pb-5 sm:pb-7 flex flex-col gap-4 border-t border-white/[0.08]">
                            {/* Arte de fondo con degradados */}
                            {artSrc && (
                                <img
                                    src={artSrc}
                                    crossOrigin={artSrc.includes('/api/v1/image-proxy?') ? 'anonymous' : undefined}
                                    alt=""
                                    aria-hidden
                                    decoding="async"
                                    draggable={false}
                                    className="absolute inset-0 w-full h-full object-cover object-[center_30%] opacity-25 pointer-events-none"
                                />
                            )}
                            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-[color-mix(in_srgb,var(--bg-primary)_85%,transparent)] to-[color-mix(in_srgb,var(--bg-primary)_50%,transparent)] pointer-events-none" />
                            <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-[var(--bg-primary)]/80 via-transparent to-transparent pointer-events-none" />

                            <div className="relative z-10 flex flex-col gap-3">
                                <p className="text-sm sm:text-base leading-relaxed text-label-1 text-pretty max-w-3xl line-clamp-4">
                                    {synopsis}
                                </p>

                                <div className="flex flex-wrap items-center gap-3 pt-2">
                                    {nextEpisode !== null && (
                                        <Button
                                            intent="primary"
                                            size="md"
                                            className="flex-1 sm:flex-initial sm:min-w-[190px] shadow-elevation-2"
                                            leftIcon={<IconMediaPlay className="size-4 fill-current" aria-hidden />}
                                            onClick={() => onPlay(item.id, nextEpisode)}
                                        >
                                            {watched > 0 ? 'Continuar ep.' : 'Reproducir ep.'} {nextEpisode}
                                        </Button>
                                    )}
                                    <Button
                                        intent={nextEpisode === null ? 'primary' : 'secondary'}
                                        size="md"
                                        className={cn(nextEpisode === null && 'flex-1', 'sm:flex-initial sm:min-w-[160px]')}
                                        rightIcon={<IconArrowRight className="size-4" aria-hidden />}
                                        onClick={() => onNavigate(item.id.toString())}
                                    >
                                        Ver episodios
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </li>
    );
});
