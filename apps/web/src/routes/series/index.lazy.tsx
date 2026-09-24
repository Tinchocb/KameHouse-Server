import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useMemo, useEffect, useCallback, useRef, memo } from 'react';
import { m, LayoutGroup, useReducedMotion } from 'framer-motion';
import { useGetLibraryCollection } from '@/api/hooks/anime_collection.hooks';
import { useQueryClient } from '@tanstack/react-query';
import { API_ENDPOINTS } from '@/api/generated/endpoints';
import { fetchAnimeEntry } from '@/api/hooks/anime_entries.hooks';
import { SeriesCard, getVhsColor, type SeriesItem } from './-SeriesCard';
import { getMediumResImage, getLowResImage, prewarmImages } from '@/lib/helpers/images';
import { DeferredImage } from '@/components/shared/deferred-image';
import { IconUiCheckCircle2, IconNavigationLayers } from "@/components/ui/icons";
import { getSeriesIdFromMedia, getSeriesYear, getSeriesEraAccent, DRAGON_BALL_SERIES_ORDER, DRAGON_BALL_SERIES_INFO, DAIMA_VERTICAL_POSTER } from '@/lib/helpers/series';
import { getSpineConfig } from '@/lib/helpers/goku-panorama';
import { getSafeCollectionEntries } from '@/lib/helpers/collection';
import { Skeleton } from '@/components/ui/skeleton/skeleton';
import { SectionBar } from '@/components/ui/sectionbar/sectionbar';
import { PosterGridSkeleton } from '@/components/ui/shimmer-skeleton';
import { useSpringPreset } from '@/components/ui/kinetics/hooks';
import { EmptyState } from '@/components/shared/empty-state';
import { useResponsive } from '@/hooks/use-responsive';
import { useSound } from '@/hooks/use-sound';
import { startViewTransition } from '@/lib/helpers/transitions';
import { useThemeSettings } from '@/lib/theme/theme-hooks';
import { useUIStore } from '@/lib/store';
import { cn } from '@/components/ui/core/styling';
import { usePerformanceStore, selectIsHeavyEffectsAllowed, selectEffectiveTier } from '@/lib/hardware/performance-store';
import { HERO_AURA_CLASS, HERO_STAGE_CLASS } from '@/lib/config/hero-stage';

export type SeriesViewMode = 'shelf' | 'etapas';

interface SeriesTabItem {
    id: SeriesViewMode;
    label: string;
}

const SERIES_TABS: SeriesTabItem[] = [
    { id: 'shelf', label: 'Estantería' },
    { id: 'etapas', label: 'Portadas' },
];

/** Delay de stagger por card, en ms. */
const ENTRY_STAGGER_MS = 45;
const ENTRY_STAGGER_MAX_ITEMS = 16;

/** Transform compartido por los dos halos de fondo (exterior + interior del shelf). */
function getGlowTransform(selectedIndex: number, total: number, offsetPx: number) {
    const pct = (selectedIndex / Math.max(total - 1, 1)) * 80 + 10;
    return `translate3d(calc(${pct}% - ${offsetPx}px), -50%, 0)`;
}

