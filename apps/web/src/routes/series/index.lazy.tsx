import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import { Fragment, useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { useGetLibraryCollection } from '@/api/hooks/anime_collection.hooks';
import { useGetContinuityWatchHistory } from '@/api/hooks/continuity.hooks';
import { SeriesCard, getVhsColor, SPINE_EXPANDED_BASIS, SPINE_COLLAPSED_BASIS, SPINE_EXPANDED_GROW, SPINE_SHELF_GAP, SPINE_SHELF_PADDING } from './-SeriesCard';
import { SeriesSpineRow } from './-SeriesSpineRow';
import { getHighResImage, getLowResImage, localImage, prewarmImages } from '@/lib/helpers/images';
import { IconNavigationChevronLeft, IconNavigationChevronRight } from '@/components/ui/icons';
import { loadSwapVariants, useMotionTier, viewSwapVariants } from '@/components/ui/kinetics';
import { getSeriesEraAccent } from '@/lib/helpers/series';
import { Skeleton } from '@/components/ui/skeleton/skeleton';
import { IconButton } from '@/components/ui/button';
import { LibraryEmptyState } from '@/components/shared/library-empty-state';
import { LibraryErrorState } from '@/components/shared/library-error-state';
import { useResponsive } from '@/hooks/use-responsive';
import { useSound } from '@/hooks/use-sound';
import { useThemeSettings } from '@/lib/theme/theme-hooks';
import { useIsClassicMode } from '@/lib/theme/use-classic-mode';
import { useUIStore } from '@/lib/store';
import { cn } from '@/components/ui/core/styling';
import { usePerformanceStore, selectEffectiveTier } from '@/lib/hardware/performance-store';
import { HERO_AURA_CLASS, HERO_STAGE_CLASS } from '@/lib/config/hero-stage';
import { ViewModeTabs, type SeriesViewMode } from './-ViewModeTabs';
import { getGlowTransform, AmbientAura } from './-AmbientAura';
import { SeriesPosterGridItem } from './-SeriesPosterGridItem';
import { buildSeriesList, loadSeriesPrefs, saveSeriesPrefs, sortSeries } from './-series-model';

/** Delay de stagger por card, en ms (tope acotado para fluidez). */
const ENTRY_STAGGER_MS = 40;

// Lomos que entran en pantalla al abrir (escritorio): sus fondos se piden ya.
const SHELF_EAGER_ITEMS = 7;

const ENTRY_STAGGER_MAX_ITEMS = 12;

export const Route = createLazyFileRoute('/series/')({
    component: SeriesFullscreenIndex,
});

const GRID_CLASS = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 w-full';

/** Misma geometría que la grilla de Portadas: tarjetas 2:3 en las mismas columnas. */
function PosterGridPlaceholder() {
    return (
        <div role="status" aria-busy="true" aria-label="Cargando series" className={GRID_CLASS}>
            {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[2/3] h-auto w-full rounded-2xl" />
            ))}
        </div>
    );
}

/** Misma geometría que las cintas de la estantería móvil (72 px de alto, 8 px entre ellas). */
function SpineListPlaceholder() {
    return (
        <div role="status" aria-busy="true" aria-label="Cargando series" className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[74px] w-full rounded-xl" />
            ))}
        </div>
    );
}

