import React, { useState } from 'react';
import type { VolumeData } from './types';
import { IconButton } from '@/components/ui/button';
import { IconUiClose } from '@/components/ui/icons';
import { formatEpisodeRange } from './data/cardModel';
import { ALL_ERAS_HEX, eraTextChannels, hexToRgbChannels } from './utils/eraColor';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SmartLoreText } from '@/components/ui/smart-lore-text';
import { Swords, Sparkles, Users, AlertTriangle, Globe } from 'lucide-react';

export type DetailTab = 'conflicto' | 'climax' | 'lore' | 'entrecaps';

const TAB_LABELS: Record<DetailTab, string> = {
  conflicto: 'Conflicto',
  climax: 'Clímax',
  lore: 'Trasfondo',
  entrecaps: 'Entre episodios',
};

interface ContralateralDetailsCardProps {
  volume: VolumeData;
  onClose: () => void;
  accentHex?: string;
  activeTab?: DetailTab;
  onTabChange?: (tab: DetailTab) => void;
  className?: string;
  layoutIdPrefix?: string;
  /**
   * Va dentro de otra tarjeta glass (acordeón móvil de TimelineVolumeCard): usa una superficie
   * sin blur para no apilar dos capas de backdrop-filter.
   */
  embedded?: boolean;
}

