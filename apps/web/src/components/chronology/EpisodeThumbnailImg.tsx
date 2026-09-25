import React, { useState } from 'react';
import { useGetTMDBEpisodeStill, buildTmdbStillUrl } from '@/api/hooks/tmdb-episode.hooks';
import { useGetAniListEpisodeThumbnail } from '@/api/hooks/anilist-episode.hooks';
import { useGetLibraryEpisodeFile } from '@/api/hooks/library-episode.hooks';
import { isImageLoaded, markImageLoaded } from '@/lib/helpers/images';
import {
  getTmdbIdForVolume,
  getAnilistIdForVolume,
  getLocalEpisodeThumbnail,
  parseAbsoluteEpisode,
} from './data/episodeMapping';
import type { VolumeData, ChapterMilestone } from './types';

interface EpisodeThumbnailImgProps {
  volume: Pick<VolumeData, 'id' | 'seriesTag' | 'tmdbId'>;
  milestone: Pick<ChapterMilestone, 'episode' | 'title' | 'thumbnailUrl' | 'tmdbSeason' | 'tmdbEpisode' | 'absoluteEpisode' | 'startSec'>;
  /** Segundo exacto para extraer frame (prioriza video-thumbnail?path=&t=). */
  startSec?: number;
  /** Fallback estático de saga (SAGA_IMAGE_MAP). Último recurso antes del gradiente. */
  fallbackSrc?: string;
  className?: string;
  eager?: boolean;
  /** Prioridad de descarga: la portada va primero y los frames de momentos después. */
  fetchPriority?: 'high' | 'low' | 'auto';
  /** Tamaño de las imágenes de TMDB: las miniaturas chicas no necesitan bajar w780. */
  tmdbSize?: 'w300' | 'w780';
}

/**
 * Miniatura SIEMPRE del episodio (híbrido por las dudas):
 * 1. Local file frame exacto si viene startSec y el episodio no tiene imagen (/api/v1/video-thumbnail?path=&t=)
 * 2. thumbnailUrl explícito del momento
 * 3. Imagen del episodio guardada en la biblioteca (un pedido para toda la cronología)
 * 4. Still real TMDB del episodio vía backend
 * 5. AniList streamingEpisodes vía backend (sin API key, cobertura completa)
 * 6. fallbackSrc de saga (último recurso, luego gradiente de fondo)
 *
 * TMDB y AniList se consultan solo cuando las fuentes anteriores no alcanzan: cada
 * fuente que falla es un pedido perdido y un re-render más de la tarjeta.
 */

type ThumbnailStage = 0 | 1 | 2 | 3 | 4;
// 0 = local curado, 1 = tmdb, 2 = local file frame, 3 = anilist, 4 = fallback saga

const TMDB_SIZE_SEGMENT = /\/t\/p\/w\d+\//;

const SOURCE_LABELS: Record<ThumbnailStage, string> = {
  0: 'local-curated',
  1: 'tmdb',
  2: 'library',
  3: 'anilist',
  4: 'saga',
};

