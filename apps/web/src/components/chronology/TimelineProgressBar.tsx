import React, { useMemo } from 'react';
import { VolumeData } from './types';
import { MASTER_ERAS } from './data/volumes';
import { CheckCircle2, Bookmark, RotateCcw, ArrowRight, Sparkles } from 'lucide-react';
import { sounds } from './utils/audio';
import { SectionBar } from '@/components/ui/sectionbar';

interface TimelineProgressBarProps {
  volumes: VolumeData[];
  readVolumeIds: Set<string>;
  onToggleRead: (volumeId: string) => void;
  onMarkAllRead: () => void;
  onResetRead: () => void;
  onSelectVolume: (volumeId: string) => void;
  selectedVolumeId: string;
}

export const TimelineProgressBar: React.FC<TimelineProgressBarProps> = ({
  volumes,
  readVolumeIds,
  onToggleRead: _onToggleRead,
  onMarkAllRead,
  onResetRead,
  onSelectVolume,
  selectedVolumeId: _selectedVolumeId,
}) => {
  const totalVolumes = volumes.length;
  const readCount = readVolumeIds.size;
  const percentage = totalVolumes > 0 ? Math.round((readCount / totalVolumes) * 100) : 0;

  // Total canon episodes read
  const totalEpisodes = useMemo(() => {
    return volumes.reduce((acc, v) => acc + (v.episodesCount || 0), 0);
  }, [volumes]);

  const readEpisodes = useMemo(() => {
    return volumes
      .filter((v) => readVolumeIds.has(v.id))
      .reduce((acc, v) => acc + (v.episodesCount || 0), 0);
  }, [volumes, readVolumeIds]);

  // Find next unread volume
  const nextUnreadVolume = useMemo(() => {
    return volumes.find((v) => !readVolumeIds.has(v.id));
  }, [volumes, readVolumeIds]);

  // Era breakdown calculation
  const eraStats = useMemo(() => {
    return MASTER_ERAS.map((era) => {
      const eraVols = volumes.filter((v) => v.seriesTag === era.seriesTag);
      const eraReadCount = eraVols.filter((v) => readVolumeIds.has(v.id)).length;
      const eraPct = eraVols.length > 0 ? Math.round((eraReadCount / eraVols.length) * 100) : 0;
      return {
        ...era,
        total: eraVols.length,
        read: eraReadCount,
        percent: eraPct,
      };
    });
  }, [volumes, readVolumeIds]);

  return (
    <SectionBar
      id="timeline-persistent-progress-bar"
      label="REGISTRO DE LECTURA CRONOLÓGICA"
      description={`Progreso persistente del canon: ${readEpisodes} de ${totalEpisodes} episodios completados`}
      icon={CheckCircle2}
      badge={
        <span className="text-3xs font-mono px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant border border-white/10 font-bold">
          {readCount} de {totalVolumes} Tomos ({percentage}%)
        </span>
      }
      variant="default"
      className="w-full"
    >
      <div className="flex flex-col gap-4">
        {/* Quick actions */}
        <div className="flex items-center justify-end gap-2 flex-wrap">
          {nextUnreadVolume && (
            <button
              id="btn-jump-next-unread"
              onClick={() => {
                sounds.playSelect();
                onSelectVolume(nextUnreadVolume.id);
              }}
              className="px-3 py-1.5 rounded-xl bg-brand-accent hover:brightness-110 text-on-primary text-xs font-mono font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
              title={`Continuar en ${nextUnreadVolume.title}`}
            >
              <span>Siguiente Tomo: {nextUnreadVolume.volumeNumber}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {readCount < totalVolumes ? (
            <button
              id="btn-mark-all-read"
              onClick={() => {
                sounds.playSelect();
                onMarkAllRead();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-white text-xs font-mono border border-white/10 transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
              title="Marcar todos los tomos como leídos"
            >
              <Bookmark className="w-3 h-3 text-brand-accent" />
              <span>Marcar Todos</span>
            </button>
          ) : (
            <button
              id="btn-reset-read-progress"
              onClick={() => {
                sounds.playSelect();
                onResetRead();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-white text-xs font-mono border border-white/10 transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
              title="Reiniciar progreso de lectura"
            >
              <RotateCcw className="w-3 h-3 text-on-surface-variant/60" />
              <span>Reiniciar</span>
            </button>
          )}
        </div>

        {/* Master glowing Ki energy progress track */}
        <div className="relative w-full h-3.5 bg-surface-container-lowest rounded-full overflow-hidden border border-white/10 shadow-inner">
          {/* Fill Bar */}
          <div className="h-full bg-gradient-to-r from-brand-accent via-brand-secondary to-brand-secondary transition-all duration-500 rounded-full relative" style={{ width: `${percentage}%` }}>
            {/* Indicator at the tip */}
            {percentage > 0 && percentage < 100 && (
              <span className="absolute right-0 top-0 bottom-0 w-3 bg-white/80 rounded-full shadow-glow-tip" />
            )}
          </div>
        </div>

        {/* Era Segmented Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {eraStats.map((era) => {
            const isCompleted = era.read === era.total && era.total > 0;
            return (
              <div key={era.key} className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${ isCompleted ? 'bg-surface-container-high/60 border-status-success/40 text-status-success' : 'bg-surface-container-low/50 border-white/5 text-on-surface-variant' }`}>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: era.themeColorHex }} />
                  <div>
                    <div className="text-xs font-mono font-bold leading-none text-white">
                      {era.shortTitle}
                    </div>
                    <span className="text-3xs font-mono text-on-surface-variant/70"> {era.years} </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 font-mono text-xs">
                  <span className="text-on-surface-variant/60"> {era.read}/{era.total} </span>
                  {isCompleted ? (
                    <span className="px-1.5 py-0.5 rounded bg-status-success/20 border border-status-success/50 text-3xs font-bold text-status-success flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" /> 100%
                    </span>
                  ) : (
                    <span className="text-on-surface-variant/60 text-2xs"> {era.percent}% </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionBar>
  );
};