import React, { useState, memo } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { VolumeData, ChapterMilestone } from './types';
import { EpisodeThumbnailImg } from './EpisodeThumbnailImg';
import { formatYearShort } from './data/spansToVolumes';
import { getSagaBadgeConfig } from './utils/sagaBadge';
import { getSagaFallbackImages } from './data/sagaImages';
import { sounds } from './utils/audio';
import { useReducedMotion } from '@/components/ui/kinetics/hooks';
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  Swords,
  Sparkles,
  Maximize2,
  Users,
  AlertTriangle,
  Globe,
  Play,
  Film,
} from 'lucide-react';

export interface ChronologyRowProps {
  volume: VolumeData;
  isRead: boolean;
  isExpanded: boolean;
  isHighlighted: boolean;
  onToggleExpand: () => void;
  onToggleRead: (volumeId: string) => void;
  onInspectThumbnail: (volume: VolumeData) => void;
  onPlayVolume?: (volume: VolumeData, episodeNum?: number) => void;
}

type RowTab = 'hitos' | 'conflicto' | 'climax' | 'lore';

export const ChronologyRow: React.FC<ChronologyRowProps> = memo(({
  volume,
  isRead,
  isExpanded,
  isHighlighted,
  onToggleExpand,
  onToggleRead,
  onInspectThumbnail,
  onPlayVolume,
}) => {
  const reduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<RowTab>('hitos');

  const story = volume.detailedStory;
  const sagaConfig = getSagaBadgeConfig(volume.saga, volume.sagaLabel);
  const sagaFallbacks = volume.isMovie
    ? [volume.posterUrl || volume.backdropUrl || '/backdrops/lq/dbz.webp']
    : getSagaFallbackImages(volume.id);
  const episodeMilestones: ChapterMilestone[] = story?.episodeMilestones || [];
  const firstMilestone: ChapterMilestone = episodeMilestones[0] || {
    episode: `Cap. ${volume.startEpisode ?? 1}`,
    title: volume.title,
    synopsis: volume.subtitle,
  };

  const yearShort = formatYearShort(volume.officialYear);
  const capsFormatted =
    volume.startEpisode && volume.endEpisode
      ? `${volume.startEpisode}–${volume.endEpisode}`
      : volume.episodesRange
          .replace(/^caps?\s*/i, '')
          .replace(/\s*al\s*/i, '–')
          .replace(/^0+/g, '')
          .replace(/–0+/g, '–');

  const hasFiller = Boolean(
    (volume.fillerEpisodes && volume.fillerEpisodes.length > 0) ||
      volume.canonStatus === 'FILLER'
  );

  return (
    <div
      id={`timeline-node-${volume.id}`}
      className={`relative flex flex-col group scroll-mt-28 pl-6 sm:pl-10 transition-colors duration-200 ${
        isHighlighted ? 'ring-2 ring-brand-accent/50 rounded-2xl' : ''
      }`}
    >
      {/* Node on vertical spine: Check if read, glyph if not */}
      <div
        className={`absolute -left-[23px] sm:-left-[31px] top-3.5 w-6 h-6 rounded-full border flex items-center justify-center z-10 transition-transform duration-150 ${
          isHighlighted
            ? 'bg-brand-accent border-white text-zinc-950 scale-125 shadow-elevation-2'
            : isRead
              ? 'bg-emerald-600 border-emerald-400 text-white shadow-sm'
              : 'bg-bg-quaternary border-white/20 text-brand-accent group-hover:scale-105 shadow-sm'
        }`}
      >
        {isRead ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-white stroke-[2.5]" />
        ) : (
          <span className="font-kanji font-black text-xs leading-none text-brand-accent">
            {volume.coverArt.symbolGlyph || '亀'}
          </span>
        )}
      </div>

      {/* Row container: dark-first glass */}
      <div
        className={`w-full rounded-2xl border transition-[background-color,border-color] duration-200 bg-bg-primary/40 backdrop-blur-overlay-md ${
          isExpanded
            ? 'border-white/25 bg-bg-quaternary/60 shadow-elevation-2'
            : 'border-white/10 hover:border-white/25 bg-white/[0.02] hover:bg-white/[0.04]'
        } ${isRead ? 'border-l-4 border-l-emerald-500' : ''}`}
      >
        {/* Collapsed row bar */}
        <div className="flex items-center justify-between p-2 sm:p-2.5 gap-2 min-w-0">
          {/* Header button (expands/collapses row) */}
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={`volume-expand-${volume.id}`}
            onClick={() => {
              sounds.playSelect();
              onToggleExpand();
            }}
            className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 text-left cursor-pointer min-h-[44px] rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent select-none"
          >
            {/* Year pill */}
            <span className="font-mono tabular-nums text-2xs sm:text-xs text-on-surface-variant font-bold shrink-0 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/10">
              {yearShort}
            </span>

            {/* Small 16:9 Thumbnail with quick play on hover */}
            <div className="relative w-14 sm:w-20 aspect-video rounded-lg overflow-hidden shrink-0 bg-bg-quaternary border border-white/10 shadow-sm group/thumb">
              <EpisodeThumbnailImg
                volume={volume}
                milestone={firstMilestone}
                fallbackSrc={sagaFallbacks[0]}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              {onPlayVolume && (
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={volume.isMovie ? `Ver película: ${volume.title}` : `Reproducir: ${volume.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    sounds.playSelect();
                    onPlayVolume(volume, volume.recommendedStartEpisode || volume.startEpisode);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      sounds.playSelect();
                      onPlayVolume(volume, volume.recommendedStartEpisode || volume.startEpisode);
                    }
                  }}
                  className="absolute inset-0 bg-black/55 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                >
                  <Play className="w-4 h-4 text-brand-accent fill-current drop-shadow" />
                </div>
              )}
            </div>

            {/* Title & Metadata */}
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display font-bold text-xs sm:text-sm text-white uppercase tracking-wide truncate group-hover:text-brand-accent transition-colors">
                  {volume.title}
                </h3>

                {/* Movie badge */}
                {volume.isMovie && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-3xs font-mono font-bold bg-blue-500/15 border border-blue-500/30 text-blue-300 shrink-0">
                    <Film className="w-2.5 h-2.5" />
                    <span>{volume.volumeNumber}</span>
                  </span>
                )}

                {/* Canon status badge */}
                {volume.isMovie && volume.isCanonMovie && (
                  <span className="px-1.5 py-0.5 rounded-full text-3xs font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0">
                    Canon Oficial
                  </span>
                )}
                {volume.isMovie && !volume.isCanonMovie && (
                  <span className="px-1.5 py-0.5 rounded-full text-3xs font-mono font-bold bg-purple-500/15 border border-purple-500/30 text-purple-300 shrink-0">
                    Multiverso
                  </span>
                )}

                {/* Filler badge */}
                {!volume.isMovie && hasFiller && (
                  <span className="px-1.5 py-0.5 rounded-full text-3xs font-mono font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
                    Relleno
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-2xs font-mono text-on-surface-variant/80 truncate">
                {/* Saga badge */}
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-3xs font-bold border shrink-0 ${sagaConfig.bg} ${sagaConfig.border} ${sagaConfig.text}`}
                >
                  <span>{sagaConfig.icon}</span>
                  <span className="truncate max-w-[120px] sm:max-w-none">{volume.sagaLabel}</span>
                </span>

                {/* Episodes range or movie tag */}
                <span className="tabular-nums opacity-90 shrink-0">
                  {volume.isMovie
                    ? (volume.mediaType === 'SPECIAL' ? 'Especial de TV' : 'Largometraje')
                    : `Caps ${capsFormatted}`}
                </span>
              </div>
            </div>

            {/* Chevron icon */}
            <ChevronDown
              className={`w-4 h-4 text-on-surface-variant transition-transform duration-200 shrink-0 mr-1 ${
                isExpanded ? 'rotate-180 text-brand-accent' : ''
              }`}
            />
          </button>

          {/* Watched toggle button (Sibling, not nested) */}
          <button
            type="button"
            id={`btn-toggle-read-${volume.id}`}
            aria-label={isRead ? 'Marcar como no visto' : 'Marcar como visto'}
            onClick={(e) => {
              e.stopPropagation();
              sounds.playSelect();
              onToggleRead(volume.id);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-full text-xs font-mono transition-colors duration-150 border cursor-pointer select-none active:scale-95 shrink-0 ${
              isRead
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold'
                : 'bg-bg-quaternary hover:bg-white/10 text-on-surface-variant hover:text-white border-white/20'
            }`}
          >
            {isRead ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Visto</span>
              </>
            ) : (
              <>
                <Circle className="w-3.5 h-3.5 text-on-surface-variant/70" />
                <span className="hidden sm:inline">Marcar</span>
              </>
            )}
          </button>
        </div>

        {/* Expanded area with Framer Motion */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <m.div
              id={`volume-expand-${volume.id}`}
              initial={reduceMotion ? { opacity: 1 } : { height: 0, opacity: 0 }}
              animate={reduceMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' }}
              className="overflow-hidden border-t border-white/10"
            >
              <div className="p-3 sm:p-4 flex flex-col gap-4">
                {/* Tabs bar: Hitos · Conflicto · Clímax · Lore */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-white/10 pb-2">
                  {(['hitos', 'conflicto', 'climax', 'lore'] as RowTab[]).map((tab) => {
                    const isActive = activeTab === tab;
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => {
                          sounds.playSelect();
                          setActiveTab(tab);
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-mono uppercase font-bold tracking-wider transition-colors cursor-pointer select-none min-h-[36px] flex items-center gap-1 ${
                          isActive
                            ? 'bg-brand-accent/20 border border-brand-accent/40 text-brand-accent'
                            : 'bg-bg-quaternary/60 hover:bg-white/10 border border-white/10 text-on-surface-variant hover:text-white'
                        }`}
                      >
                        {tab === 'hitos' && 'Hitos'}
                        {tab === 'conflicto' && 'Conflicto'}
                        {tab === 'climax' && 'Clímax'}
                        {tab === 'lore' && 'Lore'}
                      </button>
                    );
                  })}
                </div>

                {/* Tab content area */}
                <div>
                  {/* 1. Hitos */}
                  {activeTab === 'hitos' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {episodeMilestones.map((ep, idx) => {
                        const epNum = ep.absoluteEpisode || Number(ep.episode.match(/\d+/)?.[0]) || volume.startEpisode || 1;
                        return (
                          <div
                            key={ep.episode}
                            role={onPlayVolume ? "button" : undefined}
                            tabIndex={onPlayVolume ? 0 : undefined}
                            aria-label={onPlayVolume ? `Reproducir: ${ep.title} (${ep.episode})` : undefined}
                            onClick={() => {
                              if (onPlayVolume) {
                                sounds.playSelect();
                                onPlayVolume(volume, epNum);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (onPlayVolume && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault();
                                sounds.playSelect();
                                onPlayVolume(volume, epNum);
                              }
                            }}
                            className={`rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden flex flex-col group/ep shadow-sm transition-all duration-200 ${
                              onPlayVolume
                                ? 'cursor-pointer hover:border-brand-accent/40 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent'
                                : ''
                            }`}
                          >
                            <div className="relative aspect-video w-full overflow-hidden shrink-0">
                              <EpisodeThumbnailImg
                                volume={volume}
                                milestone={ep}
                                fallbackSrc={sagaFallbacks[idx % sagaFallbacks.length]}
                                className="w-full h-full object-cover group-hover/ep:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30 pointer-events-none" />
                              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-3xs font-mono font-bold bg-black/80 border border-white/15 text-white">
                                {ep.iconEmoji || '⚡'} {ep.episode}
                              </span>
                              {onPlayVolume && (
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/ep:opacity-100 transition-opacity flex items-center justify-center">
                                  <div className="w-8 h-8 rounded-full bg-brand-accent text-black flex items-center justify-center shadow-brand-primary transform scale-90 group-hover/ep:scale-100 transition-transform">
                                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="p-2.5 flex flex-col gap-1 min-w-0">
                              <div className="flex items-center justify-between gap-1 min-w-0">
                                <span className="text-3xs font-mono text-on-surface-variant truncate">
                                  {ep.characterFocus || volume.title}
                                </span>
                                {onPlayVolume && (
                                  <span className="text-3xs font-mono text-brand-accent font-bold opacity-0 group-hover/ep:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
                                    <Play className="w-2.5 h-2.5 fill-current" /> Ver
                                  </span>
                                )}
                              </div>
                              <h5 className="font-display font-bold text-xs text-white leading-tight truncate group-hover/ep:text-brand-accent transition-colors">
                                {ep.title}
                              </h5>
                              <p className="text-2xs text-on-surface/85 line-clamp-2 leading-relaxed">
                                {ep.sceneHighlight || ep.synopsis}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 2. Conflicto */}
                  {activeTab === 'conflicto' && (
                    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 sm:p-4 text-xs leading-relaxed space-y-3">
                      <div className="flex items-start gap-2.5">
                        <span className="text-brand-accent font-mono font-bold text-2xs shrink-0 uppercase mt-0.5">
                          Inicio:
                        </span>
                        <p className="text-on-surface/85 text-xs sm:text-sm leading-relaxed">
                          {story?.prologue || volume.narrative.detonante.description}
                        </p>
                      </div>
                      <div className="flex items-start gap-2.5 border-t border-white/10 pt-3">
                        <span className="text-red-400 font-mono font-bold text-2xs shrink-0 uppercase mt-0.5">
                          Quiebre:
                        </span>
                        <p className="text-on-surface/85 text-xs sm:text-sm leading-relaxed">
                          {story?.turningPoint || volume.narrative.climax.description}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 3. Clímax: Duelo decisivo + Estado de las esferas + Momento icónico */}
                  {activeTab === 'climax' && (
                    <div className="bg-red-950/20 border border-red-500/25 rounded-xl p-3 sm:p-4 text-xs leading-relaxed space-y-3">
                      <span className="text-red-400 font-mono font-bold text-xs uppercase block">
                        {volume.narrative.climax.title}
                      </span>
                      <p className="text-on-surface/90 text-xs sm:text-sm leading-relaxed">
                        {story?.turningPoint || volume.narrative.climax.description}
                      </p>

                      <div className="pt-2 border-t border-red-500/20 flex flex-col gap-2">
                        {/* Duelo Decisivo */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Swords className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          <span className="text-red-300 font-mono font-bold uppercase text-2xs">
                            Duelo Decisivo:
                          </span>
                          <span className="text-white font-medium">
                            {volume.narrative.climax.decisiveBattle}
                          </span>
                        </div>

                        {/* Estado de las Esferas */}
                        {(volume.dragonBallsStatus ||
                          volume.narrative.climax.forbiddenTechniqueOrCost) && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="text-amber-300 font-mono font-bold uppercase text-2xs">
                              Esferas del Dragón:
                            </span>
                            <span className="text-on-surface/90">
                              {volume.dragonBallsStatus ||
                                volume.narrative.climax.forbiddenTechniqueOrCost}
                            </span>
                          </div>
                        )}

                        {/* Momento Icónico */}
                        {volume.narrative.climax.iconicMoment && (
                          <div className="flex items-center gap-2 flex-wrap text-on-surface/85">
                            <span className="text-red-300 font-mono text-2xs font-semibold">
                              Momento Icónico:
                            </span>
                            <span>{volume.narrative.climax.iconicMoment}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 4. Lore */}
                  {activeTab === 'lore' && (
                    <div className="bg-purple-950/20 border border-purple-500/25 rounded-xl p-3 sm:p-4 text-xs leading-relaxed space-y-2.5">
                      <span className="text-purple-400 font-mono font-bold text-xs uppercase block">
                        {volume.narrative.lore.title}
                      </span>
                      <p className="text-on-surface/90 text-xs sm:text-sm leading-relaxed">
                        {volume.narrative.lore.secretSummary}
                      </p>
                      <div className="text-2xs text-on-surface/85 pt-2 border-t border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <span>Deidad / Jerarquía: {volume.narrative.lore.deityInvolved}</span>
                        {volume.narrative.lore.unrevealedFact && (
                          <span className="text-purple-300 font-mono text-2xs">
                            {volume.narrative.lore.unrevealedFact}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Línea de metadatos (personajes, amenaza, impacto, acciones) */}
                <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono text-on-surface-variant">
                  {/* Personajes, amenaza e impacto */}
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

                  {/* Acciones: Reproducir (película / episodio) + Ver en detalle */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                    {volume.isMovie ? (
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playSelect();
                          onPlayVolume?.(volume);
                        }}
                        className="min-h-[44px] px-4 py-1.5 rounded-full bg-brand-accent hover:brightness-110 text-black text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer shadow-brand-primary active:scale-95 transition-all"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Ver película</span>
                      </button>
                    ) : (
                      volume.recommendedStartEpisode && (
                        <button
                          type="button"
                          onClick={() => {
                            sounds.playSelect();
                            onPlayVolume?.(volume, volume.recommendedStartEpisode);
                          }}
                          className="min-h-[44px] px-3.5 py-1.5 rounded-full text-xs font-mono font-bold bg-brand-accent/20 hover:bg-brand-accent/30 border border-brand-accent/40 text-brand-accent hover:text-white flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Empezar en cap. {volume.recommendedStartEpisode}</span>
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      onClick={() => onInspectThumbnail(volume)}
                      className="min-h-[44px] px-3.5 py-1.5 rounded-full bg-bg-quaternary border border-white/20 hover:border-white/40 text-xs font-mono text-white flex items-center gap-1.5 cursor-pointer active:scale-95 transition-colors"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-brand-accent" />
                      <span>Ver en detalle</span>
                    </button>
                  </div>
                </div>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

ChronologyRow.displayName = 'ChronologyRow';
