import { memo, useCallback, useState, type CSSProperties } from 'react';
import { useReducedMotion } from 'framer-motion';
import { IconArrowRight, IconUiCheckCircle2 } from '@/components/ui/icons';
import { cn } from '@/components/ui/core/styling';
import { ButtonAnatomy } from '@/components/ui/button';
import { getSpineConfig } from '@/lib/helpers/goku-panorama';
import { getMediumResImage, localImage } from '@/lib/helpers/images';
import { usePrefetchAnimeEntry } from '@/hooks/use-prefetch-anime-entry';
import { DRAGON_BALL_SERIES_INFO, getSeriesEraAccent } from '@/lib/helpers/series';
import { DRAGON_BALL_SAGAS } from '@/lib/config/dragonball_sagas';
import { usePerformanceStore, selectEffectiveTier } from '@/lib/hardware/performance-store';
import { useIsClassicMode } from '@/lib/theme/use-classic-mode';
import { isDataSavingEnabled } from '@/lib/network-preferences';
import type { SeriesItem } from './-series-model';
import './-series-shelf.css';

export type { SeriesItem } from './-series-model';

const VHS_ERA_TOKENS = [
    'var(--era-db-hex)', 'var(--era-dbz-hex)', 'var(--era-dbgt-hex)',
    'var(--era-dbkai-hex)', 'var(--era-dbs-hex)', 'var(--era-daima-hex)',
];

export const getVhsColor = (id: number) => VHS_ERA_TOKENS[id % VHS_ERA_TOKENS.length];

// Compartidas con el cálculo de las capas fijas del estante.
export const SPINE_EXPANDED_BASIS = 480;
export const SPINE_COLLAPSED_BASIS = 160;
export const SPINE_EXPANDED_GROW = 3;
export const SPINE_SHELF_GAP = 8;
export const SPINE_SHELF_PADDING = 8;

// Ancho visible / alto del PNG: ignora los márgenes transparentes de cada pose.
// Permite mostrar el cuerpo completo sin modificar los archivos originales.
const CHARACTER_RATIOS: Record<string, { idle: number; attack: number; idleOffsetX?: number }> = {
    dragon_ball: { idle: 0.7777777778, attack: 0.90, idleOffsetX: 0 },
    dragon_ball_z: { idle: 0.48, attack: 0.63 },
    dragon_ball_gt: { idle: 0.7777777778, attack: 0.63, idleOffsetX: 0 },
    dragon_ball_kai: { idle: 0.48, attack: 0.63 },
    dragon_ball_super: { idle: 0.48, attack: 0.63 },
    dragon_ball_daima: { idle: 0.7777777778, attack: 0.90, idleOffsetX: 0 },
};

// Contorno visible (alfa >= 128): compensa márgenes transparentes sin editar el arte.
const IDLE_ART_FRAMING: Record<string, { height: number; x: number; y: number }> = {
    dragon_ball: { height: 1.005394, x: -2.417062, y: -0.536553 },
    dragon_ball_z: { height: 1.037982, x: 0.582072, y: -1.037684 },
    dragon_ball_gt: { height: 1.066021, x: -0.055928, y: -0.738636 },
    dragon_ball_kai: { height: 1.021753, x: -1.472081, y: -0.876644 },
    dragon_ball_super: { height: 1, x: -0.449871, y: 0 },
    dragon_ball_daima: { height: 1.007869, x: 0.097752, y: 0 },
};

// Ataque: adultos (incluido GT SSJ4) con mayor altura que DB y Daima pequeños.
// Los contornos compensan márgenes; la escala de grupo no depende del ancho de la pose.
const ATTACK_ART_FRAMING: Record<string, { height: number; x: number; y: number }> = {
    dragon_ball: { height: 1.007974, x: 0.117096, y: -0.474684 },
    dragon_ball_z: { height: 1.001383, x: -2.302026, y: 0 },
    dragon_ball_gt: { height: 1, x: 0, y: 0 },
    dragon_ball_kai: { height: 1.013545, x: -0.547046, y: -0.871586 },
    dragon_ball_super: { height: 1.007415, x: -0.120919, y: -0.368034 },
    dragon_ball_daima: { height: 1, x: 0, y: 0 },
};

