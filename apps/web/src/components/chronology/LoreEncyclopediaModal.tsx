import * as React from 'react';
import { Modal } from '@/components/ui/modal';
import { MagneticIndicator } from '@/components/ui/kinetics/magnetic-indicator';
import { useReducedMotion } from '@/components/ui/kinetics/hooks';
import {
  LORE_ARTIFACTS,
  MULTIVERSE_TIMELINES,
  LORE_GLOSSARY_TERMS,
} from '@/lib/config/lore';
import type { LoreArtifact, MultiverseTimeline, LoreGlossaryTerm } from '@/lib/config/lore';
import { Sparkles, GitBranch, Zap, CheckCircle2 } from 'lucide-react';

export interface LoreEncyclopediaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type EncyclopediaTab = 'artifacts' | 'timelines' | 'glossary';

export const LoreEncyclopediaModal: React.FC<LoreEncyclopediaModalProps> = ({ isOpen, onClose }) => {
  const reduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = React.useState<EncyclopediaTab>('artifacts');
  const [glossarySearch, setGlossarySearch] = React.useState('');

  const artifacts = React.useMemo(() => Object.values(LORE_ARTIFACTS), []);
  const timelines = React.useMemo(() => MULTIVERSE_TIMELINES, []);
  const glossaryTerms = React.useMemo(() => {
    const list = Object.values(LORE_GLOSSARY_TERMS);
    if (!glossarySearch.trim()) return list;
    const q = glossarySearch.toLowerCase();
    return list.filter(
      (t) =>
        t.term.toLowerCase().includes(q) ||
        (t.kanji && t.kanji.toLowerCase().includes(q)) ||
        t.shortDefinition.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
    );
  }, [glossarySearch]);

  const tabs: Array<{ id: EncyclopediaTab; label: string; icon: React.ReactNode }> = [
    { id: 'artifacts', label: 'Artefactos', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'timelines', label: 'Líneas Temporales', icon: <GitBranch className="w-3.5 h-3.5" /> },
    { id: 'glossary', label: 'Glosario Ki y Técnicas', icon: <Zap className="w-3.5 h-3.5" /> },
  ];

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      contentClass="max-w-3xl w-full p-4 sm:p-6 bg-zinc-950/95 border border-white/20 rounded-3xl shadow-2xl backdrop-blur-overlay-2xl max-h-[88vh] flex flex-col gap-4 overflow-hidden"
      title={
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 p-[2px] shadow-[0_0_16px_rgba(245,158,11,0.4)] shrink-0">
            <div className="w-full h-full bg-amber-950 rounded-lg flex items-center justify-center border border-amber-400/30">
              <span className="font-kanji font-black text-amber-300 text-lg">界</span>
            </div>
          </div>
          <div>
            <h2 className="font-display font-black text-base sm:text-lg text-white uppercase tracking-wider">
              Enciclopedia del Dragon World
            </h2>
            <p className="text-3xs sm:text-2xs text-on-surface-variant font-mono">
              Artefactos, líneas temporales y glosario, con su fuente
            </p>
          </div>
        </div>
      }
    >
      {/* Tab Switcher */}
      <div
        role="tablist"
        aria-label="Secciones de la enciclopedia"
        className="flex w-full items-center gap-1 overflow-x-auto no-scrollbar rounded-full border border-white/15 bg-white/[0.03] p-1 shrink-0"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`relative min-h-[38px] px-3.5 rounded-full text-xs font-mono uppercase font-bold tracking-wider transition-colors duration-150 cursor-pointer select-none flex items-center justify-center gap-1.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                isActive ? 'text-amber-300' : 'text-on-surface-variant hover:text-white'
              }`}
            >
              <MagneticIndicator
                layoutId="encyclopediaActiveTab"
                active={isActive}
                disableAnimation={!!reduceMotion}
                className="bg-amber-500/20 border border-amber-400/40"
              />
              <span className="relative z-10 flex items-center gap-1.5">
                {tab.icon}
                <span>{tab.label}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Container */}
      <div className="flex-1 overflow-y-auto pr-1 no-scrollbar space-y-4">
        {/* TAB 1: ARTIFACTS */}
        {activeTab === 'artifacts' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {artifacts.map((art: LoreArtifact) => (
              <div
                key={art.id}
                className="bg-white/[0.03] border border-white/10 hover:border-amber-400/30 rounded-2xl p-4 space-y-3 transition-colors flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display font-black text-sm text-white uppercase tracking-wide">
                        {art.name}
                      </h3>
                      <span className="font-kanji text-xs text-amber-400 font-bold block">
                        {art.japaneseName}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-3xs font-mono font-bold uppercase tracking-wider bg-amber-500/15 border border-amber-500/30 text-amber-300 shrink-0">
                      {art.category}
                    </span>
                  </div>

                  <div className="text-3xs font-mono text-zinc-400 space-y-0.5">
                    <div>
                      <span className="text-zinc-500 font-bold">Origen / Creador:</span> {art.creator}
                    </div>
                    <div>
                      <span className="text-zinc-500 font-bold">Primera Aparición:</span> {art.firstAppearance.episodeOrChapter}{art.firstAppearance.ageYear !== undefined && ` (Año ${art.firstAppearance.ageYear})`}
                    </div>
                  </div>

                  <div className="space-y-1 pt-1">
                    <span className="text-3xs font-mono text-amber-400 font-bold uppercase tracking-wider block">
                      Reglas y Limitaciones:
                    </span>
                    <ul className="space-y-1 text-xs text-on-surface-variant font-sans leading-relaxed">
                      {art.rulesAndLimitations.map((rule, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-3xs font-mono text-zinc-500">
                  <span className="truncate">Fuente: {art.source.bookOrArticle}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 2: TIMELINES */}
        {activeTab === 'timelines' && (
          <div className="space-y-3.5">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200 font-mono leading-relaxed">
              <strong>Cómo funcionan los viajes en el tiempo:</strong> viajar al pasado no reescribe la historia de origen; crea una línea temporal paralela.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {timelines.map((tl: MultiverseTimeline) => (
                <div
                  key={tl.id}
                  className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-2.5 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                      <span className="px-2 py-0.5 rounded-full text-3xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Línea {tl.id}
                      </span>
                      <span className="text-3xs font-mono text-zinc-400 truncate">
                        {tl.source}
                      </span>
                    </div>

                    <h4 className="font-display font-black text-sm text-white uppercase tracking-wide">
                      {tl.designation}
                    </h4>

                    <p className="text-xs text-on-surface-variant font-sans leading-relaxed">
                      {tl.description}
                    </p>

                    <div className="text-3xs font-mono bg-white/[0.02] p-2.5 rounded-xl border border-white/5 space-y-1">
                      <div>
                        <span className="text-red-400 font-bold uppercase">Punto de Quiebre:</span>{' '}
                        <span className="text-zinc-300">{tl.divergenceEvent}</span>
                      </div>
                      <div>
                        <span className="text-emerald-400 font-bold uppercase">Supervivientes:</span>{' '}
                        <span className="text-zinc-300">{tl.keySurvivors.join(', ')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10 text-3xs font-mono text-zinc-400">
                    <span className="text-amber-400 font-bold">Desenlace:</span> {tl.statusAtEnd}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: GLOSSARY */}
        {activeTab === 'glossary' && (
          <div className="space-y-3">
            <input
              type="text"
              value={glossarySearch}
              onChange={(e) => setGlossarySearch(e.target.value)}
              placeholder="Filtrar por término, técnica o kanji..."
              className="w-full bg-white/[0.04] border border-white/15 rounded-xl py-2 px-3.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-400/50 font-mono"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {glossaryTerms.map((term: LoreGlossaryTerm) => (
                <div
                  key={term.key}
                  className="bg-white/[0.03] border border-white/10 rounded-2xl p-3.5 space-y-2 flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-display font-black text-xs sm:text-sm text-white uppercase tracking-wide">
                          {term.term}
                        </h4>
                        {term.kanji && (
                          <span className="font-kanji text-xs text-amber-400 font-bold block">
                            {term.kanji}
                          </span>
                        )}
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-3xs font-mono font-bold uppercase tracking-wider bg-white/10 text-zinc-300 border border-white/15 shrink-0">
                        {term.category}
                      </span>
                    </div>

                    <p className="text-xs text-on-surface font-sans leading-relaxed">
                      {term.shortDefinition}
                    </p>

                    <p className="text-3xs text-on-surface-variant font-mono bg-white/[0.02] p-2 rounded-lg border border-white/5 leading-relaxed">
                      {term.detailedContext}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-white/10 text-3xs font-mono text-zinc-500 truncate">
                    Fuente: {term.sourceCitation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