export const EpisodeThumbnailImg: React.FC<EpisodeThumbnailImgProps> = ({
  volume,
  milestone,
  startSec,
  fallbackSrc,
  className = 'absolute inset-0 w-full h-full object-cover',
  eager = false,
  fetchPriority = 'auto',
  tmdbSize = 'w780',
}) => {
  const absolute = milestone.absoluteEpisode ?? parseAbsoluteEpisode(milestone.episode);
  const tvId = getTmdbIdForVolume(volume as VolumeData);
  const anilistId = getAnilistIdForVolume(volume as VolumeData);
  const localSrc = getLocalEpisodeThumbnail(volume as VolumeData, absolute, milestone.thumbnailUrl);

  const effectiveStartSec = startSec !== undefined ? startSec : milestone.startSec;
  const hasSpecificSecond = effectiveStartSec != null && effectiveStartSec >= 0;

  // URLs que ya fallaron al cargar: se saltean y se pasa a la siguiente fuente.
  const [failedSrcs, setFailedSrcs] = useState<ReadonlySet<string>>(() => new Set());
  const usable = (src: string | undefined): src is string => Boolean(src) && !failedSrcs.has(src as string);

  const { thumbnailUrl: libRawSrc, isExactFrame, settled: libSettled } = useGetLibraryEpisodeFile(tvId, absolute, effectiveStartSec);
  // La biblioteca guarda los stills de TMDB en w780; se pide el tamaño que la miniatura necesita.
  const libSrc = !isExactFrame && libRawSrc ? libRawSrc.replace(TMDB_SIZE_SEGMENT, `/t/p/${tmdbSize}/`) : libRawSrc;
  const exactFrameFirst = hasSpecificSecond && isExactFrame && usable(libSrc);

  // La biblioteca ya trae el still del episodio (llega precargada con la página): TMDB solo se
  // consulta si no hay imagen ahí ni frame exacto que mostrar.
  const libIsImage = usable(libSrc) && !isExactFrame;
  const needTmdb = !usable(localSrc) && libSettled && !libIsImage && !exactFrameFirst;
  const tmdbQuery = useGetTMDBEpisodeStill(tvId, absolute, { enabled: needTmdb });
  const tmdbSrc = buildTmdbStillUrl(tmdbQuery.data?.stillPath ?? tmdbQuery.data?.stillUrl, tmdbSize);
  const tmdbSettled = !tvId || !absolute || tmdbQuery.isFetched;

  const needAniList = needTmdb && tmdbSettled && !usable(tmdbSrc) && libSettled && !usable(libSrc);
  const { data: anilistEpisode } = useGetAniListEpisodeThumbnail(anilistId, absolute, { enabled: needAniList });
  const anilistSrc = anilistEpisode?.thumbnailUrl?.trim() ? anilistEpisode.thumbnailUrl : undefined;

  // Primera fuente disponible según prioridad; con segundo específico y archivo local,
  // manda el frame exacto de ffmpeg.
  const candidates: Array<[ThumbnailStage, string | undefined]> = exactFrameFirst
    ? [[2, libSrc], [0, localSrc], [1, tmdbSrc], [3, anilistSrc], [4, fallbackSrc]]
    : [[0, localSrc], [1, tmdbSrc], [2, libSrc], [3, anilistSrc], [4, fallbackSrc]];
  const chosen = candidates.find(([, src]) => usable(src));
  const effectiveStage = chosen?.[0];
  const effectiveSrc = chosen?.[1];

  // Una imagen ya descargada en esta sesión se muestra directo, sin shimmer ni fundido.
  const [loaded, setLoaded] = useState(() => isImageLoaded(effectiveSrc));
  const [prevSrc, setPrevSrc] = useState(effectiveSrc);

  if (effectiveSrc !== prevSrc) {
    setPrevSrc(effectiveSrc);
    setLoaded(isImageLoaded(effectiveSrc));
  }

  // No effectiveSrc available -> render nothing (but hooks still called)
  if (!effectiveSrc || effectiveStage === undefined) {
    return null;
  }

  return (
    <>
      {/* Shimmer loading behind image */}
      {!loaded && (
        <div
          className="absolute inset-0 animate-pulse motion-reduce:animate-none bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800"
          aria-hidden="true"
        />
      )}
      <img
        src={effectiveSrc}
        alt={milestone.title}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={fetchPriority}
        draggable={false}
        referrerPolicy="no-referrer"
        // De dónde salió la miniatura, para depurar desde DevTools sin mostrarlo en pantalla.
        data-thumb-source={SOURCE_LABELS[effectiveStage]}
        // Aparece asentándose (fundido + 2% de escala) en vez de saltar sobre el shimmer.
        className={`${className} transition-[opacity,transform] duration-base ease-smooth-out motion-reduce:transition-none ${
          loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.02]'
        }`}
        onLoad={() => {
          markImageLoaded(effectiveSrc);
          setLoaded(true);
        }}
        onError={() => {
          setFailedSrcs((prev) => new Set(prev).add(effectiveSrc));
        }}
      />
    </>
  );
};