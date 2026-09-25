import type {
  CharacterDTO,
  EpisodeType,
  SagaDTO as BaseSagaDTO,
  SubSagaDTO as BaseSubSagaDTO,
} from "@/api/generated/types"

export type { CharacterDTO }

export interface SubSagaDTO extends BaseSubSagaDTO {
  image?: string
  description?: string
}

export interface SagaDTO extends Omit<BaseSagaDTO, "subSagas" | "description"> {
  description?: string
  image?: string
  subSagas?: SubSagaDTO[]
}

export interface SagaDetailSearchParams {
  tab?: "episodes" | "movie" | "relations" | "characters" | "details"
  saga?: string
  subSaga?: string
  /**
   * Número de episodio a reproducir automáticamente al montar la página.
   * Lo setea la continuación entre series de la línea temporal (al terminar
   * una serie se navega a la siguiente con `autoplay=1`).
   */
  autoplay?: string
  /** Segundo inicial opcional para arrancar la reproducción (ej: hito de cronología). */
  t?: string | number
  /** Clave estable del momento (`${span.id}:${episode}:${index}`) para corrección in-player. */
  moment?: string
  /** Título del momento para mostrar en el chip del player. */
  momentTitle?: string
  /** Lapso de la cronología desde el que se lanzó la reproducción: al cerrar el reproductor se vuelve ahí. */
  chrono?: string
}

import type { EpisodeTag } from "@/lib/helpers/synopsis-tagger"

export interface PremiumEpisode {
  id: string
  title: string
  number: number
  description: string
  thumbnailUrl: string
  fallbackThumbnailUrl?: string
  episodeType: EpisodeType
  isWatched: boolean
  isDownloaded?: boolean
  resolution?: string
  videoCodec?: string
  audioCodec?: string
  localFilePath?: string
  duration?: number
  progressPercent?: number
  sagaId?: string
  sagaName?: string
  tags?: string[]
  detailedTags?: EpisodeTag[]
}
