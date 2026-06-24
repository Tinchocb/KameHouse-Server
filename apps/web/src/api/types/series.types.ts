import type { NormalizedMedia } from "./unified.types"

export type CharacterRole = "Protagonist" | "Antagonist" | "Supporting" | "Background"

export type EpisodeType = "Canon" | "Filler" | "Hyped"

export interface CharacterDTO {
  name: string
  roleTag: CharacterRole
  avatarUrl: string
}

export interface SubSagaDTO {
  id: string
  name: string
  episodeRange: string
  startEp: number
  endEp: number
}

export interface SagaDTO {
  id: string
  name: string
  episodeRange: string
  description: string
  isFiller: boolean
  keyCharacters: CharacterDTO[]
  subSagas?: SubSagaDTO[]
}

export interface AdvancedMediaMetadata {
  audioTracks: string[]
  subtitles: string[]
  resolutionTag: string
  videoCodec: string
}

export interface SeriesDetailsDTO {
  media: NormalizedMedia
  advancedDetails: AdvancedMediaMetadata
  sagas: SagaDTO[]
}

export interface PremiumEpisode {
  id: string
  title: string
  number: number
  description: string
  thumbnailUrl: string
  episodeType: EpisodeType
  isWatched: boolean
  resolution: string
  videoCodec: string
  audioCodec: string
  localFilePath?: string
}
