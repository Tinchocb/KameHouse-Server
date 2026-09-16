import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { usePerformanceStore, selectIsHeavyEffectsAllowed } from '@/lib/hardware/performance-store';

export interface EvolutionItem {
    seriesId: string;
    evolutionImage: string;
    evolutionScale: number;
    evolutionOffsetY: string;
    eraLabel: string;
    eraYear: string;
    accent: string;
    auraColor: string;
}

interface GokuEvolutionBackdropProps {
    items: EvolutionItem[];
    selectedSeriesId: string | undefined;
}

/** Mapa de franjas de era: deriva de tokens CSS existentes, sin colores hardcodeados */
const ERA_STRIPE_VAR: Record<string, string> = {
    dragon_ball:       'var(--spotlight-db-vivid)',
    dragon_ball_z:     'var(--spotlight-dbz-vivid)',
    dragon_ball_gt:    'var(--spotlight-dbgt-vivid)',
    dragon_ball_kai:   'var(--spotlight-dbkai-vivid)',
    dragon_ball_super: 'var(--spotlight-dbs-vivid)',
    dragon_ball_daima: 'var(--spotlight-daima-vivid)',
};

/**
 * GokuEvolutionBackdrop
 *
 * Mural panoramico construido con las tiras de evolucion de cada era.
 * Vive en una zona propia sobre la estanteria; no queda enterrado detras
 * de tarjetas opacas.
 *
 * Se coloca a z-0 dentro del contenedor de la estanteria.
 * No tiene logica de navegacion - solo recibe props.
 */
const GokuEvolutionBackdrop = memo(function GokuEvolutionBackdrop({
    items,
    selectedSeriesId,
}: GokuEvolutionBackdropProps) {
    const reduceMotion = useReducedMotion();
    const isHeavyAllowed = usePerformanceStore(selectIsHeavyEffectsAllowed);
    const allowFx = isHeavyAllowed && !reduceMotion;

    if (items.length === 0) return null;

    return (
        <div
            aria-hidden="true"
            className="relative h-full w-full overflow-hidden pointer-events-none rounded-3xl border border-white/10 bg-surface-container/10"
        >
            <div className="absolute inset-0 flex items-stretch justify-center">
                {items.map((item) => {
                    const isActive = item.seriesId === selectedSeriesId;
                    const stripeColor = ERA_STRIPE_VAR[item.seriesId] ?? item.accent;

                    return (
                        <motion.div
                            key={`char-${item.seriesId}`}
                            className="relative min-w-0 overflow-hidden border-x border-white/[0.06] transition-[flex-grow,filter] duration-500 ease-out"
                            style={{
                                height: '100%',
                                flexBasis: 0,
                                flexGrow: isActive ? 1.42 : 1,
                                filter: isActive ? 'none' : 'saturate(72%) brightness(0.78)',
                            }}
                        >
                            <motion.img
                                src={item.evolutionImage}
                                alt=""
                                loading="eager"
                                decoding="async"
                                initial={false}
                                animate={{
                                    opacity: isActive ? 0.98 : 0.52,
                                    scale: isActive && allowFx ? 1.035 : 1,
                                    y: isActive && allowFx ? -4 : 0,
                                }}
                                transition={
                                    reduceMotion
                                        ? { duration: 0.25, ease: 'easeOut' }
                                        : { type: 'spring', stiffness: 380, damping: 32, mass: 0.8 }
                                }
                                className="absolute inset-0 h-full w-full object-cover object-bottom"
                                style={{
                                    objectPosition: `center calc(100% - ${item.evolutionOffsetY})`,
                                    willChange: allowFx ? 'opacity, transform' : 'auto',
                                    contain: 'paint',
                                }}
                                onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                            />

                            <div
                                className="absolute inset-0 transition-opacity duration-500"
                                style={{
                                    opacity: isActive ? 0.32 : 0.13,
                                    background: `linear-gradient(to bottom, color-mix(in srgb, ${stripeColor} 42%, transparent), transparent 58%)`,
                                    mixBlendMode: 'screen',
                                }}
                            />

                            {isActive && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="absolute inset-0 ring-1 ring-inset ring-white/25"
                                    style={{ boxShadow: `inset 0 0 36px color-mix(in srgb, ${stripeColor} 28%, transparent)` }}
                                />
                            )}
                        </motion.div>
                    );
                })}
            </div>

            {/* Fundido breve: integra el mural con la estanteria sin borrar personajes. */}
            <div
                className="absolute inset-x-0 bottom-0 pointer-events-none"
                style={{
                    height: '20%',
                    background: 'linear-gradient(to top, rgba(5,5,8,0.64) 0%, rgba(5,5,8,0.22) 58%, transparent 100%)',
                }}
            />

            {/* Capa 4: Degradados laterales (funden los bordes) */}
            <div
                className="absolute inset-y-0 left-0 w-16 pointer-events-none"
                style={{ background: 'linear-gradient(to right, rgba(5,5,8,0.55) 0%, transparent 100%)' }}
            />
            <div
                className="absolute inset-y-0 right-0 w-16 pointer-events-none"
                style={{ background: 'linear-gradient(to left, rgba(5,5,8,0.55) 0%, transparent 100%)' }}
            />
        </div>
    );
});

export { GokuEvolutionBackdrop };
