import React, { useState, useMemo, useEffect } from 'react';
import { GLOSSARY_TERMS, GLOSSARY_CATEGORIES } from './data/glossary';
import { GlossaryTerm, VolumeData } from './types';
import { Search, X, BookMarked, Sparkles, ExternalLink, Quote, Tag, ShieldCheck } from 'lucide-react';
import { sounds } from './utils/audio';

interface GlossaryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  volumes: VolumeData[];
  onSelectVolume: (volumeId: string) => void;
}

export const GlossaryDrawer: React.FC<GlossaryDrawerProps> = ({
  isOpen,
  onClose,
  volumes,
  onSelectVolume,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [selectedTermId, setSelectedTermId] = useState<string>('super-saiyan');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filtered terms
  const filteredTerms = useMemo(() => {
    return GLOSSARY_TERMS.filter((item) => {
      const matchesCategory =
        selectedCategory === 'Todos' || item.category === selectedCategory;

      const q = searchQuery.trim().toLowerCase();
      if (!q) return matchesCategory;

      const matchesQuery =
        item.term.toLowerCase().includes(q) ||
        (item.originalJapanese && item.originalJapanese.toLowerCase().includes(q)) ||
        item.shortDefinition.toLowerCase().includes(q) ||
        item.deepLore.toLowerCase().includes(q) ||
        item.canonicalRules.some((r) => r.toLowerCase().includes(q));

      return matchesCategory && matchesQuery;
    });
  }, [searchQuery, selectedCategory]);

  // Current active term
  const activeTerm: GlossaryTerm | undefined = useMemo(() => {
    return (
      filteredTerms.find((t) => t.id === selectedTermId) ||
      filteredTerms[0] ||
      GLOSSARY_TERMS[0]
    );
  }, [filteredTerms, selectedTermId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-modal overflow-hidden select-none">
      {/* Dark Blur Backdrop (cierre solo puntero; por teclado: botón Cerrar y Escape) */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- backdrop pointer-only */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      />

      {/* Slide-over Drawer Panel */}
      <div className="absolute inset-y-0 right-0 max-w-2xl w-full bg-surface-container border-l border-brand-secondary/30 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-surface-container-low/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-accent/20 border border-brand-accent/40 flex items-center justify-center text-brand-accent">
              <BookMarked className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-2xl tracking-wider text-white">
                  GLOSARIO DE LORE & CONCEPTOS CANÓNICOS
                </h3>
                <span className="text-3xs font-mono px-2 py-0.5 rounded-full bg-brand-accent/20 text-brand-accent font-bold">
                  ARCHIVO CÓSMICO
                </span>
              </div>
              <p className="text-xs text-on-surface-variant font-mono">
                Consulta los conceptos de segundo plano expuestos en el dorso de los tomos
              </p>
            </div>
          </div>

          <button
            id="btn-close-glossary-drawer"
            onClick={onClose}
            className="p-2 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-white transition-colors"
            title="Cerrar Glosario"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Category Filter Section */}
        <div className="p-4 border-b border-white/10 bg-surface-container-low/40 flex flex-col gap-3">
          {/* Search bar */}
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/60" />
            <input
              id="input-search-glossary"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar concepto (ej: Super Saiyan, Namekian, Anillo del Tiempo, Ki Divino)..."
              className="w-full bg-surface-container-low border border-white/15 rounded-xl pl-10 pr-10 py-2 text-xs font-mono text-white placeholder-on-surface-variant/50 focus:outline-none focus:border-brand-accent transition-colors"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {GLOSSARY_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  sounds.playSelect();
                  setSelectedCategory(cat);
                }}
                className={`text-xs font-mono whitespace-nowrap px-3 py-1 rounded-lg border transition-all ${
                  selectedCategory === cat
                    ? 'bg-brand-accent text-on-primary font-bold border-brand-accent/30 shadow-sm'
                    : 'bg-surface-container-low/80 text-on-surface-variant border-white/10 hover:border-white/20 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content: Split List on Mobile/Desktop or Scrollable Inspector */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Terms Navigation Column */}
          <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/10 overflow-y-auto max-h-56 md:max-h-full bg-surface-container-low/60 p-2 space-y-1">
            {filteredTerms.length === 0 ? (
              <div className="p-4 text-center text-xs font-mono text-on-surface-variant/50">
                No se encontraron términos con ese criterio.
              </div>
            ) : (
              filteredTerms.map((t) => {
                const isSelected = activeTerm?.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      sounds.playSelect();
                      setSelectedTermId(t.id);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex flex-col gap-0.5 border ${
                      isSelected
                        ? 'bg-surface-container border-brand-accent/80 text-white shadow-md'
                        : 'bg-surface-container-low/40 border-white/5 hover:border-white/20 text-on-surface'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="text-4xs font-mono px-1.5 py-px rounded font-bold"
                        style={{
                          backgroundColor: `${t.categoryColor}25`,
                          color: t.categoryColor,
                        }}
                      >
                        {t.category}
                      </span>
                      {isSelected && <Sparkles className="w-3 h-3 text-brand-accent" />}
                    </div>
                    <span className="text-xs font-bold leading-tight mt-1 line-clamp-1">
                      {t.term}
                    </span>
                    {t.originalJapanese && (
                      <span className="text-3xs font-kanji text-on-surface-variant/60 line-clamp-1">
                        {t.originalJapanese}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Detailed Term Inspector Column */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {activeTerm ? (
              <article className="space-y-4">
                {/* Header of Term */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-3xs font-mono px-2 py-0.5 rounded-full font-bold uppercase"
                      style={{
                        backgroundColor: `${activeTerm.categoryColor}25`,
                        color: activeTerm.categoryColor,
                        border: `1px solid ${activeTerm.categoryColor}50`,
                      }}
                    >
                      {activeTerm.category}
                    </span>
                    {activeTerm.originalJapanese && (
                      <span className="text-xs font-kanji text-on-surface-variant/60">
                        {activeTerm.originalJapanese}
                      </span>
                    )}
                  </div>
                  <h4 className="font-display text-3xl tracking-wide text-white">
                    {activeTerm.term}
                  </h4>
                </div>

                {/* Short Definition Box */}
                <div className="bg-surface-container/90 border border-white/10 rounded-xl p-3.5 text-xs text-on-surface leading-relaxed font-sans shadow-sm">
                  {activeTerm.shortDefinition}
                </div>

                {/* Canonical Quote if present */}
                {activeTerm.keyQuote && (
                  <div className="bg-brand-accent/10 border-l-2 border-brand-accent p-3 rounded-r-xl flex items-start gap-2.5 text-xs italic text-brand-accent/90 font-serif">
                    <Quote className="w-4 h-4 text-brand-accent shrink-0 mt-0.5" />
                    <span>{activeTerm.keyQuote}</span>
                  </div>
                )}

                {/* Deep Lore Section */}
                <div className="space-y-1.5">
                  <span className="text-3xs font-mono uppercase tracking-widest text-on-surface-variant/60 font-bold block">
                    Contexto Histórico y Cósmico (Lore Oculto)
                  </span>
                  <p className="text-xs text-on-surface-variant/80 leading-relaxed font-sans bg-surface-container-low p-3 rounded-xl border border-white/5">
                    {activeTerm.deepLore}
                  </p>
                </div>

                {/* Canonical Rules List */}
                <div className="space-y-2">
                  <span className="text-3xs font-mono uppercase tracking-widest text-on-surface-variant/60 font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-brand-success" />
                    Reglas Canónicas del Universo Oficial
                  </span>
                  <ul className="space-y-1.5">
                    {activeTerm.canonicalRules.map((rule, idx) => (
                      <li
                        key={idx}
                        className="text-xs text-on-surface-variant/80 flex items-start gap-2 bg-surface-container-low/50 p-2 rounded-lg border border-white/5"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-accent shrink-0 mt-1.5" />
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Referenced Volumes in the Timeline */}
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <span className="text-3xs font-mono uppercase tracking-widest text-brand-accent font-bold flex items-center gap-1.5">
                    <Tag className="w-3 h-3 text-brand-accent" />
                    Aparece en los siguientes Tomos del Archivo:
                  </span>
                  <div className="flex flex-col gap-2">
                    {activeTerm.associatedVolumeIds.map((vid) => {
                      const vol = volumes.find((v) => v.id === vid);
                      if (!vol) return null;
                      return (
                        <div
                          key={vid}
                          role="button"
                          tabIndex={0}
                          aria-label={`Ir al tomo ${vol.volumeNumber}: ${vol.title}`}
                          onClick={() => {
                            sounds.playSelect();
                            onSelectVolume(vid);
                            onClose();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              sounds.playSelect();
                              onSelectVolume(vid);
                              onClose();
                            }
                          }}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-white/10 hover:border-white/30 transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: vol.coverArt.accentHex }}
                            />
                            <div>
                              <div className="text-xs font-bold text-white group-hover:text-brand-accent/80 transition-colors flex items-center gap-2">
                                <span>{vol.volumeNumber}: {vol.title}</span>
                                <span className="text-3xs font-mono text-on-surface-variant/60 font-normal">
                                  ({vol.officialYear})
                                </span>
                              </div>
                              <div className="text-2xs text-on-surface-variant/60 truncate max-w-sm">
                                {vol.narrative.lore.title}
                              </div>
                            </div>
                          </div>

                          <span className="text-2xs font-mono text-brand-accent flex items-center gap-1 group-hover:underline">
                            <span>Ir al Tomo</span>
                            <ExternalLink className="w-3 h-3" />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </article>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};