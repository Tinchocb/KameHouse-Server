import { memo, useMemo, useCallback, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { IconMediaPlay } from "@/components/ui/icons";
import { cn } from '@/components/ui/core/styling';
import { getSpineConfig } from '@/lib/helpers/goku-panorama';
import { getMediumResImage } from '@/lib/helpers/images';
import { useQueryClient } from '@tanstack/react-query';
import { API_ENDPOINTS } from '@/api/generated/endpoints';
import { fetchAnimeEntry } from '@/api/hooks/anime_entries.hooks';
import { DRAGON_BALL_SERIES_INFO, getSeriesEraAccent } from '@/lib/helpers/series';
import { DRAGON_BALL_SAGAS } from '@/lib/config/dragonball_sagas';
import { usePerformanceStore, selectIsHeavyEffectsAllowed } from '@/lib/hardware/performance-store';
import { MediaMetadataCapsule } from '@/components/ui/media-metadata-capsule';

/** Saga que contiene el episodio dado (para "Vas en…"). */
function getSagaForEpisode(mediaId: number, ep: number): string | null {
    if (ep < 1) return null;
    const raw = mediaId >= 1000000 ? mediaId - 1000000 : mediaId;
    const sagas = DRAGON_BALL_SAGAS[raw];
    if (!sagas) return null;
    return sagas.find(s => ep >= s.startEp && ep <= s.endEp)?.title ?? null;
}

export interface SeriesItem {
    id: number;
    title: string;
    eps: number;
    year: string | number;
    progress: number;
    img: string;
    poster: string;
    desc: string;
    seriesId?: string;
}

export const getVhsColor = (id: number) => {
    const colors = ['#d96c14', '#b51f1f', '#2980b9', '#1a5c2e', '#1a4a8a', '#8e44ad', '#0e6655'];
    return colors[id % colors.length];
};

export const SeriesCard = memo(function SeriesCard({
    item,
    isSelected,
    showUnwatchedCount = true,
    onNavigate,
    onSelect,
    entryDelayMs = 0,
}: {
    item: SeriesItem;
    isSelected: boolean;
    showUnwatchedCount?: boolean;
    onNavigate: (id: string) => void;
    onSelect: (id: number) => void;
    entryDelayMs?: number;
}) {
    const queryClient = useQueryClient();
    const reduceMotion = useReducedMotion();
    const isHeavyAllowed = usePerformanceStore(selectIsHeavyEffectsAllowed);
    const allowFx = isHeavyAllowed && !reduceMotion;
    const spineCfg = getSpineConfig(item.seriesId || '', item.id, item.title);
    const [isHovered, setIsHovered] = useState(false);

    const canonicalInfo = item.seriesId ? DRAGON_BALL_SERIES_INFO[item.seriesId] : undefined;
    const fallbackPoster = canonicalInfo?.poster || canonicalInfo?.banner || '/sagas/original/busqueda-esferas.webp';
    const rawPoster = item.poster || item.img || fallbackPoster;
    const posterSrc = useMemo(() =>
        getMediumResImage(rawPoster) || fallbackPoster,
        [rawPoster, fallbackPoster]);

    const unwatchedCount = showUnwatchedCount && item.eps > 0
        ? Math.max(0, item.eps - Math.round(item.eps * (item.progress / 100)))
        : null;

    // Color de era tokenizado (--spotlight-*-vivid); el spine ya lo trae,
    // el fallback VHS solo queda para series sin era canónica.
    const eraGradientFrom = spineCfg?.colors?.[0] || getSeriesEraAccent(item.seriesId, getVhsColor(item.id));
    const eraAccent = spineCfg?.accent || eraGradientFrom;

    // Fondo del cuerpo VHS colapsado: gradiente de era sobre token de superficie.
    const bgGradient = spineCfg?.bg || `linear-gradient(to bottom, color-mix(in srgb, ${eraGradientFrom} 30%, transparent), var(--bg-primary))`;

    const handlePrefetch = useCallback(() => {
        const sId = item.id.toString();
        queryClient.prefetchQuery({
            queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, sId],
            queryFn: () => fetchAnimeEntry(sId),
            staleTime: 60000,
        });
    }, [queryClient, item.id]);

    const handleActivate = useCallback(() => {
        if (!isSelected) {
            onSelect(item.id);
        }
    }, [isSelected, item.id, onSelect]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            if ((e.target as HTMLElement).tagName === 'BUTTON') return;
            e.preventDefault();
            if (!isSelected) {
                onSelect(item.id);
            } else {
                handlePrefetch();
                onNavigate(item.id.toString());
            }
            return;
        }
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            const cards = Array.from(document.querySelectorAll<HTMLElement>('article[id^="series-card-"]'));
            const idx = cards.findIndex((el) => el.id === `series-card-${item.id}`);
            const next = e.key === 'ArrowRight' ? cards[idx + 1] : cards[idx - 1];
            if (next) { next.focus(); next.click(); }
        }
    }, [handleActivate, handlePrefetch, isSelected, item.id, onNavigate, onSelect]);

    const handleMouseEnter = useCallback(() => {
        if (typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches) {
            setIsHovered(true);
            handlePrefetch();
        }
    }, [handlePrefetch]);

    const handleMouseLeave = useCallback(() => setIsHovered(false), []);

    const handlePlayClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        handlePrefetch();
        onNavigate(item.id.toString());
    }, [onNavigate, item.id, handlePrefetch]);

    const watchedCount = Math.round((item.progress / 100) * (item.eps || 0));

    return (
        <article
            id={`series-card-${item.id}`}
            role="option"
            tabIndex={0}
            aria-selected={isSelected}
            title={item.title}
            aria-label={`${item.title}, Año ${item.year}, ${item.eps} episodios, ${item.progress}% visto`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleActivate}
            onKeyDown={handleKeyDown}
            className={cn(
                "h-full flex flex-col cursor-pointer overflow-visible relative group/card border-r border-white/10 select-none shrink-0",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
            )}
            style={{
                flex: isSelected ? '3 0 380px' : '1 0 150px',
                transition: 'flex 750ms cubic-bezier(0.2, 1, 0.2, 1)',
                animationDelay: `${entryDelayMs}ms`,
                contain: 'layout',
                scrollSnapAlign: 'center',
            } as React.CSSProperties}
        >
            {/* ─── Indicador activo: glow de era que se desliza (paridad pills) ─── */}
            {isSelected && (
                allowFx ? (
                    <motion.div
                        layoutId="activeSeriesShelfIndicator"
                        className="absolute top-0 inset-x-0 h-[3px] z-30 pointer-events-none"
                        style={{
                            background: eraAccent,
                            boxShadow: `0 0 12px ${eraAccent}, 0 1px 6px color-mix(in srgb, ${eraAccent} 60%, transparent)`,
                        }}
                        transition={{ type: 'spring', stiffness: 480, damping: 34 }}
                    />
                ) : (
                    <div
                        className="absolute top-0 inset-x-0 h-[3px] z-30 pointer-events-none"
                        style={{ background: eraAccent }}
                    />
                )
            )}
            {/* ─── VHS TAPE BODY (poster + info, flush como lomo real) ─── */}
            {/* transition-colors (no transition-all): transition-all invalida el
                backdrop-filter de la cápsula en cada frame y el blur "llega tarde". */}
            <div
                className="flex-1 min-h-0 relative overflow-hidden transition-colors duration-700"
                style={{
                    background: !isSelected ? bgGradient : 'var(--bg-primary)',
                }}
            >
                {/* Background poster visible solo al expandir — sin blur */}
                {posterSrc && (
                    <img
                        src={posterSrc}
                        alt={item.title}
                        loading={isSelected ? 'eager' : 'lazy'}
                        decoding="async"
                        className={cn(
                            'absolute inset-0 w-full h-full object-cover',
                            isSelected
                                ? 'opacity-100 scale-100 brightness-50'
                                : 'opacity-0 scale-110 pointer-events-none'
                        )}
                        style={{
                            transition: 'opacity 500ms cubic-bezier(0.16,1,0.3,1), transform 900ms cubic-bezier(0.16,1,0.3,1)',
                        }}
                        onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                    />
                )}

                {/* Panel de info expandido (sobre el poster oscurecido) */}
                <div
                    className={cn(
                        'absolute inset-0 z-[5] flex flex-col justify-end p-5 transition-opacity [transition-duration:600ms] ease-out',
                        isSelected ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                    )}
                >
                    {/* Cápsula metadata (paridad Home/Movies) — FUERA del bloque con
                        slide de abajo: cualquier transform animado en un ancestro
                        obliga a Chromium a re-rasterizar el backdrop-filter en cada
                        frame y el blur "llega tarde" (plano y luego salta). Por encima
                        solo quedan fades de opacity (panel + este), así el blur pinta
                        en el primer frame. Capa GPU con translateZ(0) inline. */}
                    <div className={cn(
                        'flex items-center gap-2 mb-2 transition-opacity [transition-duration:300ms] ease-out',
                        isSelected ? 'opacity-100 delay-[50ms]' : 'opacity-0 delay-0'
                    )}
                    style={{ transform: 'translateZ(0)' }}
                    >
                        <MediaMetadataCapsule format="SERIE" year={item.year} episodes={item.eps}>
                            {!!unwatchedCount && (
                                <span className="badge badge-success">{unwatchedCount} sin ver</span>
                            )}
                        </MediaMetadataCapsule>
                    </div>
                    <div className={cn(
                        'transition-[opacity,transform] [transition-duration:600ms] ease-out delay-150 will-change-transform',
                        isSelected ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                    )}>
                        {/* Título */}
                        <h3 className={cn(
                            'text-lg md:text-xl font-black text-white mb-2 leading-tight tracking-tight line-clamp-2 transition-all [transition-duration:600ms] ease-out',
                            isSelected ? 'opacity-100 translate-y-0 [transition-delay:220ms]' : 'opacity-0 translate-y-3 delay-0'
                        )}>
                            {item.title}
                        </h3>

                        {/* Descripción */}
                        {isSelected && (
                            <p className="text-on-surface-variant/70 text-xs leading-relaxed mb-3 font-medium line-clamp-2 [transition-delay:300ms] transition-all [transition-duration:600ms]">
                                {item.desc || canonicalInfo?.description}
                            </p>
                        )}

                        {/* Saga actual según tu progreso */}
                        {isSelected && item.progress > 0 && item.progress < 100 && (() => {
                            const nextEp = Math.min(item.eps || 1, watchedCount + 1);
                            const saga = getSagaForEpisode(item.id, nextEp);
                            if (!saga) return null;
                            return (
                                <p className="font-mono font-bold uppercase tracking-widest truncate" style={{ color: eraAccent, fontSize: '10px' }}>
                                    Vas en: {saga} · EP {nextEp}
                                </p>
                            );
                        })()}

                        {/* Barra de progreso */}
                        <div className={cn(
                            'flex flex-col w-full transition-all [transition-duration:600ms] ease-out',
                            isSelected ? 'opacity-100 translate-y-0 [transition-delay:380ms]' : 'opacity-0 translate-y-3 delay-0'
                        )}>
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-badge text-on-surface-variant/60">
                                    {item.progress > 0 ? `Visto: ${watchedCount} de ${item.eps}` : 'Sin comenzar'}
                                </span>
                                <span className="text-badge font-bold" style={{ color: eraAccent }}>{item.progress}%</span>
                            </div>
                            <div className="h-1 w-full bg-surface-variant rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-1000 ease-out origin-left"
                                    style={{
                                        width: isSelected ? `${item.progress}%` : '0%',
                                        background: `linear-gradient(90deg, ${eraAccent}, color-mix(in srgb, ${eraAccent} 55%, white))`,
                                        boxShadow: `0 0 8px color-mix(in srgb, ${eraAccent} 50%, transparent)`,
                                    }}
                                />
                            </div>
                        </div>

                        {/* Botón reproducir */}
                        <div className={cn(
                            'mt-3 transition-all [transition-duration:600ms] ease-out',
                            isSelected ? 'opacity-100 translate-y-0 [transition-delay:460ms]' : 'opacity-0 translate-y-3 delay-0'
                        )}>
                            <button
                                type="button"
                                onClick={handlePlayClick}
                                className="w-full hover:brightness-110 active:scale-[0.98] text-zinc-950 rounded-full text-button-sm py-2.5 transition-all duration-300 flex justify-center items-center gap-2 relative overflow-hidden group/btn cursor-pointer font-black uppercase tracking-widest text-xs"
                                style={{
                                    background: eraAccent,
                                    boxShadow: `0 6px 16px color-mix(in srgb, ${eraAccent} 45%, transparent), inset 0 1px 1px rgba(255,255,255,0.45)`,
                                }}
                            >
                                <div className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000 ease-out bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
                                <IconMediaPlay className="w-3.5 h-3.5 fill-current" />
                                {item.progress <= 0
                                    ? 'Ver serie'
                                    : item.progress >= 100
                                        ? 'Ver de nuevo'
                                        : `Continuar · EP ${Math.min(item.eps, watchedCount + 1)}`}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Glow de era visible en hover cuando está colapsado */}
                <div
                    className={cn(
                        'absolute inset-0 pointer-events-none transition-opacity duration-500',
                        !isSelected && isHovered ? 'opacity-100' : 'opacity-0'
                    )}
                    style={{
                        background: `radial-gradient(ellipse at 50% 100%, ${eraGradientFrom}30 0%, transparent 70%)`,
                    }}
                />
                {/* Marca de era cuando está colapsado (el zócalo se eliminó) */}
                <div
                    className={cn(
                        'absolute inset-0 z-[4] flex flex-col items-center justify-center gap-1.5 pointer-events-none transition-opacity duration-500',
                        isSelected ? 'opacity-0' : 'opacity-100'
                    )}
                >
                    <span
                        className="font-black leading-none select-none"
                        style={{
                            color: eraGradientFrom,
                            fontSize: '44px',
                            opacity: isHovered ? 0.9 : 0.45,
                            textShadow: `0 0 24px color-mix(in srgb, ${eraGradientFrom} 60%, transparent)`,
                            transition: 'opacity 300ms ease',
                        }}
                    >
                        {spineCfg?.kanji ?? '★'}
                    </span>
                    <span
                        className="font-mono font-bold uppercase select-none"
                        style={{ color: eraGradientFrom, fontSize: '10px', letterSpacing: '0.22em', opacity: 0.7 }}
                    >
                        {item.year}
                    </span>
                </div>
                {!isSelected && item.progress > 0 && (
                    <div className="absolute bottom-0 inset-x-0 h-[3px] bg-white/10 z-[6]">
                        <div className="h-full" style={{ width: `${item.progress}%`, background: eraGradientFrom }} />
                    </div>
                )}
            </div>
        </article>
    );
});