export const ContralateralDetailsCard: React.FC<ContralateralDetailsCardProps> = ({
  volume,
  onClose,
  accentHex = ALL_ERAS_HEX,
  activeTab: controlledTab,
  onTabChange,
  className = '',
  layoutIdPrefix = 'contralateral-',
  embedded = false,
}) => {
  const [localTab, setLocalTab] = useState<DetailTab>('conflicto');
  const activeTab = controlledTab ?? localTab;

  const handleTabSelect = (tab: DetailTab) => {
    setLocalTab(tab);
    onTabChange?.(tab);
  };

  const handleClose = () => {
    onClose();
  };

  const eraRgb = hexToRgbChannels(accentHex);
  const eraTextRgb = eraTextChannels(accentHex);
  const capsFormatted = formatEpisodeRange(volume);
  const story = volume.detailedStory;
  const interChapter = volume.interChapter ?? [];
  const tabs: DetailTab[] = interChapter.length > 0
    ? ['conflicto', 'climax', 'lore', 'entrecaps']
    : ['conflicto', 'climax', 'lore'];
  // Dentro de otra tarjeta glass: superficie opaca sin blur (la de fuera ya desenfoca).
  const surfaceClass = embedded
    ? 'rounded-2xl border border-[var(--neutral-separator)] bg-[var(--neutral-elev-1)]'
    : 'sectionbar';

  return (
    <article
      style={{ '--era': eraRgb, '--era-text': eraTextRgb } as React.CSSProperties}
      className={`${surfaceClass} relative w-full p-4 sm:p-5 flex flex-col gap-3.5 overflow-hidden ${className}`}
    >
      {/* Filete superior con brillo de la era */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-[rgb(var(--era)/0.9)] to-transparent"
      />

      {/* Encabezado: Ficha técnica complementaria (no duplica la tarjeta principal) */}
      <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[rgb(var(--era)/0.12)] border border-[rgb(var(--era)/0.3)] text-3xs font-mono font-bold uppercase tracking-wider text-[rgb(var(--era-text,var(--era)))]">
              <span className="w-1.5 h-1.5 rounded-full bg-[rgb(var(--era))]" />
              <span>{volume.sagaLabel}</span>
              <span className="opacity-60">·</span>
              <span>{volume.volumeNumber}</span>
            </span>
            <span className="text-2xs font-mono tabular-nums text-label-2 font-medium">
              Ep. {capsFormatted}
            </span>
          </div>
          <h4 className="font-display font-bold text-on-surface text-sm sm:text-base leading-snug line-clamp-1 text-balance">
            {volume.title}
          </h4>
        </div>

        <IconButton
          intent="ghost"
          size="sm"
          onClick={handleClose}
          aria-label={`Cerrar detalles de ${volume.title}`}
          icon={<IconUiClose className="w-4 h-4 text-on-surface-variant hover:text-on-surface" />}
          className="shrink-0 -mt-0.5 -mr-1"
        />
      </div>

      {/* Estado del Universo: métricas sintetizadas con iconos semánticos */}
      {(volume.dragonBallsStatus || volume.threatLevel || volume.narrative.lore.cosmicImpact) && (
        <div className="flex flex-wrap items-center gap-1.5 py-0.5">
          {volume.dragonBallsStatus && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-2xs">
              <Sparkles className="w-3 h-3 text-status-warning shrink-0" />
              <span className="text-label-2 font-medium">Esferas:</span>
              <span className="text-on-surface font-semibold">{volume.dragonBallsStatus}</span>
            </div>
          )}
          {volume.threatLevel && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-2xs">
              <AlertTriangle className="w-3 h-3 text-status-warning shrink-0" />
              <span className="text-label-2 font-medium">Amenaza:</span>
              <span className="text-on-surface font-semibold">{volume.threatLevel}</span>
            </div>
          )}
          {volume.narrative.lore.cosmicImpact && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-2xs">
              <Globe className="w-3 h-3 text-brand-accent-readable shrink-0" />
              <span className="text-label-2 font-medium">Impacto:</span>
              <span className="text-on-surface font-semibold truncate max-w-[180px]">
                {volume.narrative.lore.cosmicImpact}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tabs esenciales: SegmentedControl en semantics tablist (roving tabindex, flechas, Home/End) sobre superficie inset */}
      <SegmentedControl<DetailTab>
        aria-label={`Detalles de ${volume.title}`}
        layoutId={`${layoutIdPrefix}tab-${volume.id}`}
        semantics="tablist"
        surface="inset"
        tone="accent"
        labelStyle="sentence"
        className="max-w-full overflow-x-auto no-scrollbar"
        options={tabs.map((tab) => ({ value: tab, label: TAB_LABELS[tab] }))}
        value={activeTab}
        onChange={handleTabSelect}
      />

      {/* Contenido según pestaña */}
      <div key={activeTab} className="animate-fade-in text-xs leading-relaxed space-y-3 pt-1">
        {/* 1. CONFLICTO */}
        {activeTab === 'conflicto' && (
          <div className="space-y-3">
            <div className="surface-content surface-content-row border border-white/10 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-start gap-2">
                <span className="text-3xs font-mono font-bold uppercase tracking-wider text-brand-accent-readable shrink-0 mt-0.5">
                  Inicio:
                </span>
                <p className="text-on-surface text-xs leading-relaxed text-pretty">
                  <SmartLoreText
                    text={story?.prologue || volume.previouslyOn || volume.narrative.detonante.description}
                  />
                </p>
              </div>
              <div className="flex items-start gap-2 border-t border-white/10 pt-2.5">
                <span className="text-3xs font-mono font-bold uppercase tracking-wider text-status-error shrink-0 mt-0.5">
                  Quiebre:
                </span>
                <p className="text-on-surface text-xs leading-relaxed text-pretty">
                  <SmartLoreText
                    text={story?.turningPoint || volume.narrative.climax.description}
                  />
                </p>
              </div>
            </div>

            {/* Hitos Decisivos breves */}
            {volume.keyFacts && volume.keyFacts.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-3xs font-mono uppercase tracking-wider text-label-2 font-bold block">
                  Hitos Clave
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {volume.keyFacts.map((fact) => (
                    <div
                      key={fact.label}
                      className="p-2.5 rounded-lg surface-content surface-content-row border border-white/10 flex flex-col gap-0.5"
                    >
                      <span className="text-3xs font-mono font-bold uppercase tracking-wider text-[rgb(var(--era-text,var(--era)))]">
                        {fact.label}
                      </span>
                      <p className="text-2xs text-on-surface leading-snug">
                        {fact.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Personajes */}
            {volume.characters.length > 0 && (
              <div className="flex items-center gap-1.5 pt-1 text-2xs text-label-2">
                <Users className="w-3.5 h-3.5 text-brand-accent-readable shrink-0" />
                <span className="font-semibold text-label-2">Personajes:</span>
                <span className="text-on-surface truncate">{volume.characters.join(', ')}</span>
              </div>
            )}
          </div>
        )}

        {/* 2. CLÍMAX */}
        {activeTab === 'climax' && (
          <div className="bg-status-error/10 border border-status-error/25 rounded-xl p-3.5 space-y-2.5">
            <span className="text-status-error font-display font-bold text-xs uppercase tracking-wider block">
              {volume.narrative.climax.title}
            </span>
            <p className="text-on-surface text-xs leading-relaxed text-pretty">
              <SmartLoreText text={story?.turningPoint || volume.narrative.climax.description} />
            </p>

            <div className="pt-2.5 border-t border-status-error/20 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Swords className="w-3 h-3 text-status-error shrink-0" />
                <span className="text-status-error font-semibold text-2xs">Duelo:</span>
                <span className="text-on-surface font-medium text-2xs">
                  <SmartLoreText text={volume.narrative.climax.decisiveBattle} />
                </span>
              </div>
              {volume.narrative.climax.iconicMoment && (
                <div className="flex items-center gap-1.5 flex-wrap text-2xs">
                  <Sparkles className="w-3 h-3 text-status-warning shrink-0" />
                  <span className="text-status-error font-semibold">Momento:</span>
                  <span className="text-on-surface">
                    <SmartLoreText text={volume.narrative.climax.iconicMoment} />
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. LORE */}
        {activeTab === 'lore' && (
          <div className="bg-[rgb(var(--era)/0.1)] border border-[rgb(var(--era)/0.25)] rounded-xl p-3.5 space-y-2.5">
            <span className="text-[rgb(var(--era-text,var(--era)))] font-display font-bold text-xs uppercase tracking-wider block">
              {volume.narrative.lore.title}
            </span>
            <p className="text-on-surface text-xs leading-relaxed text-pretty">
              <SmartLoreText text={volume.narrative.lore.secretSummary} />
            </p>
            <div className="pt-2 border-t border-[rgb(var(--era)/0.2)] flex flex-col gap-1.5 text-2xs">
              {volume.narrative.lore.deityInvolved && (
                <div className="flex items-center gap-1.5 text-label-2">
                  <span className="font-semibold text-[rgb(var(--era-text,var(--era)))] shrink-0">Deidad:</span>
                  <span className="text-on-surface">{volume.narrative.lore.deityInvolved}</span>
                </div>
              )}
              {volume.narrative.lore.unrevealedFact && (
                <div className="flex items-start gap-1.5 text-label-2">
                  <span className="font-semibold text-[rgb(var(--era-text,var(--era)))] shrink-0">Revelación:</span>
                  <span className="text-on-surface leading-snug">
                    <SmartLoreText text={volume.narrative.lore.unrevealedFact} />
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. ENTRE EPISODIOS */}
        {activeTab === 'entrecaps' && interChapter.length > 0 && (
          <ol className="surface-content surface-content-row border border-white/10 rounded-xl p-3.5 space-y-2.5">
            {interChapter.map((entry, idx) => (
              <li key={entry.title} className={idx > 0 ? 'border-t border-white/10 pt-2.5' : undefined}>
                <div className="flex items-baseline justify-between gap-1.5 flex-wrap">
                  <span className="font-semibold text-xs text-brand-accent-readable">
                    {entry.title}
                  </span>
                  {entry.when && (
                    <span className="text-2xs text-label-2 tabular-nums">{entry.when}</span>
                  )}
                </div>
                <p className="mt-1 text-on-surface text-xs leading-relaxed text-pretty">
                  <SmartLoreText text={entry.summary} />
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </article>
  );
};