function ViewModeTabs({
    mode,
    onChange,
}: {
    mode: SeriesViewMode;
    onChange: (next: SeriesViewMode) => void;
}) {
    const reduceMotion = useReducedMotion();
    const isHeavyAllowed = usePerformanceStore(selectIsHeavyEffectsAllowed);
    const allowEraFx = isHeavyAllowed && !reduceMotion;
    return (
        <div
            role="tablist"
            aria-label="Modo de visualización de series"
            className="relative z-20 w-full flex items-center justify-between gap-2 bg-surface-container-lowest/60 backdrop-blur-overlay-2xl backdrop-saturate-[190%] border border-white/20 border-t-white/40 border-b-white/10 rounded-full p-1.5 sm:p-2 shadow-[shadow:var(--glass-highlight-lg),0_12px_36px_-6px_rgba(0,0,0,0.85)] overflow-hidden"
        >
            <LayoutGroup id="series-view-tabs">
            <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full flex-1">
                {SERIES_TABS.map(({ id, label }) => {
                    const isActive = id === mode;
                    return (
                        <button
                            key={id}
                            role="tab"
                            aria-selected={isActive}
                            onClick={() => onChange(id)}
                            className={cn(
                                'relative flex flex-1 items-center justify-center px-2.5 sm:px-3 py-1.5 min-h-[44px] rounded-full text-center shrink-0 cursor-pointer select-none overflow-hidden transition-[background-color,color] duration-150',
                                isActive
                                    ? 'text-black font-bold'
                                    : 'text-on-surface-variant hover:text-on-surface hover:bg-white/10',
                            )}
                        >
                            {isActive && (
                                allowEraFx ? (
                                    <m.div
                                        layoutId="activeSeriesTopPill"
                                        className="absolute inset-0 rounded-full pointer-events-none z-0 bg-white/95"
                                        transition={{ type: 'tween', duration: 0.2, ease: 'easeOut' }}
                                    />
                                ) : (
                                    <div className="absolute inset-0 rounded-full pointer-events-none z-0 bg-white/95" />
                                )
                            )}
                            <span className="relative z-10 font-sans font-extrabold text-2xs sm:text-xs tracking-wider uppercase leading-tight whitespace-nowrap">
                                {label}
                            </span>
                        </button>
                    );
                })}
            </div>
            </LayoutGroup>
        </div>
    );
}

const AmbientAura = memo(function AmbientAura({
    src,
    allowGlowFx,
}: {
    src: string | null;
    allowGlowFx: boolean;
}) {
    const [prevPropSrc, setPrevPropSrc] = useState(src);
    const [activeSrc, setActiveSrc] = useState<string | null>(src);
    const [incomingSrc, setIncomingSrc] = useState<string | null>(null);
    const [isIncomingLoaded, setIsIncomingLoaded] = useState(false);

    // Ajuste de estado durante el render (patrón documentado de React para
    // derivar estado del prop anterior): arranca el crossfade sin efecto extra.
    if (src !== prevPropSrc) {
        setPrevPropSrc(src);
        if (!src) {
            setActiveSrc(null);
            setIncomingSrc(null);
            setIsIncomingLoaded(false);
        } else if (!activeSrc) {
            setActiveSrc(src);
            setIncomingSrc(null);
            setIsIncomingLoaded(false);
        } else if (src !== activeSrc) {
            setIncomingSrc(src);
            setIsIncomingLoaded(false);
        }
    }

    const handleIncomingLoad = useCallback(() => {
        setIsIncomingLoaded(true);
        const timer = setTimeout(() => {
            setActiveSrc(incomingSrc);
            setIncomingSrc(null);
            setIsIncomingLoaded(false);
        }, 500);
        return () => clearTimeout(timer);
    }, [incomingSrc]);

    const targetOpacity = allowGlowFx ? 0.28 : 0.18;

    return (
        <div
            className="absolute inset-0 pointer-events-none overflow-hidden transform-gpu will-change-[opacity]"
            style={{
                filter: "blur(48px) saturate(140%)",
                maskImage: "radial-gradient(ellipse 90% 80% at 70% 40%, black 0%, transparent 75%)",
                WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 70% 40%, black 0%, transparent 75%)",
            }}
        >
            {activeSrc && (
                <img
                    src={activeSrc}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover object-[center_20%] pointer-events-none transition-opacity duration-500 ease-out"
                    style={{
                        opacity: incomingSrc && isIncomingLoaded ? 0 : targetOpacity,
                    }}
                />
            )}
            {incomingSrc && (
                <img
                    src={incomingSrc}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    decoding="async"
                    loading="lazy"
                    onLoad={handleIncomingLoad}
                    onError={handleIncomingLoad}
                    className="absolute inset-0 w-full h-full object-cover object-[center_20%] pointer-events-none transition-opacity duration-500 ease-out"
                    style={{
                        opacity: isIncomingLoaded ? targetOpacity : 0,
                    }}
                />
            )}
        </div>
    );
});

