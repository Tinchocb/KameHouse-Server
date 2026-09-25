export type SagaCategory = 'clasico' | 'saiyan-freezer' | 'cell' | 'buu' | 'super' | 'daima' | 'gt';

export type EraFilter = 'all' | 'db-clasico' | 'db-z' | 'db-super' | 'db-daima' | 'db-gt';

export type AspectRatioType = '3:4' | '2:3';

export type MovieFilterOption = 'none' | 'canon' | 'all';

export type TimelineViewType = 'horizontal' | 'vertical' | 'branches' | 'inspector';

export interface TimelineMilestone {
  id: string;
  year: string;
  yearNumber: number;
  label: string;
  category: 'time-jump' | 'cosmic-event' | 'training' | 'paradox';
  description: string;
  durationOrGap?: string;
  associatedVolumeBeforeId: string;
  associatedVolumeAfterId: string;
  iconType: 'hourglass' | 'swords' | 'zap' | 'orbit' | 'flame';
}

export interface SagaStartMilestone {
  id: string;
  sagaName: string;
  shortTitle: string;
  volumeId: string;
  volumeNumber: string;
  year: string;
  yearNumber: number;
  era: 'Dragon Ball' | 'Dragon Ball Z' | 'Super' | 'Dragon Ball Daima' | 'Dragon Ball GT';
  eraKey: 'db-clasico' | 'db-z' | 'db-super' | 'db-daima' | 'db-gt';
  eraBadgeColor: string;
  colorHex: string;
  kanji: string;
  episodesStart: string;
  description: string;
}

export interface MasterEraInfo {
  key: 'db-clasico' | 'db-z' | 'db-super' | 'db-daima' | 'db-gt';
  title: string;
  shortTitle: string;
  seriesTag: 'Dragon Ball Clásico' | 'Dragon Ball Z' | 'Dragon Ball Super' | 'Dragon Ball Daima' | 'Dragon Ball GT';
  years: string;
  yearStart: number;
  yearEnd: number;
  kanjiEmblems: string[];
  themeColorHex: string;
  accentBorder: string;
  bgGradient: string;
  tagline: string;
  volumeRangeText: string;
  canonEpisodesText: string;
  sagasIncluded: string[];
}

export interface TimelineBranch {
  id: string;
  name: string;
  codeName: string;
  originYear: string;
  status: 'active' | 'alternate' | 'erased' | 'divergent';
  summary: string;
  events: string[];
  ringOfTimeColor: string;
  paradoxCause: string;
  fate: string;
}

export interface VolumeNarrative {
  detonante: {
    title: string;
    description: string;
    statusQuoBreaker: string;
    exactEpisodePoint: string;
    keyQuote?: string;
  };
  climax: {
    title: string;
    description: string;
    decisiveBattle: string;
    forbiddenTechniqueOrCost: string;
    iconicMoment: string;
  };
  lore: {
    title: string;
    secretSummary: string;
    cosmicBackground: string;
    deityInvolved: string;
    cosmicImpact: string;
    unrevealedFact: string;
  };
  characters?: string[];
  keyArtifacts?: string[];
}

export interface VolumeCoverArt {
  dominantToneDescription: string;
  visualSummary: string;
  kanjiTitle: string;
  kanjiSubtitle: string;
  symbolGlyph: string;
  auraGradient: string;
  spineColor: string;
  borderColor: string;
  badgeBg: string;
  tagColor: string;
  accentHex: string;
  themeClass: string;
}

export interface ChapterMilestone {
  episode: string;
  title: string;
  synopsis: string;
  sceneHighlight?: string;
  accentColor?: string;
  bgGradient?: string;
  iconEmoji?: string;
  characterFocus?: string;
  /** Ruta local curada (prioridad 1 del híbrido). Ej: /episodes/z/159.webp */
  thumbnailUrl?: string;
  /** Temporada TMDB para el fallback de still (prioridad 2). Si se omite se deriva del absoluto. */
  tmdbSeason?: number;
  /** Episodio dentro de la temporada TMDB para el fallback. */
  tmdbEpisode?: number;
  /** Número absoluto dentro de la serie (1-based). Si se omite se parsea de `episode`. */
  absoluteEpisode?: number;
  /** Segundo de inicio del momento (segundos exactos dentro del episodio). */
  startSec?: number;
  /** Clave estable del momento (`${span.id}:${episode}:${index}`) para correcciones y player. */
  momentKey?: string;
}