function getSagaForEpisode(mediaId: number, ep: number): string | null {
    if (ep < 1) return null;
    const raw = mediaId >= 1000000 ? mediaId - 1000000 : mediaId;
    return DRAGON_BALL_SAGAS[raw]?.find(s => ep >= s.startEp && ep <= s.endEp)?.title ?? null;
}

export const SeriesCard = memo(function SeriesCard({
    item,
    isSelected,
    isTabStop = false,
    showUnwatchedCount = true,
    onNavigate,
    onSelect,
    entryDelayMs = 0,
    eager = false,
    index = 0,
    total = 1,
}: {
    item: SeriesItem;
    isSelected: boolean;
    isTabStop?: boolean;
    showUnwatchedCount?: boolean;
    onNavigate: (id: string) => void;
    onSelect: (id: number) => void;
    entryDelayMs?: number;
    eager?: boolean;
    index?: number;
    total?: number;
}) {
    const handlePrefetch = usePrefetchAnimeEntry(item.id);
    const effectiveTier = usePerformanceStore(selectEffectiveTier);
    const reduceMotion = useReducedMotion();
    const isClassic = useIsClassicMode();
    const spineCfg = getSpineConfig(item.seriesId || '', item.id, item.title);
    const canonicalInfo = item.seriesId ? DRAGON_BALL_SERIES_INFO[item.seriesId] : undefined;
    const characterSrc = spineCfg.rawImg;
    const attackSrc = spineCfg.rawImgAtaque;
    const [loadedAttackSrc, setLoadedAttackSrc] = useState<string | null>(null);
    const [requestedAttackSrc, setRequestedAttackSrc] = useState<string | null>(null);
    const loadAttack = isSelected || requestedAttackSrc === attackSrc || loadedAttackSrc === attackSrc;
    // Mantener la pose de reposo si la de combate tarda o no se puede cargar.
    const showAttack = isSelected && Boolean(attackSrc) && loadedAttackSrc === attackSrc;
    const characterRatios = CHARACTER_RATIOS[item.seriesId || ''] ?? { idle: 0.65, attack: 0.65 };
    const idleFraming = IDLE_ART_FRAMING[item.seriesId || ''];
    const attackFraming = ATTACK_ART_FRAMING[item.seriesId || ''];
    const fallbackPoster = canonicalInfo?.poster || canonicalInfo?.banner || '/sagas/original/busqueda-esferas.webp';
    const posterSrc = localImage(getMediumResImage(item.poster || item.img || fallbackPoster));
    const progress = Math.max(0, Math.min(100, item.progress));
    const watchedCount = item.watched ?? Math.round((progress / 100) * (item.eps || 0));
    const unwatchedCount = showUnwatchedCount && item.eps > 0 ? Math.max(0, item.eps - watchedCount) : null;
    const isComplete = progress >= 100;
    const progressLabel = isComplete ? 'Completa' : progress > 0 ? `${watchedCount} de ${item.eps}` : 'Sin comenzar';
    const nextEp = Math.min(item.eps || 1, watchedCount + 1);
    const saga = progress > 0 && !isComplete ? getSagaForEpisode(item.id, nextEp) : null;
    const eraAccent = spineCfg.accent || getSeriesEraAccent(item.seriesId, getVhsColor(item.id));
    const chromeAccent = isClassic ? 'var(--label-1)' : eraAccent;

    const handleActivate = useCallback(() => {
        setRequestedAttackSrc(attackSrc);
        handlePrefetch();
        if (isSelected) onNavigate(item.id.toString());
        else onSelect(item.id);
    }, [attackSrc, handlePrefetch, isSelected, item.id, onNavigate, onSelect]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleActivate();
            return;
        }
        const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (dir !== 0 || e.key === 'Home' || e.key === 'End') {
            e.preventDefault();
            const cards = Array.from(e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
            const idx = cards.indexOf(e.currentTarget as HTMLElement);
            const next = e.key === 'Home' ? cards[0] : e.key === 'End' ? cards[cards.length - 1] : cards[idx + dir];
            if (next && next !== e.currentTarget) {
                next.focus();
                if (next.getAttribute('aria-selected') !== 'true') next.click();
            }
        }
    }, [handleActivate]);

    const handleMouseEnter = useCallback(() => {
        if (window.matchMedia?.('(hover: hover)').matches) {
            if (!isDataSavingEnabled()) setRequestedAttackSrc(attackSrc);
            handlePrefetch();
        }
    }, [attackSrc, handlePrefetch]);

    const handleFocus = useCallback(() => {
        if (!isDataSavingEnabled()) setRequestedAttackSrc(attackSrc);
        handlePrefetch();
    }, [attackSrc, handlePrefetch]);

    return (
        <div
            id={`series-card-${item.id}`}
            role="option"
            tabIndex={isSelected || isTabStop ? 0 : -1}
            aria-selected={isSelected}
            aria-posinset={index + 1}
            aria-setsize={total}
            aria-label={`${item.title}, ${item.year}, ${item.eps} ${item.eps === 1 ? 'episodio' : 'episodios'}, ${progress}% visto. ${isSelected ? 'Pulsa Intro para abrir la serie' : 'Pulsa Intro para seleccionar'}`}
            onMouseEnter={handleMouseEnter}
            onFocus={handleFocus}
            onClick={handleActivate}
            onKeyDown={handleKeyDown}
            className="series-shelf-card relative h-full shrink-0 cursor-pointer select-none overflow-hidden rounded-2xl outline-none animate-slide-up"
            data-still={reduceMotion || effectiveTier === 'low_power' ? 'true' : undefined}
            style={{
                flex: isSelected
                    ? `${SPINE_EXPANDED_GROW} 0 ${SPINE_EXPANDED_BASIS}px`
                    : `1 0 ${SPINE_COLLAPSED_BASIS}px`,
                animationDelay: `${entryDelayMs}ms`,
                '--shelf-accent': chromeAccent,
                '--shelf-progress': progress / 100,
            } as CSSProperties}
        >
            <div aria-hidden className="series-shelf-backdrop absolute inset-0 pointer-events-none" />
            {/* Ambas poses conservan su encuadre; el combate aparece solo al expandir. */}
            {characterSrc ? (
                <>
                    <div
                        aria-hidden
                        className="series-shelf-character pointer-events-none"
                        data-pose="idle"
                        data-visible={!showAttack}
                        style={{
                            '--shelf-character-ratio': characterRatios.idle,
                            '--shelf-character-offset-x': `${characterRatios.idleOffsetX ?? 0}px`,
                        } as CSSProperties}
                    >
                        <img
                            src={characterSrc}
                            style={idleFraming ? {
                                height: String(idleFraming.height * 100) + '%',
                                transform: 'translate(' + idleFraming.x + '%, ' + idleFraming.y + '%)',
                            } : undefined}
                            alt=""
                            draggable={false}
                            loading={eager || isSelected ? 'eager' : 'lazy'}
                            decoding="async"
                            fetchPriority={eager ? 'auto' : 'low'}
                            className="block h-full w-auto max-w-none"
                        />
                    </div>
                    {attackSrc && loadAttack && (
                        <div
                            aria-hidden
                            className="series-shelf-character pointer-events-none"
                            data-pose="attack"
                            data-visible={showAttack}
                            style={{ '--shelf-character-ratio': characterRatios.attack } as CSSProperties}
                        >
                            <img
                                src={attackSrc}
                                style={attackFraming ? {
                                    height: String(attackFraming.height * 100) + '%',
                                    transform: 'translate(' + attackFraming.x + '%, ' + attackFraming.y + '%)',
                                } : undefined}
                                alt=""
                                draggable={false}
                                loading="eager"
                                decoding="async"
                                fetchPriority="low"
                                onLoad={() => setLoadedAttackSrc(attackSrc)}
                                onError={() => setLoadedAttackSrc(null)}
                                className="block h-full w-auto max-w-none"
                            />
                        </div>
                    )}
                </>
            ) : (
                <img
                    src={posterSrc}
                    alt=""
                    aria-hidden
                    draggable={false}
                    loading={eager || isSelected ? 'eager' : 'lazy'}
                    decoding="async"
                    className="series-shelf-poster absolute inset-0 h-full w-full object-cover pointer-events-none"
                />
            )}

            <div aria-hidden={isSelected} className="series-shelf-closed pointer-events-none">
                <div className="absolute inset-x-0 top-0 p-4 space-y-2">
                    <p className="text-xs font-medium tabular-nums text-label-2">{item.year}</p>
                    <span className="series-shelf-era block h-1 w-7 rounded-full" />
                    <h2 className="font-display text-lg font-bold leading-tight text-label-1 line-clamp-2 text-balance">
                        {item.title}
                    </h2>
                </div>
                <div className="series-shelf-footer absolute bottom-0 inset-x-0 px-4 py-4 space-y-2.5">
                    <p className="flex items-center gap-1.5 text-xs font-medium tabular-nums text-label-1">
                        {isComplete && <IconUiCheckCircle2 className="size-3.5 shrink-0" />}
                        <span className="truncate">{progressLabel}</span>
                    </p>
                    <div className="series-shelf-progress h-1 w-full overflow-hidden rounded-full">
                        <span className="block h-full w-full origin-left rounded-full" />
                    </div>
                </div>
            </div>

            {/* Ancho fijo: título y CTA no refluyen durante la apertura del lomo. */}
            <div aria-hidden={!isSelected} className="series-shelf-expanded pointer-events-none">
                <div className={cn(
                    'series-shelf-copy absolute inset-y-0 left-0 flex flex-col justify-center py-8 pl-6 pr-3',
                    !characterSrc && 'series-shelf-copy-fallback',
                )}>
                    <p className="text-xs font-medium tabular-nums text-label-2">
                        {item.year}{item.eps > 0 && ` · ${item.eps} episodios`}
                    </p>
                    <span className="series-shelf-era mt-3 mb-4 block h-1 w-9 rounded-full" />
                    <h2 className="series-shelf-title font-display font-black leading-tight tracking-tight text-label-1 text-balance">
                        {item.title}
                    </h2>
                    {saga && (
                        <p className="mt-3 text-sm leading-snug text-label-2 line-clamp-2">
                            {saga}
                        </p>
                    )}
                    <div className="mt-8 space-y-2">
                        <div className="flex items-center justify-between gap-2 text-xs font-medium tabular-nums text-label-2">
                            <span>{progressLabel}</span>
                            {progress > 0 && <span>{Math.round(progress)}%</span>}
                        </div>
                        <div className="series-shelf-progress h-1.5 w-full overflow-hidden rounded-full">
                            <span className="block h-full w-full origin-left rounded-full" />
                        </div>
                        {!!unwatchedCount && progress > 0 && (
                            <p className="text-xs tabular-nums text-label-2">{unwatchedCount} sin ver</p>
                        )}
                    </div>
                    {/* La option es el único control enfocable. Esta acción abre la ficha. */}
                    <span aria-hidden className={cn(
                        ButtonAnatomy.root({ intent: 'primary', size: 'lg' }),
                        'mt-6 w-full gap-3',
                    )}>
                        Abrir serie
                        <IconArrowRight className="size-4 shrink-0" />
                    </span>
                </div>
            </div>
            <span aria-hidden className="series-shelf-rim absolute inset-0 rounded-[inherit] pointer-events-none" />
        </div>
    );
});
