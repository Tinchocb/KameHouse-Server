import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useMemo, useEffect, useCallback, useRef, memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useGetLibraryCollection, fetchLibraryCollection } from '@/api/hooks/anime_collection.hooks';
import { HydrationBoundary, dehydrate, useQueryClient } from '@tanstack/react-query';
import { API_ENDPOINTS } from '@/api/generated/endpoints';
import { fetchAnimeEntry } from '@/api/hooks/anime_entries.hooks';
import { SeriesCard, getVhsColor, type SeriesItem } from './-SeriesCard';
import { getMediumResImage, getLowResImage } from '@/lib/helpers/images';
import { DeferredImage } from '@/components/shared/deferred-image';
import { IconUiCheckCircle2, IconNavigationSearch, IconUiClose } from "@/components/ui/icons";
import { useHeroBackdrop } from '@/hooks/use-hero';
import { getSeriesIdFromMedia, getSeriesYear, getSeriesEraAccent, DRAGON_BALL_SERIES_ORDER, DRAGON_BALL_SERIES_INFO, DAIMA_VERTICAL_POSTER } from '@/lib/helpers/series';
import { getSpineConfig } from '@/lib/helpers/goku-panorama';
import { isTmdbId } from '@/lib/helpers/type-guards';
import { Skeleton } from '@/components/ui/skeleton/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { useResponsive } from '@/hooks/use-responsive';
import { useSound } from '@/hooks/use-sound';
import { startViewTransition } from '@/lib/helpers/transitions';
import { useThemeSettings } from '@/lib/theme/theme-hooks';
import { useAppStore } from '@/lib/store';
import { AppErrorBoundary } from '@/components/shared/app-error-boundary';
import { cn } from '@/components/ui/core/styling';
import { usePerformanceStore, selectIsHeavyEffectsAllowed } from '@/lib/hardware/performance-store';

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
            className="relative z-20 w-full flex items-center justify-between gap-2 bg-zinc-950/45 backdrop-blur-overlay-2xl backdrop-saturate-[190%] border border-white/20 border-t-white/40 border-b-white/10 rounded-full p-1.5 sm:p-2 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.3),0_12px_36px_-6px_rgba(0,0,0,0.85)] overflow-hidden"
        >
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
                                'relative flex flex-1 items-center justify-center px-2.5 sm:px-3 py-1.5 min-h-9 sm:min-h-10 rounded-full text-center shrink-0 cursor-pointer select-none transition-[transform,background-color,color] duration-150 hover:scale-[1.02] active:scale-[0.98]',
                                isActive
                                    ? 'text-zinc-950 font-bold'
                                    : 'text-on-surface-variant hover:text-on-surface hover:bg-white/10',
                            )}
                        >
                            {isActive && (
                                allowEraFx ? (
                                    <motion.div
                                        layoutId="activeSeriesTopPill"
                                        className="absolute inset-0 rounded-full pointer-events-none z-0 bg-white/95 shadow-[0_2px_14px_rgba(255,255,255,0.4),inset_0_1px_1px_rgba(255,255,255,1)]"
                                        transition={{ type: 'spring', stiffness: 480, damping: 34 }}
                                    />
                                ) : (
                                    <div className="absolute inset-0 rounded-full pointer-events-none z-0 bg-white/95" />
                                )
                            )}
                            <span className="relative z-10 font-sans font-extrabold text-[11px] sm:text-xs tracking-wider uppercase leading-tight whitespace-nowrap">
                                {label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export const Route = createFileRoute('/series/')({
    validateSearch: (search: Record<string, unknown>): { view?: SeriesViewMode } => ({
        view: search.view === 'etapas' ? 'etapas' : undefined,
    }),
    loader: async ({ context }) => {
        const qc = context.queryClient;
        await qc.prefetchQuery({
            queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key],
            queryFn: fetchLibraryCollection,
        });
        return { dehydrateState: dehydrate(qc) };
    },
    component: SeriesFullscreenPage,
    errorComponent: AppErrorBoundary,
});

