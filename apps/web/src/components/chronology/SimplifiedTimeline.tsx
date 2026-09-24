import React, { useState, useMemo } from 'react';
import { VolumeData } from './types';
import { ChronologyRow } from './ChronologyRow';
import { InterludeDivider } from './InterludeDivider';
import { useShowInterludes } from '@/routes/chronology/-hooks/use-timeline-prefs';
import { SectionBar } from '@/components/ui/sectionbar/sectionbar';
import {
  Clock,
  RotateCcw,
  Check,
  ShieldAlert,
  Eye,
  EyeOff,
} from 'lucide-react';
import { sounds } from './utils/audio';
import { groupVolumesByEra } from './data/spansToVolumes';
import { CHRONOLOGY_INTERLUDES } from './data/interludes';
import { getSagaBadgeConfig } from './utils/sagaBadge';

interface SimplifiedTimelineProps {
  volumes: VolumeData[];
  totalVolumesCount?: number;
  readVolumeIds: Set<string>;
  onToggleRead: (volumeId: string) => void;
  onMarkAllRead: () => void;
  onResetRead: () => void;
  onInspectThumbnail: (volume: VolumeData) => void;
  onPlayVolume?: (volume: VolumeData, episodeNum?: number) => void;
  highlightedVolumeId?: string | null;
  searchQuery?: string;
}

const ERA_NAV_ITEMS = [
  { key: 'classic', label: 'Clásico' },
  { key: 'z', label: 'Z' },
  { key: 'daima', label: 'Daima' },
  { key: 'super', label: 'Super' },
  { key: 'gt', label: 'GT' },
] as const;

const ERA_KANJI_MAP: Record<string, string> = {
  classic: '亀',
  z: '界',
  daima: '大',
  super: '神',
  gt: '極',
};

