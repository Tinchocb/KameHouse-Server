import { describe, expect, it } from 'vitest';
import { DRAGON_BALL_STORY_SPANS } from '@/lib/config/dragonball_story_spans';
import { SPAN_LORE } from './spanLore';

const UNVERIFIED_LOCATOR = /p[áa]g\.|p[áa]gina|cap\.\s*\d/i;

describe('SPAN_LORE', () => {
  it('solo describe lapsos que existen', () => {
    const spanIds = new Set(DRAGON_BALL_STORY_SPANS.map((s) => s.id));
    for (const id of Object.keys(SPAN_LORE)) {
      expect(spanIds.has(id), id).toBe(true);
    }
  });

  it('los datos clave llenan la grilla de a pares y sin repetir etiqueta', () => {
    for (const [id, lore] of Object.entries(SPAN_LORE)) {
      const facts = lore.keyFacts ?? [];
      expect(facts.length % 2, id).toBe(0);
      expect(new Set(facts.map((f) => f.label)).size, id).toBe(facts.length);
    }
  });

  it('cada entrada cita su fuente sin páginas ni capítulos sin verificar', () => {
    for (const [id, lore] of Object.entries(SPAN_LORE)) {
      const sources = [
        ...(lore.interChapter ?? []).map((e) => e.source),
        ...(lore.behindTheScenes ?? []).map((n) => n.source),
      ];
      for (const source of sources) {
        expect(source, id).toBeTruthy();
        expect(source, id).not.toMatch(UNVERIFIED_LOCATOR);
      }
    }
  });
});
