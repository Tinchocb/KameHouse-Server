import React from 'react';
import { VolumeData } from './types';
import { StoryCard } from './StoryCard';
import { CheckCircle2, BookOpen } from 'lucide-react';
import { sounds } from './utils/audio';

interface StoryCardsViewProps {
  volumes: VolumeData[];
  readVolumeIds: Set<string>;
  onToggleRead: (id: string) => void;
  onMarkAllRead: () => void;
  onResetRead: () => void;
  onOpenReader: (volume: VolumeData) => void;
  onInspectThumbnail: (volume: VolumeData) => void;
  searchQuery: string;
}

const ERA_STYLE: Record<string, { badgeBg: string; badgeText: string; badgeBorder: string; emblemBg: string; emblemBorder: string }> = {
  'db-clasico': { badgeBg: 'bg-emerald-950/40', badgeText: 'text-emerald-300', badgeBorder: 'border-emerald-500/30', emblemBg: 'bg-emerald-950/20', emblemBorder: 'border-emerald-500/40' },
  'db-z-saiyan-freezer': { badgeBg: 'bg-red-950/40', badgeText: 'text-red-300', badgeBorder: 'border-red-500/30', emblemBg: 'bg-red-950/20', emblemBorder: 'border-red-500/40' },
  'db-z-cell': { badgeBg: 'bg-teal-950/40', badgeText: 'text-teal-300', badgeBorder: 'border-teal-500/30', emblemBg: 'bg-teal-950/20', emblemBorder: 'border-teal-500/40' },
  'db-z-buu': { badgeBg: 'bg-pink-950/40', badgeText: 'text-pink-300', badgeBorder: 'border-pink-500/30', emblemBg: 'bg-pink-950/20', emblemBorder: 'border-pink-500/40' },
  'db-super': { badgeBg: 'bg-cyan-950/40', badgeText: 'text-cyan-300', badgeBorder: 'border-cyan-500/30', emblemBg: 'bg-cyan-950/20', emblemBorder: 'border-cyan-500/40' },
};

const ERA_KANJI: Record<string, string> = {
  'db-clasico': '亀',
  'db-z-saiyan-freezer': '界',
  'db-z-cell': '未',
  'db-z-buu': '魔',
  'db-super': '神',
};

const ERA_TITLE: Record<string, string> = {
  'db-clasico': 'Dragon Ball Clásico',
  'db-z-saiyan-freezer': 'Dragon Ball Z: Invasión Saiyajin & Namek',
  'db-z-cell': 'Dragon Ball Z: Androides & Cell Games',
  'db-z-buu': 'Dragon Ball Z: El Monstruo Majin Buu',
  'db-super': 'Dragon Ball Super',
};

const ERA_SUBTITLE: Record<string, string> = {
  'db-clasico': 'La Era de las Leyendas Terrenales y el Rey Demonio',
  'db-z-saiyan-freezer': 'La Expansión Cósmica, el Linaje Perdido y el Super Saiyajin Legendario',
  'db-z-cell': 'Paradojas Temporales, el Horror Bio-Mecánico y la Furia de Gohan',
  'db-z-buu': 'Magia Primordial, el Sacrificio de un Príncipe y la Genkidama Final',
  'db-super': 'La Jerarquía Divina de los Dioses, Anillos del Tiempo y el Torneo Universal',
};

const ERA_YEARS: Record<string, string> = {
  'db-clasico': 'Año 749 - 753',
  'db-z-saiyan-freezer': 'Año 761 - 762',
  'db-z-cell': 'Año 764 - 767',
  'db-z-buu': 'Año 774',
  'db-super': 'Año 778 - 780',
};

