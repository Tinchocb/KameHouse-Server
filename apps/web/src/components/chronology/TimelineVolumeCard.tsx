import React, { useState, useEffect, memo } from 'react';
import { m, LayoutGroup, AnimatePresence } from 'framer-motion';
import type { VolumeData } from './types';
import { Chip } from './Chip';
import { IconButton } from '@/components/ui/button';
import { cn } from '@/components/ui/core/styling';
import { useSpringPreset, useReducedMotion, useMotionTier } from '@/components/ui/kinetics/hooks';
import { useIsMinimalistMode } from '@/lib/theme/use-classic-mode';

const SAGA_PREFIX_REGEX_CACHE = new Map<string, RegExp>();

function getSagaPrefixRegex(sagaLabel: string): RegExp {
  let re = SAGA_PREFIX_REGEX_CACHE.get(sagaLabel);
  if (!re) {
    const escaped = sagaLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    re = new RegExp(`^${escaped}\\s*[▪•·\\-–—]\\s*`, 'i');
    SAGA_PREFIX_REGEX_CACHE.set(sagaLabel, re);
  }
  return re;
}
import { EpisodeThumbnailImg } from './EpisodeThumbnailImg';
import { type MomentPlayInfo } from './types';
import { ContralateralDetailsCard, type DetailTab } from './ContralateralDetailsCard';
import { SpanProgressBar } from './SpanProgressBar';
import { getSagaFallbackImages } from './data/sagaImages';
import {
  buildSegments,
  formatEpisodeRange,
  playTargetFor,
  spanStatus,
} from './data/cardModel';
import { ALL_ERAS_HEX, eraTextChannels, hexToRgbChannels } from './utils/eraColor';
import {
  IconMediaPlay,
  IconUiCheckCircle2,
  IconNavigationPanelRightOpen,
  IconMediaMaximize,
  IconUiListPlus,
  IconUiClose,
} from '@/components/ui/icons';

/**
 * Transiciones para los elementos secundarios (overlays, textos, botones) que acompañan el morfismo FLIP
 * del contenedor, el lomo Kanzenban y la miniatura (`layoutId`).
 */
const CONTENT_IN_ERA = { duration: 0.25, ease: [0.22, 1, 0.36, 1] } as const;
const CONTENT_IN_MINIMAL = { duration: 0.16, ease: [0.23, 1, 0.32, 1] } as const;
const CONTENT_IN_REDUCED = { duration: 0.12 } as const;

interface TimelineVolumeCardProps {
  volume: VolumeData;
  /** Avisa a la fila cuando la tarjeta se abre o se pliega. */
  onExpandedChange?: (volumeId: string, expanded: boolean) => void;
  isRead: boolean;
  /** Avance del lapso según el historial (0–100). */
  progressPercent?: number;
  /** Primer episodio sin ver cuando el lapso está empezado. */
  nextEpisode?: number;
  /** Episodios del lapso ya vistos según el historial. */
  seenEpisodes?: number[];
  isHighlighted?: boolean;
  /** Color de la era: tiñe borde, brillo, etiquetas y avance. */
  accentHex?: string;
  onInspectThumbnail?: (volume: VolumeData) => void;
  onPlayVolume?: (volume: VolumeData, episodeNum?: number, momentInfo?: MomentPlayInfo) => void;
  /** Arma en Mi Lista los episodios desde este lapso hasta el final de la era. */
  onMarathon?: (volume: VolumeData) => void;
  /** Se está armando el maratón de este lapso (busca los archivos). */
  marathonBusy?: boolean;
  /** Estado de apertura de detalles controlado externamente */
  isDetailsOpen?: boolean;
  onToggleDetails?: (volumeId: string) => void;
  /** Indica si la tarjeta está en foco (desplegada en Opción B) o en reposo (compacta). */
  isFocused?: boolean;
  /** Indica si hay alguna tarjeta en foco en la línea de tiempo (para atenuar las demás en Spotlight mode). */
  hasAnyFocus?: boolean;
  /** Solicita poner esta tarjeta en foco al interactuar con ella. */
  onFocusCard?: (volumeId: string) => void;
  /** Solicita contraer la tarjeta si está en foco. */
  onCollapseCard?: (volumeId: string) => void;
  /** Pestaña activa del panel contralateral o acordeón. */
  detailTab?: DetailTab;
  /** Recibe el id del lapso para que la lista pase un callback estable. */
  onTabChange?: (volumeId: string, tab: DetailTab) => void;
  className?: string;
}

