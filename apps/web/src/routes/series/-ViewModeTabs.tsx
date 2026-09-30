import { IconNavigationLayers, IconStatusImage } from '@/components/ui/icons';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';

export type SeriesViewMode = 'shelf' | 'etapas';

export const SERIES_TABS: ReadonlyArray<SegmentedOption<SeriesViewMode>> = [
    {
        value: 'shelf',
        label: 'Estantería',
        icon: <IconNavigationLayers size={14} className="shrink-0" />,
    },
    {
        value: 'etapas',
        label: 'Portadas',
        icon: <IconStatusImage size={14} className="shrink-0" />,
    },
];

/**
 * Selector de vista de Series. Usa el SegmentedControl canónico (DESIGN-GUIDE §5.3):
 * roving tabindex, pill con layoutId y respeto por reduce-motion y por el nivel de
 * rendimiento del equipo.
 */
export function ViewModeTabs({
    mode,
    onChange,
}: {
    mode: SeriesViewMode;
    onChange: (next: SeriesViewMode) => void;
}) {
    return (
        <SegmentedControl<SeriesViewMode>
            options={SERIES_TABS}
            value={mode}
            onChange={onChange}
            layoutId="activeSeriesTopPill"
            aria-label="Modo de visualización de series"
            semantics="tablist"
            tone="neutral"
            surface="glass"
            fullWidth
            className="relative z-20 p-2 sm:p-2.5"
        />
    );
}
