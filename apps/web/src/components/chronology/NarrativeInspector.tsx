import React, { useState } from 'react';
import { VolumeData } from './types';
import {
  Zap,
  Swords,
  Compass,
  RotateCw,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Clock,
  Quote,
  Sparkles
} from 'lucide-react';
import { sounds } from './utils/audio';

interface NarrativeInspectorProps {
  volume: VolumeData;
  isPosterFlipped: boolean;
  onToggleFlip: () => void;
  onPrevVolume: () => void;
  onNextVolume: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export const NarrativeInspector: React.FC<NarrativeInspectorProps> = ({
  volume,
  isPosterFlipped,
  onToggleFlip,
  onPrevVolume,
  onNextVolume,
  hasPrev,
  hasNext,
}) => {
  // Active reading level: 1 = Detonante, 2 = Clímax, 3 = Lore, 4 = Contexto & Catch-Up
  const [activeLevel, setActiveLevel] = useState<1 | 2 | 3 | 4>(1);
  const { narrative, coverArt } = volume;
  const eraColor = coverArt.accentHex;

  const handleLevelChange = (lvl: 1 | 2 | 3 | 4) => {
    setActiveLevel(lvl);
    sounds.playSelect();
    if (lvl === 3 && !isPosterFlipped) {
      // automatically flip to back if inspecting level 3
      sounds.playLoreReveal();
      onToggleFlip();
    } else if (lvl !== 3 && isPosterFlipped) {
      // flip back to front if switching away from level 3
      sounds.playFlip();
      onToggleFlip();
    }
  };

  return (
    <div id="narrative-inspector-panel" className="flex-1 bg-surface-container/90 border border-white/10 rounded-2xl p-5 md:p-6 flex flex-col justify-between shadow-elevation-3 relative overflow-hidden" style={{ '--poster-accent': eraColor } as React.CSSProperties}>
      {/* Subtle Saga Background Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-xl opacity-20 pointer-events-none -z-10 transform-gpu" style={{ background: 'var(--poster-accent)' }} />

      {/* Top Header & Volume Breadcrumb */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold tracking-wider uppercase border shadow-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--poster-accent) 13%, transparent)', borderColor: 'color-mix(in srgb, var(--poster-accent) 38%, transparent)', color: 'var(--poster-accent)' }}>
              {volume.volumeNumber}
            </span>
            <span className="text-xs font-mono text-on-surface-variant/80"> {volume.episodesRange} ({volume.episodesCount} Caps) </span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-surface-container-low text-brand-accent border border-brand-accent/30 flex items-center gap-1"> <Clock className="w-3 h-3 text-brand-accent" /> {volume.officialYear} </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button id="btn-nav-prev-volume" onClick={() => { sounds.playSelect(); onPrevVolume(); }} disabled={!hasPrev} aria-label="Tomo anterior" className={`min-h-[44px] p-1.5 rounded-lg border text-xs font-mono flex items-center gap-1 transition ${ hasPrev ? 'border-white/10 bg-surface-container-low text-on-surface hover:bg-surface-container-high hover:text-white' : 'border-on-surface/15 bg-surface-container-lowest text-on-surface-variant/40 cursor-not-allowed' }`} title="Tomo Anterior"> <ChevronLeft className="w-4 h-4" /> <span className="hidden sm:inline">Anterior</span> </button>
            <button id="btn-nav-next-volume" onClick={() => { sounds.playSelect(); onNextVolume(); }} disabled={!hasNext} aria-label="Tomo siguiente" className={`min-h-[44px] p-1.5 rounded-lg border text-xs font-mono flex items-center gap-1 transition ${ hasNext ? 'border-white/10 bg-surface-container-low text-on-surface hover:bg-surface-container-high hover:text-white' : 'border-on-surface/15 bg-surface-container-lowest text-on-surface-variant/40 cursor-not-allowed' }`} title="Siguiente Tomo"> <span className="hidden sm:inline">Siguiente</span> <ChevronRight className="w-4 h-4" /> </button>
          </div>
        </div>

        {/* Volume Title & Subtitle Banner */}
        <div className="mt-4">
          <div className="flex items-baseline gap-3">
            <h1 className="font-display text-3xl sm:text-4xl tracking-wide text-white leading-none"> {volume.title} </h1>
            <span className="text-sm font-kanji font-bold text-on-surface-variant/80"> {coverArt.kanjiTitle} </span>
          </div>
          <p className="text-sm text-brand-accent/90 font-serif mt-1 tracking-wide"> {volume.subtitle} </p>
        </div>

        {/* THREE-LEVEL NARRATIVE SELECTOR TABS */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xs font-mono uppercase tracking-widest text-on-surface-variant/60"> Estructura Narrativa en Tres Niveles de Lectura: </span>
            <button id="btn-flip-inspector" onClick={() => { sounds.playFlip(); onToggleFlip(); }} className="text-xs font-mono text-brand-accent hover:text-brand-secondary flex items-center gap-1.5 underline decoration-brand-accent/40"> <RotateCw className="w-3.5 h-3.5" /> <span>{isPosterFlipped ? 'Ver Anverso (Portada)' : 'Girar al Dorso (Lore)'}</span> </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1 bg-surface-container-low/40 rounded-xl border border-white/10">
            <button id="tab-level-detonante" onClick={() => handleLevelChange(1)} className={`flex items-center justify-center gap-2 py-2 px-2 sm:px-3 rounded-lg text-xs font-mono font-semibold transition ${ activeLevel === 1 ? 'bg-brand-accent/20 text-brand-accent border border-brand-accent/50 shadow-sm' : 'text-on-surface-variant hover:text-white hover:bg-surface-container-low/40' }`}> <Zap className={`w-3.5 h-3.5 ${activeLevel === 1 ? 'text-brand-accent' : 'text-on-surface-variant/50'}`} /> <span className="truncate">1. Detonante</span> </button>
            <button id="tab-level-climax" onClick={() => handleLevelChange(2)} className={`flex items-center justify-center gap-2 py-2 px-2 sm:px-3 rounded-lg text-xs font-mono font-semibold transition ${ activeLevel === 2 ? 'bg-status-error/20 text-status-error border border-status-error/50 shadow-sm' : 'text-on-surface-variant hover:text-white hover:bg-surface-container-low/40' }`}> <Swords className={`w-3.5 h-3.5 ${activeLevel === 2 ? 'text-status-error' : 'text-on-surface-variant/50'}`} /> <span className="truncate">2. Clímax</span> </button>
            <button id="tab-level-lore" onClick={() => handleLevelChange(3)} className={`flex items-center justify-center gap-2 py-2 px-2 sm:px-3 rounded-lg text-xs font-mono font-semibold transition ${ activeLevel === 3 ? 'bg-brand-secondary/20 text-brand-secondary border border-brand-secondary/50 shadow-sm' : 'text-on-surface-variant hover:text-white hover:bg-surface-container-low/40' }`}> <Compass className={`w-3.5 h-3.5 ${activeLevel === 3 ? 'text-brand-secondary' : 'text-on-surface-variant/50'}`} /> <span className="truncate">3. Lore</span> </button>
            <button id="tab-level-contexto" onClick={() => handleLevelChange(4)} className={`flex items-center justify-center gap-2 py-2 px-2 sm:px-3 rounded-lg text-xs font-mono font-semibold transition ${ activeLevel === 4 ? 'bg-status-success/20 text-status-success border border-status-success/50 shadow-sm' : 'text-on-surface-variant hover:text-white hover:bg-surface-container-low/40' }`}> <BookOpen className={`w-3.5 h-3.5 ${activeLevel === 4 ? 'text-status-success' : 'text-on-surface-variant/50'}`} /> <span className="truncate">4. Continuidad</span> </button>
          </div>
        </div>

        {/* ACTIVE NARRATIVE LEVEL CARD */}
        <div className="mt-4">
          {activeLevel === 1 && (
            <div id="content-level-detonante" className="bg-surface-container/80 border border-brand-accent/30 rounded-xl p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-brand-accent/20 pb-2"> <div className="flex items-center gap-2"> <span className="w-2 h-2 rounded-full bg-brand-accent animate-pulse" /> <h3 className="font-mono text-xs uppercase tracking-wider text-brand-accent font-bold"> El Detonante (Inicio del bloque) </h3> </div> <span className="text-2xs font-mono text-on-surface-variant/60"> Ruptura del Statu Quo </span> </div>
              <div> <h4 className="font-serif text-lg font-bold text-white mb-2"> {narrative.detonante.title} </h4> <p className="text-sm text-on-surface-variant/80 leading-relaxed font-sans"> {narrative.detonante.description} </p> </div>
              <div className="grid sm:grid-cols-2 gap-3 pt-2"> <div className="bg-surface-container/90 p-3 rounded-lg border border-white/5"> <span className="text-3xs font-mono uppercase text-brand-accent/80 block mb-1"> Hecho que rompe el universo: </span> <p className="text-xs text-on-surface font-medium"> {narrative.detonante.statusQuoBreaker} </p> </div> <div className="bg-surface-container/90 p-3 rounded-lg border border-white/5"> <span className="text-3xs font-mono uppercase text-brand-accent/80 block mb-1"> Punto exacto del relato: </span> <p className="text-xs text-on-surface font-medium"> {narrative.detonante.exactEpisodePoint} </p> </div> </div>
              {narrative.detonante.keyQuote && ( <div className="flex items-start gap-2 bg-brand-accent/10 border-l-2 border-brand-accent p-3 rounded-r-lg"> <Quote className="w-4 h-4 text-brand-accent shrink-0 mt-0.5" /> <p className="text-xs italic text-brand-accent/90 font-serif"> {narrative.detonante.keyQuote} </p> </div> )} </div> )} {activeLevel === 2 && ( <div id="content-level-climax" className="bg-surface-container/80 border border-status-error/30 rounded-xl p-4 sm:p-5 space-y-4 animate-in fade-in duration-200"> <div className="flex items-center justify-between border-b border-status-error/20 pb-2"> <div className="flex items-center gap-2"> <span className="w-2 h-2 rounded-full bg-status-error animate-pulse" /> <h3 className="font-mono text-xs uppercase tracking-wider text-status-error font-bold"> El Clímax Dramático (Nudo y Desenlace) </h3> </div> <span className="text-2xs font-mono text-on-surface-variant/60"> Batalla Decisiva & Pérdida Irreversible </span> </div> <div> <h4 className="font-serif text-lg font-bold text-white mb-2"> {narrative.climax.title} </h4> <p className="text-sm text-on-surface-variant/80 leading-relaxed font-sans"> {narrative.climax.description} </p> </div> <div className="grid sm:grid-cols-2 gap-3 pt-2"> <div className="bg-surface-container/90 p-3 rounded-lg border border-white/5"> <span className="text-3xs font-mono uppercase text-status-error/80 block mb-1"> Batalla decisiva del arco: </span> <p className="text-xs text-on-surface font-medium"> {narrative.climax.decisiveBattle} </p> </div> <div className="bg-surface-container/90 p-3 rounded-lg border border-white/5"> <span className="text-3xs font-mono uppercase text-status-error/80 block mb-1"> Técnica prohibida o costo irreparable: </span> <p className="text-xs text-on-surface font-medium"> {narrative.climax.forbiddenTechniqueOrCost} </p> </div> </div> <div className="bg-status-error/10 border border-status-error/30 p-3 rounded-lg"> <span className="text-3xs font-mono uppercase tracking-wider text-status-error block mb-1"> Momento Icónico Visualizado en Portada: </span> <p className="text-xs text-on-surface font-sans"> {narrative.climax.iconicMoment} </p> </div> </div> )} {activeLevel === 3 && ( <div id="content-level-lore" className="bg-surface-container/80 border border-brand-secondary/30 rounded-xl p-4 sm:p-5 space-y-4 animate-in fade-in duration-200"> <div className="flex items-center justify-between border-b border-brand-secondary/20 pb-2"> <div className="flex items-center gap-2"> <span className="w-2 h-2 rounded-full bg-brand-secondary animate-ping" /> <h3 className="font-mono text-xs uppercase tracking-wider text-brand-secondary font-bold"> El Archivo de Lore (El Dorso de la Portada) </h3> </div> <span className="text-2xs font-mono text-brand-accent"> Secreto Cósmico en Segundo Plano </span> </div> <div> <h4 className="font-serif text-lg font-bold text-brand-accent/90 mb-2"> {narrative.lore.title} </h4> <p className="text-sm text-on-surface-variant/80 leading-relaxed font-sans"> {narrative.lore.secretSummary} </p> </div> <div className="bg-brand-secondary/10 border border-brand-secondary/30 p-3 rounded-lg"> <span className="text-3xs font-mono uppercase tracking-wider text-brand-secondary/80 block mb-1"> Contexto Cósmico Oculto a los Protagonistas: </span> <p className="text-xs text-on-surface-variant/80 leading-relaxed font-sans"> {narrative.lore.cosmicBackground} </p> </div> <div className="grid sm:grid-cols-2 gap-3 pt-1"> <div className="bg-surface-container/90 p-3 rounded-lg border border-white/5"> <span className="text-3xs font-mono uppercase text-brand-secondary/80 block mb-1"> Entidad Divina Involucrada: </span> <p className="text-xs text-on-surface font-medium"> {narrative.lore.deityInvolved} </p> </div> <div className="bg-surface-container/90 p-3 rounded-lg border border-white/5"> <span className="text-3xs font-mono uppercase text-brand-secondary/80 block mb-1"> Impacto en el Multiverso: </span> <p className="text-xs text-on-surface font-medium"> {narrative.lore.cosmicImpact} </p> </div> </div> <div className="bg-brand-accent/10 border-l-2 border-brand-accent p-3 rounded-r-lg"> <span className="text-3xs font-mono uppercase text-brand-accent block mb-1"> Dato de Lore Revelado Años Después: </span> <p className="text-xs text-brand-accent/90 font-sans"> {narrative.lore.unrevealedFact} </p> </div> </div> )} {activeLevel === 4 && ( <div id="content-level-contexto" className="bg-surface-container/80 border border-status-success/30 rounded-xl p-4 sm:p-5 space-y-4 animate-in fade-in duration-200"> <div className="flex items-center justify-between border-b border-status-success/20 pb-2"> <div className="flex items-center gap-2"> <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" /> <h3 className="font-mono text-xs uppercase tracking-wider text-status-success font-bold flex items-center gap-1.5"> <BookOpen className="w-3.5 h-3.5 text-status-success" /> <span>Guía de Continuidad & Contexto Previo</span> </h3> </div> {volume.recommendedStartEpisode && ( <span className="text-2xs font-mono text-status-success bg-status-success/10 px-2 py-0.5 rounded border border-status-success/20"> Comenzar en: Ep {volume.recommendedStartEpisode} </span> )} </div> {volume.previouslyOn && ( <div className="bg-surface-container/90 p-3.5 rounded-lg border border-white/5 space-y-1.5"> <span className="text-3xs font-mono uppercase text-status-success font-bold flex items-center gap-1"> <Clock className="w-3 h-3" /> ¿De dónde venimos? (Previously on): </span> <p className="text-xs sm:text-sm text-on-surface leading-relaxed font-sans"> {volume.previouslyOn} </p> </div> )} {volume.quickCatchUpKeys && volume.quickCatchUpKeys.length > 0 && ( <div className="space-y-2"> <span className="text-3xs font-mono uppercase text-brand-accent font-bold flex items-center gap-1"> <Sparkles className="w-3 h-3 text-brand-accent" /> Puntos clave para entender este arco: </span> <ul className="grid grid-cols-1 gap-2 pl-1"> {volume.quickCatchUpKeys.map((key, idx) => ( <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-on-surface-variant/80"> <span className="text-brand-accent font-bold mt-0.5">•</span> <span>{key}</span> </li> ))} </ul> </div> )} {volume.fillerEpisodes && volume.fillerEpisodes.length > 0 && ( <div className="bg-brand-accent/10 border border-brand-accent/20 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"> <div className="flex items-center gap-1.5 text-brand-accent font-mono"> <Sparkles className="w-3.5 h-3.5 text-brand-accent shrink-0" /> <span>Episodios de relleno opcionales en este tomo ({volume.fillerEpisodes.length}):</span> </div> <span className="font-mono text-on-surface-variant/80 text-2xs bg-surface-container-low px-2 py-0.5 rounded border border-white/10"> {volume.fillerEpisodes.join(', ')} </span> </div> )} </div> )} </div>
      </div>
    </div>
  );
};