import { memo, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { usePerformanceStore, selectIsHeavyEffectsAllowed } from '@/lib/hardware/performance-store';

export interface TimelineItem {
    seriesId: string;
    eraLabel: string;
    eraYear: string;
    accent: string;
}

interface EraTimelineProps {
    items: TimelineItem[];
    selectedSeriesId: string | undefined;
    onSelect: (seriesId: string) => void;
}

/**
 * EraTimeline
 *
 * Barra horizontal minimalista debajo del VHS shelf que muestra
 * la cronologia de eras de Dragon Ball.
 *
 *   1986   1989   1996   2009   2015   2024
 *    DB      Z      GT    KAI   SUPER  DAIMA
 *
 * El punto activo tiene glow del color de era y un indicador
 * animado con layoutId (paridad con SpotlightEraNav).
 * Solo se muestra en desktop/laptop (!isMobile se controla en el padre).
 */
const EraTimeline = memo(function EraTimeline({
    items,
    selectedSeriesId,
    onSelect,
}: EraTimelineProps) {
    const reduceMotion = useReducedMotion();
    const isHeavyAllowed = usePerformanceStore(selectIsHeavyEffectsAllowed);
    const allowFx = isHeavyAllowed && !reduceMotion;

    const handleKey = useCallback((e: React.KeyboardEvent<HTMLButtonElement>, seriesId: string) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(seriesId);
        }
    }, [onSelect]);

    if (items.length === 0) return null;

    return (
        <div
            role="tablist"
            aria-label="Linea temporal de eras Dragon Ball"
            className="w-full h-12 flex items-center justify-center gap-0 px-4 sm:px-6 lg:px-8 shrink-0"
        >
            {items.map((item, idx) => {
                const isActive = item.seriesId === selectedSeriesId;
                const isLast = idx === items.length - 1;

                return (
                    <div key={item.seriesId} className="flex items-center flex-1 min-w-0">
                        {/* Punto + etiqueta */}
                        <div className="flex items-center justify-center gap-1.5 flex-1 min-w-0">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                aria-label={`Seleccionar ${item.eraLabel} (${item.eraYear})`}
                                onClick={() => onSelect(item.seriesId)}
                                onKeyDown={(e) => handleKey(e, item.seriesId)}
                                className="relative flex items-center justify-center rounded-full transition-transform duration-200 hover:scale-110 active:scale-95 cursor-pointer"
                                style={{
                                    width: 44,
                                    height: 44,
                                }}
                            >
                                {/* Indicador animado (paridad con SpotlightEraNav) */}
                                {isActive && (
                                    allowFx ? (
                                        <motion.div
                                            layoutId="eraTimelineIndicator"
                                            className="absolute inset-0 rounded-full pointer-events-none"
                                            style={{
                                                background: `color-mix(in srgb, ${item.accent} 18%, transparent)`,
                                                boxShadow: `0 0 12px color-mix(in srgb, ${item.accent} 55%, transparent)`,
                                            }}
                                            transition={{ type: 'spring', stiffness: 480, damping: 34 }}
                                        />
                                    ) : (
                                        <div
                                            className="absolute inset-0 rounded-full pointer-events-none"
                                            style={{
                                                background: `color-mix(in srgb, ${item.accent} 18%, transparent)`,
                                            }}
                                        />
                                    )
                                )}

                                {/* Punto central */}
                                <div
                                    className="relative z-10 rounded-full transition-all duration-300"
                                    style={{
                                        width: isActive ? 10 : 6,
                                        height: isActive ? 10 : 6,
                                        background: isActive
                                            ? item.accent
                                            : 'rgba(255,255,255,0.25)',
                                        boxShadow: isActive
                                            ? `0 0 10px color-mix(in srgb, ${item.accent} 80%, transparent), 0 0 4px color-mix(in srgb, ${item.accent} 60%, transparent)`
                                            : 'none',
                                        flexShrink: 0,
                                    }}
                                />
                            </button>

                            {/* Etiqueta de anio y era */}
                            <div className="flex items-baseline gap-1.5 pointer-events-none select-none min-w-0">
                                <span
                                    className="font-mono text-[9px] font-bold tracking-wider transition-colors duration-300 leading-none"
                                    style={{ color: isActive ? item.accent : 'rgba(255,255,255,0.35)' }}
                                >
                                    {item.eraYear}
                                </span>
                                <span
                                    className="font-mono text-[9px] font-black uppercase tracking-widest transition-colors duration-300 leading-none truncate"
                                    style={{ color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.20)' }}
                                >
                                    {item.eraLabel}
                                </span>
                            </div>
                        </div>

                        {/* Linea conectora entre puntos */}
                        {!isLast && (
                            <div
                                className="h-px flex-1 max-w-[40px] mx-1 transition-opacity duration-300"
                                style={{ background: 'rgba(255,255,255,0.10)' }}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
});

export { EraTimeline };