export const Route = createLazyFileRoute('/series/')({
    component: SeriesFullscreenIndex,
});

/** Tarjeta de póster fluida para el grid de Portadas (una por serie). */
const SeriesPosterGridItem = memo(function SeriesPosterGridItem({
    item,
    index,
    onNavigate,
}: {
    item: SeriesItem;
    index: number;
    onNavigate: (id: string) => void;
}) {
    const queryClient = useQueryClient();
    const posterSrc = getMediumResImage(item.poster || item.img);
    const posterLowSrc = useMemo(() => getLowResImage(item.poster || item.img) || undefined, [item.poster, item.img]);
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
    const shouldAnimate = index < 8;

    return (
        <m.article
            initial={shouldAnimate ? { opacity: 0, y: 16 } : false}
            animate={shouldAnimate ? { opacity: 1, y: 0 } : false}
            transition={shouldAnimate ? { ...entranceSpring, delay: index * 0.04 } : undefined}
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
                <div aria-hidden className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/15 to-transparent z-10 pointer-events-none" />

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

                <div className="absolute inset-x-0 bottom-0 h-1 bg-white/15">
                    <div
                        className="h-full rounded-full"
                        style={{
                            width: `${item.progress}%`,
                            background: getSeriesEraAccent(item.seriesId),
                        }}
                    />
                </div>
            </button>
        </m.article>
    );
});