export const SimplifiedTimeline: React.FC<SimplifiedTimelineProps> = ({
  volumes,
  totalVolumesCount,
  readVolumeIds,
  onToggleRead,
  onMarkAllRead,
  onResetRead,
  onInspectThumbnail,
  onPlayVolume,
  highlightedVolumeId,
  searchQuery = '',
}) => {
  // Estado de una sola fila expandida a la vez
  const [prevHighlightedId, setPrevHighlightedId] = useState<string | null>(
    highlightedVolumeId ?? null
  );
  const [expandedVolumeId, setExpandedVolumeId] = useState<string | null>(
    highlightedVolumeId ?? null
  );

  // El deep-link ?highlight= expande la fila correspondiente
  if (highlightedVolumeId !== prevHighlightedId) {
    setPrevHighlightedId(highlightedVolumeId ?? null);
    if (highlightedVolumeId) {
      setExpandedVolumeId(highlightedVolumeId);
    }
  }

  const handleToggleExpand = (volumeId: string) => {
    setExpandedVolumeId((prev) => (prev === volumeId ? null : volumeId));
  };

  const totalVolumes = volumes.length;
  const readCount = volumes.filter((v) => readVolumeIds.has(v.id)).length;
  const progressPercent =
    totalVolumes > 0 ? Math.round((readCount / totalVolumes) * 100) : 0;

  // Agrupación consecutiva: Era > (Saga si >= 2) > Filas
  const eraGroups = useMemo(() => groupVolumesByEra(volumes), [volumes]);

  const { showInterludes, handleToggleInterludes } = useShowInterludes();

  // Mapa de índice visible para comprobar consecutividad en la lista visible
  const visibleIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    volumes.forEach((v, idx) => {
      map.set(v.id, idx);
    });
    return map;
  }, [volumes]);

  // Interludio por par fromVolumeId -> toVolumeId (consecutivos in-universe)
  const interludeMap = useMemo(() => {
    const map = new Map<string, (typeof CHRONOLOGY_INTERLUDES)[number]>();
    for (const il of CHRONOLOGY_INTERLUDES) {
      if (il.toVolumeId) map.set(`${il.fromVolumeId}::${il.toVolumeId}`, il);
    }
    return map;
  }, []);

  const epilogue = useMemo(
    () => CHRONOLOGY_INTERLUDES.find((il) => il.toVolumeId === null),
    []
  );

  // Acento de cada lapso visible según su era (para el separador de años)
  const accentByVolumeId = useMemo(() => {
    const map = new Map<string, string>();
    for (const era of eraGroups) {
      for (const saga of era.sagas) {
        for (const v of saga.volumes) {
          map.set(v.id, era.accentHex);
        }
      }
    }
    return map;
  }, [eraGroups]);

  const hasActiveSearch = Boolean(searchQuery && searchQuery.trim().length > 0);
  const showInterludeDividers = showInterludes && !hasActiveSearch;

  // Jump to era section handler
  const scrollToEra = (seriesId: string) => {
    sounds.playSelect();
    const element = document.getElementById(`era-${seriesId}`);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 py-2">
      {/* 1. PROGRESO Y ACCESO RÁPIDO POR ERA: Canonical SectionBar Collapsible */}
      <SectionBar
        id="sectionbar-timeline-progress"
        collapsible
        defaultOpen={true}
        label="Progreso en la Línea de Tiempo"
        description={`${readCount} de ${totalVolumes} lapsos vistos`}
        icon={Clock}
        badge={
          <span className="inline-flex items-center justify-center min-w-[36px] h-5 px-2 py-0.5 rounded-full bg-brand-accent/20 text-brand-accent border border-brand-accent/30 font-mono text-xs font-bold leading-none shrink-0 shadow-elevation-1 tabular-nums">
            {progressPercent}%
          </span>
        }
      >
        <div className="flex flex-col gap-3.5 pt-1">
          {/* Actions: Marcar todos & Reiniciar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs font-mono text-on-surface-variant">
              Barra de progreso y accesos directos por era
            </span>
            <div className="flex items-center gap-2 text-xs font-mono">
              <button
                type="button"
                aria-pressed={showInterludes}
                onClick={() => {
                  sounds.playSelect();
                  handleToggleInterludes();
                }}
                className={`min-h-[44px] px-3.5 py-1.5 rounded-full border flex items-center gap-1.5 cursor-pointer active:scale-95 transition-colors duration-150 select-none ${
                  showInterludes
                    ? 'bg-brand-accent/15 border-brand-accent/30 text-brand-accent font-semibold'
                    : 'bg-bg-primary/40 border-white/20 text-on-surface-variant hover:text-white'
                }`}
              >
                {showInterludes ? (
                  <Eye className="w-3.5 h-3.5 text-brand-accent" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 text-on-surface-variant" />
                )}
                <span>Mostrar interludios</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  sounds.playSelect();
                  onMarkAllRead();
                }}
                className="min-h-[44px] px-3.5 py-1.5 rounded-full bg-bg-primary/40 border border-white/20 hover:border-white/40 text-on-surface hover:text-white flex items-center gap-1.5 cursor-pointer active:scale-95 transition-colors duration-150 select-none"
              >
                <Check className="w-3.5 h-3.5 text-brand-accent" />
                <span>Marcar todos</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  sounds.playSelect();
                  onResetRead();
                }}
                className="min-h-[44px] px-3.5 py-1.5 rounded-full bg-bg-primary/40 border border-white/20 hover:border-white/40 text-on-surface-variant hover:text-white flex items-center gap-1.5 cursor-pointer active:scale-95 transition-colors duration-150 select-none"
              >
                <RotateCcw className="w-3.5 h-3.5 text-on-surface-variant" />
                <span>Reiniciar</span>
              </button>
            </div>
          </div>

          {/* Minimal Progress Bar */}
          <div className="w-full bg-surface-container-high rounded-full h-2.5 overflow-hidden border border-white/10 shadow-inner">
            <div
              className="h-full bg-brand-accent transition-[width] duration-300 ease-out rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* 5 Chips de Era ("Z · 4/14") */}
          <div className="pt-1">
            <div className="flex flex-wrap items-center gap-2 pb-1 pt-0.5">
              <span className="text-2xs font-mono text-on-surface-variant uppercase shrink-0 mr-1 font-bold">
                Eras:
              </span>
              {ERA_NAV_ITEMS.map((era) => {
                const eraVolumes = volumes.filter((v) => v.seriesId === era.key);
                const totalInEra = eraVolumes.length;
                if (totalInEra === 0) return null;

                const readInEra = eraVolumes.filter((v) => readVolumeIds.has(v.id)).length;
                const isComplete = readInEra === totalInEra && totalInEra > 0;

                return (
                  <button
                    key={era.key}
                    type="button"
                    onClick={() => scrollToEra(era.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-mono border transition-colors duration-150 cursor-pointer min-h-[44px] flex items-center gap-1.5 active:scale-95 select-none ${
                      isComplete
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold'
                        : readInEra > 0
                          ? 'bg-brand-accent/15 border-brand-accent/30 text-brand-accent font-semibold'
                          : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 hover:border-white/25 text-on-surface-variant hover:text-white'
                    }`}
                  >
                    <span>{era.label}</span>
                    <span className="opacity-80 tabular-nums">· {readInEra}/{totalInEra}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </SectionBar>

      {/* 2. LÍNEA DE TIEMPO CON FILAS EXPANDIBLES */}
      <SectionBar
        variant="minimal"
        label="Línea de Tiempo"
        className="w-full"
        badge={
          <span className="px-2 py-0.5 rounded-full text-3xs font-mono font-bold bg-[var(--glass-bg)] text-on-surface-variant border border-[var(--glass-border-side)]">
            {totalVolumesCount && totalVolumesCount !== volumes.length
              ? `${volumes.length} de ${totalVolumesCount} lapsos`
              : `${volumes.length} lapsos`}
          </span>
        }
      >
        {volumes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] animate-error-shake my-4">
            <ShieldAlert className="w-10 h-10 text-on-surface-variant/40 mb-3" />
            <p className="font-display font-bold text-lg text-white mb-1">
              No se encontraron lapsos cronológicos
            </p>
            <p className="text-xs font-mono text-on-surface-variant max-w-sm">
              Prueba a cambiar o reiniciar los filtros de era y búsqueda en la barra superior.
            </p>
          </div>
        ) : (
          <div className="relative pt-2">
            {/* Columna vertical continua a la izquierda (sin overlay impreciso) */}
            <div
              aria-hidden="true"
              className="absolute left-[11px] sm:left-[19px] top-6 bottom-6 w-[2px] bg-white/10 pointer-events-none rounded-full"
            />

            <div className="flex flex-col gap-10">
              {eraGroups.map((era) => {
                // Cálculo de vistos en la era
                const eraVols = era.sagas.flatMap((s) => s.volumes);
                const eraReadCount = eraVols.filter((v) => readVolumeIds.has(v.id)).length;
                const eraTotalCount = eraVols.length;
                const eraPercent =
                  eraTotalCount > 0 ? Math.round((eraReadCount / eraTotalCount) * 100) : 0;
                const eraKanji = ERA_KANJI_MAP[era.seriesId] || '亀';

                return (
                  <section
                    key={`era-${era.seriesId}`}
                    id={`era-${era.seriesId}`}
                    aria-label={`Era ${era.seriesTag}`}
                    className="flex flex-col gap-4 scroll-mt-24"
                  >
                    {/* Encabezado de era: kanji, nombre de la serie, rango de años, "x/y vistos" con mini barra (no sticky) */}
                    <div
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border bg-bg-primary/60 backdrop-blur-overlay-md text-left shadow-elevation-1"
                      style={{ borderColor: `${era.accentHex}40` }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Kanji emblem */}
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
                          style={{
                            backgroundColor: `${era.accentHex}20`,
                            borderColor: `${era.accentHex}45`,
                            color: era.accentHex,
                          }}
                        >
                          <span className="font-kanji font-black text-base leading-none">
                            {eraKanji}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <h2 className="font-display font-black text-white text-base sm:text-lg uppercase tracking-wide truncate">
                            {era.seriesTag}
                          </h2>
                          <span className="text-xs font-mono text-on-surface-variant/90 tabular-nums">
                            {era.yearsLabel}
                          </span>
                        </div>
                      </div>

                      {/* Progreso de la era con mini barra */}
                      <div className="flex items-center gap-2.5 shrink-0 text-xs font-mono">
                        <span className="tabular-nums text-on-surface-variant font-bold">
                          {eraReadCount}/{eraTotalCount} vistos
                        </span>
                        <div className="w-16 sm:w-20 h-1.5 rounded-full bg-white/10 overflow-hidden border border-white/5">
                          <div
                            className="h-full rounded-full transition-[width] duration-300"
                            style={{
                              width: `${eraPercent}%`,
                              backgroundColor: era.accentHex,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Sagas de la era */}
                    <div className="flex flex-col gap-5">
                      {era.sagas.map((sagaGroup) => {
                        const sagaBadge = getSagaBadgeConfig(
                          sagaGroup.volumes[0]?.saga ?? 'clasico',
                          sagaGroup.sagaName
                        );
                        const sagaGroupRead = sagaGroup.volumes.filter((v) =>
                          readVolumeIds.has(v.id)
                        ).length;

                        return (
                          <div
                            key={`${sagaGroup.seriesId}::${sagaGroup.sagaId}`}
                            className="flex flex-col gap-3"
                          >
                            {/* Subencabezado de saga: SOLO si tiene >= 2 lapsos */}
                            {sagaGroup.volumes.length >= 2 && (
                              <div className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs font-mono ml-6 sm:ml-10">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-3xs font-bold border shrink-0 ${sagaBadge.bg} ${sagaBadge.border} ${sagaBadge.text}`}
                                  >
                                    {sagaBadge.icon} {sagaGroup.sagaName}
                                  </span>
                                  <span className="text-on-surface-variant tabular-nums text-2xs">
                                    {sagaGroup.volumes.length} lapsos • {sagaGroupRead}/{sagaGroup.volumes.length} vistos
                                  </span>
                                </div>
                                <span className="text-on-surface-variant/70 tabular-nums text-2xs hidden sm:inline">
                                  {sagaGroup.volumes[0]?.episodesRange} → {sagaGroup.volumes[sagaGroup.volumes.length - 1]?.episodesRange}
                                </span>
                              </div>
                            )}

                            {/* Filas de la saga con interludios intercalados */}
                            <div className="flex flex-col gap-3">
                              {sagaGroup.volumes.map((volume) => {
                                const visibleIndex = visibleIndexMap.get(volume.id) ?? -1;
                                const nextVolume =
                                  visibleIndex >= 0 && visibleIndex + 1 < volumes.length
                                    ? volumes[visibleIndex + 1]
                                    : undefined;
                                // Solo si from y to son consecutivos en la lista visible:
                                // con filtro de era se ven los internos de la era, con
                                // búsqueda activa ninguno.
                                const interlude =
                                  showInterludeDividers && nextVolume
                                    ? interludeMap.get(`${volume.id}::${nextVolume.id}`)
                                    : undefined;
                                const isLastVisible =
                                  visibleIndex === volumes.length - 1;
                                const showEpilogue =
                                  showInterludeDividers &&
                                  isLastVisible &&
                                  epilogue?.fromVolumeId === volume.id
                                    ? epilogue
                                    : undefined;

                                const isRead = readVolumeIds.has(volume.id);
                                const isExpanded = expandedVolumeId === volume.id;
                                const isHighlighted = highlightedVolumeId === volume.id;

                                return (
                                  <React.Fragment key={volume.id}>
                                    <ChronologyRow
                                      volume={volume}
                                      isRead={isRead}
                                      isExpanded={isExpanded}
                                      isHighlighted={isHighlighted}
                                      onToggleExpand={() =>
                                        handleToggleExpand(volume.id)
                                      }
                                      onToggleRead={onToggleRead}
                                      onInspectThumbnail={onInspectThumbnail}
                                      onPlayVolume={onPlayVolume}
                                    />
                                    {interlude && (
                                      <InterludeDivider
                                        interlude={interlude}
                                        toVolume={nextVolume}
                                        accentHex={
                                          accentByVolumeId.get(nextVolume?.id ?? '') ??
                                          era.accentHex
                                        }
                                      />
                                    )}
                                    {showEpilogue && (
                                      <InterludeDivider
                                        interlude={showEpilogue}
                                        toVolume={null}
                                        accentHex={era.accentHex}
                                      />
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </SectionBar>
    </div>
  );
};
