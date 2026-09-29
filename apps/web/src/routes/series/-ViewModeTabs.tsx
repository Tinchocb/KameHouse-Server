import { useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { IconNavigationLayers, IconStatusImage } from '@/components/ui/icons';
import { MagneticIndicator } from '@/components/ui/kinetics';
import { cn } from '@/components/ui/core/styling';
import { usePerformanceStore, selectIsHeavyEffectsAllowed } from '@/lib/hardware/performance-store';

export type SeriesViewMode = 'shelf' | 'etapas';

export interface SeriesTabOption {
    id: SeriesViewMode;
    label: string;
    icon: React.ReactNode;
}

export const SERIES_TABS: SeriesTabOption[] = [
    {
        id: 'shelf',
        label: 'Estantería',
        icon: <IconNavigationLayers size={14} className="relative z-10 shrink-0" />,
    },
    {
        id: 'etapas',
        label: 'Portadas',
        icon: <IconStatusImage size={14} className="relative z-10 shrink-0" />,
    },
];

export function ViewModeTabs({
    mode,
    onChange,
}: {
    mode: SeriesViewMode;
    onChange: (next: SeriesViewMode) => void;
}) {
    const reduceMotion = useReducedMotion();
    const isHeavyAllowed = usePerformanceStore(selectIsHeavyEffectsAllowed);
    const allowEraFx = isHeavyAllowed && !reduceMotion;
    const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        let newIndex = index;
        const total = SERIES_TABS.length;
        switch (e.key) {
            case 'ArrowRight':
            case 'ArrowDown':
                e.preventDefault();
                newIndex = (index + 1) % total;
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
                e.preventDefault();
                newIndex = (index - 1 + total) % total;
                break;
            case 'Home':
                e.preventDefault();
                newIndex = 0;
                break;
            case 'End':
                e.preventDefault();
                newIndex = total - 1;
                break;
            default:
                return;
        }
        const target = SERIES_TABS[newIndex];
        if (target) {
            onChange(target.id);
            tabRefs.current[newIndex]?.focus();
        }
    };

    return (
        <div
            role="tablist"
            aria-label="Modo de visualización de series"
            className="glass-frosted-pill relative z-20 flex items-center justify-between gap-2 w-full p-1.5 sm:p-2 overflow-hidden"
        >
            <div className="relative z-10 flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full flex-1">
                {SERIES_TABS.map(({ id, label, icon }, index) => {
                    const isActive = id === mode;
                    return (
                        <button
                            key={id}
                            ref={(el) => { tabRefs.current[index] = el; }}
                            role="tab"
                            aria-selected={isActive}
                            tabIndex={isActive ? 0 : -1}
                            onClick={() => onChange(id)}
                            onKeyDown={(e) => handleKeyDown(e, index)}
                            className={cn(
                                'group relative flex flex-[1_0_auto] items-center justify-center gap-2 px-2.5 sm:px-3 py-1.5 min-h-[44px] rounded-full text-center cursor-pointer select-none transition-[transform,background-color,color,opacity] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent',
                                isActive
                                    ? 'text-zinc-950 font-black'
                                    : 'text-on-surface-variant hover:text-white hover:bg-white/[0.08] hover:scale-[1.01] active:scale-[0.99]',
                            )}
                        >
                            <MagneticIndicator
                                layoutId="activeSeriesTopPill"
                                active={isActive}
                                disableAnimation={!allowEraFx}
                                className="border-t border-t-white"
                                style={{
                                    background: 'rgba(255, 255, 255, 0.95)',
                                    boxShadow: allowEraFx
                                        ? '0 2px 14px rgba(255, 255, 255, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.9)'
                                        : undefined,
                                }}
                            />
                            {icon}
                            <span className={cn(
                                'relative z-10 font-sans font-extrabold text-2xs sm:text-xs tracking-wider uppercase leading-tight whitespace-nowrap transition-colors duration-200',
                                isActive ? 'text-zinc-950 font-black' : 'text-on-surface-variant group-hover:text-white',
                            )}>
                                {label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