function SeriesFullscreenPage() {
    const { dehydrateState } = Route.useLoaderData();
    return (
        <HydrationBoundary state={dehydrateState}>
            <SeriesFullscreenIndex />
        </HydrationBoundary>
    );
}

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
    const isComplete = item.progress >= 100;
    const volLabel = `VOL.${index + 1}`;
    const posterKanji = getSpineConfig(item.seriesId || '', item.id, item.title)?.kanji ?? '★';

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

    return (
        <motion.article
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index, 11) * 0.05, duration: 0.35, ease: 'easeOut' }}
            className="group relative select-none"
        >
            <div
                role="button"
                tabIndex={0}
                aria-label={`${item.title} — ${item.progress}% completado`}
                onClick={handleOpen}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpen(); }
                }}
                onMouseEnter={handlePrefetch}
                onFocus={handlePrefetch}
                className="relative block aspect-[2/3] w-full overflow-hidden rounded-2xl border border-white/10 bg-surface-container/20 shadow-elevation-2 cursor-pointer transition-all duration-base ease-smooth-out hover:-translate-y-1 hover:border-brand-accent/40 hover:shadow-[0_0_24px_hsl(var(--brand-accent)/0.2)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
            >
                {posterSrc ? (
                    <DeferredImage
                        src={posterSrc}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-base ease-smooth-out group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-surface-container-high to-surface-container p-4 text-center font-display text-lg uppercase tracking-wide text-on-surface-variant">
                        {item.title}
                    </div>
                )}
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent opacity-80 transition-opacity duration-base group-hover:opacity-90" />
                <div aria-hidden className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/15 to-transparent z-10 pointer-events-none" />

                <div className="absolute top-2.5 left-2.5 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur-overlay-sm">
                    {volLabel}
                </div>
                {isComplete ? (
                    <IconUiCheckCircle2 className="absolute top-2.5 right-2.5 h-5 w-5 text-brand-success drop-shadow-md" />
                ) : (
                    <span
                        className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full border border-white/25 bg-black/55 backdrop-blur-overlay-sm flex items-center justify-center text-[13px] font-black leading-none text-white/90"
                        aria-hidden
                    >
                        {posterKanji}
                    </span>
                )}

                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-3.5">
                    <h3 className="font-display text-lg leading-tight tracking-wide text-white line-clamp-2 drop-shadow-md">
                        {item.title}
                    </h3>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-white/70">
                        {item.year} • {item.eps} EPS • {item.progress}%
                    </p>
                </div>

                <div className="absolute inset-x-0 bottom-0 h-1 bg-white/15">
                    <div
                        className="h-full rounded-full"
                        style={{
                            width: `${item.progress}%`,
                            background: getSeriesEraAccent(item.seriesId),
                            boxShadow: `0 0 8px color-mix(in srgb, ${getSeriesEraAccent(item.seriesId)} 50%, transparent)`,
                        }}
                    />
                </div>
            </div>
        </motion.article>
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
    // Glows caros (blur 80-100px) solo con GPU capaz y sin reduced-motion.
    const allowGlowFx = isHeavyAllowed && !reduceMotion;
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [query, setQuery] = useState('');
    const shelfRef = useRef<HTMLDivElement>(null);
    const gridSearchRef = useRef<HTMLInputElement>(null);
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
        const raw = collection.lists
            .flatMap(list => list.entries || [])
            .filter(entry => {
                const media = entry.media;
                const format = media?.format?.toUpperCase();
                const type = media?.type?.toUpperCase();
                if (format === 'MOVIE' || format === 'OVA' || format === 'SPECIAL') return false;
                if (type === 'MOVIE') return false;
                if (isTmdbId(entry.mediaId) || isTmdbId(media?.tmdbId)) return false;

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

        const mapped = filtered.map((s) => {
            const media = s.media;
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
            const desc = canonicalInfo?.description || ((rawDesc && rawDesc !== 'Sin descripción') ? rawDesc : 'Sin descripción');

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

    // Pre-cargar portadas visibles iniciales
    useEffect(() => {
        if (!seriesList.length) return;
        seriesList.slice(0, 4).forEach(item => {
            const src = item.poster || item.img;
            if (src) { const img = new Image(); img.src = src; }
        });
    }, [seriesList]);

    // Selección efectiva: cae al primer item si no hay selección explícita
    const displayedList = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return seriesList;
        return seriesList.filter(s =>
            [s.title, s.seriesId, String(s.year)].filter(Boolean).join(' ').toLowerCase().includes(q),
        );
    }, [seriesList, query]);

    const effectiveSelectedId = displayedList.some(s => s.id === selectedId)
        ? selectedId
        : displayedList[0]?.id ?? null;

    const selectedIndex = useMemo(() => {
        return displayedList.findIndex(item => item.id === effectiveSelectedId);
    }, [displayedList, effectiveSelectedId]);
    const selectedItem = displayedList[selectedIndex] ?? null;
    const selectedAccent = getSeriesEraAccent(selectedItem?.seriesId, selectedItem ? getVhsColor(selectedItem.id) : undefined);

    const handleSelectSeries = useCallback((id: number) => {
        if (id !== effectiveSelectedId) playSound('series', 0.1);
        setSelectedId(id);
    }, [effectiveSelectedId, playSound]);

    // Backdrop global (paridad Home/Películas)
    useHeroBackdrop(selectedItem?.img || selectedItem?.poster);

    const setActiveSeriesContext = useAppStore(s => s.setActiveSeriesContext);
    const listingContextWrittenRef = useRef<string | null>(null);
    useEffect(() => {
        const key = selectedItem?.seriesId || (selectedItem?.id ? String(selectedItem.id) : null);
        if (key) {
            listingContextWrittenRef.current = key;
            setActiveSeriesContext(key);
        }
        return () => {
            if (useAppStore.getState().activeSeriesContext === listingContextWrittenRef.current) {
                setActiveSeriesContext(null);
            }
        };
    }, [selectedItem?.seriesId, selectedItem?.id, setActiveSeriesContext]);

    // Atajos: 1-6 saltan a cada serie, / enfoca el buscador de Portadas
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
            if (e.key === '/') {
                e.preventDefault();
                gridSearchRef.current?.focus();
                return;
            }
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
                cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }, [effectiveSelectedId, isMobile, view]);

    return (
        <div className="w-full h-full max-w-content mx-auto flex flex-col bg-transparent text-on-surface font-sans overflow-hidden relative px-4 sm:px-6 md:px-8 lg:px-10 pb-4 md:pb-6 pt-4 md:pt-20 space-y-4">
            {/* ── Ambient Aura Background (guía §SpotlightHero: arte difuminado + máscara) ── */}
            <div className="absolute top-0 inset-x-0 h-[500px] sm:h-[560px] md:h-[640px] pointer-events-none overflow-hidden z-0 transform-gpu">
                {(selectedItem?.img || selectedItem?.poster) && (
                    <motion.div
                        key={selectedItem?.img || selectedItem?.poster}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: allowGlowFx ? 0.28 : 0.18 }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="absolute inset-0 pointer-events-none overflow-hidden"
                        style={{
                            backgroundImage: `url(${getLowResImage(selectedItem?.img || selectedItem?.poster)})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center 20%",
                            filter: "blur(72px) saturate(140%)",
                            maskImage: "radial-gradient(ellipse 90% 80% at 70% 40%, black 0%, transparent 75%)",
                            WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 70% 40%, black 0%, transparent 75%)",
                        }}
                    />
                )}
                {/* Orbe de color de era (sin esto el wash queda gris: el color lo pone el accent) */}
                {selectedItem && (allowGlowFx ? (
                    <motion.div
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
            {/* ── Ambient Background Glow (exterior, respira como Home) ── */}
            {selectedItem && (
                allowGlowFx ? (
                    <motion.div
                        animate={{ opacity: [0.05, 0.09, 0.05] }}
                        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute top-1/2 left-0 w-[700px] h-[700px] pointer-events-none blur-[100px] z-0"
                        style={{
                            background: `radial-gradient(circle, ${selectedAccent} 0%, transparent 70%)`,
                            transform: getGlowTransform(selectedIndex, displayedList.length, 350),
                        }}
                    />
                ) : (
                    <div
                        className="absolute top-1/2 left-0 w-[700px] h-[700px] pointer-events-none z-0"
                        style={{
                            opacity: 0.04,
                            background: `radial-gradient(circle, ${selectedAccent} 0%, transparent 70%)`,
                            transform: getGlowTransform(selectedIndex, displayedList.length, 350),
                            transition: 'transform 700ms cubic-bezier(0.16, 1, 0.3, 1), background 700ms ease-out',
                        }}
                    />
                )
            )}

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
                /* ═══════════════════════ VISTA VHS SHELF (desktop) ═══════════════════════ */
                <div className="flex-1 min-h-0 flex flex-col gap-2 relative z-10">
                <div
                    className="flex-1 min-h-0 backdrop-blur-[var(--blur-overlay-xl)] rounded-[var(--radius-corner-lg)] border border-outline-variant/50 shadow-elevation-3 overflow-hidden relative z-10 flex flex-col"
                    style={{ background: 'color-mix(in srgb, var(--md-sys-color-surface) 50%, transparent)' }}
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
                        {selectedItem && (
                            allowGlowFx ? (
                                <motion.div
                                    animate={{ opacity: [0.09, 0.15, 0.09] }}
                                    transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                                    className="absolute top-1/2 left-0 w-[500px] h-[500px] pointer-events-none blur-[80px] z-0"
                                    style={{
                                        background: `radial-gradient(circle, ${selectedAccent} 0%, transparent 60%)`,
                                        transform: getGlowTransform(selectedIndex, displayedList.length, 250),
                                    }}
                                />
                            ) : (
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

                        {isLoading && displayedList.length === 0 && !query ? (
                            <div className="w-full h-full flex items-stretch gap-0 relative z-10 p-2">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <div key={i} className="h-full flex flex-col gap-2 p-2 shrink-0" style={{ flex: '1 0 150px' }}>
                                        <Skeleton className="flex-1 h-auto rounded-xl" />
                                    </div>
                                ))}
                            </div>
                        ) : displayedList.length === 0 ? (
                            <div className="w-full h-full flex items-center justify-center relative z-10 p-6">
                                {query ? (
                                    <EmptyState
                                        title="Sin resultados"
                                        message={`Nada coincide con "${query}".`}
                                        action={
                                            <button
                                                type="button"
                                                onClick={() => setQuery('')}
                                                className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-semibold text-white transition-colors cursor-pointer"
                                            >
                                                Limpiar búsqueda
                                            </button>
                                        }
                                    />
                                ) : (
                                <EmptyState
                                    title="No hay series en tu colección"
                                    message="Agregá series a tu biblioteca para verlas acá."
                                    action={
                                        <button
                                            type="button"
                                            onClick={() => navigate({ to: '/settings' })}
                                            className="px-6 py-2.5 rounded-full bg-brand-accent text-white font-display text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_hsl(var(--brand-accent)/0.4)] cursor-pointer"
                                        >
                                            Configurar Biblioteca
                                        </button>
                                    }
                                />
                                )}
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
                    {/* Riel superior del shelf: remata el borde */}
                    <div
                        aria-hidden
                        className="absolute top-0 inset-x-0 h-[2px] z-30 pointer-events-none bg-gradient-to-r from-transparent via-white/25 to-transparent"
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
                        {/* Buscador de portadas (atajo /) */}
                        <div className="relative w-full sm:max-w-64">
                            <IconNavigationSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50 pointer-events-none" />
                            <input
                                ref={gridSearchRef}
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Escape') { setQuery(''); gridSearchRef.current?.blur(); } }}
                                placeholder="Buscar serie... (/)"
                                aria-label="Buscar serie"
                                className="w-full bg-zinc-950/45 border border-white/20 border-t-white/40 border-b-white/10 rounded-full py-1.5 pl-9 pr-8 text-xs font-medium text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/50 focus:ring-1 focus:ring-white/40 transition-all backdrop-blur-overlay-2xl shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.2)]"
                            />
                            {query && (
                                <button
                                    type="button"
                                    onClick={() => setQuery('')}
                                    aria-label="Limpiar búsqueda"
                                    className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full text-zinc-400 hover:text-white transition-colors cursor-pointer"
                                >
                                    <IconUiClose className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                        {isLoading && displayedList.length === 0 && !query ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 w-full">
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <div key={i} className="flex flex-col gap-2">
                                        <Skeleton className="aspect-[2/3] w-full rounded-2xl bg-surface-container animate-pulse" />
                                        <Skeleton className="h-4 w-3/4 rounded-md bg-surface-container/70 animate-pulse" />
                                        <Skeleton className="h-3 w-1/2 rounded-md bg-surface-container/50 animate-pulse" />
                                    </div>
                                ))}
                            </div>
                        ) : displayedList.length === 0 ? (
                            <div className="min-h-[50vh] flex items-center justify-center p-6">
                                {query ? (
                                    <EmptyState
                                        title="Sin resultados"
                                        message={`Nada coincide con "${query}".`}
                                        action={
                                            <button
                                                type="button"
                                                onClick={() => setQuery('')}
                                                className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-semibold text-white transition-colors cursor-pointer"
                                            >
                                                Limpiar búsqueda
                                            </button>
                                        }
                                    />
                                ) : (
                                <EmptyState
                                    title="No hay series en tu colección"
                                    message="Agregá series a tu biblioteca para verlas acá."
                                    action={
                                        <button
                                            type="button"
                                            onClick={() => navigate({ to: '/settings' })}
                                            className="px-6 py-2.5 rounded-full bg-brand-accent text-white font-display text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_hsl(var(--brand-accent)/0.4)] cursor-pointer"
                                        >
                                            Configurar Biblioteca
                                        </button>
                                    }
                                />
                                )}
                            </div>
                        ) : (
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
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
