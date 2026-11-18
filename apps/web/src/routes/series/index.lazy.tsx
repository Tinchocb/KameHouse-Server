import { useScreenEra } from '@/lib/theme/screen-era';
import { themeEraFromEraId, type EraId } from '@/lib/config/eras';
import { PresenceSurface } from "@/components/ui/kinetics/presence-surface"
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import { Fragment, useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { AnimatePresence } from "framer-motion"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { useGetLibraryCollection } from '@/api/hooks/anime_collection.hooks';
import { SeriesCard, getVhsColor, SPINE_EXPANDED_BASIS, SPINE_COLLAPSED_BASIS, SPINE_EXPANDED_GROW, SPINE_SHELF_GAP, SPINE_SHELF_PADDING } from './-SeriesCard';
import { SeriesSpineRow } from './-SeriesSpineRow';
import { getHighResImage, getLowResImage, localImage, prewarmImages } from '@/lib/helpers/images';
import { SPINE_IDLE_ART_URLS } from '@/lib/helpers/goku-panorama';
import { queueIdlePreload } from '@/lib/idle-preload-queue';
import { IconNavigationChevronLeft, IconNavigationChevronRight } from '@/components/ui/icons';
import { loadSwapVariants, useMotionTier, viewSwapVariants } from '@/components/ui/kinetics';
import { getSeriesEraAccent } from '@/lib/helpers/series';
import { Skeleton } from '@/components/ui/skeleton/skeleton';
import { IconButton } from '@/components/ui/button';
import { LibraryEmptyState } from '@/components/shared/library-empty-state';
import { LibraryErrorState } from '@/components/shared/library-error-state';
import { useSound } from '@/hooks/use-sound';
import { useThemeSettings } from '@/lib/theme/theme-hooks';
import { useIsMinimalistMode } from '@/lib/theme/use-classic-mode';
import { useUIStore } from '@/lib/store';
import { cn } from '@/components/ui/core/styling';
import { HERO_AURA_CLASS, HERO_STAGE_CLASS } from '@/lib/config/hero-stage';
import { ViewModeTabs, type SeriesViewMode } from './-ViewModeTabs';
import { AmbientAura } from './-AmbientAura';
import { buildSeriesList, loadSeriesPrefs, saveSeriesPrefs } from './-series-model';
import { useMediaQuery } from '@/hooks/use-media-query';

/** Delay de stagger por card, en ms (tope acotado para fluidez). */
const ENTRY_STAGGER_MS = 40;

// Lomos que entran en pantalla al abrir (escritorio): sus fondos se piden ya.
const SHELF_EAGER_ITEMS = 7;

const ENTRY_STAGGER_MAX_ITEMS = 7;

export const Route = createLazyFileRoute('/series/')({
    component: SeriesFullscreenIndex,
});

/** Misma geometría que las tarjetas horizontales (136px en pantallas grandes, 124px en tablet, 104px en móvil). */
function SpineListPlaceholder() {
    return (
        <div role="status" aria-busy="true" aria-label="Cargando series" className="flex flex-col gap-3.5 sm:gap-4 lg:gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[104px] sm:h-[124px] lg:h-[136px] w-full rounded-2xl" />
            ))}
        </div>
    );
}

