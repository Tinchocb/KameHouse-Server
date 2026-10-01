import React, { useEffect, useState, useCallback, memo } from 'react';
import { m } from 'framer-motion';
import type { EraGroup } from './data/spansToVolumes';
import { AnimatedTooltip } from '@/components/ui/kinetics/animated-tooltip';
import { sounds } from './utils/audio';
import { useReducedMotion } from '@/components/ui/kinetics/hooks';
import { cn } from '@/components/ui/core/styling';

export interface TimelineScrubberNavProps {
  eraGroups: EraGroup[];
  className?: string;
}

export const TimelineScrubberNav: React.FC<TimelineScrubberNavProps> = memo(({
  eraGroups,
  className,
}) => {
  const reduceMotion = useReducedMotion();
  const [activeEraId, setActiveEraId] = useState<string>(() => eraGroups[0]?.seriesId ?? '');
  const [isHovered, setIsHovered] = useState(false);

  // Scroll-spy con IntersectionObserver sobre las secciones de cada era
  useEffect(() => {
    if (typeof window === 'undefined' || eraGroups.length === 0) return;

    const observerMap = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const eraId = entry.target.id.replace('era-section-', '');
          if (entry.isIntersecting) {
            observerMap.set(eraId, entry.intersectionRatio);
          } else {
            observerMap.delete(eraId);
          }
        });

        // La era con mayor porcentaje de visibilidad se considera la activa
        let bestId = '';
        let maxRatio = -1;
        observerMap.forEach((ratio, id) => {
          if (ratio > maxRatio) {
            maxRatio = ratio;
            bestId = id;
          }
        });

        if (bestId) {
          setActiveEraId(bestId);
        }
      },
      {
        rootMargin: '-20% 0px -50% 0px',
        threshold: [0.1, 0.3, 0.6],
      }
    );

    eraGroups.forEach((group) => {
      const el = document.getElementById(`era-section-${group.seriesId}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [eraGroups]);

  const handleScrollToEra = useCallback((seriesId: string) => {
    sounds.playSelect();
    const el = document.getElementById(`era-section-${seriesId}`);
    if (el) {
      el.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    }
  }, [reduceMotion]);

  if (eraGroups.length <= 1) return null;

  return (
    <aside
      aria-label="Minimapa de eras de la cronología"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'hidden lg:flex fixed right-3 xl:right-4 top-1/2 -translate-y-1/2 z-30 flex-col items-center gap-3 py-3 px-1.5 rounded-full',
        'glass-frosted border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.2)] backdrop-blur-overlay-md select-none',
        'transition-opacity duration-300 ease-smooth-out',
        isHovered ? 'opacity-100' : 'opacity-70 hover:opacity-100',
        className
      )}
    >
      {/* Guía central vertical conectando los nodos */}
      <div
        aria-hidden="true"
        className="absolute inset-y-4 left-1/2 -translate-x-1/2 w-0.5 bg-white/10 rounded-full -z-10"
      />

      {eraGroups.map((group) => {
        const isActive = activeEraId === group.seriesId;
        const totalVolumes = group.sagas.reduce((acc, saga) => acc + saga.volumes.length, 0);

        return (
          <AnimatedTooltip
            key={group.seriesId}
            content={
              <div className="flex flex-col gap-0.5 text-left py-0.5">
                <span className="font-display font-bold text-xs uppercase tracking-wider text-white">
                  {group.seriesTag}
                </span>
                <span className="font-mono text-3xs text-on-surface-variant font-medium">
                  {group.yearsLabel} · {totalVolumes} {totalVolumes === 1 ? 'lapso' : 'lapsos'}
                </span>
              </div>
            }
            side="left"
          >
            <button
              type="button"
              onClick={() => handleScrollToEra(group.seriesId)}
              aria-label={`Saltar a ${group.seriesTag} (${group.yearsLabel})`}
              aria-current={isActive ? 'true' : undefined}
              className="group relative flex items-center justify-center p-1.5 rounded-full transition-transform duration-fast ease-out-strong active:scale-90 cursor-pointer"
            >
              {/* Anillo de pulso cuando está activo */}
              {isActive && (
                <m.span
                  layoutId="activeEraScrubberRing"
                  className="absolute inset-0 rounded-full border-2 border-white/80 shadow-[0_0_12px_rgba(255,255,255,0.4)]"
                  transition={{ type: 'spring', stiffness: 480, damping: 34 }}
                />
              )}

              {/* Punto indicador con el color de la era */}
              <span
                style={{
                  backgroundColor: group.accentHex,
                  boxShadow: isActive
                    ? `0 0 14px ${group.accentHex}, inset 0 1px 1px rgba(255,255,255,0.6)`
                    : `0 0 6px ${group.accentHex}40`,
                }}
                className={cn(
                  'rounded-full transition-all duration-fast ease-out-strong shrink-0',
                  isActive
                    ? 'w-3.5 h-3.5 scale-110'
                    : 'w-2.5 h-2.5 opacity-60 group-hover:opacity-100 group-hover:scale-125'
                )}
              />
            </button>
          </AnimatedTooltip>
        );
      })}
    </aside>
  );
});

TimelineScrubberNav.displayName = 'TimelineScrubberNav';
