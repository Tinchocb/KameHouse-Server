import { memo, useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { IconMediaPlay } from '@/components/ui/icons';
import { cn } from '@/components/ui/core/styling';
import { getSpineConfig } from '@/lib/helpers/goku-panorama';
import { getMediumResImage, getLowResImage } from '@/lib/helpers/images';
import { usePrefetchAnimeEntry } from '@/hooks/use-prefetch-anime-entry';
import { DRAGON_BALL_SERIES_INFO, getSeriesEraAccent } from '@/lib/helpers/series';
import { DRAGON_BALL_SAGAS } from '@/lib/config/dragonball_sagas';
import { usePerformanceStore, selectEffectiveTier } from '@/lib/hardware/performance-store';
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

const VHS_ERA_TOKENS = [
    'var(--era-db-hex)',
    'var(--era-dbz-hex)',
    'var(--era-dbgt-hex)',
    'var(--era-dbs-hex)',
    'var(--era-daima-hex)',
];

export const getVhsColor = (id: number) => {
    return VHS_ERA_TOKENS[id % VHS_ERA_TOKENS.length];
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
    const effectiveTier = usePerformanceStore(selectEffectiveTier);
    const handlePrefetch = usePrefetchAnimeEntry(item.id);
    const isEco = effectiveTier === 'low_power';
    const spineCfg = getSpineConfig(item.seriesId || '', item.id, item.title);
    const [isHovered, setIsHovered] = useState(false);

    const canonicalInfo = item.seriesId ? DRAGON_BALL_SERIES_INFO[item.seriesId] : undefined;
    const fallbackPoster = canonicalInfo?.poster || canonicalInfo?.banner || '/sagas/original/busqueda-esferas.webp';
    const rawPoster = item.poster || item.img || fallbackPoster;
    const posterSrc = useMemo(() =>
        getMediumResImage(rawPoster) || fallbackPoster,
        [rawPoster, fallbackPoster]);

    const [isPosterLoaded, setIsPosterLoaded] = useState(false);
    const posterImgRef = useRef<HTMLImageElement>(null);

    const handlePosterLoad = useCallback(() => {
        setIsPosterLoaded(true);
    }, []);

    useEffect(() => {
        if (posterImgRef.current?.complete && posterImgRef.current.naturalWidth > 0) {
            setIsPosterLoaded(true);
        }
    }, [posterSrc]);

    const characterSrc = spineCfg?.rawImg;
    // NOTA perf: no usar useDominantColors acá. Ya duplica la descarga del
    // character (new Image + canvas) por cada card y bloquea el paint con
    // k-means. Los colores de fondo derivan de los tokens de era (spineCfg),
    // que son la fuente canónica y no cambian por píxel.

    const unwatchedCount = showUnwatchedCount && item.eps > 0
        ? Math.max(0, item.eps - Math.round(item.eps * (item.progress / 100)))
        : null;

    // Color de era canónico
    const eraGradientFrom = spineCfg?.colors?.[0] || getSeriesEraAccent(item.seriesId, getVhsColor(item.id));
    const eraAccent = spineCfg?.accent || eraGradientFrom;

    // Fondo cinematográfico obsidiana unificador para el lomo del shelf (mural continuo).
    const bgGradient = useMemo(() => {
        return `linear-gradient(175deg, #06070a 0%, #030407 100%)`;
    }, []);

    // Capa manga colapsada: decorativa en grayscale + overlay al 35%.
    // w185 alcanza (va con blur de mezcla) y lazy para no competir con el hero.
    const collapsedBgSrc = useMemo(() =>
        getLowResImage(rawPoster) || posterSrc,
        [rawPoster, posterSrc]);

    // Prefetch de la ficha (lógica en hooks/use-prefetch-anime-entry).

    const handleActivate = useCallback(() => {
        handlePrefetch();
        if (!isSelected) {
            onSelect(item.id);
        } else {
            onNavigate(item.id.toString());
        }
    }, [isSelected, item.id, onSelect, onNavigate, handlePrefetch]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            if ((e.target as HTMLElement).tagName === 'BUTTON') return;
            e.preventDefault();
            handleActivate();
            return;
        }
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            const cards = Array.from(document.querySelectorAll<HTMLElement>('article[id^="series-card-"]'));
            const idx = cards.findIndex((el) => el.id === `series-card-${item.id}`);
            const next = e.key === 'ArrowRight' ? cards[idx + 1] : cards[idx - 1];
            if (next) { next.focus(); next.click(); }
        }
    }, [handleActivate, item.id]);

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
            onFocus={handlePrefetch}
            onClick={handleActivate}
            onKeyDown={handleKeyDown}
            className={cn(
                "h-full flex flex-col cursor-pointer overflow-hidden relative group/card border-r border-white/5 select-none shrink-0 transform-gpu"
            )}
            style={{
                flex: isSelected ? '3 0 380px' : '1 0 150px',
                transition: 'flex-grow 600ms cubic-bezier(0.16, 1, 0.3, 1), flex-basis 600ms cubic-bezier(0.16, 1, 0.3, 1)',
                animationDelay: `${entryDelayMs}ms`,
                contain: 'layout paint',
                scrollSnapAlign: 'center',
                willChange: 'flex-grow, flex-basis',
            } as React.CSSProperties}
        >
            {/* ─── VHS TAPE BODY (Cuerpo de la cinta de colección) ─── */}
            <div
                className="flex-1 min-h-0 relative overflow-hidden rounded-none transition-colors duration-500 border-x border-white/5 shadow-[0_12px_36px_-6px_rgba(0,0,0,0.75)]"
                style={{
                    background: !isSelected ? bgGradient : '#07080c',
                }}
            >
                {/* ─── ESTADO EXPANDIDO / PLACEHOLDER BASE: Capa inmediata que evita hueco negro ─── */}
                {collapsedBgSrc && (
                    <img
                        src={collapsedBgSrc}
                        alt=""
                        aria-hidden="true"
                        draggable={false}
                        decoding="async"
                        className={cn(
                            "absolute inset-0 w-full h-full object-cover transform-gpu pointer-events-none z-[1]",
                            isSelected ? "opacity-100 blur-md brightness-[0.45] scale-105" : "opacity-0"
                        )}
                        style={{
                            transition: isSelected
                                ? 'opacity 300ms ease-out'
                                : 'opacity 300ms ease-in',
                        }}
                    />
                )}

                {/* ─── ESTADO EXPANDIDO: Póster Cinematográfico nítido ─── */}
                {posterSrc && (
                    <img
                        ref={posterImgRef}
                        src={posterSrc}
                        alt={item.title}
                        loading={isSelected ? "eager" : "lazy"}
                        decoding="async"
                        fetchPriority={isSelected ? "high" : "low"}
                        onLoad={handlePosterLoad}
                        onError={handlePosterLoad}
                        className={cn(
                            "absolute inset-0 w-full h-full object-cover transform-gpu z-[2]",
                            isSelected && isPosterLoaded
                                ? "opacity-100 scale-100 brightness-[0.45] will-change-transform"
                                : "opacity-0 scale-105 pointer-events-none"
                        )}
                        style={{
                            transition: isSelected
                                ? 'opacity 400ms cubic-bezier(0.16, 1, 0.3, 1), transform 500ms cubic-bezier(0.16, 1, 0.3, 1)'
                                : 'opacity 300ms cubic-bezier(0.4, 0, 1, 1), transform 300ms cubic-bezier(0.4, 0, 1, 1)',
                        }}
                    />
                )}

                {/* ─── ESTADO COLAPSADO: Elementos de Lomo (se desvanecen suavemente al expandir) ─── */}
                <div
                    className={cn(
                        "absolute inset-0 pointer-events-none transition-opacity duration-200 z-[3]",
                        !isSelected ? "opacity-100" : "opacity-0 pointer-events-none"
                    )}
                >
                    {/* 1. Capa superior Mural: Color difuminado de la portada arriba (top → bottom) con blur etéreo */}
                    <div className="absolute top-0 inset-x-0 h-[68%] overflow-hidden pointer-events-none z-[1] transform-gpu">
                        <img
                            src={collapsedBgSrc}
                            alt=""
                            aria-hidden="true"
                            draggable={false}
                            loading="lazy"
                            decoding="async"
                            fetchPriority="low"
                            className="w-full h-full object-cover object-top scale-115 blur-xl brightness-[0.6] saturate-[1.3] opacity-80 transform-gpu"
                            style={{
                                maskImage: 'linear-gradient(to bottom, black 0%, black 35%, transparent 100%)',
                                WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 35%, transparent 100%)',
                            }}
                        />
                        {/* Degradé unificador obsidiana hacia abajo */}
                        <div
                            aria-hidden="true"
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                background: 'linear-gradient(to bottom, transparent 0%, rgba(3,4,7,0.55) 45%, #030407 100%)',
                            }}
                        />
                        {/* Velo de era sutil arriba */}
                        <div
                            aria-hidden="true"
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                background: `linear-gradient(to bottom, color-mix(in srgb, ${eraAccent} 18%, transparent) 0%, transparent 60%)`,
                            }}
                        />
                    </div>

                    {/* 2. Textura sutil manga-speed (sin blur, puro pattern overlay) */}
                    <div className="absolute inset-0 bg-manga-speed opacity-[0.06] mix-blend-overlay pointer-events-none z-[1]" />

                    {/* 3. Kanji de la Era en marca de agua flotante de fondo (profundidad z-[2]) */}
                    <div
                        className="absolute inset-0 z-[2] flex flex-col items-center justify-center pointer-events-none transition-transform duration-500"
                        style={{
                            transform: isHovered ? 'scale(1.06) translateY(-4px)' : 'scale(1) translateY(0)',
                        }}
                    >
                        <span
                            className="font-display font-black leading-none select-none blur-[1px]"
                            style={{
                                color: eraAccent,
                                fontSize: '52px',
                                opacity: isHovered ? 0.12 : 0.07,
                                transition: 'opacity 300ms ease',
                            }}
                        >
                            {spineCfg?.kanji ?? '★'}
                        </span>
                        <span
                            className="font-mono font-bold uppercase select-none mt-1"
                            style={{
                                color: eraAccent,
                                fontSize: '10px',
                                letterSpacing: '0.22em',
                                opacity: isHovered ? 0.30 : 0.18,
                            }}
                        >
                            {item.year}
                        </span>
                    </div>

                    {/* 4. Título HORIZONTAL del lomo (Sin vertical-lr, alineado con DESIGN-GUIDE.md) */}
                    <div className="absolute top-4 inset-x-0 z-[4] flex flex-col items-center px-2.5 pointer-events-none transition-opacity duration-300 opacity-90 group-hover/card:opacity-100">
                        <span className="font-display font-black text-xs uppercase tracking-wider text-center text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] line-clamp-2 select-none leading-tight">
                            {spineCfg?.subtitle || item.title}
                        </span>
                        <span className="text-3xs font-mono font-bold text-white/70 tracking-widest uppercase mt-0.5 select-none drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                            VOL. {spineCfg?.vol ?? '1'}
                        </span>
                    </div>

                    {/* 5. Personaje recortado (Goku en pose por era con sombra de oclusión negra limpia, sin resplandor) */}
                    {characterSrc && (
                        <img
                            src={characterSrc}
                            alt=""
                            aria-hidden="true"
                            draggable={false}
                            loading="lazy"
                            decoding="async"
                            fetchPriority="low"
                            className={cn(
                                "pointer-events-none absolute z-[3] select-none object-contain origin-bottom bottom-0 right-1/2 translate-x-1/2 h-[66%] transform-gpu will-change-transform",
                                "translate-y-0 opacity-95 scale-100 saturate-[1.05] group-hover/card:opacity-100 group-hover/card:scale-[1.08] group-hover/card:translate-y-[-6px] group-hover/card:saturate-[1.12]"
                            )}
                            style={{
                                filter: 'drop-shadow(0 12px 18px rgba(0,0,0,0.9))',
                                maskImage: 'linear-gradient(to bottom, black 92%, transparent 100%)',
                                WebkitMaskImage: 'linear-gradient(to bottom, black 92%, transparent 100%)',
                                transition: 'opacity 400ms cubic-bezier(0.16, 1, 0.3, 1) 50ms, transform 500ms cubic-bezier(0.16, 1, 0.3, 1), filter 400ms ease',
                            }}
                        />
                    )}

                    {/* 6. Barra de progreso colapsada en la base */}
                    {item.progress > 0 && (
                        <div className="absolute bottom-0 inset-x-0 h-[3px] bg-white/10 z-[6]">
                            <div className="h-full transition-all duration-500" style={{ width: `${item.progress}%`, background: eraAccent }} />
                        </div>
                    )}
                </div>

                {/* Resplandor ambiental de era expandido */}
                {isSelected && !isEco && (
                    <div
                        className="absolute top-0 right-0 w-64 h-64 pointer-events-none z-[4] opacity-25 blur-3xl transform-gpu"
                        style={{ background: eraAccent }}
                    />
                )}

                {/* Panel flotante expandido */}
                <div
                    className={cn(
                        "absolute inset-0 z-[5] flex flex-col justify-end p-4 md:p-5 transition-opacity duration-300 ease-out",
                        isSelected ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                    )}
                >
                    {/* Viñeta de gradiente suave */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent pointer-events-none" />

                    {/* Contenedor Glassmorphism — SectionBar canónico (tokens DESIGN-GUIDE.md §3) */}
                    <div className={cn(
                        "sectionbar relative p-4 md:p-5 space-y-2.5 transform-gpu transition-[opacity,transform] duration-slow ease-expo-out delay-100",
                        isSelected ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-6 scale-95"
                    )}>
                        {/* Badges de metadatos — MediaMetadataCapsule canónica */}
                        <div className={cn(
                            "flex flex-wrap items-center gap-1.5 transition-[opacity,transform] duration-slow ease-smooth-out",
                            isSelected ? "opacity-100 translate-y-0 delay-150" : "opacity-0 translate-y-2 delay-0"
                        )}>
                            <MediaMetadataCapsule format="SERIE" year={item.year} episodes={item.eps}>
                                {!!unwatchedCount && (
                                    <span className="badge badge-success font-mono text-3xs font-bold uppercase tracking-wider">{unwatchedCount} sin ver</span>
                                )}
                            </MediaMetadataCapsule>
                        </div>

                        {/* Título horizontal */}
                        <h3 className={cn(
                            "font-display text-xl md:text-2xl font-black text-on-surface leading-tight tracking-tight line-clamp-2 transition-[opacity,transform] duration-slow ease-smooth-out text-edge-glow text-balance",
                            isSelected ? "opacity-100 translate-y-0 delay-200" : "opacity-0 translate-y-2 delay-0"
                        )}>
                            {item.title}
                        </h3>

                        {/* Sinopsis */}
                        {isSelected && (
                            <p className="font-sans text-on-surface-variant text-xs leading-relaxed font-medium line-clamp-2 delay-250 transition-opacity duration-base [@media(max-height:640px)]:hidden">
                                {item.desc || canonicalInfo?.description}
                            </p>
                        )}

                        {/* Contexto de avance inteligente ("Vas en:...") — color = token de era */}
                        {isSelected && item.progress > 0 && item.progress < 100 && (() => {
                            const nextEp = Math.min(item.eps || 1, watchedCount + 1);
                            const saga = getSagaForEpisode(item.id, nextEp);
                            if (!saga) return null;
                            return (
                                <p className="font-mono font-bold uppercase tracking-display truncate text-3xs" style={{ color: eraAccent }}>
                                    Vas en: {saga} · EP {nextEp}
                                </p>
                            );
                        })()}

                        {/* Barra de progreso */}
                        <div className={cn(
                            "flex flex-col w-full transition-[opacity,transform] duration-slow ease-smooth-out pt-1",
                            isSelected ? "opacity-100 translate-y-0 delay-300" : "opacity-0 translate-y-2 delay-0"
                        )}>
                            <div className="flex justify-between items-end mb-1 text-2xs font-semibold">
                                <span className="font-mono text-on-surface-variant uppercase tracking-wider text-3xs">
                                    {item.progress > 0 ? `Visto: ${watchedCount} de ${item.eps}` : 'Sin comenzar'}
                                </span>
                                <span className="font-mono font-extrabold text-2xs" style={{ color: eraAccent }}>
                                    {item.progress}%
                                </span>
                            </div>
                            <div className="h-1.5 w-full bg-surface-container-high/60 rounded-full overflow-hidden border border-[var(--sectionbar-border)]">
                                <div
                                    className="h-full rounded-full transition-[width] duration-slower ease-expo-out origin-left"
                                    style={{
                                        width: isSelected ? `${item.progress}%` : '0%',
                                        background: `linear-gradient(90deg, ${eraAccent}, color-mix(in srgb, ${eraAccent} 55%, white))`,
                                    }}
                                />
                            </div>
                        </div>

                        {/* Botón CTA — pill canónico (rounded-full + active:scale-95 + shadow-brand-primary) */}
                        <div className={cn(
                            "pt-2 transition-[opacity,transform] duration-slow ease-smooth-out",
                            isSelected ? "opacity-100 translate-y-0 delay-350" : "opacity-0 translate-y-2 delay-0"
                        )}>
                            <button
                                type="button"
                                onClick={handlePlayClick}
                                className="w-full min-h-11 text-zinc-950 font-display font-black uppercase tracking-display rounded-full text-label-sm py-2.5 transition-all duration-base ease-out flex justify-center items-center gap-2 relative overflow-hidden group/btn hover:brightness-110 active:scale-95 cursor-pointer"
                                style={{
                                    background: eraAccent,
                                    boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.45)',
                                }}
                            >
                                <div className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-slower ease-out bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none" />
                                <IconMediaPlay className="w-3.5 h-3.5 fill-current drop-shadow-sm" />
                                {item.progress <= 0
                                    ? 'Ver serie'
                                    : item.progress >= 100
                                        ? 'Ver de nuevo'
                                        : `Continuar · EP ${Math.min(item.eps, watchedCount + 1)}`}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </article>
    );
});