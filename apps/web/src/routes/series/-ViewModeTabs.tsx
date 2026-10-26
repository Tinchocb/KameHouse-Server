import { IconNavigationLibrary, IconStatusImage } from '@/components/ui/icons';
import { EraRail, type EraRailItem } from '@/components/ui/era-rail';

export type SeriesViewMode = 'shelf' | 'etapas';

const SERIES_VIEWS: ReadonlyArray<EraRailItem<SeriesViewMode>> = [
    { id: 'shelf', label: 'Estantería', kanji: '棚', icon: <IconNavigationLibrary className="size-5" aria-hidden="true" />, accent: 'var(--label-1)', years: 'Series por estante' },
    { id: 'etapas', label: 'Portadas', kanji: '絵', icon: <IconStatusImage className="size-5" aria-hidden="true" />, accent: 'var(--label-1)', years: 'Series por portada' },
];

/**
 * Selector de vista de Series (Estantería / Portadas). Reutiliza el EraRail de la sidebar de eras:
 * riel vertical en escritorio, barra compacta en móvil y tableta.
 */
export function ViewModeTabs({
    mode,
    onChange,
}: {
    mode: SeriesViewMode;
    onChange: (next: SeriesViewMode) => void;
}) {
    return <EraRail eras={SERIES_VIEWS} activeId={mode} onSelect={onChange} label="Vista de series" />;
}
