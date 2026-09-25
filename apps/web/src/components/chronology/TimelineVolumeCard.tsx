import React, { useState, memo } from 'react';
import type { VolumeData } from './types';
import { EpisodeThumbnailImg } from './EpisodeThumbnailImg';
import { MomentStrip, type MomentPlayInfo, type MomentPreview } from './MomentStrip';
import { VolumeDetailsTabs, type DetailTab } from './VolumeDetailsTabs';
import { getSagaBadgeConfig } from './utils/sagaBadge';
import { getSagaFallbackImages } from './data/sagaImages';
import { sounds } from './utils/audio';
import { hexToRgbChannels } from './utils/eraColor';
import { Play, CheckCircle2, Circle, ChevronDown, Maximize2 } from 'lucide-react';

export interface TimelineVolumeCardProps {
  volume: VolumeData;
  isRead: boolean;
  /** Avance del lapso según el historial (0–100). */
  progressPercent?: number;
  /** Primer episodio sin ver cuando el lapso está empezado. */
  nextEpisode?: number;
  isHighlighted?: boolean;
  /** Color de la era: tiñe borde, brillo, etiquetas y avance. */
  accentHex?: string;
  serverMomentTimes?: Record<string, number>;
  onToggleRead: (volumeId: string) => void;
  onInspectThumbnail?: (volume: VolumeData) => void;
  onPlayVolume?: (volume: VolumeData, episodeNum?: number, momentInfo?: MomentPlayInfo) => void;
  /** Estado de apertura de detalles controlado externamente (soporte contralateral) */
  isDetailsOpen?: boolean;
  onToggleDetails?: (volumeId: string) => void;
  detailTab?: DetailTab;
  /** Recibe el id del lapso para que la lista pase un callback estable y el memo sirva. */
  onTabChange?: (volumeId: string, tab: DetailTab) => void;
}

