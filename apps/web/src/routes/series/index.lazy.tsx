import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import { Fragment, useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { useGetLibraryCollection } from '@/api/hooks/anime_collection.hooks';
import { SeriesCard, getVhsColor } from './-SeriesCard';
import { SeriesSpineRow } from './-SeriesSpineRow';
import { getMediumResImage, getLowResImage, localImage, prewarmImages } from '@/lib/helpers/images';
import { IconNavigationLayers } from '@/components/ui/icons';
import { LoadSwap, loadSwapVariants, viewSwapVariants } from '@/components/ui/kinetics';
import { getSeriesIdFromMedia, getSeriesYear, getSeriesEraAccent, DRAGON_BALL_SERIES_ORDER, DRAGON_BALL_SERIES_INFO, DAIMA_VERTICAL_POSTER } from '@/lib/helpers/series';
import { getSafeCollectionEntries } from '@/lib/helpers/collection';
import { Skeleton } from '@/components/ui/skeleton/skeleton';
import { SectionBar } from '@/components/ui/sectionbar/sectionbar';
import { PosterGridSkeleton } from '@/components/ui/shimmer-skeleton';
import { useRevealChildren } from '@/components/ui/kinetics/scroll-reveal';
import { EmptyState } from '@/components/shared/empty-state';
import { useResponsive } from '@/hooks/use-responsive';
import { useSound } from '@/hooks/use-sound';
import { useThemeSettings } from '@/lib/theme/theme-hooks';
import { useUIStore } from '@/lib/store';
import { cn } from '@/components/ui/core/styling';
import { usePerformanceStore, selectIsHeavyEffectsAllowed, selectEffectiveTier } from '@/lib/hardware/performance-store';
import { HERO_AURA_CLASS, HERO_STAGE_CLASS } from '@/lib/config/hero-stage';
import { SeriesViewMode, ViewModeTabs } from './-ViewModeTabs';
import { getGlowTransform, AmbientAura } from './-AmbientAura';
import { SeriesPosterGridItem } from './-SeriesPosterGridItem';

export type { SeriesViewMode } from './-ViewModeTabs';

/** Delay de stagger por card, en ms (tope acotado para fluidez). */
const ENTRY_STAGGER_MS = 40;

// Lomos que entran en pantalla al abrir (escritorio): sus fondos se piden ya.
const SHELF_EAGER_ITEMS = 7;

const ENTRY_STAGGER_MAX_ITEMS = 12;

export const Route = createLazyFileRoute('/series/')({
    component: SeriesFullscreenIndex,
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

    // Estantería móvil: una sola cinta abierta. `undefined` = todavía sin tocar,
    // se abre sola la primera serie a medio ver.
    const [openSpineId, setOpenSpineId] = useState<number | null | undefined>(undefined);

    const handlePlayEpisode = useCallback((id: number, episode: number) => {
        navigate({
            to: '/series/$seriesId',
            params: { seriesId: String(id) },
            search: { saga: '', autoplay: String(episode) },
        });
    }, [navigate]);

    const handleViewChange = useCallback((nextView: SeriesViewMode) => {
        playSound('category', 0.1);
        // Sin startViewTransition: el cambio de panel ya lo anima AnimatePresence
        // (viewSwapVariants); el cross-fade del navegador lo duplicaba y dejaba
        // fantasma la píldora del tab mientras se desplaza.
        navigate({ to: '/series', search: { view: nextView === 'shelf' ? undefined : nextView }, replace: true });
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
                watched: totalEps > 0 ? Math.min(watched, totalEps) : watched,
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
        ].map(localImage)));
    }, [seriesList]);

    // Selección efectiva: cae al primer item si no hay selección explícita
    const displayedList = seriesList;
    // Las portadas entran en ola al bajar (solo las que no se ven al cargar).
    const posterGridRef = useRef<HTMLDivElement>(null);
    useRevealChildren(posterGridRef, `${view}:${displayedList.map(s => s.id).join(',')}`);

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
    const lowAuraSrc = useMemo(() => rawAuraSrc ? localImage(getLowResImage(rawAuraSrc)) : null, [rawAuraSrc]);

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
        prewarmImages(targets.map(localImage));
    }, [selectedIndex, displayedList]);

    const defaultOpenSpineId = useMemo(
        () => displayedList.find(s => s.progress > 0 && s.progress < 100)?.id ?? null,
        [displayedList]
    );
    const activeSpineId = openSpineId === undefined ? defaultOpenSpineId : openSpineId;

    const handleToggleSpine = useCallback((id: number) => {
        setOpenSpineId(id === activeSpineId ? null : id);
        if (id !== activeSpineId) {
            playSound('series', 0.1);
            setSelectedId(id);
        }
    }, [activeSpineId, playSound]);

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
            <h1 className="sr-only">Series</h1>
            {/* ── Ambient Aura Background (mismo tamaño que Home / Películas) ── */}
            <div className={cn(HERO_AURA_CLASS, "[contain:paint]")}>
                <AmbientAura src={lowAuraSrc} allowGlowFx={allowGlowFx} />
                {/* Tinte de la era sobre todo el hero (sin esto el wash queda gris). Antes era
                    un orbe que respiraba arriba a la izquierda; ahora es un velo sin forma visible. */}
                {selectedItem && (
                    <div
                        className="absolute inset-0 pointer-events-none transition-[background] duration-500"
                        style={{
                            background: `radial-gradient(ellipse 80% 60% at 30% 30%, color-mix(in srgb, ${selectedAccent} 16%, transparent) 0%, transparent 70%)`,
                        }}
                    />
                )}
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
            {/* Cambio de vista: el panel saliente se va antes de que entre el nuevo. */}
            <AnimatePresence mode="wait" initial={false}>
            {view === 'shelf' && !isMobile ? (
                /* ═══════════════════════ VISTA VHS SHELF (desktop, mismo stage que Home/Películas) ═══════════════════════ */
                <m.div key="shelf" variants={viewSwapVariants} initial="initial" animate="animate" exit="exit" className="relative z-10 w-full">
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
                                        // Framer solo anima la opacidad: el halo sigue a la
                                        // cinta elegida por CSS, igual que la variante balanced.
                                        transition: 'transform 700ms cubic-bezier(0.16, 1, 0.3, 1)',
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

                        {/* mode="wait": las cintas entran (con su propia cascada) recién cuando el skeleton terminó de irse. */}
                        <AnimatePresence mode="wait" initial={false}>
                        {isLoading && displayedList.length === 0 ? (
                            <m.div key="skeleton" variants={loadSwapVariants} exit="exit" className="w-full h-full flex items-stretch gap-0 relative z-10 p-2">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <div key={i} className="h-full flex flex-col gap-2 p-2 shrink-0" style={{ flex: '1 0 150px' }}>
                                        <Skeleton className="flex-1 h-auto rounded-xl" />
                                    </div>
                                ))}
                            </m.div>
                        ) : displayedList.length === 0 ? (
                            <div key="empty" className="w-full h-full flex items-center justify-center relative z-10 p-6">
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
                            <Fragment key="list">
                            {displayedList.map((item, i) => (
                                <SeriesCard
                                    key={item.id}
                                    item={item}
                                    isSelected={item.id === effectiveSelectedId}
                                    showUnwatchedCount={ts.themeShowAnimeUnwatchedCount}
                                    onNavigate={handleNavigate}
                                    onSelect={handleSelectSeries}
                                    entryDelayMs={!reduceMotion && i < ENTRY_STAGGER_MAX_ITEMS ? i * ENTRY_STAGGER_MS : 0}
                                    eager={i < SHELF_EAGER_ITEMS}
                                />
                            ))}
                            </Fragment>
                        )}
                        </AnimatePresence>
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
                </m.div>
            ) : view === 'shelf' && isMobile && displayedList.length > 0 ? (
                /* ═══════════════════════ VISTA ESTANTERÍA MÓVIL (cintas apiladas) ═══════════════════════ */
                <m.div key="spines" variants={viewSwapVariants} initial="initial" animate="animate" exit="exit" className="w-full max-w-2xl mx-auto pt-1 pb-[calc(8rem+env(safe-area-inset-bottom,0px))]">
                    <ul aria-label="Colección de series" className="flex flex-col gap-2">
                        {displayedList.map((item, i) => (
                            <SeriesSpineRow
                                key={item.id}
                                item={item}
                                index={i}
                                watched={item.watched}
                                isOpen={item.id === activeSpineId}
                                onToggle={handleToggleSpine}
                                onNavigate={handleNavigate}
                                onPlay={handlePlayEpisode}
                            />
                        ))}
                    </ul>
                </m.div>
            ) : (
                /* ═══════════════════════ VISTA PORTADAS (grid / mobile) ═══════════════════════ */
                <m.div key="grid" variants={viewSwapVariants} initial="initial" animate="animate" exit="exit" className="flex-1 overflow-y-auto no-scrollbar [contain:paint]">
                    <div className="w-full page-container py-7 pb-[calc(8rem+env(safe-area-inset-bottom,0px))] space-y-6 min-h-full">
                        <LoadSwap loading={isLoading && displayedList.length === 0} skeleton={<PosterGridSkeleton count={12} />}>
                        {displayedList.length === 0 ? (
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
                                <div ref={posterGridRef} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 w-full">
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
                        </LoadSwap>
                    </div>
                </m.div>
            )}
            </AnimatePresence>
        </div>
    );
}
