import React, { useState, memo } from 'react';
import type { VolumeData } from './types';
import { MagneticIndicator } from '@/components/ui/kinetics/magnetic-indicator';
import { useReducedMotion } from '@/components/ui/kinetics/hooks';
import { sounds } from './utils/audio';
import { Swords, Sparkles, Users, AlertTriangle, Globe, Clapperboard } from 'lucide-react';
import { SmartLoreText } from '@/components/ui/smart-lore-text';

export type DetailTab = 'conflicto' | 'climax' | 'lore' | 'entrecaps';

const TAB_LABELS: Record<DetailTab, string> = {
  conflicto: 'Conflicto',
  climax: 'Clímax',
  lore: 'Lore',
  entrecaps: 'Entre caps',
};

export interface VolumeDetailsTabsProps {
  volume: VolumeData;
  /** Pestaña activa controlada desde afuera; sin ella el componente maneja su propio estado. */
  activeTab?: DetailTab;
  onTabChange?: (tab: DetailTab) => void;
  layoutIdPrefix?: string;
}

export const VolumeDetailsTabs: React.FC<VolumeDetailsTabsProps> = memo(({
  volume,
  activeTab: controlledTab,
  onTabChange,
  layoutIdPrefix = '',
}) => {
  const reduceMotion = useReducedMotion();
  const [localTab, setLocalTab] = useState<DetailTab>('conflicto');
  const activeTab = controlledTab ?? localTab;
  const setActiveTab = (tab: DetailTab) => {
    setLocalTab(tab);
    onTabChange?.(tab);
  };

  const story = volume.detailedStory;
  const interChapter = volume.interChapter ?? [];
  const tabs: DetailTab[] = interChapter.length > 0
    ? ['conflicto', 'climax', 'lore', 'entrecaps']
    : ['conflicto', 'climax', 'lore'];

  return (
    <div className="flex flex-col gap-3.5 pt-2">
      {/* Segmented controls: Conflicto · Clímax · Lore */}
      <div
        role="tablist"
        aria-label="Detalles narrativos del lapso"
        className="flex w-fit max-w-full items-center gap-1 overflow-x-auto no-scrollbar rounded-full border border-white/20 border-t-white/40 border-b-white/10 bg-zinc-950/40 p-1.5"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                sounds.playSelect();
                setActiveTab(tab);
              }}
              className={`relative min-h-[44px] px-3.5 rounded-full text-xs font-mono uppercase font-bold tracking-wider transition-colors duration-150 cursor-pointer select-none flex items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
                isActive ? 'text-brand-accent' : 'text-on-surface-variant hover:text-on-surface hover:bg-white/10'
              }`}
            >
              <MagneticIndicator
                layoutId={`${layoutIdPrefix}volumeDetailTab-${volume.id}`}
                active={isActive}
                disableAnimation={!!reduceMotion}
                className="bg-brand-accent/20 border border-brand-accent/40"
              />
              <span className="relative z-10 whitespace-nowrap">{TAB_LABELS[tab]}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels: el contenido nuevo entra con un fundido corto en vez de cambiar de golpe */}
      <div key={activeTab} className="animate-fade-in">

        {activeTab === 'conflicto' && (
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 sm:p-4 text-xs leading-relaxed space-y-3">
            <div className="flex items-start gap-2.5">
              <span className="text-brand-accent font-mono font-bold text-2xs shrink-0 uppercase mt-0.5">
                Inicio:
              </span>
              <p className="text-on-surface/85 text-xs sm:text-sm leading-relaxed">
                <SmartLoreText text={story?.prologue || volume.narrative.detonante.description} />
              </p>
            </div>
            <div className="flex items-start gap-2.5 border-t border-white/10 pt-3">
              <span className="text-red-400 font-mono font-bold text-2xs shrink-0 uppercase mt-0.5">
                Quiebre:
              </span>
              <p className="text-on-surface/85 text-xs sm:text-sm leading-relaxed">
                <SmartLoreText text={story?.turningPoint || volume.narrative.climax.description} />
              </p>
            </div>
          </div>
        )}

        {activeTab === 'climax' && (
          <div className="bg-red-950/20 border border-red-500/25 rounded-xl p-3 sm:p-4 text-xs leading-relaxed space-y-3">
            <span className="text-red-400 font-mono font-bold text-xs uppercase block">
              {volume.narrative.climax.title}
            </span>
            <p className="text-on-surface/90 text-xs sm:text-sm leading-relaxed">
              <SmartLoreText text={story?.turningPoint || volume.narrative.climax.description} />
            </p>

            <div className="pt-2 border-t border-red-500/20 flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Swords className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span className="text-red-300 font-mono font-bold uppercase text-2xs">
                  Duelo Decisivo:
                </span>
                <span className="text-white font-medium">
                  <SmartLoreText text={volume.narrative.climax.decisiveBattle} />
                </span>
              </div>

              {(volume.dragonBallsStatus || volume.narrative.climax.forbiddenTechniqueOrCost) && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-amber-300 font-mono font-bold uppercase text-2xs">
                    Esferas del Dragón:
                  </span>
                  <span className="text-on-surface/90">
                    <SmartLoreText text={volume.dragonBallsStatus || volume.narrative.climax.forbiddenTechniqueOrCost} />
                  </span>
                </div>
              )}

              {volume.narrative.climax.iconicMoment && (
                <div className="flex items-center gap-2 flex-wrap text-on-surface/85">
                  <span className="text-red-300 font-mono text-2xs font-semibold">
                    Momento Icónico:
                  </span>
                  <span>
                    <SmartLoreText text={volume.narrative.climax.iconicMoment} />
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'lore' && (
          <div className="bg-purple-950/20 border border-purple-500/25 rounded-xl p-3 sm:p-4 text-xs leading-relaxed space-y-2.5">
            <span className="text-purple-400 font-mono font-bold text-xs uppercase block">
              {volume.narrative.lore.title}
            </span>
            <p className="text-on-surface/90 text-xs sm:text-sm leading-relaxed">
              <SmartLoreText text={volume.narrative.lore.secretSummary} />
            </p>
            {volume.behindTheScenes && volume.behindTheScenes.length > 0 && (
              <div className="pt-2 border-t border-purple-500/20 flex flex-col gap-2">
                <span className="flex items-center gap-1.5 text-purple-300 font-mono font-bold text-2xs uppercase tracking-wider">
                  <Clapperboard className="w-3.5 h-3.5" aria-hidden="true" />
                  Detrás de escena
                </span>
                {volume.behindTheScenes.map((note) => (
                  <div key={note.title}>
                    <span className="block text-xs font-semibold text-white/90">{note.title}</span>
                    <p className="text-xs text-on-surface/85 leading-relaxed">{note.text}</p>
                    <p className="font-mono text-3xs text-on-surface-variant/70">Fuente: {note.source}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="text-2xs text-on-surface/85 pt-2 border-t border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <span>Deidad / Jerarquía: {volume.narrative.lore.deityInvolved}</span>
              {volume.narrative.lore.unrevealedFact && (
                <span className="text-purple-300 font-mono text-2xs">
                  <SmartLoreText text={volume.narrative.lore.unrevealedFact} />
                </span>
              )}
            </div>
          </div>
        )}

        {activeTab === 'entrecaps' && interChapter.length > 0 && (
          <ol className="bg-white/[0.03] border border-white/10 rounded-xl p-3 sm:p-4 text-xs leading-relaxed space-y-3">
            {interChapter.map((entry, idx) => (
              <li key={entry.title} className={idx > 0 ? 'border-t border-white/10 pt-3' : undefined}>
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <span className="font-mono font-bold text-2xs uppercase tracking-wider text-brand-accent">
                    {entry.title}
                  </span>
                  {entry.when && (
                    <span className="font-mono text-3xs text-on-surface-variant tabular-nums">{entry.when}</span>
                  )}
                </div>
                <p className="mt-1 text-on-surface/85 text-xs sm:text-sm leading-relaxed">
                  <SmartLoreText text={entry.summary} />
                </p>
                <p className="mt-1 font-mono text-3xs text-on-surface-variant/70">Fuente: {entry.source}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Narrative Footer: Personajes & Amenaza */}
      <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono text-on-surface-variant">
        <div className="flex flex-col gap-1 min-w-0">
          {volume.characters.length > 0 && (
            <div className="flex items-center gap-1.5 truncate">
              <Users className="w-3.5 h-3.5 text-brand-accent shrink-0" />
              <span className="text-on-surface-variant">Personajes:</span>
              <span className="text-on-surface/90 truncate">{volume.characters.join(', ')}</span>
            </div>
          )}
          {volume.threatLevel && (
            <div className="flex items-center gap-1.5 truncate">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-on-surface-variant">Amenaza:</span>
              <span className="text-on-surface/90 truncate">{volume.threatLevel}</span>
            </div>
          )}
          {volume.narrative.lore.cosmicImpact && (
            <div className="flex items-center gap-1.5 truncate">
              <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-on-surface-variant">Impacto:</span>
              <span className="text-on-surface/90 truncate">{volume.narrative.lore.cosmicImpact}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

VolumeDetailsTabs.displayName = 'VolumeDetailsTabs';