export const TimelineVolumeCard: React.FC<TimelineVolumeCardProps> = memo(
  ({
    volume,
    onExpandedChange,
    isRead,
    progressPercent = 0,
    nextEpisode,
    seenEpisodes,
    isHighlighted = false,
    accentHex = ALL_ERAS_HEX,
    onInspectThumbnail,
    onPlayVolume,
    onMarathon,
    marathonBusy = false,
    isDetailsOpen: controlledShowDetails,
    onToggleDetails: controlledToggleDetails,
    isFocused = true,
    hasAnyFocus = false,
    onFocusCard,
    onCollapseCard,
    detailTab: controlledDetailTab,
    onTabChange: controlledTabChange,
    className = '',
  }) => {
    const [localShowDetails, setLocalShowDetails] = useState(false);
    const showDetails = controlledShowDetails ?? localShowDetails;

    // El acordeón móvil se monta al abrirlo por primera vez y queda montado para que el cierre anime.
    const [hasOpenedDetails, setHasOpenedDetails] = useState(false);
    if (showDetails && !hasOpenedDetails) {
      setHasOpenedDetails(true);
    }

    // Un salto desde la búsqueda o un enlace abre la tarjeta destino una sola vez.
    const [openedByHighlight, setOpenedByHighlight] = useState(false);
    if (isHighlighted && !openedByHighlight) {
      setOpenedByHighlight(true);
      setLocalShowDetails(true);
    }

    useEffect(() => {
      onExpandedChange?.(volume.id, showDetails);
    }, [showDetails, volume.id, onExpandedChange]);

    const [localDetailTab, setLocalDetailTab] = useState<DetailTab>('conflicto');
    const detailTab = controlledDetailTab ?? localDetailTab;
    const handleTabChange = (tab: DetailTab) => {
      setLocalDetailTab(tab);
      controlledTabChange?.(volume.id, tab);
    };

    // Fallback images de la saga
    const sagaFallbacks = getSagaFallbackImages(volume.id);

    const firstMilestone = volume.detailedStory?.episodeMilestones?.[0] || {
      episode: `Ep. ${volume.startEpisode ?? 1}`,
      title: volume.title,
      synopsis: volume.subtitle,
    };

    const capsFormatted = formatEpisodeRange(volume);
    const fillerCount = volume.fillerEpisodes?.length ?? 0;
    const status = spanStatus(isRead, progressPercent, Boolean(volume.mediaId));
    const segments = buildSegments(volume, isRead, progressPercent, nextEpisode, seenEpisodes);
    const playTarget = playTargetFor(volume, isRead, progressPercent, nextEpisode);

    // Subtítulo deduplicado: evita repetir el nombre de la saga
    const cleanSubtitle = volume.subtitle
      ? volume.subtitle.replace(getSagaPrefixRegex(volume.sagaLabel), '').trim()
      : volume.narrative.detonante.description;

    const handlePlayMain = () => {
      onPlayVolume?.(volume, playTarget.episode);
    };

    // Combate principal para la franja VS de la Opción B (4C)
    const mainBattle = volume.detailedStory?.keyBattles?.[0];

    // Número corto del lapso para el lomo Kanzenban (#09)
    const volumeNumberShort = volume.order
      ? `#${String(volume.order).padStart(2, '0')}`
      : volume.volumeNumber.replace(/^(lapso|volumen)\s*/i, '#');

    const handleToggleDetails = () => {
      if (controlledToggleDetails) {
        controlledToggleDetails(volume.id);
      } else {
        setLocalShowDetails((prev) => !prev);
      }
    };

    const handleCloseDetails = () => {
      if (controlledToggleDetails && controlledShowDetails) {
        controlledToggleDetails(volume.id);
      } else {
        setLocalShowDetails(false);
      }
    };

    const morphSpring = useSpringPreset('entrance');
    const reduceMotion = useReducedMotion();
    const isMinimalist = useIsMinimalistMode();
    const motionTier = useMotionTier();
    const contentInTransition = reduceMotion
      ? CONTENT_IN_REDUCED
      : isMinimalist
        ? CONTENT_IN_MINIMAL
        : CONTENT_IN_ERA;

    return (
      <LayoutGroup id={`timeline-volume-${volume.id}`}>
        <m.article
          layout={reduceMotion || motionTier !== 'full' ? false : 'position'}
          id={`timeline-card-${volume.id}`}
          data-liquid-surface="content"
          data-status={status}
          data-focused={isFocused ? 'true' : 'false'}
          tabIndex={-1}
          transition={morphSpring}
          style={{ '--era': hexToRgbChannels(accentHex), '--era-text': eraTextChannels(accentHex) } as React.CSSProperties}
          className={cn(
            'group relative isolate flex w-full max-w-[660px] outline-none select-none text-left', className,
            'transition-[border-color,box-shadow,opacity,background-color] duration-medium ease-smooth-out motion-reduce:transition-none',
            !isFocused
              ? cn(
                  // Sin .sectionbar: hay una fila por lapso plegado y el vidrio se repetiría en la lista (§9).
                  'items-stretch overflow-hidden rounded-xl border bg-[var(--surface-content)] cursor-pointer',
                  hasAnyFocus
                    ? 'opacity-80 hover:opacity-100 hover:border-[rgb(var(--era)/0.45)]'
                    : 'opacity-100',
                  'hover:bg-[color-mix(in_srgb,var(--surface-content)_95%,rgb(var(--era)))] motion-safe:active:scale-[0.995]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:opacity-100',
                  isHighlighted
                    ? 'border-[rgb(var(--era)/0.7)] ring-2 ring-brand-accent !opacity-100'
                    : 'border-[var(--neutral-separator)]'
                )
              : cn(
                  // Única capa de vidrio de la tarjeta en foco: su sombra sale de --sectionbar-shadow y el halo de era con color-mix.
                  'isolate flex w-full overflow-hidden rounded-2xl',
                  isHighlighted
                    ? 'sectionbar border-[rgb(var(--era)/0.4)] shadow-[shadow:var(--sectionbar-shadow),0_0_28px_-6px_color-mix(in_srgb,rgb(var(--era))_25%,transparent)]'
                    : 'surface-content surface-content-row',
                  isHighlighted ? 'sectionbar-strong ring-2 ring-brand-accent' : ''
                )
          )}
        >
          {!isFocused && (
            <button
              type="button"
              aria-label={`Seleccionar ${volume.title} en la línea de tiempo`}
              onClick={(e) => {
                // El artículo persiste cuando el botón de selección se desmonta al expandir.
                e.currentTarget.parentElement?.focus({ preventScroll: true });
                onFocusCard?.(volume.id);
              }}
              className="absolute inset-0 z-10 rounded-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent"
            />
          )}
          {/* Filete superior de la era */}
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute inset-x-0 top-0 z-30 transition-opacity duration-base',
              isFocused
                ? 'h-[2px] bg-gradient-to-r from-[rgb(var(--era))] via-[rgb(var(--era)/0.75)] to-transparent opacity-100'
                : 'h-px bg-gradient-to-r from-transparent via-[rgb(var(--era)/0.7)] to-transparent opacity-40 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100'
            )}
          />

          {/* Lomo persistente con el nombre de la saga en español latino. */}
          <aside
            aria-hidden="true"
            className={cn(
              'shrink-0 border-r border-white/10 flex flex-col items-center justify-between px-0.5 select-none z-20 bg-gradient-to-b from-[rgb(var(--era)/0.22)] via-surface-container-lowest/90 to-surface-container-lowest',
              isFocused ? 'w-8 py-3' : 'w-7 py-2.5'
            )}
          >
            <span className="font-mono font-black text-2xs text-[rgb(var(--era-text,var(--era)))] tracking-tighter">
              {volumeNumberShort}
            </span>

            <AnimatePresence initial={false}>
              {isFocused && (
                <m.span
                  key={`spine-label-${volume.id}`}
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={contentInTransition}
                  className="my-1.5 [writing-mode:vertical-rl] rotate-180 font-display font-semibold text-3xs sm:text-2xs tracking-wide text-on-surface-variant line-clamp-1"
                >
                  {volume.sagaLabel}
                </m.span>
              )}
            </AnimatePresence>

            <div
              className={cn(
                'flex items-center justify-center font-kanji font-black transition-[background-color,border-color] duration-fast',
                isFocused
                  ? 'w-6.5 h-6.5 rounded-md border border-[rgb(var(--era)/0.65)] bg-[rgb(var(--era)/0.15)] text-xs text-[rgb(var(--era-text,var(--era)))] shadow-inner'
                  : 'text-2xs text-white/50'
              )}
            >
              {volume.coverArt.symbolGlyph || '亀'}
            </div>
          </aside>

          {/* CUERPO DERECHO (Alterna entre fila compacta y columna expandida manteniendo layoutId en miniatura/título/barra) */}
          {!isFocused ? (
            <div className="flex-1 min-w-0 p-2.5 sm:p-3 flex items-center gap-3">
              {/* Miniatura 16:9 con Play Directo (viaja a la portada panorámica) */}
              <m.div
                layoutId={reduceMotion ? undefined : `card-artwork-${volume.id}`}
                transition={morphSpring}
                style={{ borderRadius: 6 }}
                className="w-20 sm:w-28 shrink-0 aspect-video rounded-md overflow-hidden relative z-20 pointer-events-none bg-surface-container-lowest group/thumb"
              >
                <EpisodeThumbnailImg
                  volume={volume}
                  milestone={firstMilestone}
                  fallbackSrc={sagaFallbacks[0]}
                  eager
                  className={`w-full h-full object-cover transition-transform duration-fast ease-smooth-out group-hover/thumb:scale-105 ${
                    isRead ? 'saturate-[0.8] brightness-90' : ''
                  }`}
                />
                <div className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 group-focus-within/thumb:opacity-100 [@media(hover:none)]:opacity-100 focus-within:opacity-100 transition-opacity duration-fast ease-smooth-out">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayMain();
                    }}
                    aria-label={`Reproducir ${playTarget.label}`}
                    disabled={status === 'unavailable'}
                    className="episode-play-overlay pointer-events-auto w-7 h-7 rounded-full bg-white text-black flex items-center justify-center text-xs shadow-elevation-2 motion-safe:[@media(hover:hover)_and_(pointer:fine)]:hover:scale-110 motion-safe:active:scale-[0.97] transition-transform duration-fast ease-smooth-out disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  >
                    <IconMediaPlay className="w-3.5 h-3.5 fill-current ml-0.5" />
                  </button>
                </div>
              </m.div>

              {/* Metadatos esenciales + Título + Micro Barra */}
              <m.div
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={contentInTransition}
                className="flex-1 min-w-0 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2 text-xs font-mono text-label-2">
                  <span className="truncate">
                    {capsFormatted}
                    {mainBattle && (
                      <span className="text-on-surface-variant font-sans font-medium">
                        {' · '}{mainBattle.fighter1} vs {mainBattle.fighter2}
                      </span>
                    )}
                  </span>
                  <span className={status === 'seen' ? 'text-status-success font-semibold shrink-0' : 'text-label-2 font-mono shrink-0 tabular-nums'}>
                    {status === 'seen' ? '✓ Visto' : progressPercent > 0 ? `${progressPercent}%` : ''}
                  </span>
                </div>

                <m.h3
                  layoutId={reduceMotion ? undefined : `card-title-${volume.id}`}
                  layout="position"
                  transition={morphSpring}
                  className="font-display font-bold text-sm sm:text-base text-on-surface [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-on-surface line-clamp-2 leading-snug text-balance"
                >
                  {volume.title}
                </m.h3>

                {/* Micro barra de avance */}
                <m.div layoutId={reduceMotion ? undefined : `card-progress-${volume.id}`} layout="position" transition={morphSpring}>
                  <SpanProgressBar title={volume.title} segments={segments} isRead={isRead} progressPercent={progressPercent} height={3} />
                </m.div>
              </m.div>

              {/* Icono de desplegar */}
              <span
                aria-hidden="true"
                className="text-label-3 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-[rgb(var(--era-text,var(--era)))] text-xs px-1 shrink-0 transition-colors duration-fast ease-smooth-out"
                title="Desplegar lapso en la línea de tiempo"
              >
                ⤢
              </span>
            </div>
          ) : (
            <div className="flex-1 min-w-0 flex flex-col">
              {/* 1. Portada Cinemática Panorámica (recibe la miniatura 16:9 con FLIP) */}
              <m.div
                layoutId={reduceMotion ? undefined : `card-artwork-${volume.id}`}
                transition={morphSpring}
                style={{ borderRadius: 0 }}
                className={`group/thumb relative w-full aspect-video sm:aspect-[2.35/1] sm:max-h-[210px] overflow-hidden bg-gradient-to-br ${volume.coverArt.auraGradient}`}
              >
                {/* Glifo de fondo */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 grid place-items-center font-kanji text-5xl sm:text-6xl font-black text-white/[0.05] select-none pointer-events-none"
                >
                  {volume.coverArt.symbolGlyph}
                </span>

                <EpisodeThumbnailImg
                  key="cover"
                  volume={volume}
                  milestone={firstMilestone}
                  fallbackSrc={sagaFallbacks[0]}
                  eager
                  fetchPriority={isHighlighted ? 'high' : 'auto'}
                  className={`w-full h-full object-cover transition-transform duration-medium ease-smooth-out group-hover/thumb:scale-105 ${
                    isRead ? 'saturate-[0.8] brightness-90' : ''
                  }`}
                />

                {/* Viñeta cinematográfica */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent pointer-events-none" />

                {/* Barra superior de la portada: Episodios + Estado + Maximizar */}
                <m.div
                  initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={contentInTransition}
                  className="absolute top-2 inset-x-3 flex items-center justify-between gap-2 z-10"
                >
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-ring)] text-2xs font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-[rgb(var(--era))]" />
                    <span className="font-semibold text-label-1">{capsFormatted}</span>
                    {fillerCount > 0 && (
                      <span className="text-status-warning font-bold">({fillerCount} Relleno)</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {status === 'seen' ? (
                      <Chip overlay tone="success" icon={<IconUiCheckCircle2 className="w-3 h-3" aria-hidden="true" />}>
                        Visto
                      </Chip>
                    ) : status === 'in-progress' ? (
                      <Chip overlay tone="era">
                        {progressPercent}%
                      </Chip>
                    ) : null}

                    {onInspectThumbnail && (
                      <IconButton
                        intent="secondary"
                        size="sm"
                        onClick={() => onInspectThumbnail(volume)}
                        aria-label={`Inspeccionar arte de ${volume.title}`}
                        icon={<IconMediaMaximize className="w-3.5 h-3.5" />}
                        className="w-11 h-11 [@media(pointer:fine)]:w-7 [@media(pointer:fine)]:h-7 min-h-0"
                      />
                    )}

                    {onCollapseCard && (
                      <IconButton
                        intent="secondary"
                        size="sm"
                        onClick={() => onCollapseCard(volume.id)}
                        aria-label={`Contraer ${volume.title} a vista compacta`}
                        title="Contraer lapso (Esc)"
                        icon={<IconUiClose className="w-3.5 h-3.5" />}
                        className="w-11 h-11 [@media(pointer:fine)]:w-7 [@media(pointer:fine)]:h-7 min-h-0 hover:bg-white/20 motion-safe:active:scale-[0.97]"
                      />
                    )}
                  </div>
                </m.div>

                {/* Base de la portada: Título + Botón Play siempre accesible */}
                <div className="absolute bottom-2 inset-x-3 flex items-end justify-between gap-2 z-10">
                  <div className="min-w-0 flex-1">
                    <m.h3
                      layoutId={reduceMotion ? undefined : `card-title-${volume.id}`}
                      layout="position"
                      transition={morphSpring}
                      className="font-display font-black text-white leading-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)] text-base sm:text-lg line-clamp-2 text-balance"
                    >
                      {volume.title}
                    </m.h3>
                  </div>

                  <m.button
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={contentInTransition}
                    type="button"
                    onClick={handlePlayMain}
                    disabled={status === 'unavailable'}
                    aria-label={`Reproducir ${playTarget.label}`}
                    className="spotlight-play-cta shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-black font-display font-bold text-xs uppercase tracking-wider shadow-elevation-3 motion-safe:[@media(hover:hover)_and_(pointer:fine)]:hover:scale-105 motion-safe:active:scale-[0.97] transition-transform duration-fast ease-smooth-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                  >
                    <IconMediaPlay className="w-3.5 h-3.5 fill-current ml-px" />
                    <span className="truncate">{playTarget.label}</span>
                  </m.button>
                </div>
              </m.div>

              {/* 2. Cuerpo Opción B: Franja Duelo VS + Sinopsis + Barra y Acciones */}
              <m.div
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={contentInTransition}
                className="relative p-3 sm:p-4 flex flex-col gap-3"
              >
                {/* Franja de Combate Estelar (Sello 4C) */}
                <div className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[rgb(var(--era)/0.14)] to-transparent border border-[rgb(var(--era)/0.28)] flex flex-wrap items-center justify-between gap-2 text-2xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[rgb(var(--era-text,var(--era)))] font-mono font-black shrink-0">
                      ⚔️ DUELO
                    </span>
                    <span className="font-display font-bold text-on-surface truncate">
                      {mainBattle ? `${mainBattle.fighter1} vs ${mainBattle.fighter2}` : volume.narrative.climax.decisiveBattle}
                    </span>
                  </div>
                  <span className="text-status-success font-semibold truncate shrink-0">
                    {mainBattle?.outcome || volume.narrative.climax.iconicMoment || 'Clímax del lapso'}
                  </span>
                </div>

                {/* Sinopsis breve (1-2 líneas) */}
                <p className="font-sans text-xs text-on-surface-variant line-clamp-2 leading-relaxed font-medium text-pretty">
                  {volume.narrative.detonante.description || cleanSubtitle}
                </p>

                {/* Barra de Progreso + Fila de Acciones en 1 sola línea limpia */}
                <div className="pt-1.5 border-t border-[var(--neutral-separator)] flex items-center gap-2.5">
                  <m.div
                    layoutId={reduceMotion ? undefined : `card-progress-${volume.id}`}
                    layout="position"
                    transition={morphSpring}
                    className="flex-1 min-w-0"
                  >
                    <SpanProgressBar title={volume.title} segments={segments} isRead={isRead} progressPercent={progressPercent} height={3} />
                  </m.div>

                  {/* Botón Lore (Abre la Contralateral) */}
                  <IconButton
                    intent="secondary"
                    size="sm"
                    onClick={handleToggleDetails}
                    aria-label={`Ver detalles y trasfondo de ${volume.title}`}
                    aria-expanded={showDetails}
                    title="Ver detalles del lapso"
                    className={cn(
                      'h-7 px-2 rounded-lg flex items-center gap-1 text-xs font-semibold transition-[background-color,border-color,color,transform] duration-fast motion-safe:active:scale-[0.97]',
                      showDetails && 'bg-[rgb(var(--era)/0.25)] border-[rgb(var(--era)/0.6)] text-[rgb(var(--era-text,var(--era)))] shadow-[0_0_12px_color-mix(in_srgb,rgb(var(--era))_30%,transparent)]'
                    )}
                    icon={<IconNavigationPanelRightOpen className="w-3.5 h-3.5 text-brand-accent-readable" />}
                  />

                  {/* Botón Maratón */}
                  {onMarathon && (
                    <IconButton
                      intent="secondary"
                      size="sm"
                      onClick={() => onMarathon(volume)}
                      disabled={marathonBusy}
                      aria-label="Añadir maratón de la era a Mi Lista"
                      title="Añadir maratón a Mi Lista"
                      className="w-7 h-7 rounded-lg transition-[background-color,border-color,transform] duration-fast motion-safe:active:scale-[0.97]"
                      icon={<IconUiListPlus className="w-3.5 h-3.5" />}
                    />
                  )}
                </div>

                {/* Móvil (< lg): Acordeón de detalles bajo la tarjeta */}
                <div
                  id={`volume-details-${volume.id}`}
                  inert={!showDetails}
                  className={`lg:hidden grid transition-[grid-template-rows,opacity] duration-medium ease-drawer motion-reduce:transition-none ${
                    showDetails ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="min-h-0 overflow-hidden">
                    {hasOpenedDetails && (
                      <div className="pt-2">
                        <ContralateralDetailsCard
                          volume={volume}
                          accentHex={accentHex}
                          onClose={handleCloseDetails}
                          activeTab={detailTab}
                          onTabChange={handleTabChange}
                          layoutIdPrefix={`card-details-${volume.id}-`}
                          embedded
                        />
                      </div>
                    )}
                  </div>
                </div>
              </m.div>
            </div>
          )}
        </m.article>
      </LayoutGroup>
    );
  },
);

TimelineVolumeCard.displayName = 'TimelineVolumeCard';
