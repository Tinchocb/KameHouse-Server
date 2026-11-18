import { IconNavigationLibrary, IconNavigationList } from '@/components/ui/icons';
import { EraRail, type EraRailItem } from '@/components/ui/era-rail';

export type SeriesViewMode = 'cards' | 'shelf';

const SERIES_VIEWS: ReadonlyArray<EraRailItem<SeriesViewMode>> = [
    { id: 'cards', label: 'Tarjetas', kanji: '帯', icon: <IconNavigationList className="size-5" aria-hidden="true" />, accent: 'var(--label-1)', years: 'Tarjetas horizontales' },
    { id: 'shelf', label: 'Estantería', kanji: '棚', icon: <IconNavigationLibrary className="size-5" aria-hidden="true" />, accent: 'var(--label-1)', years: 'Repisa VHS' },
];

/**
 * Selector de vista de Series (Tarjetas / Estantería). Reutiliza el EraRail de la sidebar:
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