function SeriesFullscreenIndex() {
    const navigate = useNavigate();
    const { view: viewParam } = Route.useSearch();
    const view: SeriesViewMode = viewParam ?? 'shelf';
    const { playSound } = useSound();
    const ts = useThemeSettings();
    const reduceMotion = useReducedMotion();
    const isHeavyAllowed = usePerformanceStore(selectIsHeavyEffectsAllowed);
    const effectiveTier = usePerformanceStore(selectEffectiveTier);
    // Glows caros (blur 80-100px + animaciones 8s) solo con GPU capaz y sin reduced-m.
    const allowGlowFx = isHeavyAllowed && !reduceMotion;
    // En eco (low_power) se apagan incluso los blurs estáticos de los glows.
    const isEco = effectiveTier === 'low_power';
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const shelfRef = useRef<HTMLDivElement>(null);
    // Tablet (768-1023) usa el grid de posters en vez del shelf horizontal
    const { isMobile: isPhone, isTablet } = useResponsive();
    const isMobile = isPhone || isTablet;

    const { data: collection, isLoading } = useGetLibraryCollection();

    const handleNavigate = useCallback((id: string) => {
        navigate({ to: '/series/$seriesId', params: { seriesId: id } });
    }, [navigate]);

    const handleViewChange = useCallback((nextView: SeriesViewMode) => {
        playSound('category', 0.1);
        startViewTransition(() => {
            navigate({ to: '/series', search: { view: nextView === 'shelf' ? undefined : nextView }, replace: true });
        });
    }, [navigate, playSound]);

    const seriesList = useMemo(() => {
        if (!collection?.lists) return [];
        const raw = getSafeCollectionEntries(collection)
            .filter(entry => {
                if (!entry) return false;
                const media = entry?.media;
                const format = media?.format?.toUpperCase();
                const type = media?.type?.toUpperCase();
                if (format === 'MOVIE' || format === 'OVA' || format === 'SPECIAL') return false;
                if (type === 'MOVIE') return false;

                const allTitles = [
                    media?.titleSpanish,
                    media?.titleEnglish,
                    media?.titleRomaji,
                    media?.titleOriginal,
                ].filter(Boolean).join(' ').toLowerCase();

                const totalEps = media?.totalEpisodes || entry.libraryData?.mainFileCount || 0;
                if (totalEps <= 1 && (
                    allTitles.includes('movie') ||
                    allTitles.includes('pelicula') ||
                    allTitles.includes('película') ||
                    allTitles.includes('film')
                )) return false;

                return true;
            });

        const unique = new Map<number, NonNullable<typeof raw[0]>>();
        raw.forEach(s => { if (s.mediaId) unique.set(s.mediaId, s); });
        const filtered = Array.from(unique.values());

        const mapped = filtered.filter(s => s != null).map((s) => {
            const media = s?.media;
            const title = media?.titleSpanish || media?.titleEnglish || media?.titleRomaji || media?.titleOriginal || 'Sin título';
            const seriesId = getSeriesIdFromMedia(media, title);
            const canonicalInfo = seriesId ? DRAGON_BALL_SERIES_INFO[seriesId] : undefined;

            const rawTotalEps = media?.totalEpisodes || s.libraryData?.mainFileCount || 0;
            const totalEps = rawTotalEps > 0 ? rawTotalEps : (canonicalInfo?.episodes || 0);

            const watchedFromLibrary = s.libraryData
                ? Math.max(0, (s.libraryData.mainFileCount || 0) - (s.libraryData.unwatchedCount || 0))
                : 0;
            const watched = s.listData?.progress || watchedFromLibrary;
            const progressPercent = totalEps > 0 ? Math.min(100, Math.round((watched / totalEps) * 100)) : 0;
            const yearVal = getSeriesYear(title, media?.year, media?.startDate, seriesId);

            const rawDesc = media?.description?.replace(/<[^>]*>?/gm, '').trim();
            const desc = canonicalInfo?.description || ((rawDesc && rawDesc.toLowerCase() !== 'sin descripción') ? rawDesc : 'Sin sinopsis disponible.');

            const posterImg = seriesId === 'dragon_ball_daima'
                ? DAIMA_VERTICAL_POSTER
                : (media?.posterImage || media?.bannerImage || canonicalInfo?.poster || '');
            const bannerImg = media?.bannerImage || media?.posterImage || canonicalInfo?.banner || '';

            return {
                id: s.mediaId as number,
                title: canonicalInfo?.title || title,
                eps: totalEps,
                year: yearVal,
                yearNum: yearVal === 'N/A' ? 9999 : Number(yearVal),
                progress: progressPercent,
                img: getMediumResImage(bannerImg),
                poster: getMediumResImage(posterImg),
                desc,
                seriesId,
                orderNum: DRAGON_BALL_SERIES_ORDER[seriesId] ?? 999,
            };
        });

        const sorted = [...mapped];
        sorted.sort((a, b) => {
            if (a.orderNum !== b.orderNum) return a.orderNum - b.orderNum;
            if (a.yearNum !== b.yearNum) return a.yearNum - b.yearNum;
            return a.title.localeCompare(b.title);
        });
        return sorted;
    }, [collection]);

    // Pre-cargar portadas + banners visibles iniciales una sola vez por montaje.
    // El hero expandido y el aura usan el banner (item.img); sin esto el primer
    // paint del aura siempre falla la caché aunque el póster ya esté cargado.
    const preloadedRef = useRef(false);
    useEffect(() => {
        if (preloadedRef.current || !seriesList.length) return;
        preloadedRef.current = true;
        prewarmImages(seriesList.slice(0, 4).flatMap(item => [
            item.poster,
            getLowResImage(item.poster),
            item.img,
            getLowResImage(item.img),
        ]));
    }, [seriesList]);

    // Selección efectiva: cae al primer item si no hay selección explícita
    const displayedList = seriesList;

    const effectiveSelectedId = displayedList.some(s => s.id === selectedId)
        ? selectedId
        : displayedList[0]?.id ?? null;

    const selectedIndex = useMemo(() => {
        return displayedList.findIndex(item => item.id === effectiveSelectedId);
    }, [displayedList, effectiveSelectedId]);
    const selectedItem = displayedList[selectedIndex] ?? null;
    const selectedAccent = getSeriesEraAccent(selectedItem?.seriesId, selectedItem ? getVhsColor(selectedItem.id) : undefined);

    // Aura ambiental sin flash: arte difuminado ultra-liviano (w185) con crossfade nativo
    const rawAuraSrc = selectedItem?.img || selectedItem?.poster || null;
    const lowAuraSrc = useMemo(() => rawAuraSrc ? getLowResImage(rawAuraSrc) : null, [rawAuraSrc]);

    // Precarga predictiva en idle: serie seleccionada y vecinos contiguos (±1).
    // Cubre tanto item.poster (card expandida) como item.img (aura ambiental) y sus variantes low.
    useEffect(() => {
        if (selectedIndex < 0 || !displayedList.length) return;
        const targets: string[] = [];
        const indices = [selectedIndex, selectedIndex - 1, selectedIndex + 1];
        indices.forEach((idx) => {
            const it = displayedList[idx];
            if (!it) return;
            if (it.poster) targets.push(it.poster, getLowResImage(it.poster));
            if (it.img) targets.push(it.img, getLowResImage(it.img));
        });
        prewarmImages(targets);
    }, [selectedIndex, displayedList]);

    const handleSelectSeries = useCallback((id: number) => {
        if (id !== effectiveSelectedId) playSound('series', 0.1);
        setSelectedId(id);
    }, [effectiveSelectedId, playSound]);

    // NOTA perf: sin useHeroBackdrop en el listado. DynamicBackdrop omite su
    // capa de imagen cuando el hero local ya pinta la misma arte
    // (hasLocalHeroAura), así que sincronizar el backdrop solo descargaba un
    // w1280 que nunca se pinta. El aura local (w185 + blur) es la única capa.

    const setActiveSeriesContext = useUIStore(s => s.setActiveSeriesContext);
    const listingContextWrittenRef = useRef<string | null>(null);
    useEffect(() => {
        const key = selectedItem?.seriesId || (selectedItem?.id ? String(selectedItem.id) : null);
        if (key) {
            listingContextWrittenRef.current = key;
            setActiveSeriesContext(key);
        }
        return () => {
            if (useUIStore.getState().activeSeriesContext === listingContextWrittenRef.current) {
                setActiveSeriesContext(null);
            }
        };
    }, [selectedItem?.seriesId, selectedItem?.id, setActiveSeriesContext]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
            const n = Number(e.key);
            if (Number.isInteger(n) && n >= 1 && n <= displayedList.length) {
                const target = displayedList[n - 1];
                if (target && target.id !== effectiveSelectedId) {
                    playSound('series', 0.1);
                    setSelectedId(target.id);
                }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [displayedList, effectiveSelectedId, view, isMobile, playSound]);

    // Scroll automático hacia la card seleccionada
    useEffect(() => {
        if (!effectiveSelectedId || isMobile || view === 'etapas') return;
        const cardEl = document.getElementById(`series-card-${effectiveSelectedId}`);
        if (cardEl && shelfRef.current) {
            const shelfRect = shelfRef.current.getBoundingClientRect();
            const cardRect = cardEl.getBoundingClientRect();
            if (cardRect.left < shelfRect.left || cardRect.right > shelfRect.right) {
                cardEl.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }, [effectiveSelectedId, isMobile, view, reduceMotion]);

    return (
        <div className="relative w-full max-w-content-desktop mx-auto px-4 sm:px-6 md:px-8 lg:px-10 pt-4 md:pt-20 pb-8 select-none flex flex-col justify-start space-y-4 text-on-surface">
            {/* ── Ambient Aura Background (mismo tamaño que Home / Películas) ── */}
            <div className={cn(HERO_AURA_CLASS, "[contain:paint]")}>
                <AmbientAura src={lowAuraSrc} allowGlowFx={allowGlowFx} />
                {/* Orbe de color de era (sin esto el wash queda gris: el color lo pone el accent) */}
                {selectedItem && (allowGlowFx ? (
                    <m.div
                        animate={{ scale: [1, 1.08, 1], opacity: [0.25, 0.4, 0.25] }}
                        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute -top-[10%] -left-[5%] w-[50%] h-[70%] rounded-full pointer-events-none transform-gpu"
                        style={{
                            background: `radial-gradient(ellipse, color-mix(in srgb, ${selectedAccent} 50%, transparent) 0%, transparent 70%)`,
                        }}
                    />
                ) : (
                    <div
                        className="absolute -top-[10%] -left-[5%] w-[50%] h-[70%] rounded-full pointer-events-none"
                        style={{
                            background: `radial-gradient(ellipse, color-mix(in srgb, ${selectedAccent} 50%, transparent) 0%, transparent 70%)`,
                            opacity: 0.35,
                        }}
                    />
                ))}
            </div>

            {/* ── CRT scanlines (solo vista Portadas; el shelf tiene el suyo recortado) ── */}
            {(view !== 'shelf' || isMobile) && (
                <div className="absolute inset-0 pointer-events-none z-[49] opacity-[0.015] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%]" />
            )}

            {/* ── Tab Estantería / Portadas (posición original, primera barra) ── */}
            <div className="relative flex justify-center items-center w-full z-20 shrink-0">
                {/* Wash de aura para que el blur de la píldora tenga qué refractar */}
                {selectedItem && (
                    <div
                        aria-hidden
                        className="absolute inset-x-4 -inset-y-4 pointer-events-none blur-2xl"
                        style={{
                            background: `radial-gradient(ellipse 60% 100% at 50% 50%, color-mix(in srgb, ${selectedAccent} 18%, transparent), transparent 70%)`,
                            opacity: allowGlowFx ? 1 : 0.5,
                        }}
                    />
                )}
                <ViewModeTabs mode={view} onChange={handleViewChange} />
            </div>

            {/* ── Main Content ── */}
            {view === 'shelf' && !isMobile ? (
                /* ═══════════════════════ VISTA VHS SHELF (desktop, mismo stage que Home/Películas) ═══════════════════════ */
                <div className="relative z-10 w-full">
                <div
                    className={cn("sectionbar w-full relative z-10 flex flex-col rounded-3xl overflow-hidden border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] flex-none md:mb-8", HERO_STAGE_CLASS)}
                >
                    <div
                        ref={shelfRef}
                        role="listbox"
                        aria-orientation="horizontal"
                        aria-label="Colección de series"
                        aria-activedescendant={selectedItem ? `series-card-${selectedItem.id}` : undefined}
                        className="vhs-shelf w-full h-full flex bg-transparent overflow-x-auto overflow-y-hidden no-scrollbar relative z-10"
                        style={{ scrollSnapType: 'x proximity', scrollPadding: '0 16px' }}
                    >
                        {/* Glow interno del shelf (respira como Home) */}
                        {selectedItem && !isEco && (
                            allowGlowFx ? (
                                <m.div
                                    animate={{ opacity: [0.09, 0.15, 0.09] }}
                                    transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                                    className="absolute top-1/2 left-0 w-[500px] h-[500px] pointer-events-none blur-[80px] z-0 transform-gpu"
                                    style={{
                                        background: `radial-gradient(circle, ${selectedAccent} 0%, transparent 60%)`,
                                        transform: getGlowTransform(selectedIndex, displayedList.length, 250),
                                    }}
                                />
                            ) : (
                                // balanced: gradiente sin blur
                                <div
                                    className="absolute top-1/2 left-0 w-[500px] h-[500px] pointer-events-none z-0"
                                    style={{
                                        opacity: 0.07,
                                        background: `radial-gradient(circle, ${selectedAccent} 0%, transparent 60%)`,
                                        transform: getGlowTransform(selectedIndex, displayedList.length, 250),
                                        transition: 'transform 700ms cubic-bezier(0.16, 1, 0.3, 1), background 700ms ease-out',
                                    }}
                                />
                            )
                        )}

                        {isLoading && displayedList.length === 0 ? (
                            <div className="w-full h-full flex items-stretch gap-0 relative z-10 p-2">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <div key={i} className="h-full flex flex-col gap-2 p-2 shrink-0" style={{ flex: '1 0 150px' }}>
                                        <Skeleton className="flex-1 h-auto rounded-xl" />
                                    </div>
                                ))}
                            </div>
                        ) : displayedList.length === 0 ? (
                            <div className="w-full h-full flex items-center justify-center relative z-10 p-6">
                                <EmptyState
                                    title="No hay series en tu colección"
                                    message="Agregá series a tu biblioteca para verlas acá."
                                    action={
                                        <button
                                            type="button"
                                            onClick={() => navigate({ to: '/settings' })}
                                            className="px-6 py-2.5 rounded-full bg-brand-accent text-on-primary font-display text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-[transform,filter] duration-base ease-smooth-out shadow-elevation-1 cursor-pointer"
                                        >
                                            Configurar Biblioteca
                                        </button>
                                    }
                                />
                            </div>
                        ) : (
                            displayedList.map((item, i) => (
                                <SeriesCard
                                    key={item.id}
                                    item={item}
                                    isSelected={item.id === effectiveSelectedId}
                                    showUnwatchedCount={ts.themeShowAnimeUnwatchedCount}
                                    onNavigate={handleNavigate}
                                    onSelect={handleSelectSeries}
                                    entryDelayMs={i < ENTRY_STAGGER_MAX_ITEMS ? i * ENTRY_STAGGER_MS : 0}
                                />
                            ))
                        )}
                    </div>
                    {/* Zócalo continuo unificador de mural para la base del shelf */}
                    <div
                        aria-hidden
                        className="absolute bottom-0 inset-x-0 h-[22%] bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-[25]"
                    />
                    {/* Fades laterales del shelf */}
                    <div
                        aria-hidden
                        className="absolute inset-y-0 left-0 w-10 z-20 pointer-events-none"
                        style={{ background: 'linear-gradient(to right, color-mix(in srgb, var(--md-sys-color-surface) 65%, transparent), transparent)' }}
                    />
                    <div
                        aria-hidden
                        className="absolute inset-y-0 right-0 w-10 z-20 pointer-events-none"
                        style={{ background: 'linear-gradient(to left, color-mix(in srgb, var(--md-sys-color-surface) 65%, transparent), transparent)' }}
                    />
                    {/* CRT scanlines recortado al shelf */}
                    <div className="absolute inset-0 pointer-events-none z-30 opacity-[0.015] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%]" />
                </div>
                </div>
            ) : (
                /* ═══════════════════════ VISTA PORTADAS (grid / mobile) ═══════════════════════ */
                <div className="flex-1 overflow-y-auto no-scrollbar transform-gpu [contain:paint]">
                    <div className="w-full page-container py-7 pb-32 space-y-6 min-h-full">
                        {isLoading && displayedList.length === 0 ? (
                            <PosterGridSkeleton count={12} />
                        ) : displayedList.length === 0 ? (
                            <div className="min-h-[50vh] flex items-center justify-center p-6">
                                <EmptyState
                                    title="No hay series en tu colección"
                                    message="Agregá series a tu biblioteca para verlas acá."
                                    action={
                                        <button
                                            type="button"
                                            onClick={() => navigate({ to: '/settings' })}
                                            className="px-6 py-2.5 rounded-full bg-brand-accent text-on-primary font-display text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-[transform,filter] duration-base ease-smooth-out shadow-elevation-1 cursor-pointer"
                                        >
                                            Configurar Biblioteca
                                        </button>
                                    }
                                />
                            </div>
                        ) : (
                            <SectionBar
                                label="Colección de Series"
                                icon={IconNavigationLayers}
                                variant="minimal"
                                className="p-0 md:p-0"
                                badge={
                                    <span className="px-2 py-0.5 rounded-full text-3xs font-mono font-bold bg-[var(--glass-bg)] text-on-surface-variant border border-[var(--glass-border-side)]">
                                        {displayedList.length} {displayedList.length === 1 ? "serie" : "series"}
                                    </span>
                                }
                            >
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 w-full">
                                    {displayedList.map((item, i) => (
                                        <SeriesPosterGridItem
                                            key={item.id}
                                            item={item}
                                            index={i}
                                            onNavigate={handleNavigate}
                                        />
                                    ))}
                                </div>
                            </SectionBar>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
