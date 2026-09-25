/**
 * KameHouse — Dragon World Lore Engine (TypeScript Contracts)
 *
 * Contratos de datos estructurados para el compendio enciclopédico oficial de Dragon Ball.
 * Regla editorial: cada dato debe salir de la obra o de material oficial identificable;
 * lo que no se pueda citar no entra.
 */

export type LoreSourceKey =
  | 'manga'
  | 'anime'
  | 'daizenshuu-2'
  | 'daizenshuu-4'
  | 'daizenshuu-7'
  | 'chozenshu-1'
  | 'toriyama-interview'
  | 'kanzenshuu-archive'
  | 'dragon-ball-official';

export interface LoreSourceCitation {
  source: LoreSourceKey;
  bookOrArticle: string;
  referenceNote?: string;
}

export interface LoreArtifact {
  id: string;
  name: string;
  japaneseName: string;
  category: 'místico' | 'tecnología' | 'divino' | 'combate';
  creator: string;
  firstAppearance: {
    ageYear?: number;
    episodeOrChapter: string;
    context: string;
  };
  rulesAndLimitations: string[];
  cosmicSignificance: string;
  source: LoreSourceCitation;
}

export interface LoreRace {
  id: string;
  name: string;
  homeworld: string;
  biologicalTraits: {
    lifespan: string;
    kiPhysiology: string;
    transformationsOrAwakenings?: string[];
    weaknesses?: string[];
  };
  reproductionAndClans?: string;
  cosmicStatus: string;
  source: LoreSourceCitation;
}

export interface MultiverseTimeline {
  id: number;
  designation: string;
  description: string;
  divergenceEvent: string;
  keySurvivors: string[];
  statusAtEnd: string;
  /** Obra donde se establece esta línea temporal. */
  source: string;
}

export interface PowerScaleSystem {
  id: string;
  name: string;
  origin: string;
  measurementUnit: string;
  referencePoints: Array<{
    subject: string;
    value: string;
    context: string;
  }>;
  operationalLimits: string;
  source: LoreSourceCitation;
}

export interface LoreGlossaryTerm {
  key: string;
  term: string;
  kanji?: string;
  romaji?: string;
  category: 'técnica' | 'objeto' | 'raza' | 'concepto-ki' | 'lugar' | 'evento';
  shortDefinition: string;
  detailedContext: string;
  sourceCitation: string;
}