function SeriesFullscreenIndex() {
    const navigate = useNavigate();
    const { view: viewParam } = Route.useSearch();
    // Preferencias de este dispositivo (vista y orden). La URL manda si trae `view`.
    const [prefs] = useState(loadSeriesPrefs);
    const view: SeriesViewMode = (viewParam === 'shelf' || viewParam === 'cards' ? viewParam : undefined)
        ?? (prefs.view === 'shelf' || prefs.view === 'cards' ? prefs.view : 'cards');
    const { playSound } = useSound();
    const ts = useThemeSettings();
    const isMinimalist = useIsMinimalistMode();
    const reduceMotion = useReducedMotion();
    // Efectos de brillo cinematográfico solo con tier "full": GPU capaz, sin reduced-motion.
    const allowGlowFx = useMotionTier() === 'full';
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const shelfRef = useRef<HTMLDivElement | null>(null);
    // El shelf se monta y desmonta con AnimatePresence al cambiar de vista: el efecto de anchos
    // necesita el nodo como estado para volver a correr cuando aparece.
    const [shelfEl, setShelfEl] = useState<HTMLDivElement | null>(null);
    const setShelfNode = useCallback((node: HTMLDivElement | null) => {
        shelfRef.current = node;
        setShelfEl(node);
    }, []);
    const isMobile = useMediaQuery('(max-width: 1023px)');

    // Estantería móvil: una sola cinta abierta. Al entrar todas arrancan colapsadas.
    const [openSpineId, setOpenSpineId] = useState<number | null>(null);

    const handlePlayEpisode = useCallback((id: number, episode: number) => {
        navigate({
            to: '/series/$seriesId',
            params: { seriesId: String(id) },
            search: { saga: '', autoplay: String(episode) },
        });
    }, [navigate]);

    const activeSpineId = openSpineId;

    const handleToggleSpine = useCallback((id: number) => {
        setOpenSpineId(id === activeSpineId ? null : id);
        if (id !== activeSpineId) {
            playSound('series', 0.1);
            setSelectedId(id);
        }
    }, [activeSpineId, playSound]);

    const { data: collection, isLoading, isError, error, refetch } = useGetLibraryCollection();

    const handleNavigate = useCallback((id: string) => {
        navigate({ to: '/series/$seriesId', params: { seriesId: id } });
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

    const allSeries = useMemo(() => buildSeriesList(collection), [collection]);
    const displayedList = allSeries;

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
            const expandedBasis = Math.min(SPINE_EXPANDED_BASIS, Math.max(280, el.clientWidth - SPINE_SHELF_PADDING * 2 - 8));
            const free = Math.max(0, availableWidth - (expandedBasis + SPINE_COLLAPSED_BASIS * (shelfCount - 1)));
            const share = free / (shelfCount - 1 + SPINE_EXPANDED_GROW);
            const expW = Math.round(expandedBasis + SPINE_EXPANDED_GROW * share);
            el.style.setProperty('--spine-exp-basis', `${expandedBasis}px`);
            el.style.setProperty('--spine-exp-w', `${expW}px`);
            el.style.setProperty('--spine-exp-width', String(expW));
            el.style.setProperty('--spine-art-height', String(Math.max(1, el.clientHeight - SPINE_SHELF_PADDING * 2 - 144)));
            const colW = hayLomoAbierto
                ? SPINE_COLLAPSED_BASIS + share
                : Math.max(SPINE_COLLAPSED_BASIS, availableWidth / shelfCount);
            el.style.setProperty('--spine-col-basis', `${Math.round(SPINE_COLLAPSED_BASIS)}px`);
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
    const selectedAccent = getSeriesEraAccent(selectedItem?.seriesId, selectedItem ? getVhsColor(selectedItem.id) : undefined);
    const selectedThemeEra = selectedItem?.seriesId ? themeEraFromEraId(selectedItem.seriesId as EraId) : null;
    useScreenEra(selectedThemeEra);

    // Aura ambiental sin flash: arte difuminado ultra-liviano (w185) con crossfade nativo
    const rawAuraSrc = selectedItem?.img || selectedItem?.poster || null;
    const lowAuraSrc = useMemo(() => rawAuraSrc ? localImage(getLowResImage(rawAuraSrc)) : null, [rawAuraSrc]);

    // Precarga en idle del arte panorámico de los lomos solo al entrar en /series.
    useEffect(() => {
        return queueIdlePreload("series:spine-art", () => {
            prewarmImages([...SPINE_IDLE_ART_URLS])
        }, 2)
    }, [])

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

    const isHorizontal = view === 'cards' || (view === 'shelf' && isMobile);

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
                    if (isHorizontal) {
                        setOpenSpineId(target.id);
                    }
                }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [displayedList, selectedId, view, isHorizontal, playSound]);

    // Scroll automático hacia la card seleccionada
    useEffect(() => {
        if (!effectiveSelectedId || isHorizontal) return;
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
    }, [effectiveSelectedId, selectedId, isHorizontal, reduceMotion]);

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
            {!isMinimalist && (
                <div className={cn(HERO_AURA_CLASS, "[contain:paint]")}>
                    <AmbientAura
                        src={lowAuraSrc}
                        accent={selectedItem && !isMinimalist ? selectedAccent : null}
                        seriesKey={selectedItem?.id ?? null}
                        allowGlowFx={allowGlowFx}
                    />
                </div>
            )}

            <h1 className="sr-only">Series</h1>
            {/* Selector de vista (Estantería / Portadas): riel fijo, solo cuando hay series o están cargando. */}
            {(hasList || loadingList) && <ViewModeTabs mode={view} onChange={handleViewChange} />}

            {/* ── Main Content ── */}
            {/* Cambio de vista: el panel saliente se va antes de que entre el nuevo. */}
            <AnimatePresence mode="wait" initial={false}>
            {view === 'shelf' && !isMobile ? (
                /* ═══════════════════════ VISTA VHS SHELF (desktop, mismo stage que Home/Películas) ═══════════════════════ */
                <PresenceSurface key="shelf" variants={viewSwapVariants} initial="initial" animate="animate" exit="exit" className="relative z-10 w-full">
                <div
                    className={cn(
                        "vhs-shelf-stage w-full relative z-10 flex flex-col rounded-hero overflow-hidden flex-none",
                        HERO_STAGE_CLASS
                    )}
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
                        style={{ scrollSnapType: 'x proximity', scrollPadding: '0 0px', gap: SPINE_SHELF_GAP, padding: SPINE_SHELF_PADDING }}
                    >
                        {/* Sin glow interno redundante en el shelf: la atmósfera unificada vive en AmbientAura
                            (evita doble blur y recorte abrupto en los bordes con overflow-hidden). */}

                        {/* El skeleton sale superpuesto: las cintas disponibles entran sin esperar. */}
                        <AnimatePresence initial={false}>
                        {loadingList ? (
                            <PresenceSurface key="skeleton" role="status" aria-busy="true" aria-label="Cargando series" variants={loadSwapVariants} exit="exit" className="absolute inset-0 w-full h-full flex items-stretch gap-2 z-10">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="h-full flex flex-col shrink-0" style={{ flex: `1 0 ${SPINE_COLLAPSED_BASIS}px` }}>
                                        <Skeleton className="flex-1 h-auto rounded-2xl" />
                                    </div>
                                ))}
                            </PresenceSurface>
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
                    {/* Fades laterales del shelf: solo visibles cuando hay contenido desbordado para desplazar */}
                    <div
                        aria-hidden
                        className={cn(
                            "absolute inset-y-0 left-0 w-10 z-20 pointer-events-none transition-opacity duration-base",
                            canScroll.left ? "opacity-100" : "opacity-0"
                        )}
                        style={{ background: 'linear-gradient(to right, color-mix(in srgb, var(--md-sys-color-surface) 65%, transparent), transparent)' }}
                    />
                    <div
                        aria-hidden
                        className={cn(
                            "absolute inset-y-0 right-0 w-10 z-20 pointer-events-none transition-opacity duration-base",
                            canScroll.right ? "opacity-100" : "opacity-0"
                        )}
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
                </PresenceSurface>
            ) : (
                /* ═══════════════════════ VISTA TARJETAS HORIZONTALES (cintas apiladas) ═══════════════════════ */
                <PresenceSurface key="cards" variants={viewSwapVariants} initial="initial" animate="animate" exit="exit" className="w-full max-w-content-desktop mx-auto pt-2 pb-16 px-2 sm:px-4 lg:px-6">
                    {loadingList ? <SpineListPlaceholder /> : !hasList ? (emptyLibrary) : (
                        <ul aria-label="Colección de series" className="flex flex-col gap-3.5 sm:gap-4 lg:gap-5">
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
                </PresenceSurface>
            )}
            </AnimatePresence>
        </div>
    );
}
