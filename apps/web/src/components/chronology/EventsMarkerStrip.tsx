import React, { useState } from 'react';
import { SagaStartMilestone } from './types';
import { sounds } from './utils/audio';
import { ChevronRight, ChevronLeft, Flag, Zap } from 'lucide-react';

interface EventsMarkerStripProps {
  milestones: SagaStartMilestone[];
  selectedVolumeId: string;
  onSelectMilestone: (milestone: SagaStartMilestone) => void;
  className?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const ERA_BADGE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  'db-clasico': { bg: 'bg-emerald-950/40', text: 'text-emerald-400', border: 'border-emerald-500/40' },
  'db-z': { bg: 'bg-red-950/40', text: 'text-red-400', border: 'border-red-500/40' },
  'db-super': { bg: 'bg-cyan-950/40', text: 'text-cyan-400', border: 'border-cyan-500/40' },
};

export const EventsMarkerStrip: React.FC<EventsMarkerStripProps> = ({
  milestones,
  selectedVolumeId,
  onSelectMilestone,
  className = '',
  isCollapsed: controlledIsCollapsed,
  onToggleCollapse: controlledOnToggleCollapse,
}) => {
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);
  const isCollapsed = controlledIsCollapsed !== undefined ? controlledIsCollapsed : internalIsCollapsed;
  const toggleCollapse = () => {
    sounds.playSelect();
    if (controlledOnToggleCollapse) {
      controlledOnToggleCollapse();
    } else {
      setInternalIsCollapsed((prev) => !prev);
    }
  };

  // Group milestones by Era
  const eraGroups = [
    {
      name: 'Dragon Ball',
      key: 'db-clasico',
      milestones: milestones.filter((m) => m.eraKey === 'db-clasico'),
    },
    {
      name: 'Dragon Ball Z',
      key: 'db-z',
      milestones: milestones.filter((m) => m.eraKey === 'db-z'),
    },
    {
      name: 'Dragon Ball Super',
      key: 'db-super',
      milestones: milestones.filter((m) => m.eraKey === 'db-super'),
    },
  ];

  return (
    <aside
      id="events-marker-strip"
      className={`transition-all duration-300 flex flex-col shrink-0 ${isCollapsed ? 'w-14 sm:w-16' : 'w-64 sm:w-72'} ${className}`}
    >
      <div className="sticky top-24 z-30 bg-surface-container/95 border border-white/10 rounded-2xl p-3 sm:p-4 shadow-elevation-2 flex flex-col gap-3">
        {/* Header with collapse button */}
        <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-brand-accent/20 border border-brand-accent/40 flex items-center justify-center shrink-0">
                <Flag className="w-3.5 h-3.5 text-brand-accent" />
              </div>
              <div>
                <span className="text-3xs font-mono uppercase tracking-widest text-brand-accent font-bold block">
                  EVENTS MARKER
                </span>
                <span className="text-xs font-display text-white tracking-wider block">
                  INICIO DE SAGAS
                </span>
              </div>
            </div>
          )}

          {isCollapsed && (
            <div className="w-full flex justify-center pb-1">
              <Flag className="w-4 h-4 text-brand-accent" />
            </div>
          )}

          <button
            id="btn-toggle-events-strip"
            onClick={toggleCollapse}
            title={isCollapsed ? 'Expandir marcadores' : 'Colapsar tira lateral'}
            className="p-1 rounded-lg bg-surface-container-low border border-white/10 text-on-surface-variant hover:text-white hover:border-white/30 transition-colors"
          >
            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Scrollable list of Saga Start Milestones */}
        <div className="flex flex-col gap-4 max-h-[calc(100vh-180px)] overflow-y-auto pr-1 select-none" style={{ scrollbarWidth: 'thin' }}>
          {eraGroups.map((group) => (
            <div key={group.key} className="flex flex-col gap-1.5">
              {/* Era header badge */}
              {!isCollapsed ? (
                <div className="flex items-center justify-between px-1.5 py-0.5">
                  <span className={`text-4xs font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${ERA_BADGE_STYLE[group.key]?.bg} ${ERA_BADGE_STYLE[group.key]?.text} ${ERA_BADGE_STYLE[group.key]?.border}`}>
                    {group.name}
                  </span>
                  <span className="text-4xs font-mono text-on-surface-variant/50">
                    {group.milestones.length} inicios
                  </span>
                </div>
              ) : (
                <div className="w-full h-px bg-white/10 my-1" />
              )}

              {/* Milestones inside this era */}
              <div className="flex flex-col gap-1 relative pl-1">
                {/* Vertical timeline track line */}
                <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-on-surface/15 -z-0" />

                {group.milestones.map((m) => {
                  const isActive = selectedVolumeId === m.volumeId;

                  return (
                    <button
                      key={m.id}
                      id={`event-marker-${m.id}`}
                      onClick={() => onSelectMilestone(m)}
                      title={`${m.shortTitle} (${m.year} \u00b7 ${m.episodesStart})`}
                      className={`group relative flex items-center gap-2.5 p-1.5 rounded-xl text-left transition-all z-10 border ${
                        isActive
                          ? 'bg-surface-container border-white/40 shadow-elevation-2'
                          : 'bg-surface-container-low/60 border-transparent hover:border-white/15 hover:bg-surface-container-low/80'
                      }`}
                    >
                      {/* Node Indicator with Kanji or Dot */}
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                          isActive
                            ? 'scale-110'
                            : 'opacity-80 group-hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: `${m.colorHex}25`,
                          borderColor: m.colorHex,
                        }}
                      >
                        <span
                          className="font-kanji font-bold text-xs"
                          style={{ color: m.colorHex }}
                        >
                          {m.kanji}
                        </span>
                      </div>

                      {/* Detailed info if not collapsed */}
                      {!isCollapsed && (
                        <div className="flex-1 min-w-0 pr-1">
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`text-2xs font-bold font-sans truncate ${
                                isActive ? 'text-white' : 'text-on-surface group-hover:text-white'
                              }`}
                            >
                              {m.shortTitle}
                            </span>
                            <span
                              className="text-4xs font-mono px-1 rounded shrink-0"
                              style={{
                                color: m.colorHex,
                                backgroundColor: `${m.colorHex}15`,
                              }}
                            >
                              {m.volumeNumber}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-4xs font-mono text-on-surface-variant mt-0.5">
                            <span className="text-on-surface font-semibold">{m.year}</span>
                            <span>•</span>
                            <span className="text-on-surface-variant/70">{m.episodesStart}</span>
                          </div>
                        </div>
                      )}

                      {/* Active indicator dot */}
                      {isActive && (
                        <div
                          className="w-1.5 h-1.5 rounded-full absolute right-1.5 top-1/2 -translate-y-1/2 animate-pulse"
                          style={{ backgroundColor: m.colorHex }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Quick jump hint */}
        {!isCollapsed && (
          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-4xs font-mono text-on-surface-variant/60">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-brand-accent" /> Clic para saltar directo
            </span>
            <span>10 Sagas</span>
          </div>
        )}
      </div>
    </aside>
  );
};