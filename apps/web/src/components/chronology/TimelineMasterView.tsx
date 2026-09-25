import React, { useState, useRef, useEffect } from 'react';
import { VolumeData, TimelineMilestone, TimelineBranch, AspectRatioType } from './types';
import { CHRONOLOGICAL_ERAS, MASTER_ERAS, SAGA_START_MILESTONES } from './data/volumes';
import { PosterCard } from './PosterCard';
import { EventsMarkerStrip } from './EventsMarkerStrip';
import { EraStickyHeader } from './EraStickyHeader';
import { TimelineProgressBar } from './TimelineProgressBar';
import { sounds } from './utils/audio';
import { SectionBar } from '@/components/ui/sectionbar';
import { Modal } from '@/components/ui/modal';
import { useReducedMotion } from '@/components/ui/kinetics/hooks';
import { MagneticIndicator } from '@/components/ui/kinetics/magnetic-indicator';
import {
  Clock,
  GitBranch,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Hourglass,
  Swords,
  Zap,
  Flame,
  Orbit,
  RotateCcw,
  BookOpen,
  Layers,
  ShieldAlert,
  Compass,
  Flag,
  BookMarked,
  X
} from 'lucide-react';

interface TimelineMasterViewProps {
  volumes: VolumeData[];
  milestones: TimelineMilestone[];
  branches: TimelineBranch[];
  selectedVolumeId: string;
  onSelectVolume: (volume: VolumeData) => void;
  aspectRatio: AspectRatioType;
  flippedVolumeIds: Set<string>;
  onToggleFlipVolume: (volumeId: string) => void;
  onOpenDetailedInspector: (volume: VolumeData) => void;
  readVolumeIds?: Set<string>;
  onToggleRead?: (volumeId: string) => void;
  onMarkAllRead?: () => void;
  onResetRead?: () => void;
  onOpenGlossary?: () => void;
}

