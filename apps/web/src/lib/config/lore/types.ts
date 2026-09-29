/**
 * KameHouse — Dragon World Lore Engine (TypeScript Contracts)
 *
 * Contratos del glosario de lore de Dragon Ball.
 * Regla editorial: cada dato debe salir de la obra o de material oficial identificable;
 * lo que no se pueda citar no entra.
 */

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
