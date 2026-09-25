import { describe, it, expect } from 'vitest';
import { LORE_GLOSSARY_TERMS, LORE_ARTIFACTS, MULTIVERSE_TIMELINES } from './index';
import { LORE_KEYWORD_RULES } from '@/components/ui/smart-lore-text';

/** Citas con número de página o capítulo: solo se aceptan si alguien las verificó contra el ejemplar. */
const UNVERIFIED_LOCATOR = /p[áa]g\.|p[áa]gina|cap\.\s*\d/i;

describe('lore canónico', () => {
  it('cada término del glosario tiene definición y fuente', () => {
    for (const [key, term] of Object.entries(LORE_GLOSSARY_TERMS)) {
      expect(term.key).toBe(key);
      expect(term.shortDefinition).toBeTruthy();
      expect(term.detailedContext).toBeTruthy();
      expect(term.sourceCitation).toBeTruthy();
    }
  });

  it('cada artefacto tiene fuente y al menos una regla', () => {
    for (const [id, artifact] of Object.entries(LORE_ARTIFACTS)) {
      expect(artifact.id).toBe(id);
      expect(artifact.rulesAndLimitations.length).toBeGreaterThan(0);
      expect(artifact.source.bookOrArticle).toBeTruthy();
    }
  });

  it('las líneas temporales tienen ids únicos y fuente', () => {
    const ids = MULTIVERSE_TIMELINES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const timeline of MULTIVERSE_TIMELINES) {
      expect(timeline.divergenceEvent).toBeTruthy();
      expect(timeline.source).toBeTruthy();
    }
  });

  it('ninguna cita trae números de página o capítulo sin verificar', () => {
    const citations = [
      ...Object.values(LORE_GLOSSARY_TERMS).map((t) => t.sourceCitation),
      ...Object.values(LORE_ARTIFACTS).flatMap((a) => [a.source.bookOrArticle, a.source.referenceNote ?? '']),
      ...MULTIVERSE_TIMELINES.map((t) => t.source),
    ];
    for (const citation of citations) {
      expect(citation).not.toMatch(UNVERIFIED_LOCATOR);
    }
  });

  it('cada palabra clave del texto enriquecido apunta a un término existente', () => {
    for (const rule of LORE_KEYWORD_RULES) {
      expect(LORE_GLOSSARY_TERMS[rule.termKey], rule.termKey).toBeDefined();
    }
  });
});
