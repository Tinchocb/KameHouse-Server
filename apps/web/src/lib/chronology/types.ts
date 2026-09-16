export type CanonStatus = "canon" | "non-canon" | "filler";

export interface TimelineSeries {
  id: string;
  tmdbId: number;
  title: string;
  totalEpisodes: number;
  spansCount: number;
  canon: boolean;
  inUniverseStartYear: number;
  inUniverseEndYear: number;
  dominantVibe: string;
  key: string;
  label: string;
}

export interface TimelineSpan {
  id: string;
  seriesId: string;
  seriesTitle: string;
  tmdbId: number;
  order: number;
  seriesOrder: number;
  sagaId: string;
  sagaName: string;
  title: string;
  startEpisode: number;
  endEpisode: number;
  inUniverseYears: string;
  dominantVibe: string;
  previouslyOn: string;
  detailedPlot: string;
  worldStateAtStart: WorldState;
  quickCatchUpKeys: string[];
  milestones: Milestone[];
  hasFiller: boolean;
  fillerEpisodes: number[];
  recommendedStartEpisode: number;
  canon: boolean;
}

export interface WorldState {
  threatLevel: ThreatLevel;
  activeVillains: string[];
  dragonBallsStatus: string;
  characterStatus: CharacterStatus;
}

export type ThreatLevel =
  | "Bajo / Cómico"
  | "Competitivo / Deportivo"
  | "Aventura Épica / Bélica / Pulp"
  | "Místico / Desafío Mágico"
  | "Deportivo / Ideológico"
  | "Terror / Tragedia / Venganza"
  | "Artes Marciales Divinas / Clímax Épico"
  | "Ciencia Ficción / Giro Cósmico / Entrenamiento Divino"
  | "Tragedia Bélica / Clímax Agónico"
  | "Thriller Espacial / Guerra a Tres Bandas"
  | "Acción Frenética / Revelación de Poder"
  | "Clímax Histórico del Anime / Ira Trascendental"
  | "Mágico / Demoníaco"
  | "Viajes en el Tiempo / Tensión Tecnológica / Desesperación"
  | "Fantasía Oscura / Relleno Toei";

export interface CharacterStatus {
  goku: string;
  vegeta: string;
  gohan: string;
  piccolo: string;
  allies: string;
}

export interface Milestone {
  episode: number;
  title: string;
  description: string;
}

export interface FranchiseTimelineEntry {
  tmdbId: number;
  key: string;
  label: string;
  canon: boolean;
}

export interface EraGroup {
  sagaId: string;
  sagaName: string;
  spans: TimelineSpan[];
  totalEpisodes: number;
  watchedEpisodes: number;
  inUniverseStart: string;
  inUniverseEnd: string;
  dominantVibe: string;
  canon: boolean;
}

export interface HeatmapNode {
  episode: number;
  intensity: number;
  milestone?: Milestone;
  threatLevel: ThreatLevel;
}