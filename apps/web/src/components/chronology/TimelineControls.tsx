import React from 'react';
import {
  IconNavigationList,
  IconUiBookOpen,
} from '@/components/ui/icons';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
import type { TimelineView } from './data/timelinePrefs';

const VIEW_OPTIONS: ReadonlyArray<SegmentedOption<TimelineView>> = [
  {
    value: 'detailed',
    label: 'Detallada',
    icon: <IconUiBookOpen className="size-4 shrink-0" aria-hidden="true" />,
  },
  {
    value: 'compact',
    label: 'Compacta',
    icon: <IconNavigationList className="size-4 shrink-0" aria-hidden="true" />,
  },
];

interface TimelineControlsProps {
  view: TimelineView;
  onViewChange: (view: TimelineView) => void;
}

/** Selector de vista (Detallada o Compacta) de la línea de tiempo. */
export const TimelineControls: React.FC<TimelineControlsProps> = ({
  view,
  onViewChange,
}) => (
  <div className="relative z-10 flex items-center">
    <SegmentedControl<TimelineView>
      aria-label="Vista de la línea de tiempo"
      layoutId="chrono-view"
      options={VIEW_OPTIONS}
      value={view}
      onChange={onViewChange}
      surface="glass"
      labelStyle="sentence"
      iconOnly
    />
  </div>
);
