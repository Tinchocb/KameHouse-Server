import { useMemo, useCallback, memo } from 'react';
import { m } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { API_ENDPOINTS } from '@/api/generated/endpoints';
import { fetchAnimeEntry } from '@/api/hooks/anime_entries.hooks';
import type { SeriesItem } from './-series-model';
import { getMediumResImage, getLowResImage, localImage } from '@/lib/helpers/images';
import { DeferredImage } from '@/components/shared/deferred-image';
import { IconUiCheckCircle2 } from '@/components/ui/icons';
import { getSeriesEraAccent } from '@/lib/helpers/series';
import { getSpineConfig } from '@/lib/helpers/goku-panorama';
import { useSpringPreset } from '@/components/ui/kinetics/hooks';

/** Tarjeta de póster fluida para el grid de Portadas (una por serie). */
export const SeriesPosterGridItem = memo(function SeriesPosterGridItem({
    item,
    index,
    onNavigate,
    showUnwatchedCount = true,
}: {
    item: SeriesItem;
    index: number;
    onNavigate: (id: string) => void;
    showUnwatchedCount?: boolean;
}) {
    const queryClient = useQueryClient();
    // Vía caché local del servidor (precalentada): sin viaje a TMDB por internet.
    const posterSrc = localImage(getMediumResImage(item.poster || item.img));
    const posterLowSrc = useMemo(() => localImage(getLowResImage(item.poster || item.img)) || undefined, [item.poster, item.img]);
    const isComplete = item.progress >= 100;
    // Mismo número canónico que la estantería (SeriesCard): el índice solo
    // es fallback, porque con series faltantes (p. ej. Kai) se desfasaría.
    const spineCfg = getSpineConfig(item.seriesId || '', item.id, item.title);
    const volLabel = `Vol. ${spineCfg?.vol ?? index + 1}`;
    const posterKanji = spineCfg?.kanji ?? '★';
    const watched = item.watched ?? Math.round((item.progress / 100) * item.eps);
    const unwatched = Math.max(0, item.eps - watched);
    const episodesLabel = `${item.eps} ${item.eps === 1 ? 'episodio' : 'episodios'}`;

    // Segunda línea: siempre existe, así todas las portadas alinean título y metadatos.
    const status = isComplete
        ? 'Completa'
        : item.progress <= 0
            ? 'Sin comenzar'
            : showUnwatchedCount && unwatched > 0
                ? `${unwatched} sin ver`
                : `${watched} vistos`;

    const handleOpen = useCallback(() => {
        onNavigate(item.id.toString());
    }, [item.id, onNavigate]);

    const handlePrefetch = useCallback(() => {
        const sId = item.id.toString();
        queryClient.prefetchQuery({
            queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, sId],
            queryFn: () => fetchAnimeEntry(sId),
            staleTime: 60000,
        });
    }, [queryClient, item.id]);

    const entranceSpring = useSpringPreset('entrance');
    const shouldAnimate = index < 12;

    return (
        <m.article
            initial={shouldAnimate ? { opacity: 0, y: 16 } : false}
            animate={shouldAnimate ? { opacity: 1, y: 0 } : false}
            transition={shouldAnimate ? { ...entranceSpring, delay: Math.min(index, 12) * 0.04 } : undefined}
            className="group relative select-none"
            // Las portadas fuera de la primera pantalla no se pintan hasta acercarse (colecciones largas).
            style={index >= 12 ? { contentVisibility: 'auto', containIntrinsicSize: 'auto 420px' } : undefined}
        >
            <button
                type="button"
                data-shared-poster={`series:${item.id}`}
                aria-label={`${item.title}, ${volLabel}, ${episodesLabel}, ${isComplete ? 'completa' : `${item.progress}% visto`}`}
                onClick={handleOpen}
                onMouseEnter={handlePrefetch}
                onFocus={handlePrefetch}
                // Sin desplazamiento al pasar el ratón (era un salto de 4 px): solo cambian el borde y el zoom de la imagen.
                className="relative block aspect-[2/3] w-full text-left overflow-hidden rounded-2xl border border-[var(--surface-content-border)] bg-[var(--neutral-elev-1)] cursor-pointer transition-[border-color,transform] duration-base ease-smooth-out outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background [@media(hover:hover)_and_(pointer:fine)]:hover:border-white/35 active:scale-[0.98]"
            >
                {posterSrc ? (
                    <DeferredImage
                        src={posterSrc}
                        lowResSrc={posterLowSrc}
                        alt=""
                        priority={index < 2}
                        className="h-full w-full object-cover transition-transform duration-slow ease-smooth-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.04]"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-surface-container-high to-surface-container p-4 text-center font-display text-lg text-label-2">
                        {item.title}
                    </div>
                )}
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black via-black/40 via-45% to-transparent to-75%" />

                {/* Badge sin desenfoque propio (§10.2): hay uno por póster y el vidrio se repetía en la grilla */}
                <div className="absolute top-2.5 left-2.5 rounded-full border border-white/15 border-t-white/30 bg-black/75 px-2.5 py-1 text-xs font-semibold tabular-nums text-white shadow-elevation-1">
                    {volLabel}
                </div>
                {isComplete ? (
                    <IconUiCheckCircle2 aria-hidden className="absolute top-2.5 right-2.5 h-6 w-6 text-brand-success drop-shadow-md" />
                ) : (
                    <span
                        className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full border border-white/15 border-t-white/30 bg-black/75 flex items-center justify-center text-sm font-black leading-none text-white shadow-elevation-1"
                        aria-hidden
                    >
                        {posterKanji}
                    </span>
                )}

                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 px-3.5 pb-4 pt-3">
                    <h2 className="font-display text-base sm:text-lg leading-tight text-white line-clamp-2 min-h-[2.5em] flex items-end drop-shadow-md text-balance" title={item.title}>
                        <span className="line-clamp-2 text-balance">{item.title}</span>
                    </h2>
                    <p className="text-xs font-medium tabular-nums text-white/90 truncate">
                        {item.year} · {episodesLabel}
                    </p>
                    <p className="flex items-center justify-between gap-2 text-xs font-medium tabular-nums text-white/90">
                        <span className="truncate">{status}</span>
                        {item.progress > 0 && !isComplete && <span className="shrink-0 font-semibold text-white">{item.progress}%</span>}
                    </p>
                </div>

                <div aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-white/15 overflow-hidden">
                    <div
                        className="h-full w-full origin-left transition-transform duration-base ease-smooth-out"
                        style={{
                            transform: `scaleX(${Math.min(Math.max(item.progress, 0), 100) / 100})`,
                            background: getSeriesEraAccent(item.seriesId),
                        }}
                    />
                </div>
            </button>
        </m.article>
    );
});
