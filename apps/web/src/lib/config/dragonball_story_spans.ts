import storySpansData from "./dragonball_story_spans.json"

export interface StorySpanMilestone {
  episode: number
  title: string
  description: string
  time?: string
}

export interface StorySpanCharacterStatus {
  goku: string
  vegeta: string
  gohan: string
  piccolo: string
  allies?: string
  [key: string]: string | undefined
}

export interface StorySpanWorldState {
  threatLevel: string
  activeVillains: string[]
  dragonBallsStatus: string
  characterStatus: StorySpanCharacterStatus
}

export type SeriesSpanId = "classic" | "z" | "super" | "daima" | "gt"

export interface StorySpan {
  id: string
  seriesId: SeriesSpanId
  seriesTitle: string
  tmdbId: number
  order: number
  seriesOrder: number
  sagaId: string
  sagaName: string
  title: string
  startEpisode: number
  endEpisode: number
  inUniverseYears: string
  dominantVibe: string
  previouslyOn: string
  detailedPlot: string
  worldStateAtStart: StorySpanWorldState
  quickCatchUpKeys: string[]
  milestones: StorySpanMilestone[]
  hasFiller: boolean
  fillerEpisodes: number[]
  recommendedStartEpisode: number
}

export interface SeriesSummary {
  id: SeriesSpanId
  tmdbId: number
  title: string
  totalEpisodes: number
  spansCount: number
  canon: boolean
}

export interface StorySpansPayload {
  title: string
  version: string
  updatedAt: string
  totalSpans: number
  seriesSummary: SeriesSummary[]
  spans: StorySpan[]
}

export const DRAGON_BALL_STORY_DATA = storySpansData as unknown as StorySpansPayload
export const DRAGON_BALL_STORY_SPANS: StorySpan[] = DRAGON_BALL_STORY_DATA.spans