function SeriesFullscreenIndex() {
    const navigate = useNavigate();
    const { view: viewParam } = Route.useSearch();
    // Preferencias de este dispositivo (vista y orden). La URL manda si trae `view`.
    const [prefs] = useState(loadSeriesPrefs);
    const view: SeriesViewMode = viewParam ?? prefs.view ?? 'shelf';
    const { playSound } = useSound();
    const ts = useThemeSettings();
    const reduceMotion = useReducedMotion();
    const effectiveTier = usePerformanceStore(selectEffectiveTier);
    // Glows caros (blur 80-100px + animaciones 8s) solo con tier "full": GPU capaz, sin reduced-motion ni modo TV.
    const allowGlowFx = useMotionTier() === 'full';
    // En eco (low_power) se apagan incluso los blurs estáticos de los glows.
    const isEco = effectiveTier === 'low_power';
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const shelfRef = useRef<HTMLDivElement | null>(null);
    // El shelf se monta y desmonta con AnimatePresence al cambiar de vista: el efecto de anchos
    // necesita el nodo como estado para volver a correr cuando aparece.
    const [shelfEl, setShelfEl] = useState<HTMLDivElement | null>(null);
    const setShelfNode = useCallback((node: HTMLDivElement | null) => {
        shelfRef.current = node;
        setShelfEl(node);
    }, []);
    // Tablet (768-1023) usa el grid de posters en vez del shelf horizontal
    const { isMobile: isPhone, isTablet } = useResponsive();
    const isMobile = isPhone || isTablet;

    const { data: collection, isLoading, isError, error, refetch } = useGetLibraryCollection();
    const { data: history } = useGetContinuityWatchHistory();

    const handleNavigate = useCallback((id: string) => {
        navigate({ to: '/series/$seriesId', params: { seriesId: id } });
    }, [navigate]);

    // Estantería móvil: una sola cinta abierta. Al entrar todas arrancan colapsadas.
    const [openSpineId, setOpenSpineId] = useState<number | null>(null);

    const handlePlayEpisode = useCallback((id: number, episode: number) => {
        navigate({
            to: '/series/$seriesId',
            params: { seriesId: String(id) },
            search: { saga: '', autoplay: String(episode) },
        });
    }, [navigate]);

    const handleViewChange = useCallback((nextView: SeriesViewMode) => {
        playSound('category', 0.1);
        saveSeriesPrefs({ view: nextView });
        // Sin startViewTransition: el cambio de panel ya lo anima AnimatePresence
        // (viewSwapVariants); el cross-fade del navegador lo duplicaba y dejaba
        // fantasma la píldora del tab mientras se desplaza.
        // La vista va siempre explícita en la URL: así "estantería" no se confunde con "sin elegir".
        navigate({ to: '/series', search: { view: nextView }, replace: true });
    }, [navigate, playSound]);

    const allSeries = useMemo(() => buildSeriesList(collection, history), [collection, history]);
    const displayedList = useMemo(
        () => sortSeries(allSeries, 'saga'),
        [allSeries],
    );

    // Pre-cargar portadas + banners visibles iniciales una sola vez por montaje.
    // El hero expandido y el aura usan el banner (item.img); sin esto el primer
    // paint del aura siempre falla la caché aunque el póster ya esté cargado.
    const preloadedRef = useRef(false);
    useEffect(() => {
        if (preloadedRef.current || !displayedList.length) return;
        preloadedRef.current = true;
        prewarmImages(displayedList.slice(0, 4).flatMap(item => [
            item.poster,
            getLowResImage(item.poster),
            item.img,
            getLowResImage(item.img),
        ].map(localImage)));
    }, [displayedList]);

    // Anchos reales de lomo abierto/cerrado (misma cuenta que el flex de SeriesCard). Las capas
    // internas de cada lomo se fijan a estos anchos para que la transición de flex-grow solo recorte
    // y no vuelva a pintar imágenes con blur en cada frame.
    const shelfCount = displayedList.length;
    // Sin lomo abierto cada lomo ocupa W/N: el ancho de las capas internas tiene que seguirlo,
    // si no quedan huecos a los costados. Con uno abierto se mantiene el cálculo de siempre.
    const hayLomoAbierto = displayedList.some(s => s.id === selectedId);
    useLayoutEffect(() => {
        const el = shelfEl;
        if (!el || shelfCount === 0) return;
        const apply = () => {
            const availableWidth = el.clientWidth - SPINE_SHELF_PADDING * 2 - SPINE_SHELF_GAP * (shelfCount - 1);
            const free = Math.max(0, availableWidth - (SPINE_EXPANDED_BASIS + SPINE_COLLAPSED_BASIS * (shelfCount - 1)));
            const share = free / (shelfCount - 1 + SPINE_EXPANDED_GROW);
            const expW = Math.round(SPINE_EXPANDED_BASIS + SPINE_EXPANDED_GROW * share);
            el.style.setProperty('--spine-exp-w', `${expW}px`);
            el.style.setProperty('--spine-exp-width', String(expW));
            el.style.setProperty('--spine-art-height', String(Math.max(1, el.clientHeight - SPINE_SHELF_PADDING * 2 - 144)));
            const colW = hayLomoAbierto
                ? SPINE_COLLAPSED_BASIS + share
                : Math.max(SPINE_COLLAPSED_BASIS, availableWidth / shelfCount);
            el.style.setProperty('--spine-col-w', `${Math.round(colW)}px`);
            el.style.setProperty('--spine-col-width', String(Math.round(colW)));
        };
        apply();
        const ro = new ResizeObserver(apply);
        ro.observe(el);
        return () => ro.disconnect();
    }, [shelfEl, shelfCount, hayLomoAbierto]);

    // Flechas del estante: solo aparecen cuando los lomos no caben y hay hacia dónde desplazarse.
    const [canScroll, setCanScroll] = useState({ left: false, right: false });
    useEffect(() => {
        const el = shelfEl;
        if (!el) return;
        const update = () => {
            const left = el.scrollLeft > 4;
            const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
            setCanScroll(prev => (prev.left === left && prev.right === right ? prev : { left, right }));
        };
        update();
        el.addEventListener('scroll', update, { passive: true });
        el.addEventListener('transitionend', update);
        // En el siguiente frame: actualizar estado dentro del callback del observer provoca "ResizeObserver loop".
        let raf = 0;
        const ro = new ResizeObserver(() => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(update);
        });
        ro.observe(el);
        return () => {
            cancelAnimationFrame(raf);
            el.removeEventListener('scroll', update);
            el.removeEventListener('transitionend', update);
            ro.disconnect();
        };
    }, [shelfEl, shelfCount, hayLomoAbierto]);
    const scrollShelf = useCallback((dir: -1 | 1) => {
        shelfRef.current?.scrollBy({ left: dir * SPINE_EXPANDED_BASIS * 0.8, behavior: reduceMotion ? 'auto' : 'smooth' });
    }, [reduceMotion]);

    const effectiveSelectedId = displayedList.some(s => s.id === selectedId)
        ? selectedId
        : displayedList[0]?.id ?? null;

    const selectedIndex = useMemo(() => {
        return displayedList.findIndex(item => item.id === effectiveSelectedId);
    }, [displayedList, effectiveSelectedId]);
    const selectedItem = displayedList[selectedIndex] ?? null;
    const isClassic = useIsClassicMode();
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
            if (it.poster) targets.push(it.poster, getHighResImage(it.poster), getLowResImage(it.poster));
            if (it.img) targets.push(it.img, getLowResImage(it.img));
        });
        prewarmImages(targets.map(localImage));
    }, [selectedIndex, displayedList]);

    const activeSpineId = openSpineId;

    const handleToggleSpine = useCallback((id: number) => {
        setOpenSpineId(id === activeSpineId ? null : id);
        if (id !== activeSpineId) {
            playSound('series', 0.1);
            setSelectedId(id);
        }
    }, [activeSpineId, playSound]);

    // Callback estable (lee lo último vía ref): si cambiara de identidad con cada selección
    // rompería el memo de SeriesCard y las 6 tarjetas se renderizarían de nuevo (~35 ms).
    const selectionRef = useRef({ id: selectedId, playSound });
    useLayoutEffect(() => {
        selectionRef.current = { id: selectedId, playSound };
    });
    const handleSelectSeries = useCallback((id: number) => {
        const { id: currentId, playSound: play } = selectionRef.current;
        if (id !== currentId) play('series', 0.1);
        setSelectedId(id);
    }, []);

    // NOTA perf: sin useHeroBackdrop en el listado. DynamicBackdrop omite su
    // capa de imagen cuando el hero local ya pinta la misma arte
    // (hasLocalHeroAura), así que sincronizar el backdrop solo descargaba un
    // w1280 que nunca se pinta. El aura local (w185 + blur) es la única capa.

    const setActiveSeriesContext = useUIStore(s => s.setActiveSeriesContext);
    const listingContextWrittenRef = useRef<string | null>(null);
    useEffect(() => {
        const expandedItem = displayedList.find(item => item.id === selectedId);
        const key = expandedItem?.seriesId || (expandedItem?.id ? String(expandedItem.id) : null);
        listingContextWrittenRef.current = key;
        setActiveSeriesContext(key);
        return () => {
            if (useUIStore.getState().activeSeriesContext === listingContextWrittenRef.current) {
                setActiveSeriesContext(null);
            }
        };
    }, [displayedList, selectedId, setActiveSeriesContext]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
            const n = Number(e.key);
            if (Number.isInteger(n) && n >= 1 && n <= displayedList.length) {
                const target = displayedList[n - 1];
                if (target && target.id !== selectedId) {
                    playSound('series', 0.1);
                    setSelectedId(target.id);
                }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [displayedList, selectedId, view, isMobile, playSound]);

    // Scroll automático hacia la card seleccionada
    useEffect(() => {
        if (!effectiveSelectedId || isMobile || view === 'etapas') return;
        // Sin selección del usuario la tarjeta activa es la primera, que ya está a la izquierda del
        // estante: medir rects acá forzaba un layout completo dentro del montaje de la página.
        if (selectedId === null) return;
        const cardEl = document.getElementById(`series-card-${effectiveSelectedId}`);
        if (cardEl && shelfRef.current) {
            const shelfRect = shelfRef.current.getBoundingClientRect();
            const cardRect = cardEl.getBoundingClientRect();
            if (cardRect.left < shelfRect.left || cardRect.right > shelfRect.right) {
                cardEl.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }, [effectiveSelectedId, selectedId, isMobile, view, reduceMotion]);

    if (isError && !collection) return <LibraryErrorState error={error} onRetry={() => { void refetch(); }} />;

    const loadingList = isLoading && allSeries.length === 0;
    const hasList = displayedList.length > 0;

    const emptyLibrary = (
        <LibraryEmptyState
            title="No hay series en tu biblioteca"
            message="Escanea tus carpetas desde Ajustes para añadir series."
        />
    );

    return (
        <div className="neutro-sentence relative w-full max-w-content-desktop mx-auto px-4 sm:px-6 md:px-8 lg:px-10 pt-nav pb-8 select-none flex flex-col justify-start space-y-4 text-on-surface">
            {/* ── Ambient Aura Background (mismo tamaño que Home / Películas) ── */}
            <div className={cn(HERO_AURA_CLASS, "[contain:paint]")}>
                <AmbientAura src={lowAuraSrc} allowGlowFx={allowGlowFx} />
                {/* Tinte de la era sobre todo el hero (sin esto el wash queda gris). Antes era
                    un orbe que respiraba arriba a la izquierda; ahora es un velo sin forma visible.
                    Color en background-color y forma en la máscara: un degradado en `background` no se
                    interpola y el tinte saltaba de golpe al cambiar de serie. */}
                {selectedItem && !isClassic && (
                    <div
                        className="absolute inset-0 pointer-events-none transition-[background-color] duration-slow ease-smooth-out"
                        style={{
                            backgroundColor: `color-mix(in srgb, ${selectedAccent} 16%, transparent)`,
                            maskImage: 'radial-gradient(ellipse 80% 60% at 30% 30%, black 0%, transparent 70%)',
                            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 30% 30%, black 0%, transparent 70%)',
                        }}
                    />
                )}
            </div>

            <h1 className="sr-only">Series</h1>
            {/* Selector de vista (Estantería / Portadas): riel fijo, no ocupa espacio en el flujo. */}
            <ViewModeTabs mode={view} onChange={handleViewChange} />

            {/* ── Main Content ── */}
            {/* Cambio de vista: el panel saliente se va antes de que entre el nuevo. */}
            <AnimatePresence mode="wait" initial={false}>
            {view === 'shelf' && !isMobile ? (
                /* ═══════════════════════ VISTA VHS SHELF (desktop, mismo stage que Home/Películas) ═══════════════════════ */
                <m.div key="shelf" variants={viewSwapVariants} initial="initial" animate="animate" exit="exit" className="relative z-10 w-full">
                <div
                    className={cn("w-full relative z-10 flex flex-col rounded-hero overflow-hidden flex-none", HERO_STAGE_CLASS)}
                >
                    <div
                        ref={setShelfNode}
                        // Sin tarjetas (cargando o vacío) no hay `option` hijos: un listbox vacío
                        // rompe `aria-required-children`, así que el rol solo existe con contenido.
                        // El foco vive en cada lomo (roving tabindex), no en el contenedor.
                        role={hasList ? "listbox" : undefined}
                        aria-orientation={hasList ? "horizontal" : undefined}
                        aria-label={hasList ? "Series" : undefined}
                        className="vhs-shelf w-full h-full flex bg-transparent overflow-x-auto overflow-y-hidden no-scrollbar relative z-10"
                        style={{ scrollSnapType: 'x proximity', scrollPadding: '0 16px', gap: SPINE_SHELF_GAP, padding: SPINE_SHELF_PADDING }}
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
                                // balanced: gradiente sin blur. Color en background-color y forma en la máscara
                                // (el degradado en `background` no se interpola): el color se funde con el del tinte.
                                <div
                                    className="absolute top-1/2 left-0 w-[500px] h-[500px] pointer-events-none z-0"
                                    style={{
                                        opacity: 0.07,
                                        backgroundColor: selectedAccent,
                                        maskImage: 'radial-gradient(circle, black 0%, transparent 60%)',
                                        WebkitMaskImage: 'radial-gradient(circle, black 0%, transparent 60%)',
                                        transform: getGlowTransform(selectedIndex, displayedList.length, 250),
                                        transition: 'transform 700ms cubic-bezier(0.16, 1, 0.3, 1), background-color var(--duration-slow) var(--ease-smooth-out)',
                                    }}
                                />
                            )
                        )}

                        {/* mode="wait": las cintas entran (con su propia cascada) recién cuando el skeleton terminó de irse. */}
                        <AnimatePresence mode="wait" initial={false}>
                        {loadingList ? (
                            <m.div key="skeleton" role="status" aria-busy="true" aria-label="Cargando series" variants={loadSwapVariants} exit="exit" className="w-full h-full flex items-stretch gap-2 relative z-10">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="h-full flex flex-col shrink-0" style={{ flex: `1 0 ${SPINE_COLLAPSED_BASIS}px` }}>
                                        <Skeleton className="flex-1 h-auto rounded-2xl" />
                                    </div>
                                ))}
                            </m.div>
                        ) : !hasList ? (
                            <div key="empty" className="w-full h-full flex items-center justify-center relative z-10 p-6">
                                {emptyLibrary}
                            </div>
                        ) : (
                            <Fragment key="list">
                            {displayedList.map((item, i) => (
                                <SeriesCard
                                    key={item.id}
                                    item={item}
                                    index={i}
                                    total={displayedList.length}
                                    isSelected={item.id === selectedId}
                                    isTabStop={item.id === effectiveSelectedId}
                                    showUnwatchedCount={ts.themeShowAnimeUnwatchedCount}
                                    onNavigate={handleNavigate}
                                    onSelect={handleSelectSeries}
                                    entryDelayMs={!reduceMotion ? Math.min(i, ENTRY_STAGGER_MAX_ITEMS - 1) * ENTRY_STAGGER_MS : 0}
                                    eager={i < SHELF_EAGER_ITEMS}
                                />
                            ))}
                            </Fragment>
                        )}
                        </AnimatePresence>
                    </div>
                    {/* El zócalo oscuro de la base vive ahora en cada lomo colapsado (-SeriesCard): a nivel de
                        shelf tapaba con un degradé gris el botón y el panel de la tarjeta seleccionada. */}
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
                    {/* Flechas: solo si hay lomos fuera de pantalla (con la biblioteca actual caben todos) */}
                    {canScroll.left && (
                        <IconButton
                            intent="glass"
                            size="lg"

                            aria-label="Ver series anteriores"
                            icon={<IconNavigationChevronLeft />}
                            onClick={() => scrollShelf(-1)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 z-30 rounded-full"
                        />
                    )}
                    {canScroll.right && (
                        <IconButton
                            intent="glass"
                            size="lg"

                            aria-label="Ver más series"
                            icon={<IconNavigationChevronRight />}
                            onClick={() => scrollShelf(1)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 z-30 rounded-full"
                        />
                    )}
                </div>
                </m.div>
            ) : view === 'shelf' && isMobile ? (
                /* ═══════════════════════ VISTA ESTANTERÍA MÓVIL (cintas apiladas) ═══════════════════════ */
                <m.div key="spines" variants={viewSwapVariants} initial="initial" animate="animate" exit="exit" className="w-full max-w-2xl mx-auto pt-1 pb-[calc(8rem+env(safe-area-inset-bottom,0px))]">
                    {loadingList ? <SpineListPlaceholder /> : !hasList ? (emptyLibrary) : (
                        <ul aria-label="Series" className="flex flex-col gap-2">
                            {displayedList.map((item, i) => (
                                <SeriesSpineRow
                                    key={item.id}
                                    item={item}
                                    index={i}
                                    watched={item.watched ?? 0}
                                    isOpen={item.id === activeSpineId}
                                    onToggle={handleToggleSpine}
                                    onNavigate={handleNavigate}
                                    onPlay={handlePlayEpisode}
                                />
                            ))}
                        </ul>
                    )}
                </m.div>
            ) : (
                /* ═══════════════════════ VISTA PORTADAS (grid) ═══════════════════════ */
                <m.div key="grid" variants={viewSwapVariants} initial="initial" animate="animate" exit="exit" className="relative z-10 w-full pb-[calc(8rem+env(safe-area-inset-bottom,0px))]">
                    {loadingList ? <PosterGridPlaceholder /> : !hasList ? (
                        <div className="min-h-[50vh] flex items-center justify-center p-2">{emptyLibrary}</div>
                    ) : (
                        <div className={GRID_CLASS}>
                            {displayedList.map((item, i) => (
                                <SeriesPosterGridItem
                                    key={item.id}
                                    item={item}
                                    index={i}
                                    showUnwatchedCount={ts.themeShowAnimeUnwatchedCount}
                                    onNavigate={handleNavigate}
                                />
                            ))}
                        </div>
                    )}
                </m.div>
            )}
            </AnimatePresence>
        </div>
    );
}