export const TimelineVolumeCard: React.FC<TimelineVolumeCardProps> = memo(
  ({
    volume,
    isRead,
    progressPercent = 0,
    nextEpisode,
    isHighlighted = false,
    accentHex = '#f59e0b',
    serverMomentTimes,
    onToggleRead,
    onInspectThumbnail,
    onPlayVolume,
    isDetailsOpen: controlledShowDetails,
    onToggleDetails: controlledToggleDetails,
    detailTab: controlledDetailTab,
    onTabChange: controlledTabChange,
  }) => {
    const [localShowDetails, setLocalShowDetails] = useState(false);
    const showDetails = controlledShowDetails ?? localShowDetails;
    // El contenido del cajón se monta al abrirlo por primera vez: 42 tarjetas no lo pagan de entrada.
    const [hasOpenedDetails, setHasOpenedDetails] = useState(false);
    const [localDetailTab, setLocalDetailTab] = useState<DetailTab>('conflicto');
    const detailTab = controlledDetailTab ?? localDetailTab;
    const handleTabChange = (tab: DetailTab) => {
      setLocalDetailTab(tab);
      controlledTabChange?.(volume.id, tab);
    };
    // Momento apuntado en la tira: la miniatura grande lo muestra mientras dure el hover o el foco.
    const [preview, setPreview] = useState<MomentPreview | null>(null);

    const sagaConfig = getSagaBadgeConfig(volume.saga, volume.sagaLabel);
    const sagaFallbacks = getSagaFallbackImages(volume.id);

    const firstMilestone = volume.detailedStory?.episodeMilestones?.[0] || {
      episode: `Cap. ${volume.startEpisode ?? 1}`,
      title: volume.title,
      synopsis: volume.subtitle,
    };

    const capsFormatted =
      volume.startEpisode && volume.endEpisode
        ? `${volume.startEpisode}–${volume.endEpisode}`
        : volume.episodesRange
            .replace(/^caps?\s*/i, '')
            .replace(/\s*al\s*/i, '–')
            .replace(/^0+/g, '')
            .replace(/–0+/g, '–');

    const fillerCount = volume.fillerEpisodes?.length ?? 0;
    const showPartialProgress = !isRead && progressPercent > 0 && progressPercent < 100;

    const defaultEp = volume.recommendedStartEpisode || volume.startEpisode || 1;

    // El botón principal dice qué va a pasar: seguir donde quedaste, empezar o repetir.
    const playTarget = isRead
      ? {
          label: 'Volver a ver',
          episode: volume.startEpisode || defaultEp,
        }
      : showPartialProgress && nextEpisode
        ? {
            label: `Continuar · Cap. ${nextEpisode}`,
            episode: nextEpisode,
          }
        : { label: `Empezar · Cap. ${defaultEp}`, episode: defaultEp };

    const handlePlayMain = () => {
      sounds.playSelect();
      onPlayVolume?.(volume, playTarget.episode);
    };

    const handleToggleDetails = () => {
      sounds.playSelect();
      setHasOpenedDetails(true);
      if (controlledToggleDetails) {
        controlledToggleDetails(volume.id);
      } else {
        setLocalShowDetails((prev) => !prev);
      }
    };

    // El tilde celebra solo cuando lo marcás vos, no cada vez que la tarjeta se monta.
    const [celebrateRead, setCelebrateRead] = useState(false);

    const handleToggleWatched = (e: React.MouseEvent) => {
      e.stopPropagation();
      sounds.playSelect();
      setCelebrateRead(!isRead);
      onToggleRead(volume.id);
    };

    return (
      <article
        id={`timeline-card-${volume.id}`}
        style={{ '--era': hexToRgbChannels(accentHex) } as React.CSSProperties}
        className={`group relative isolate flex flex-col rounded-2xl border overflow-hidden bg-zinc-950 bg-[linear-gradient(180deg,rgb(255_255_255/0.055),rgb(255_255_255/0.012)_40%,transparent_75%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_24px_48px_-28px_rgb(0_0_0/0.9)] transition-[border-color,box-shadow,transform] duration-300 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
          isHighlighted
            ? 'ring-2 ring-[rgb(var(--era)/0.7)] border-[rgb(var(--era)/0.5)]'
            : isRead
              ? 'border-emerald-500/30 hover:border-emerald-400/50'
              : 'border-white/[0.09] hover:border-[rgb(var(--era)/0.45)] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.09),0_30px_60px_-30px_rgb(var(--era)/0.5)]'
        }`}
      >
        {/* Filete superior con el color de la era */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-[rgb(var(--era)/0.85)] to-transparent opacity-70 transition-opacity duration-300 group-hover:opacity-100"
        />

        {/* 1. Main 16:9 Image */}
        <div className="group/thumb relative w-full aspect-video bg-zinc-900 overflow-hidden">
          <EpisodeThumbnailImg
            key={preview ? (preview.milestone.momentKey ?? `ep-${preview.episodeNum}`) : 'cover'}
            volume={volume}
            milestone={preview?.milestone ?? firstMilestone}
            startSec={preview?.seconds}
            fallbackSrc={sagaFallbacks[0]}
            fetchPriority="high"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          />

          {/* Viñeta: arriba oscurece para las etiquetas y abajo funde el arte con el cuerpo */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/25 to-black/45 pointer-events-none" />

          {/* Saga y caps arriba a la izquierda; inspeccionar arriba a la derecha */}
          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-2 pointer-events-none">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-mono font-bold border ${sagaConfig.bg} ${sagaConfig.border} ${sagaConfig.text}`}
              >
                <span>{sagaConfig.icon}</span>
                <span className="truncate max-w-[140px] sm:max-w-none">{volume.sagaLabel}</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-3xs font-mono font-bold bg-black/75 border border-white/20 text-white/90 tabular-nums">
                Caps {capsFormatted}
              </span>
            </div>
            <div className="flex items-center gap-1.5 pointer-events-auto shrink-0">
              {onInspectThumbnail && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playSelect();
                    onInspectThumbnail(volume);
                  }}
                  aria-label={`Inspeccionar arte de ${volume.title}`}
                  className="w-11 h-11 rounded-full bg-black/70 hover:bg-black/85 border border-white/20 text-white/80 hover:text-white flex items-center justify-center cursor-pointer transition-[background-color,color,transform] duration-150 ease-out-strong active:scale-[0.94]"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Toda la miniatura reproduce; el ícono solo aparece al apuntarla para no tapar el arte */}
          {onPlayVolume && (
            <>
              <button
                type="button"
                onClick={handlePlayMain}
                aria-label={`${playTarget.label}: ${volume.title}`}
                className="absolute inset-0 cursor-pointer focus-visible:outline-none select-none"
              />
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-brand-accent text-zinc-950 flex items-center justify-center shadow-elevation-2 pointer-events-none opacity-0 scale-90 transition-[opacity,transform] duration-150 ease-out group-hover/thumb:opacity-100 group-hover/thumb:scale-100 group-focus-within/thumb:opacity-100 group-focus-within/thumb:scale-100 motion-reduce:transition-none motion-reduce:scale-100"
              >
                <Play className="w-5 h-5 fill-current ml-0.5" />
              </span>
            </>
          )}

          {/* Avance parcial del lapso según el historial */}
          {showPartialProgress && (
            <div
              role="progressbar"
              aria-label={`Avance de ${volume.title}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPercent}
              className="absolute bottom-0 inset-x-0 h-1 bg-white/15 pointer-events-none"
            >
              <div className="h-full bg-[rgb(var(--era))]" style={{ width: `${progressPercent}%` }} />
            </div>
          )}

          {/* Momento que se está previsualizando desde la tira */}
          {preview && (
            <div className="absolute bottom-3 left-3 right-3 pointer-events-none">
              <span className="inline-flex items-center gap-1.5 max-w-full px-2 py-0.5 rounded-full text-3xs font-mono font-bold bg-black/85 border border-[rgb(var(--era)/0.5)] text-white">
                <span className="text-[rgb(var(--era))] tabular-nums shrink-0">Cap. {preview.episodeNum}</span>
                <span className="truncate">{preview.milestone.title}</span>
              </span>
            </div>
          )}
        </div>

        {/* 2. Card Content & Metadata */}
        <div className="relative -mt-2 px-3.5 pb-3.5 sm:px-5 sm:pb-5 flex flex-col gap-3">
          {/* Título, estado y ficha */}
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display font-black text-base sm:text-lg text-white uppercase tracking-wide leading-tight text-balance transition-colors duration-200 group-hover:text-[rgb(var(--era))]">
                {volume.title}
              </h3>

              {/* Estado del lapso y relleno, legibles de un vistazo */}
              <div className="flex items-center gap-1.5 shrink-0">
                {isRead ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-3xs font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                    <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                    Visto
                  </span>
                ) : showPartialProgress ? (
                  <span className="px-1.5 py-0.5 rounded-md text-3xs font-mono font-bold bg-brand-accent/15 border border-brand-accent/30 text-brand-accent tabular-nums">
                    {progressPercent}%
                  </span>
                ) : null}
              </div>
            </div>

            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-2xs text-on-surface-variant tabular-nums">
              <span>{volume.episodesCount} episodios</span>
              {fillerCount > 0 && (
                <>
                  <span aria-hidden="true" className="text-white/25">
                    ·
                  </span>
                  <span className="text-amber-400/90">{fillerCount} de relleno</span>
                </>
              )}
            </p>

            <p className="font-sans text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
              {volume.subtitle || volume.narrative.detonante.description}
            </p>
          </div>

          {/* Datos clave verificados del lapso */}
          {volume.keyFacts && volume.keyFacts.length > 0 && (
            <dl className="grid grid-cols-2 gap-2">
              {volume.keyFacts.map((fact) => (
                <div key={fact.label} className="min-w-0 rounded-xl border border-white/[0.07] bg-white/[0.025] px-2.5 py-2">
                  <dt className="font-mono text-3xs uppercase tracking-wider text-[rgb(var(--era)/0.9)]">{fact.label}</dt>
                  <dd className="mt-0.5 text-xs font-semibold leading-snug text-white/90">{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {/* 3. Acciones. En móvil el botón principal ocupa toda la fila y debajo van
            «visto» y «Detalles»; desde sm entran los tres en una fila. */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/10">
            {onPlayVolume && (
              <button
                type="button"
                onClick={handlePlayMain}
                className="basis-full sm:basis-auto min-h-[44px] px-3.5 rounded-full bg-brand-accent text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 hover:brightness-110 active:scale-[0.97] transition-[filter,transform] duration-150 ease-out-strong cursor-pointer select-none shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                <span>{playTarget.label}</span>
              </button>
            )}

            <button
              type="button"
              id={`btn-toggle-read-${volume.id}`}
              aria-label={isRead ? 'Marcar como no visto' : 'Marcar como visto'}
              onClick={handleToggleWatched}
              className={`min-h-[44px] px-3 rounded-full text-xs font-mono transition-[background-color,border-color,color,transform] duration-150 ease-out-strong border cursor-pointer select-none active:scale-[0.97] flex items-center gap-1.5 ${
                isRead
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] text-on-surface-variant hover:text-white border-white/15'
              }`}
            >
              {isRead ? (
                <>
                  <CheckCircle2
                    className={`w-3.5 h-3.5 text-emerald-400 stroke-[2.5] ${celebrateRead ? 'animate-success-check' : ''}`}
                  />
                  <span>Visto</span>
                </>
              ) : (
                <>
                  <Circle className="w-3.5 h-3.5 text-on-surface-variant/70" />
                  <span>Marcar visto</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleToggleDetails}
              aria-expanded={showDetails}
              aria-controls={`volume-details-${volume.id}`}
              className={`ml-auto min-h-[44px] px-3 rounded-full text-xs font-mono transition-[background-color,border-color,color,transform] duration-150 ease-out-strong border cursor-pointer select-none active:scale-[0.97] flex items-center gap-1.5 ${
                showDetails
                  ? 'bg-brand-accent/15 border-brand-accent/30 text-brand-accent font-semibold'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] text-on-surface-variant hover:text-white border-white/15'
              }`}
            >
              <span>Detalles</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-300 ease-out-strong motion-reduce:transition-none ${
                  showDetails ? 'rotate-180 text-brand-accent' : ''
                }`}
              />
            </button>
          </div>

          {/* 4. MomentStrip: Horizontal Key Moments with Minute and Frame Extraction */}
          <MomentStrip
            volume={volume}
            serverMomentTimes={serverMomentTimes}
            onPlayMoment={onPlayVolume}
            onPreviewMoment={setPreview}
          />

          {/* 5. Cajón de detalles: solo en móvil (< lg); en desktop se muestra al costado en la columna contralateral */}
          <div
            id={`volume-details-${volume.id}`}
            inert={!showDetails}
            className={`lg:hidden grid -mt-3 transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
              showDetails ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              {(hasOpenedDetails || showDetails) && (
                <div className="mt-3 border-t border-white/10 pt-3">
                  <VolumeDetailsTabs
                    volume={volume}
                    activeTab={detailTab}
                    onTabChange={handleTabChange}
                    layoutIdPrefix="mobile-"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </article>
    );
  },
);

TimelineVolumeCard.displayName = 'TimelineVolumeCard';
