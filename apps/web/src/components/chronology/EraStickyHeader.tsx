import React from 'react';
import { MasterEraInfo, SagaStartMilestone } from './types';
import { Clock } from 'lucide-react';
import { sounds } from './utils/audio';

interface EraStickyHeaderProps {
  era: MasterEraInfo;
  volumeCount: number;
  sagas: SagaStartMilestone[];
  selectedVolumeId: string;
  onJumpToSaga: (volumeId: string) => void;
}

export const EraStickyHeader: React.FC<EraStickyHeaderProps> = ({
  era,
  volumeCount,
  sagas,
  selectedVolumeId,
  onJumpToSaga,
}) => {
  const style = { '--era-accent': era.themeColorHex } as React.CSSProperties;

  return (
    <div id={`era-header-${era.key}`} className="sticky top-20 sm:top-24 z-20 w-full mb-6 transition-all duration-300 pointer-events-auto" style={style}>
      <div className="w-full rounded-2xl border border-brand-accent/30 p-3.5 sm:p-4.5 shadow-2xl relative overflow-hidden bg-gradient-to-r from-brand-accent/10 via-transparent to-transparent">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full blur-xl opacity-20 pointer-events-none transform-gpu" style={{ backgroundColor: 'var(--era-accent)' }} />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border shadow-elevation-2" style={{ backgroundColor: 'color-mix(in srgb, var(--era-accent) 13%, transparent)', borderColor: 'color-mix(in srgb, var(--era-accent) 38%, transparent)' }}>
              <div className="flex items-center gap-0.5">
                {era.kanjiEmblems.slice(0, 2).map((k, idx) => (
                  <span key={idx} className="font-kanji font-black text-base" style={{ color: 'var(--era-accent)' }}>{k}</span>
                ))}
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-3xs font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border font-bold" style={{ color: 'var(--era-accent)', borderColor: 'color-mix(in srgb, var(--era-accent) 31%, transparent)', backgroundColor: 'color-mix(in srgb, var(--era-accent) 8%, transparent)' }}>
                  ERA FIJADA EN VISTA
                </span>
                <span className="text-xs font-mono text-on-surface-variant/80 flex items-center gap-1"><Clock className="w-3 h-3 text-on-surface-variant/60" /> {era.years}</span>
                <span className="text-2xs font-mono text-on-surface-variant/70 hidden sm:inline">\u00b7 {era.volumeRangeText} ({volumeCount} Tomos) \u00b7 {era.canonEpisodesText}</span>
              </div>

              <h2 className="font-display text-2xl sm:text-3xl tracking-wider text-white flex items-center gap-2 mt-0.5">
                {era.title}
                <span className="text-xs font-sans font-normal text-on-surface-variant/70 hidden md:inline">\u2014 {era.tagline}</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-3xs font-mono text-on-surface-variant/60 uppercase tracking-wider mr-1 hidden xl:inline">Sagas:</span>
            {sagas.map((s) => {
              const isSelected = selectedVolumeId === s.volumeId;
              return (
                <button key={s.id} id={`era-saga-pill-${s.id}`} onClick={() => { sounds.playSelect(); onJumpToSaga(s.volumeId); }} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-all border ${isSelected ? 'bg-brand-accent text-on-primary font-bold shadow-md scale-105' : 'bg-surface-container-low/80 text-on-surface-variant border-white/10 hover:border-white/30 hover:text-white'}`} style={{ borderColor: isSelected ? 'var(--era-accent)' : undefined }} title={`Saltar a ${s.sagaName} (${s.episodesStart})`}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.colorHex }} />
                  <span className="truncate max-w-[120px]">{s.shortTitle}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};