import { describe, it, expect } from 'vitest';
import { LORE_GLOSSARY_TERMS } from './glossary-terms';
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

  it('ninguna cita trae números de página o capítulo sin verificar', () => {
    const citations = [
      ...Object.values(LORE_GLOSSARY_TERMS).map((t) => t.sourceCitation),
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
