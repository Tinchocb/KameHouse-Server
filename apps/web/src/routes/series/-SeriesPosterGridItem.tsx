import { useMemo, useCallback, memo } from 'react';
import { m } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { API_ENDPOINTS } from '@/api/generated/endpoints';
import { fetchAnimeEntry } from '@/api/hooks/anime_entries.hooks';
import { type SeriesItem } from './-SeriesCard';
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
}: {
    item: SeriesItem;
    index: number;
    onNavigate: (id: string) => void;
}) {
    const queryClient = useQueryClient();
    // Vía caché local del servidor (precalentada): sin viaje a TMDB por internet.
    const posterSrc = localImage(getMediumResImage(item.poster || item.img));
    const posterLowSrc = useMemo(() => localImage(getLowResImage(item.poster || item.img)) || undefined, [item.poster, item.img]);
    const isComplete = item.progress >= 100;
    // Mismo número canónico que la estantería (SeriesCard): el índice solo
    // es fallback, porque con series faltantes (p. ej. Kai) se desfasaría.
    const spineCfg = getSpineConfig(item.seriesId || '', item.id, item.title);
    const volLabel = `VOL. ${spineCfg?.vol ?? index + 1}`;
    const posterKanji = spineCfg?.kanji ?? '★';

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
        >
            <button
                type="button"
                aria-label={`${item.title} — ${item.progress}% completado`}
                onClick={handleOpen}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpen(); }
                }}
                onMouseEnter={handlePrefetch}
                onFocus={handlePrefetch}
                className="relative block aspect-[2/3] w-full text-left overflow-hidden rounded-2xl border border-white/15 border-t-white/35 border-b-white/10 bg-surface-container/20 shadow-elevation-2 cursor-pointer transition-[transform,border-color,box-shadow] duration-base ease-smooth-out hover:-translate-y-1 active:scale-95"
            >
                {posterSrc ? (
                    <DeferredImage
                        src={posterSrc}
                        lowResSrc={posterLowSrc}
                        alt={item.title}
                        priority={index < 2}
                        className="h-full w-full object-cover transition-transform duration-base ease-smooth-out group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-surface-container-high to-surface-container p-4 text-center font-display text-lg uppercase tracking-wide text-on-surface-variant">
                        {item.title}
                    </div>
                )}
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent opacity-80 transition-opacity duration-base group-hover:opacity-90" />
                <div aria-hidden className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-none group-hover:transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/15 to-transparent z-10 pointer-events-none" />

                <div className="absolute top-2.5 left-2.5 rounded-full border border-white/15 bg-black/75 px-2.5 py-1 font-mono text-3xs font-bold uppercase tracking-widest text-white shadow-sm">
                    {volLabel}
                </div>
                {isComplete ? (
                    <IconUiCheckCircle2 className="absolute top-2.5 right-2.5 h-5 w-5 text-brand-success drop-shadow-md" />
                ) : (
                    <span
                        className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full border border-white/20 bg-black/75 flex items-center justify-center text-[13px] font-black leading-none text-white/90 shadow-sm"
                        aria-hidden
                    >
                        {posterKanji}
                    </span>
                )}

                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-3.5">
                    <h3 className="font-display text-lg leading-tight tracking-wide text-white line-clamp-2 drop-shadow-md">
                        {item.title}
                    </h3>
                    <p className="font-mono text-3xs font-bold uppercase tracking-widest text-white/70">
                        {item.year} • {item.eps} EPS • {item.progress}%
                    </p>
                </div>

                <div className="absolute inset-x-0 bottom-0 h-1 bg-white/15 overflow-hidden">
                    <div
                        className="h-full w-full rounded-full origin-left transition-transform duration-300 ease-out"
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
