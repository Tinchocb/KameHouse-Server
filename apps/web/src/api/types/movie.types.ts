import type { NormalizedMedia } from "./unified.types"

export interface MovieChronology {
  startEpisodeContext: number
  endEpisodeContext: number
  chronologyNotes: string
}

export interface MovieAdvancedMetadata {
  fileSize: string
  resolutionTag: string
  videoCodec: string
  bitrate: string
  audioTracks: string[]
  subtitles: string[]
  collectionId: string
}

export interface MovieDetailsDTO {
  media: NormalizedMedia
  technical: MovieAdvancedMetadata
  chronology: MovieChronology
}