export const StoryCardsView: React.FC<StoryCardsViewProps> = ({
  volumes,
  readVolumeIds,
  onToggleRead,
  onMarkAllRead,
  onResetRead,
  onOpenReader,
  onInspectThumbnail,
  searchQuery,
}) => {
  // Calculate reading progress
  const totalCount = volumes.length;
  const readCount = volumes.filter((v) => readVolumeIds.has(v.id)).length;
  const progressPercent = totalCount > 0 ? Math.round((readCount / totalCount) * 100) : 0;

  // Group volumes by Series / Era
  const eraGroups = [
    {
      key: 'db-clasico',
      volumes: volumes.filter((v) => v.seriesTag === 'Dragon Ball Clásico'),
    },
    {
      key: 'db-z-saiyan-freezer',
      volumes: volumes.filter((v) => v.seriesTag === 'Dragon Ball Z' && v.saga === 'saiyan-freezer'),
    },
    {
      key: 'db-z-cell',
      volumes: volumes.filter((v) => v.seriesTag === 'Dragon Ball Z' && v.saga === 'cell'),
    },
    {
      key: 'db-z-buu',
      volumes: volumes.filter((v) => v.seriesTag === 'Dragon Ball Z' && v.saga === 'buu'),
    },
    {
      key: 'db-super',
      volumes: volumes.filter((v) => v.seriesTag === 'Dragon Ball Super'),
    },
  ];

  return (
    <div className="w-full flex flex-col gap-8">
      {/* Narrative Header Card & Progress Tracker */}
      <section
        id="story-tracker-header"
        className="bg-surface-container/85 border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden"
      >
        {/* Ambient Ki glow */}
        <div className="absolute top-0 right-1/4 w-96 h-48 bg-brand-accent/10 blur-xl pointer-events-none rounded-full transform-gpu" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Narrative Concept */}
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-brand-accent/20 border border-brand-accent/40 text-brand-accent text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Crónica Canónica</span>
              </span>
              <span className="text-xs font-mono text-on-surface-variant">
                Año 749 al 780 \u00b7 Por Akira Toriyama
              </span>
            </div>

            <h2 className="font-display text-3xl sm:text-4xl text-white tracking-wide">
              La Historia Completa de Dragon Ball
            </h2>
            <p className="text-sm text-on-surface-variant leading-relaxed mt-1">
              Explora la trama cronológica estructurada por lapsos de episodios clave. Cada tarjeta
              resume los detonantes dramáticos, las batallas cumbre y el lore cósmico, acompañado de
              su miniatura gráfica de colección.
            </p>
          </div>

          {/* Persistent Reading Progress Box */}
          <div className="w-full lg:w-80 bg-surface-container-low/80 border border-white/10 rounded-xl p-4 flex flex-col gap-3 shrink-0">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-on-surface-variant/70 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-success" />
                <span>Progreso de Lectura:</span>
              </span>
              <span className="text-brand-success font-bold text-sm">
                {progressPercent}%
              </span>
            </div>

            {/* Progress bar line */}
            <div className="w-full bg-surface-container-low rounded-full h-2.5 overflow-hidden border border-white/5 relative">
              <div
                className="h-full bg-gradient-to-r from-brand-accent via-brand-secondary to-brand-success transition-all duration-300 rounded-full shadow-[0_0_12px_var(--glow-primary)]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-2xs font-mono text-on-surface-variant">
              <span>
                {readCount} de {totalCount} lapsos completados
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    sounds.playSelect();
                    onMarkAllRead();
                  }}
                  className="text-brand-accent hover:text-brand-secondary hover:underline"
                  title="Marcar todos los lapsos como leídos"
                >
                  Marcar todos
                </button>
                <span className="text-on-surface-variant/40">\u00b7</span>
                <button
                  onClick={() => {
                    sounds.playSelect();
                    onResetRead();
                  }}
                  className="text-on-surface-variant/60 hover:text-on-surface-variant hover:underline"
                  title="Reiniciar registro de lectura"
                >
                  Reiniciar
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* No Results Fallback */}
      {volumes.length === 0 && (
        <div className="text-center py-16 bg-surface-container-low/40 border border-white/5 rounded-2xl p-8">
          <BookOpen className="w-10 h-10 text-on-surface-variant/40 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-1">No se encontraron lapsos de episodios</h3>
          <p className="text-xs text-on-surface-variant">
            Ningún episodio coincide con \u201c{searchQuery}\u201d. Prueba buscando por personaje (ej. \u201cVegeta\u201d), término o saga.
          </p>
        </div>
      )}

      {/* Story Sections grouped by Arc / Era */}
      {eraGroups.map((group) => {
        if (group.volumes.length === 0) return null;

        const style = ERA_STYLE[group.key] || { badgeBg: 'bg-surface-container-low/40', badgeText: 'text-on-surface-variant', badgeBorder: 'border-white/20', emblemBg: 'bg-surface-container-low/20', emblemBorder: 'border-white/20' };

        return (
          <section key={group.key} className="flex flex-col gap-4">
            {/* Era Divider Header */}
            <div className={`flex items-center justify-between pb-2 border-b ${style.badgeBorder} gap-4`}>
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-kanji font-black text-lg border"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--era-accent) 9%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--era-accent) 25%, transparent)',
                    color: 'var(--era-accent)',
                  }}
                >
                  {ERA_KANJI[group.key]}
                </div>

                <div>
                  <h3 className="font-display text-2xl tracking-wide text-white flex items-center gap-2">
                    {ERA_TITLE[group.key]}
                    <span className="text-xs font-mono font-normal text-on-surface-variant/70">
                      ({ERA_YEARS[group.key]})
                    </span>
                  </h3>
                  <p className="text-xs text-on-surface-variant/70 hidden sm:block">
                    {ERA_SUBTITLE[group.key]}
                  </p>
                </div>
              </div>

              {/* Volume Count Badge */}
              <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold shrink-0 ${style.badgeBg} ${style.badgeText} ${style.badgeBorder}`}>
                {group.volumes.length} {group.volumes.length === 1 ? 'Lapso' : 'Lapsos'}
              </span>
            </div>

            {/* Story Cards List */}
            <div className="flex flex-col gap-4">
              {group.volumes.map((volume) => (
                <StoryCard
                  key={volume.id}
                  volume={volume}
                  isRead={readVolumeIds.has(volume.id)}
                  onToggleRead={() => onToggleRead(volume.id)}
                  onOpenReader={() => onOpenReader(volume)}
                  onInspectThumbnail={() => onInspectThumbnail(volume)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};