export interface StoryBattle {
  fighter1: string;
  fighter2: string;
  outcome: string;
}

export interface DetailedStoryNarrative {
  prologue: string;
  escalation: string;
  turningPoint: string;
  aftermath: string;
  keyBattles: StoryBattle[];
  episodeMilestones: ChapterMilestone[];
}

/** Lo que pasa en paralelo o fuera de cámara dentro de un lapso. */
export interface InterChapterEntry {
  title: string;
  /** Momento dentro de la historia, p. ej. "Año 761–762". */
  when?: string;
  summary: string;
  /** Obra y saga donde se cuenta; sin páginas ni capítulos sin verificar. */
  source: string;
}

/** Dato puntual del lapso para leer de un vistazo («Técnica decisiva: Makankōsappō»). */
export interface KeyFact {
  label: string;
  value: string;
}

/** Nota de producción: cómo se hizo la obra, no lo que pasa en ella. */
export interface BehindTheScenesNote {
  title: string;
  text: string;
  source: string;
}

export interface VolumeData {
  id: string;
  volumeNumber: string; // e.g. "Volumen 04" / "Lapso 25"
  volumeIndex: number;
  seriesTag: 'Dragon Ball Clásico' | 'Dragon Ball Z' | 'Dragon Ball Super' | 'Dragon Ball Daima' | 'Dragon Ball GT';
  /** Serie canónica del span (classic/z/super/daima/gt). */
  seriesId?: 'classic' | 'z' | 'super' | 'daima' | 'gt';
  /** Saga canónica del span (sagaId del JSON). Permite agrupar por sagas y subsagas. */
  sagaId?: string;
  /** Orden global del span (1..N) y orden dentro de la serie. */
  order?: number;
  seriesOrder?: number;
  title: string;
  subtitle: string;
  startEpisode?: number;
  endEpisode?: number;
  episodesRange: string; // e.g. "Caps 102 al 132"
  episodesCount: number;
  officialYear: string; // e.g. "Año 753"
  officialYearNumber: number;
  saga: SagaCategory;
  sagaLabel: string;
  isFeaturedExample?: boolean;
  coverArt: VolumeCoverArt;
  narrative: VolumeNarrative;
  detailedStory?: DetailedStoryNarrative;
  characters: string[];
  keyArtifacts: string[];
  // Backend & narrative enrichment fields
  mediaId?: number;
  tmdbId?: number;
  canonStatus?: string;
  posterUrl?: string;
  backdropUrl?: string;
  previouslyOn?: string;
  detailedPlot?: string;
  fillerEpisodes?: number[];
  recommendedStartEpisode?: number;
  quickCatchUpKeys?: string[];
  /** Estado de las esferas del dragón al inicio del lapso (lapsos derivados de spans). */
  dragonBallsStatus?: string;
  /** Nivel de amenaza al inicio del lapso (lapsos derivados de spans). */
  threatLevel?: string;
  /** Hilos paralelos del lapso («Entre caps»); solo en lapsos con datos verificados. */
  interChapter?: InterChapterEntry[];
  /** Datos clave verificados del lapso. */
  keyFacts?: KeyFact[];
  /** Notas de producción verificadas del lapso. */
  behindTheScenes?: BehindTheScenesNote[];
}

export interface GlossaryTerm {
  id: string;
  term: string;
  originalJapanese?: string;
  category: 'Biología & Razas' | 'Mecánicas Temporales' | 'Divinidad & Ki' | 'Técnicas & Fusiones' | 'Artefactos Cósmicos';
  categoryColor: string;
  shortDefinition: string;
  deepLore: string;
  canonicalRules: string[];
  associatedVolumeIds: string[];
  keyQuote?: string;
}
