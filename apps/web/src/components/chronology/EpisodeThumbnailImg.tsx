import React, { useState } from 'react';
import { useGetTMDBEpisodeStill, buildTmdbStillUrl } from '@/api/hooks/tmdb-episode.hooks';
import { useGetAniListEpisodeThumbnail } from '@/api/hooks/anilist-episode.hooks';
import { useGetLibraryEpisodeFile } from '@/api/hooks/library-episode.hooks';
import {
  getTmdbIdForVolume,
  getAnilistIdForVolume,
  getLocalEpisodeThumbnail,
  parseAbsoluteEpisode,
} from './data/episodeMapping';
import type { VolumeData, ChapterMilestone } from './types';

interface EpisodeThumbnailImgProps {
  volume: Pick<VolumeData, 'id' | 'seriesTag' | 'tmdbId'>;
  milestone: Pick<ChapterMilestone, 'episode' | 'title' | 'thumbnailUrl' | 'tmdbSeason' | 'tmdbEpisode' | 'absoluteEpisode'>;
  /** Fallback estático de saga (SAGA_IMAGE_MAP). Último recurso antes del gradiente. */
  fallbackSrc?: string;
  className?: string;
  eager?: boolean;
}

/**
 * Miniatura SIEMPRE del episodio (híbrido por las dudas):
 * 1. Local curado (/episodes/<slug>/<abs>.webp o thumbnailUrl explícito)
 * 2. Still real TMDB del episodio vía backend
 * 3. **Local file frame** (biblioteca local → /api/v1/video-thumbnail?path=)
 * 4. AniList streamingEpisodes vía backend (sin API key, cobertura completa)
 * 5. fallbackSrc de saga (último recurso, luego gradiente de fondo)
 */
export const EpisodeThumbnailImg: React.FC<EpisodeThumbnailImgProps> = ({
  volume,
  milestone,
  fallbackSrc,
  className = 'absolute inset-0 w-full h-full object-cover',
  eager = false,
}) => {
  const absolute = milestone.absoluteEpisode ?? parseAbsoluteEpisode(milestone.episode);
  const tvId = getTmdbIdForVolume(volume as VolumeData);
  const anilistId = getAnilistIdForVolume(volume as VolumeData);
  const localSrc = getLocalEpisodeThumbnail(volume as VolumeData, absolute, milestone.thumbnailUrl);

  const { data: tmdbEpisode } = useGetTMDBEpisodeStill(tvId, absolute);
  const tmdbSrc = buildTmdbStillUrl(tmdbEpisode?.stillPath ?? tmdbEpisode?.stillUrl);
  const { data: anilistEpisode } = useGetAniListEpisodeThumbnail(anilistId, absolute);
  const anilistSrc = anilistEpisode?.thumbnailUrl?.trim() ? anilistEpisode.thumbnailUrl : undefined;
  const { thumbnailUrl: libSrc } = useGetLibraryEpisodeFile(tvId, absolute);

  const [stage, setStage] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  // 0 = local curado, 1 = tmdb, 2 = local file frame, 3 = anilist, 4 = fallback saga, 5 = ocultar (gradiente)

  // Salto directo al primer origen disponible (evita parpadeo con 404 local).
  const firstAvailable: 0 | 1 | 2 | 3 | 4 | 5 = localSrc
    ? 0
    : tmdbSrc
      ? 1
      : libSrc
        ? 2
        : anilistSrc
          ? 3
          : fallbackSrc
            ? 4
            : 5;
  const effectiveStage = stage === 0 && !localSrc ? firstAvailable : stage;
  const effectiveSrc =
    effectiveStage === 0
      ? localSrc
      : effectiveStage === 1
        ? tmdbSrc
        : effectiveStage === 2
          ? libSrc
          : effectiveStage === 3
            ? anilistSrc
            : effectiveStage === 4
              ? fallbackSrc
              : undefined;

  // Source label for badge
  const sourceLabels: Record<number, string> = {
    0: 'local-curated',
    1: 'tmdb',
    2: 'local-file',
    3: 'anilist',
    4: 'saga',
    5: 'none',
  };

  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [prevSrc, setPrevSrc] = useState(effectiveSrc);

  if (effectiveSrc !== prevSrc) {
    setPrevSrc(effectiveSrc);
    setLoaded(false);
    setLoadError(false);
  }

  // No effectiveSrc available -> render nothing (but hooks still called)
  if (!effectiveSrc) {
    return null;
  }

  return (
    <>
      {/* Shimmer loading behind image */}
      {!loaded && !loadError && (
        <div
          className="absolute inset-0 animate-pulse bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800"
          aria-hidden="true"
        />
      )}
      <img
        src={effectiveSrc}
        alt={milestone.title}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        referrerPolicy="no-referrer"
        className={className}
        onLoad={() => {
          setLoaded(true);
          setLoadError(false);
        }}
        onError={() => {
          setLoadError(true);
          if (effectiveStage === 0) {
            if (tmdbSrc) setStage(1);
            else if (libSrc) setStage(2);
            else if (anilistSrc) setStage(3);
            else if (fallbackSrc) setStage(4);
            else setStage(5);
          } else if (effectiveStage === 1) {
            if (libSrc) setStage(2);
            else if (anilistSrc) setStage(3);
            else if (fallbackSrc) setStage(4);
            else setStage(5);
          } else if (effectiveStage === 2) {
            if (anilistSrc) setStage(3);
            else if (fallbackSrc) setStage(4);
            else setStage(5);
          } else if (effectiveStage === 3) {
            if (fallbackSrc) setStage(4);
            else setStage(5);
          } else {
            setStage(5);
          }
        }}
      />
      {/* Source badge (bottom-right) */}
      {loaded && effectiveStage <= 4 && (
        <span
          className={`absolute bottom-1 right-1 w-2 h-2 rounded-full ${
            effectiveStage === 0 ? 'bg-emerald-500' :
            effectiveStage === 1 ? 'bg-blue-500' :
            effectiveStage === 2 ? 'bg-amber-500' :
            effectiveStage === 3 ? 'bg-purple-500' :
            'bg-slate-500'
          }`}
          title={`Fuente: ${sourceLabels[effectiveStage]}`}
          aria-label={`Fuente de miniatura: ${sourceLabels[effectiveStage]}`}
        />
      )}
    </>
  );
};