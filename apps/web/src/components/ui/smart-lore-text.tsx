import * as React from 'react';
import { LoreTerm } from './lore-term';

interface KeywordRule {
  pattern: RegExp;
  termKey: string;
}

export const LORE_KEYWORD_RULES: KeywordRule[] = [
  { pattern: /\b(maf[uū]ba)\b/i, termKey: 'mafuba' },
  { pattern: /\b(zenkai)\b/i, termKey: 'zenkai' },
  { pattern: /\b(c[eé]lulas\s*s|s-cells)\b/i, termKey: 'celulas-s' },
  { pattern: /\b(kachi\s*katchin)\b/i, termKey: 'kachi-katchin' },
  { pattern: /\b(kai[oō]-?ken)\b/i, termKey: 'kaio-ken' },
  { pattern: /\b(shunkan\s*id[oō]|teletransportaci[oó]n)\b/i, termKey: 'shunkan-ido' },
  { pattern: /\b(semillas?\s+del\s+ermita[ñn]o|senzu)\b/i, termKey: 'senzu' },
  { pattern: /\b(radar\s+del\s+drag[oó]n)\b/i, termKey: 'radar-del-dragon' },
  { pattern: /\b(nube\s+voladora|kint[oō]un)\b/i, termKey: 'kintoun' },
  { pattern: /\b(pendientes\s+pothala|pothala|potara)\b/i, termKey: 'potara' },
  { pattern: /\b(genki-?dama)\b/i, termKey: 'genki-dama' },
];

export interface SmartLoreTextProps {
  text?: string;
  className?: string;
}

/**
 * Escanea un texto narrativo e inyecta de forma reactiva y no invasiva componentes <LoreTerm />
 * sobre los conceptos canónicos reconocidos (técnicas, objetos, fisiología Saiyajin).
 */
export const SmartLoreText: React.FC<SmartLoreTextProps> = React.memo(({ text, className = '' }) => {
  if (!text) return null;

  // Encontrar todas las coincidencias válidas con su posición y termKey
  interface MatchRange {
    start: number;
    end: number;
    matchedText: string;
    termKey: string;
  }

  const matches: MatchRange[] = [];
  const usedTerms = new Set<string>();

  for (const rule of LORE_KEYWORD_RULES) {
    // Solo un highlight por término por párrafo para mantener la estética limpia
    if (usedTerms.has(rule.termKey)) continue;

    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    const result = regex.exec(text);
    if (result && result.index !== undefined) {
      const start = result.index;
      const end = start + result[0].length;

      // Verificar que no se solape con una coincidencia previa
      const overlaps = matches.some((m) => Math.max(start, m.start) < Math.min(end, m.end));
      if (!overlaps) {
        matches.push({
          start,
          end,
          matchedText: result[0],
          termKey: rule.termKey,
        });
        usedTerms.add(rule.termKey);
      }
    }
  }

  // Si no hay coincidencias de lore, devolver el texto tal cual
  if (matches.length === 0) {
    return <span className={className}>{text}</span>;
  }

  // Ordenar de izquierda a derecha
  matches.sort((a, b) => a.start - b.start);

  // Construir fragmentos React intercalados
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;

  matches.forEach((match, idx) => {
    // Texto antes de la coincidencia
    if (match.start > lastIndex) {
      elements.push(
        <React.Fragment key={`text-${lastIndex}`}>
          {text.slice(lastIndex, match.start)}
        </React.Fragment>
      );
    }

    // Coincidencia envuelta en <LoreTerm />
    elements.push(
      <LoreTerm key={`lore-${match.termKey}-${idx}`} termKey={match.termKey}>
        {match.matchedText}
      </LoreTerm>
    );

    lastIndex = match.end;
  });

  // Texto restante tras la última coincidencia
  if (lastIndex < text.length) {
    elements.push(
      <React.Fragment key={`text-end-${lastIndex}`}>
        {text.slice(lastIndex)}
      </React.Fragment>
    );
  }

  return <span className={className}>{elements}</span>;
});

SmartLoreText.displayName = 'SmartLoreText';