export const TimelineMasterView: React.FC<TimelineMasterViewProps> = ({
  volumes,
  milestones,
  branches,
  selectedVolumeId,
  onSelectVolume,
  aspectRatio,
  flippedVolumeIds,
  onToggleFlipVolume,
  onOpenDetailedInspector,
  readVolumeIds,
  onToggleRead,
  onMarkAllRead,
  onResetRead,
  onOpenGlossary,
}) => {
  const [timelineMode, setTimelineMode] = useState<'panoramic' | 'vertical' | 'branches'>('panoramic');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('branch-principal');
  const [selectedEraId, setSelectedEraId] = useState<string>('all');
  const [isPlayingTour, setIsPlayingTour] = useState<boolean>(false);
  const [selectedMilestone, setSelectedMilestone] = useState<TimelineMilestone | null>(null);

  const reduceMotion = useReducedMotion();
  const horizontalScrollRef = useRef<HTMLDivElement>(null);
  const activeNodeRef = useRef<HTMLDivElement>(null);

  // Filter volumes by Era if selected
  const displayVolumes = React.useMemo(() => {
    if (selectedEraId === 'all') return volumes;
    if (selectedEraId === 'era-terrenal') {
      return volumes.filter((v) => v.saga === 'clasico');
    }
    if (selectedEraId === 'era-espacial') {
      return volumes.filter((v) => v.saga === 'saiyan-freezer');
    }
    if (selectedEraId === 'era-temporal') {
      return volumes.filter((v) => v.saga === 'cell');
    }
    if (selectedEraId === 'era-magica') {
      return volumes.filter((v) => v.saga === 'buu');
    }
    if (selectedEraId === 'era-divina') {
      return volumes.filter((v) => v.saga === 'super');
    }
    return volumes;
  }, [volumes, selectedEraId]);

  // Mapa O(1) hito->volumen: evita `find` O(n) por tarjeta en cada render
  const milestoneByVolumeId = React.useMemo(() => {
    const map = new Map<string, TimelineMilestone>();
    for (const m of milestones) {
      if (m.associatedVolumeBeforeId && !map.has(m.associatedVolumeBeforeId)) {
        map.set(m.associatedVolumeBeforeId, m);
      }
    }
    return map;
  }, [milestones]);

  // Current volume object
  const currentVolume = volumes.find((v) => v.id === selectedVolumeId) || volumes[0];
  const currentIndex = volumes.findIndex((v) => v.id === selectedVolumeId);

  // Auto-tour timer
  useEffect(() => {
    if (!isPlayingTour) return;
    const interval = setInterval(() => {
      const nextIdx = (currentIndex + 1) % volumes.length;
      onSelectVolume(volumes[nextIdx]);
      sounds.playSelect();
    }, 4500);
    return () => clearInterval(interval);
  }, [isPlayingTour, currentIndex, volumes, onSelectVolume]);

  // Scroll active volume into view on horizontal track
  useEffect(() => {
    if (timelineMode === 'panoramic' && activeNodeRef.current && horizontalScrollRef.current) {
      activeNodeRef.current.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [selectedVolumeId, timelineMode, reduceMotion]);

  const activeMasterEra = React.useMemo(() => {
    return MASTER_ERAS.find((e) => e.seriesTag === currentVolume.seriesTag) || MASTER_ERAS[0];
  }, [currentVolume]);

  const handleJumpToSaga = (targetVolumeId: string) => {
    const targetVolume = volumes.find((v) => v.id === targetVolumeId);
    if (targetVolume) {
      onSelectVolume(targetVolume);
      sounds.playSelect();
    }

    if (timelineMode === 'vertical') {
      setTimeout(() => {
        const el = document.getElementById(`vertical-station-${targetVolumeId}`);
        if (el) {
          el.scrollIntoView({
            behavior: reduceMotion ? 'auto' : 'smooth',
            block: 'center',
          });
        }
      }, 50);
    } else if (timelineMode === 'panoramic') {
      setTimeout(() => {
        const el = document.getElementById(`panoramic-station-${targetVolumeId}`);
        if (el && horizontalScrollRef.current) {
          el.scrollIntoView({
            behavior: reduceMotion ? 'auto' : 'smooth',
            inline: 'center',
            block: 'nearest',
          });
        }
      }, 50);
    }
  };

  const handleScrollStep = (direction: 'left' | 'right') => {
    if (!horizontalScrollRef.current) return;
    const delta = direction === 'left' ? -380 : 380;
    horizontalScrollRef.current.scrollBy({ left: delta, behavior: 'smooth' });
    sounds.playSelect();
  };

  const getMilestoneIcon = (type: TimelineMilestone['iconType']) => {
    switch (type) {
      case 'hourglass':
        return <Hourglass className="w-3.5 h-3.5 text-brand-accent" />;
      case 'swords':
        return <Swords className="w-3.5 h-3.5 text-red-400" />;
      case 'zap':
        return <Zap className="w-3.5 h-3.5 text-teal-400" />;
      case 'flame':
        return <Flame className="w-3.5 h-3.5 text-orange-400" />;
      case 'orbit':
        return <Orbit className="w-3.5 h-3.5 text-indigo-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-brand-accent" />;
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* PERSISTENT TIMELINE READING PROGRESS BAR */}
      {readVolumeIds && onToggleRead && onMarkAllRead && onResetRead && (
        <TimelineProgressBar
          volumes={volumes}
          readVolumeIds={readVolumeIds}
          onToggleRead={onToggleRead}
          onMarkAllRead={onMarkAllRead}
          onResetRead={onResetRead}
          onSelectVolume={(id) => {
            const vol = volumes.find((v) => v.id === id);
            if (vol) onSelectVolume(vol);
          }}
          selectedVolumeId={selectedVolumeId}
        />
      )}

      {/* TIMELINE CONTROL DECK */}
      <SectionBar
        label="LÍNEA TEMPORAL CANÓNICA"
        description="Del Año 749 al 780 • Calendario Oficial de Akira Toriyama & Daizenshuu"
        icon={Clock}
        variant="strong"
        collapsible
        defaultOpen={true}
        className="w-full"
      >
        <div className="flex flex-col gap-3.5">
          {/* Controls: Mode Switcher & Auto-Tour */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Auto Tour Play/Pause */}
              <button
                id="btn-timeline-autotour"
                onClick={() => {
                  sounds.playSelect();
                  setIsPlayingTour(!isPlayingTour);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-colors duration-150 border active:scale-95 cursor-pointer ${
                  isPlayingTour
                    ? 'bg-red-500/20 border-red-500/50 text-red-300'
                    : 'bg-surface-container text-on-surface-variant border-white/10 hover:border-white/30'
                }`}
              >
                {isPlayingTour ? (
                  <>
                    <Pause className="w-3.5 h-3.5 text-red-400" />
                    <span>Pausar Recorrido</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-brand-accent" />
                    <span>Recorrido Cronológico</span>
                  </>
                )}
              </button>

              {/* Timeline View Tabs — segmented control (§5.3) con indicador layoutId */}
              <div
                role="tablist"
                aria-label="Vista de la cronología"
                className="flex items-center gap-1 rounded-full border border-white/20 border-t-white/40 border-b-white/10 bg-zinc-950/40 p-1.5"
              >
                {([
                  { mode: 'panoramic', id: 'btn-view-panoramic', label: 'Panorámica', Icon: Compass, pill: 'bg-brand-accent' },
                  { mode: 'vertical', id: 'btn-view-vertical', label: 'Crónica Vertical', Icon: Layers, pill: 'bg-brand-accent' },
                  { mode: 'branches', id: 'btn-view-branches', label: 'Paradojas de Trunks', Icon: GitBranch, pill: 'bg-teal-400' },
                ] as const).map(({ mode, id, label, Icon, pill }) => {
                  const isActive = timelineMode === mode;
                  return (
                    <button
                      key={mode}
                      id={id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-label={label}
                      onClick={() => {
                        sounds.playSelect();
                        setTimelineMode(mode);
                      }}
                      className={`relative flex min-h-11 min-w-11 items-center justify-center gap-1.5 px-3 rounded-full text-xs font-mono font-bold transition-colors duration-base active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
                        isActive ? 'text-neutral-950' : 'text-on-surface-variant hover:text-on-surface hover:bg-white/10'
                      }`}
                    >
                      <MagneticIndicator
                        layoutId="chronoTimelineMode"
                        active={isActive}
                        disableAnimation={!!reduceMotion}
                        className={pill}
                      />
                      <Icon className="relative z-10 w-3.5 h-3.5" />
                      <span className="relative z-10 hidden sm:inline">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lore Glossary Button */}
            {onOpenGlossary && (
              <button
                id="btn-timeline-open-glossary"
                onClick={() => {
                  sounds.playSelect();
                  onOpenGlossary();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-accent/15 hover:bg-brand-accent/25 border border-brand-secondary/40 text-brand-accent text-xs font-mono font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                title="Abrir Glosario de Conceptos de Lore y Leyes Canónicas"
              >
                <BookMarked className="w-3.5 h-3.5 text-brand-accent" />
                <span>Glosario de Lore</span>
              </button>
            )}
          </div>

          {/* Master Cosmic Era Selector Bar */}
          <div className="pt-2 border-t border-white/5 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-3xs font-mono uppercase tracking-widest text-on-surface-variant shrink-0 mr-1">
              Filtrar Era:
            </span>
            <button
              onClick={() => {
                sounds.playSelect();
                setSelectedEraId('all');
              }}
              className={`px-2.5 py-1 rounded-lg font-mono text-2xs whitespace-nowrap transition-all border active:scale-95 cursor-pointer ${
                selectedEraId === 'all'
                  ? 'bg-brand-accent/20 text-brand-accent border-brand-accent/50 font-bold'
                  : 'bg-surface-container/60 text-on-surface-variant border-white/5 hover:text-white'
              }`}
            >
              Todas las Eras ({volumes.length} Tomos)
            </button>

            {CHRONOLOGICAL_ERAS.map((era) => {
              const isActive = selectedEraId === era.id;
              return (
                <button
                  key={era.id}
                  onClick={() => {
                    sounds.playSelect();
                    setSelectedEraId(era.id);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-2xs whitespace-nowrap transition-all border active:scale-95 cursor-pointer ${
                    isActive
                      ? 'bg-surface-container-high text-white border-white/40 shadow-sm'
                      : 'bg-surface-container/40 text-on-surface-variant border-white/5 hover:border-white/20 hover:text-on-surface/90'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: era.colorHex }} />
                  <span>{era.name}</span>
                  <span className="text-4xs text-on-surface-variant/70">({era.years})</span>
                </button>
              );
            })}
          </div>
        </div>
      </SectionBar>

      {/* TIMELINE WORKSPACE WITH EVENTS MARKER STRIP ON THE SIDE */}
      <div className="flex flex-col xl:flex-row items-start gap-6 w-full relative">
        {/* Clickable 'Events Marker' strip to the side of the timeline view */}
        <EventsMarkerStrip
          milestones={SAGA_START_MILESTONES}
          selectedVolumeId={selectedVolumeId}
          onSelectMilestone={(m) => handleJumpToSaga(m.volumeId)}
          className="hidden xl:flex"
        />

        {/* Main Timeline Display Track */}
        <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
          {/* Mobile/Tablet Horizontal Events Marker Strip */}
          <div className="flex xl:hidden overflow-x-auto pb-2 w-full gap-2 px-1 select-none" style={{ scrollbarWidth: 'none' }}>
            <div className="flex items-center gap-2 min-w-max">
<span className="text-3xs font-mono uppercase tracking-widest text-brand-accent font-bold px-2 py-1 bg-brand-accent/10 border border-brand-secondary/30 rounded-lg flex items-center gap-1">
  <Flag className="w-3 h-3 text-brand-accent" />
                Inicios de Saga:
              </span>
              {SAGA_START_MILESTONES.map((m) => {
                const isActive = selectedVolumeId === m.volumeId;
                return (
                  <button
                    key={m.id}
                    id={`mobile-event-marker-${m.id}`}
                    onClick={() => handleJumpToSaga(m.volumeId)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-all border ${
                      isActive
                        ? 'bg-on-surface/15 text-white border-white shadow-sm font-bold scale-105'
                        : 'bg-bg-quaternary/80 text-on-surface/85 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.colorHex }} />
                    <span>{m.shortTitle}</span>
                    <span className="text-4xs text-on-surface-variant">({m.year})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* MODE 1: PANORAMIC HORIZONTAL TIMELINE WITH EXPANSIVE TIME CANAL */}
          {/* ========================================================================= */}
          {timelineMode === 'panoramic' && (
            <div className="flex flex-col gap-4">
              {/* Distinct 'Era' Sticky Header above the horizontal track */}
              <EraStickyHeader
                era={activeMasterEra}
                volumeCount={displayVolumes.filter((v) => v.seriesTag === activeMasterEra.seriesTag).length}
                sagas={SAGA_START_MILESTONES.filter((s) => s.eraKey === activeMasterEra.key)}
                selectedVolumeId={selectedVolumeId}
                onJumpToSaga={handleJumpToSaga}
              />
          {/* Scroll Navigation Header Bar */}
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2 text-xs font-mono text-on-surface-variant">
              <span className="text-brand-accent font-bold">Línea Panorámica Continua:</span>
              <span>Desliza para recorrer la historia de izquierda a derecha</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleScrollStep('left')}
                aria-label="Desplazar a la izquierda"
                className="min-w-[44px] min-h-[44px] p-2 rounded-xl bg-bg-quaternary border border-white/10 hover:border-white/30 text-on-surface/85 hover:text-white transition-all flex items-center justify-center"
                title="Desplazar a la izquierda"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleScrollStep('right')}
                aria-label="Desplazar a la derecha"
                className="min-w-[44px] min-h-[44px] p-2 rounded-xl bg-bg-quaternary border border-white/10 hover:border-white/30 text-on-surface/85 hover:text-white transition-all flex items-center justify-center"
                title="Desplazar a la derecha"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Master Panoramic Scroll Area */}
          <div
            ref={horizontalScrollRef}
            className="w-full overflow-x-auto pb-6 pt-2 px-2 select-none scroll-smooth"
            style={{ scrollbarWidth: 'thin' }}
          >
            <div className="flex items-stretch min-w-max gap-6 relative pt-10">
              {/* Continuous Glowing Ki Energy Line */}
              <div className="absolute top-4 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 via-emerald-500 via-red-500 via-teal-500 via-pink-500 to-cyan-400 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.5)] pointer-events-none" />

              {/* Render Volumes interleaved with Chronological Milestones */}
              {displayVolumes.map((volume, index) => {
                const isSelected = volume.id === selectedVolumeId;
                const isFlipped = flippedVolumeIds.has(volume.id);

                // Lookup O(1) del hito posterior a este volumen
                const milestoneAfter = milestoneByVolumeId.get(volume.id);

                return (
                  <React.Fragment key={volume.id}>
                    {/* VOLUME TIMELINE STATION */}
                    <div
                      ref={isSelected ? activeNodeRef : null}
                      id={`panoramic-station-${volume.id}`}
                      className={`flex flex-col items-center shrink-0 w-[300px] sm:w-[320px] transition-all duration-300 relative ${
                        isSelected ? 'scale-[1.02]' : 'opacity-90 hover:opacity-100'
                      }`}
                    >
                      {/* Timeline Node Pin on top energy line */}
                      <div className="absolute -top-10 flex flex-col items-center z-20">
                        <span
                          className={`text-3xs font-mono font-bold px-2 py-0.5 rounded-full border mb-1 transition-all ${
                            isSelected
                              ? 'bg-brand-accent text-neutral-950 border-brand-accent/30 shadow-brand-primary'
                              : 'bg-bg-quaternary text-on-surface/85 border-white/20'
                          }`}
                        >
                          {volume.officialYear}
                        </span>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-brand-accent border-white scale-125 shadow-brand-primary'
                              : 'bg-bg-primary border-white/40'
                          }`}
                        >
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: volume.coverArt.accentHex }}
                          />
                        </div>
                      </div>

                      {/* Poster Card with aspect ratio and flip capability */}
                      <div className="w-full flex flex-col items-center">
                        { }
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={`Abrir ${volume.title}`}
                          onClick={() => {
                            sounds.playSelect();
                            onSelectVolume(volume);
                          }}
                          onKeyDown={(e) => {
                            if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
                            e.preventDefault();
                            sounds.playSelect();
                            onSelectVolume(volume);
                          }}
                          className="w-full cursor-pointer rounded-2xl"
                        >
                          <PosterCard
                            volume={volume}
                            aspectRatio={aspectRatio}
                            isFlipped={isFlipped}
                            onToggleFlip={() => onToggleFlipVolume(volume.id)}
                            isSelected={isSelected}
                            size="md"
                            isRead={readVolumeIds?.has(volume.id)}
                            onToggleRead={onToggleRead ? () => onToggleRead(volume.id) : undefined}
                          />
                        </div>

                        {/* Station Quick Summary Bar */}
                        <div
                          className={`w-full mt-3 p-3 rounded-xl border transition-all ${
                            isSelected
                              ? 'bg-bg-quaternary/90 border-brand-accent/50 shadow-elevation-2'
                              : 'bg-bg-quaternary/40 border-white/5 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-display text-sm tracking-wider text-white truncate">
                              {volume.volumeNumber} • {volume.episodesRange}
                            </span>
                            {volume.isFeaturedExample && (
                              <span className="text-4xs font-mono px-1.5 py-px rounded bg-brand-accent/20 text-brand-accent border border-brand-accent/30">
                                MAESTRO
                              </span>
                            )}
                          </div>

                          <p className="text-2xs text-on-surface/85 line-clamp-2 leading-relaxed">
                            {volume.subtitle}
                          </p>

                          {/* Action Buttons */}
                          <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-2xs font-mono">
                            <button
                              onClick={() => {
                                sounds.playFlip();
                                onToggleFlipVolume(volume.id);
                              }}
                              className="text-on-surface-variant hover:text-brand-accent flex items-center gap-1 transition-colors"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>{isFlipped ? 'Anverso' : 'Dorso de Lore'}</span>
                            </button>

                            <button
                              onClick={() => {
                                sounds.playSelect();
                                onOpenDetailedInspector(volume);
                              }}
                              className="text-brand-accent hover:text-brand-secondary font-bold flex items-center gap-1 transition-colors"
                            >
                              <span>3 Niveles</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* INTERMEDIATE MILESTONE CONNECTOR BETWEEN VOLUMES */}
                    {milestoneAfter && index < displayVolumes.length - 1 && (
                      <div className="flex flex-col items-center justify-center shrink-0 w-36 px-1 relative">
                        {/* Connecting icon on Ki energy line */}
                        <div className="absolute -top-6 flex flex-col items-center z-10">
                          <div
                            role="button"
                            tabIndex={0}
                            aria-label={`Ver hito: ${milestoneAfter.label}`}
                            onClick={() => {
                              sounds.playSelect();
                              setSelectedMilestone(milestoneAfter);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                sounds.playSelect();
                                setSelectedMilestone(milestoneAfter);
                              }
                            }}
                            className="w-7 h-7 rounded-full bg-bg-quaternary border border-white/20 hover:border-white/40 hover:scale-110 flex items-center justify-center cursor-pointer shadow-md transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                            title={milestoneAfter.label}
                          >
                            {getMilestoneIcon(milestoneAfter.iconType)}
                          </div>
                        </div>

                        {/* Milestone Bridge Card */}
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={`Ver hito: ${milestoneAfter.label}`}
                          onClick={() => {
                            sounds.playSelect();
                            setSelectedMilestone(milestoneAfter);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              sounds.playSelect();
                              setSelectedMilestone(milestoneAfter);
                            }
                          }}
                          className="w-full bg-bg-primary/80 border border-white/10 hover:border-white/25 rounded-xl p-2.5 text-center cursor-pointer transition-all hover:bg-bg-quaternary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                        >
                          <span className="text-4xs font-mono text-brand-accent font-bold block uppercase tracking-tighter">
                            {milestoneAfter.durationOrGap || milestoneAfter.year}
                          </span>
                          <span className="text-3xs font-sans font-medium text-on-surface/85 line-clamp-2 mt-0.5 leading-tight">
                            {milestoneAfter.label}
                          </span>
                          <span className="text-4xs text-on-surface/85 font-mono block mt-1">
                            + Info
                          </span>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: VERTICAL CHRONICLE (DEEP IMMERSIVE STORY EXPEDITION) */}
      {/* ========================================================================= */}
      {timelineMode === 'vertical' && (
        <div className="flex flex-col gap-14 relative">
          {MASTER_ERAS.map((era) => {
            const eraVolumes = displayVolumes.filter((v) => v.seriesTag === era.seriesTag);
            if (eraVolumes.length === 0) return null;
            const eraSagas = SAGA_START_MILESTONES.filter((s) => s.eraKey === era.key);

            return (
              <section
                key={era.key}
                id={`era-section-${era.key}`}
                className="relative flex flex-col gap-8 scroll-mt-28"
              >
                {/* Distinct 'Era' Sticky Header that pins to the top of the viewport when scrolling */}
                <EraStickyHeader
                  era={era}
                  volumeCount={eraVolumes.length}
                  sagas={eraSagas}
                  selectedVolumeId={selectedVolumeId}
                  onJumpToSaga={handleJumpToSaga}
                />

                {/* Volumes container for this Era */}
                <div className="flex flex-col gap-10 relative">
                  {/* Continuous Central Vertical Ki Conduit for this Era */}
                  <div
                    className="hidden md:block absolute left-1/2 top-4 bottom-8 -translate-x-1/2 w-1 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.4)] pointer-events-none"
                    style={{
                      background: `linear-gradient(to bottom, ${era.themeColorHex}, #fbbf24, ${era.themeColorHex})`,
                    }}
                  />

                  {eraVolumes.map((volume, index) => {
                    const isSelected = volume.id === selectedVolumeId;
                    const isEven = index % 2 === 0;
                    const isFlipped = flippedVolumeIds.has(volume.id);

                    const milestoneAfter = milestoneByVolumeId.get(volume.id);

                    return (
                      <React.Fragment key={volume.id}>
                        {/* Vertical Volume Card */}
                        <div
                          id={`vertical-station-${volume.id}`}
                          className={`w-full flex flex-col md:flex-row items-center justify-between gap-6 relative scroll-mt-36 ${
                            isEven ? 'md:flex-row-reverse' : ''
                          }`}
                        >
                          {/* Central Node Badge */}
                          <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 z-20 flex-col items-center">
                            <span className="text-4xs font-mono font-bold bg-bg-quaternary border border-white/20 text-on-surface/85 px-2 py-0.5 rounded-full mb-1">
                              {volume.officialYear}
                            </span>
                            <div
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                isSelected
                                  ? 'bg-brand-accent border-white scale-125 shadow-brand-primary'
                                  : 'bg-bg-primary border-white/40'
                              }`}
                            >
                              <div
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: volume.coverArt.accentHex }}
                              />
                            </div>
                          </div>

                          {/* Left or Right Side: The Master Cover Artwork */}
                          <div className="w-full md:w-[46%] flex flex-col items-center">
                            { }
                            <div
                              role="button"
                              tabIndex={0}
                              aria-label={`Abrir ${volume.title}`}
                              onClick={() => {
                                sounds.playSelect();
                                onSelectVolume(volume);
                              }}
                              onKeyDown={(e) => {
                                if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
                                e.preventDefault();
                                sounds.playSelect();
                                onSelectVolume(volume);
                              }}
                              className="cursor-pointer rounded-2xl transition-transform hover:scale-[1.01]"
                            >
                              <PosterCard
                                volume={volume}
                                aspectRatio={aspectRatio}
                                isFlipped={isFlipped}
                                onToggleFlip={() => onToggleFlipVolume(volume.id)}
                                isSelected={isSelected}
                                size="lg"
                                isRead={readVolumeIds?.has(volume.id)}
                                onToggleRead={onToggleRead ? () => onToggleRead(volume.id) : undefined}
                              />
                            </div>
                          </div>

                          {/* Opposite Side: The 3 Narrative Levels Breakdown Card */}
                          <div className="w-full md:w-[46%]">
                            <div
                              className={`bg-surface-container/85 border rounded-2xl p-5 transition-all ${
                                isSelected
                                  ? 'border-brand-accent shadow-brand-primary'
                                  : 'border-white/10 hover:border-white/20'
                              }`}
                            >
                              {/* Header */}
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="px-2 py-0.5 rounded text-3xs font-mono font-bold uppercase"
                                    style={{
                                      backgroundColor: `${volume.coverArt.accentHex}20`,
                                      color: volume.coverArt.accentHex,
                                      border: `1px solid ${volume.coverArt.accentHex}40`,
                                    }}
                                  >
                                    {volume.volumeNumber} • {volume.officialYear}
                                  </span>
                                  <span className="text-xs font-mono text-on-surface-variant">
                                    {volume.episodesRange}
                                  </span>
                                </div>

                                <button
                                  onClick={() => {
                                    sounds.playFlip();
                                    onToggleFlipVolume(volume.id);
                                  }}
                                  className="text-xs font-mono text-brand-accent hover:text-brand-secondary underline flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>{isFlipped ? 'Ver Anverso' : 'Ver Dorso de Lore'}</span>
                                </button>
                              </div>

                              <h4 className="font-display text-2xl tracking-wide text-white">
                                {volume.title}
                              </h4>
                              <p className="text-xs text-on-surface/85 italic mb-4">
                                {volume.subtitle}
                              </p>

                              {/* The 3 Levels Summary Preview */}
                              <div className="space-y-3 text-xs">
                                {/* Nivel 1 */}
                                <div className="bg-bg-primary/60 p-2.5 rounded-xl border border-white/5">
                                  <div className="flex items-center gap-1.5 text-brand-accent font-mono font-bold text-2xs mb-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-brand-accent" />
                                    <span>1. EL DETONANTE ({volume.narrative.detonante.exactEpisodePoint.split(':')[0]})</span>
                                  </div>
                                  <p className="text-on-surface/85 text-2xs line-clamp-2">
                                    {volume.narrative.detonante.description}
                                  </p>
                                </div>

                                {/* Nivel 2 */}
                                <div className="bg-bg-primary/60 p-2.5 rounded-xl border border-white/5">
                                  <div className="flex items-center gap-1.5 text-red-400 font-mono font-bold text-2xs mb-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                    <span>2. EL CLÍMAX DRAMÁTICO</span>
                                  </div>
                                  <p className="text-on-surface/85 text-2xs line-clamp-2">
                                    {volume.narrative.climax.description}
                                  </p>
                                </div>

                                {/* Nivel 3 */}
                                <div className="bg-bg-primary/60 p-2.5 rounded-xl border border-white/5">
                                  <div className="flex items-center gap-1.5 text-cyan-400 font-mono font-bold text-2xs mb-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                                    <span>3. ARCHIVO DE LORE (DORSO)</span>
                                  </div>
                                  <p className="text-on-surface/85 text-2xs line-clamp-2">
                                    {volume.narrative.lore.secretSummary}
                                  </p>
                                </div>
                              </div>

                              {/* Footer Actions */}
                              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-1 flex-wrap">
                                  {volume.characters.slice(0, 4).map((char, ci) => (
                                    <span
                                      key={ci}
                                      className="text-3xs font-mono px-2 py-0.5 rounded bg-on-surface/15 text-on-surface/85"
                                    >
                                      {char}
                                    </span>
                                  ))}
                                </div>

                                <button
                                  onClick={() => {
                                    sounds.playSelect();
                                    onOpenDetailedInspector(volume);
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-brand-accent text-neutral-950 text-xs font-mono font-bold hover:bg-brand-secondary transition-colors flex items-center gap-1.5 shadow-sm"
                                >
                                  <BookOpen className="w-3.5 h-3.5" />
                                  <span>Inspeccionar Tomo</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Vertical Intermediate Milestone */}
                        {milestoneAfter && index < eraVolumes.length - 1 && (
                          <div className="w-full flex items-center justify-center my-2">
                            <div
                              role="button"
                              tabIndex={0}
                              aria-label={`Ver hito: ${milestoneAfter.label}`}
                              onClick={() => {
                                sounds.playSelect();
                                setSelectedMilestone(milestoneAfter);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  sounds.playSelect();
                                  setSelectedMilestone(milestoneAfter);
                                }
                              }}
                              className="max-w-md w-full bg-bg-primary/90 border border-white/10 hover:border-white/25 rounded-xl p-3 flex items-center gap-3 cursor-pointer shadow-md transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                            >
                              <div className="w-8 h-8 rounded-xl bg-bg-quaternary border border-white/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                {getMilestoneIcon(milestoneAfter.iconType)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-3xs font-mono text-brand-accent font-bold uppercase">
                                    {milestoneAfter.year} • {milestoneAfter.durationOrGap}
                                  </span>
                                  <span className="text-4xs font-mono text-on-surface-variant/70">
                                    Hito Histórico
                                  </span>
                                </div>
                                <p className="text-xs font-medium text-on-surface/90 truncate mt-0.5">
                                  {milestoneAfter.label}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 3: MULTIVERSE TIME BRANCHES (PARADOJAS TEMPORALES DE TRUNKS & CELL) */}
      {/* ========================================================================= */}
      {timelineMode === 'branches' && (
        <div className="flex flex-col gap-6 bg-surface-container/85 border border-teal-500/30 rounded-2xl p-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center shrink-0">
                <GitBranch className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <h3 className="font-display text-2xl tracking-wider text-white">
                  DIAGRAMA MULTIVERSAL DE LAS LÍNEAS TEMPORALES
                </h3>
                <p className="text-xs text-on-surface/85 font-mono max-w-2xl">
                  En Dragon Ball, el tiempo no es convergente: cada viaje hacia el pasado genera una
                  nueva rama dimensional y crea un <strong>Anillo del Tiempo verde</strong> en el
                  reino de los Kaioshins. Este es el trasfondo cósmico de <em>&ldquo;El Pecado Temporal&rdquo; (Volumen 05)</em>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-2xs font-mono text-teal-300 bg-teal-950/80 border border-teal-500/40 px-3 py-1 rounded-full flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                4 Líneas Documentadas
              </span>
            </div>
          </div>

          {/* Branch Selector Tabs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {branches.map((branch) => {
              const isActive = selectedBranchId === branch.id;
              return (
                <button
                  key={branch.id}
                  onClick={() => {
                    sounds.playSelect();
                    setSelectedBranchId(branch.id);
                  }}
                  aria-pressed={isActive}
                  className={`flex flex-col text-left p-3.5 rounded-xl border transition-[border-color,background-color,box-shadow] duration-base ease-smooth-out ${
                    isActive
                      ? 'bg-teal-950/80 border-teal-400 shadow-elevation-2'
                      : 'bg-bg-quaternary/60 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-3xs font-mono font-bold text-teal-400 uppercase">
                      {branch.originYear}
                    </span>
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: branch.ringOfTimeColor }}
                    />
                  </div>
                  <h5 className="font-display text-lg tracking-wide text-white leading-tight">
                    {branch.name}
                  </h5>
                  <span className="text-2xs text-on-surface-variant font-mono mt-0.5 truncate">
                    {branch.codeName}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected Branch Deep Dive */}
          {(() => {
            const branch = branches.find((b) => b.id === selectedBranchId) || branches[0];
            return (
              <div className="bg-bg-primary/80 border border-white/10 rounded-xl p-5 flex flex-col lg:flex-row gap-6">
                <div className="flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-teal-400/20 text-teal-300 border border-teal-400/30">
                        {branch.originYear}
                      </span>
                      <span className="text-xs font-mono text-on-surface-variant">
                        Causa de la Ruptura: {branch.paradoxCause}
                      </span>
                    </div>

                    <h4 className="font-display text-2xl tracking-wider text-white">
                      {branch.name}
                    </h4>
                    <p className="text-sm text-on-surface/85 leading-relaxed mt-1">
                      {branch.summary}
                    </p>
                  </div>

                  {/* Timeline Events Sequence */}
                  <div>
                    <span className="text-2xs font-mono uppercase tracking-wider text-on-surface-variant block mb-2">
                      Secuencia Causal de Eventos:
                    </span>
                    <ul className="space-y-2 text-xs">
                      {branch.events.map((ev, ei) => (
                        <li key={ei} className="flex items-start gap-2 text-on-surface/90">
                          <span className="w-5 h-5 rounded-full bg-teal-950 border border-teal-500/40 text-teal-300 text-3xs font-mono flex items-center justify-center shrink-0 mt-0.5">
                            {ei + 1}
                          </span>
                          <span>{ev}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Destination / Fate */}
                  <div className="p-3 rounded-lg bg-bg-quaternary border border-white/10 flex items-center justify-between text-xs">
                    <span className="font-mono text-on-surface-variant">Destino Canónico de esta Línea:</span>
                    <span className="font-mono font-bold text-brand-accent">{branch.fate}</span>
                  </div>
                </div>

                {/* Relationship with Volume 05: El Pecado Temporal */}
                <div className="w-full lg:w-72 bg-teal-950/40 border border-teal-500/30 rounded-xl p-4 flex flex-col justify-between shrink-0">
                  <div>
                    <span className="text-3xs font-mono text-teal-400 uppercase tracking-wider block mb-1">
                      Conexión Directa de Tomo
                    </span>
                    <h5 className="font-display text-xl text-white">
                      Volumen 05: El Pecado Temporal
                    </h5>
                    <p className="text-xs text-on-surface/85 mt-1 leading-relaxed">
                      Este tomo aborda exactamente el momento en que Trunks decapita a Mecha Freezer
                      y Cell viaja en la máquina generando estas fisuras multidimensionales.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      sounds.playSelect();
                      const v5 = volumes.find((v) => v.id === 'dbz-androides-trunks') || volumes.find((v) => v.id === 'vol-cell-trunks') || volumes[0];
                      onSelectVolume(v5);
                      onOpenDetailedInspector(v5);
                    }}
                    className="w-full mt-4 py-2 rounded-xl bg-teal-400 text-neutral-950 font-mono font-bold text-xs hover:bg-teal-300 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Inspeccionar Volumen 05</span>
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
        </div>
      </div>

      {/* MILESTONE DETAILS MODAL / POPUP */}
      <Modal
        open={selectedMilestone != null}
        onOpenChange={(open) => {
          if (!open) setSelectedMilestone(null)
        }}
        title={selectedMilestone ? <span className="sr-only">Hito histórico: {selectedMilestone.label}</span> : undefined}
        hideCloseButton
      >
        {selectedMilestone && (
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-brand-accent/20 border border-brand-secondary/40 flex items-center justify-center">
                  {getMilestoneIcon(selectedMilestone.iconType)}
                </div>
                <div>
                  <span className="text-3xs font-mono text-brand-accent uppercase font-bold">
                    Hito Histórico Intermedio · {selectedMilestone.year}
                  </span>
                  <h4 className="font-display text-xl text-white leading-tight">
                    {selectedMilestone.label}
                  </h4>
                </div>
              </div>

              <button
                onClick={() => setSelectedMilestone(null)}
                aria-label="Cerrar hito"
                className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-on-surface/15 text-on-surface-variant hover:text-white flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-on-surface/85 leading-relaxed">
              <div className="p-3 bg-bg-primary rounded-xl border border-white/5 font-mono text-brand-accent">
                Lapso temporal transcurrido: {selectedMilestone.durationOrGap}
              </div>
              <p>{selectedMilestone.description}</p>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedMilestone(null)}
                className="px-4 min-h-[44px] rounded-xl bg-brand-accent text-neutral-950 font-mono font-bold text-xs hover:bg-brand-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
              >
                Cerrar Hito
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
