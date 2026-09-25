import type { VolumeData, SagaCategory, DetailedStoryNarrative, ChapterMilestone } from '../types';
import { DRAGON_BALL_STORY_SPANS, type StorySpan } from '@/lib/config/dragonball_story_spans';
import { DETAILED_STORIES } from './detailedStories';
import { SPAN_DETAILED_STORIES } from './spanDetailedStories';
import { SPAN_LORE } from './spanLore';

const SERIES_TAG_BY_ID: Record<StorySpan['seriesId'], VolumeData['seriesTag']> = {
  classic: 'Dragon Ball Clásico',
  z: 'Dragon Ball Z',
  super: 'Dragon Ball Super',
  daima: 'Dragon Ball Daima',
  gt: 'Dragon Ball GT',
};

/** Categoría gruesa para badges/filtros existentes a partir del sagaId fino del span. */
function coarseSagaForSpan(span: StorySpan): SagaCategory {
  const sid = span.sagaId.toLowerCase();
  if (span.seriesId === 'classic') return 'clasico';
  if (span.seriesId === 'daima') return 'daima';
  if (span.seriesId === 'gt') return 'gt';
  if (span.seriesId === 'super') return 'super';
  // Z: repartir en saiyan-freezer / cell / buu
  if (/(saiyajin|freezer|garlic|namek)/.test(sid)) return 'saiyan-freezer';
  if (/(android|cell|torneo-otro)/.test(sid)) return 'cell';
  return 'buu';
}

function parseYearNumber(inUniverseYears: string): number {
  const m = inUniverseYears.match(/(\d{3,4})/);
  const n = m ? Number.parseInt(m[1], 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

/** Plantillas visuales por serie (heredan la estética de los 13 tomos legacy). */
const COVER_TEMPLATES: Record<StorySpan['seriesId'], VolumeData['coverArt']> = {
  classic: {
    dominantToneDescription: 'Ámbar cálido, verdes de selva primordial y resplandor de esfera mística',
    visualSummary: 'Goku infante junto a sus compañeros de aventura bajo el cielo de Shenlong.',
    kanjiTitle: '冒険の始まり',
    kanjiSubtitle: '神龍の降臨',
    symbolGlyph: '亀',
    auraGradient: 'from-amber-950 via-emerald-950/70 to-stone-950',
    spineColor: '#15803d',
    borderColor: 'border-orange-500/60',
    badgeBg: 'bg-orange-950/80 text-orange-300 border-orange-500/50',
    tagColor: 'text-orange-400',
    accentHex: '#F2762E', // = --era-db-hex
    themeClass: 'theme-clasico',
  },
  z: {
    dominantToneDescription: 'Rojo saiyajin, púrpura espacial y destellos dorados del Super Saiyajin',
    visualSummary: 'Guerreros Z al borde del colapso frente a la amenaza de turno.',
    kanjiTitle: '界王の試練',
    kanjiSubtitle: '超サイヤ人伝説',
    symbolGlyph: '超',
    auraGradient: 'from-amber-950/90 via-yellow-950/60 to-neutral-950',
    spineColor: '#b45309',
    borderColor: 'border-amber-400/60',
    badgeBg: 'bg-amber-950/80 text-amber-200 border-amber-400/50',
    tagColor: 'text-amber-300',
    accentHex: '#F5C242', // = --era-dbz-hex
    themeClass: 'theme-z',
  },
  daima: {
    dominantToneDescription: 'Oro místico, morados del Reino Demoniaco y brillos arcanos',
    visualSummary: 'Goku Mini con el Báculo Sagrado sobrevolando el Reino de los Demonios.',
    kanjiTitle: '大魔界の陰謀',
    kanjiSubtitle: '小さき戦士の冒険',
    symbolGlyph: '大',
    auraGradient: 'from-purple-950 via-violet-950/70 to-zinc-950',
    spineColor: '#7e22ce',
    borderColor: 'border-violet-400/60',
    badgeBg: 'bg-violet-950/80 text-violet-300 border-violet-400/50',
    tagColor: 'text-violet-300',
    accentHex: '#A56EF0', // = --era-daima-hex
    themeClass: 'theme-daima',
  },
  super: {
    dominantToneDescription: 'Azul divino, zafiro estelar y destellos de ki god',
    visualSummary: 'Goku y Vegeta al límite del ki divino frente a dioses y multiversos.',
    kanjiTitle: '神と神の領域',
    kanjiSubtitle: '超サイヤ人ゴッド',
    symbolGlyph: '神',
    auraGradient: 'from-blue-950 via-blue-950/80 to-indigo-950',
    spineColor: '#1d4ed8',
    borderColor: 'border-blue-400/60',
    badgeBg: 'bg-blue-950/80 text-blue-300 border-blue-400/50',
    tagColor: 'text-blue-400',
    accentHex: '#3D8BFF', // = --era-dbs-hex
    themeClass: 'theme-super',
  },
  gt: {
    dominantToneDescription: 'Rojo primal, sombras doradas cósmicas y energía negativa',
    visualSummary: 'Goku SSJ4 desatando el Kamehameha contra la oscuridad cósmica.',
    kanjiTitle: '大団円の奇跡',
    kanjiSubtitle: '超サイヤ人４の咆哮',
    symbolGlyph: '極',
    auraGradient: 'from-rose-950 via-fuchsia-950/70 to-neutral-950',
    spineColor: '#be123c',
    borderColor: 'border-rose-500/60',
    badgeBg: 'bg-rose-950/80 text-rose-300 border-rose-500/50',
    tagColor: 'text-rose-400',
    accentHex: '#E23A55', // = --era-dbgt-hex
    themeClass: 'theme-gt',
  },
};

/** Valores de characterStatus que significan "ausente en este lapso". */
const ABSENT_STATUS = /no ha nacido|fuera de pantalla|en el espacio|sellado|no existe|aún no/i;

function presentStatus(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim();
  return v !== '' && !ABSENT_STATUS.test(v);
}

function cleanName(s: string): string {
  const c = s.trim().replace(/\.$/, '');
  if (!c) return '';
  return c.charAt(0).toUpperCase() + c.slice(1);
}

function charactersFromSpan(span: StorySpan): string[] {
  const cs = span.worldStateAtStart.characterStatus;
  const out: string[] = [];
  if (presentStatus(cs.goku)) out.push('Goku');
  if (presentStatus(cs.vegeta)) out.push('Vegeta');
  if (presentStatus(cs.gohan)) out.push('Gohan');
  if (presentStatus(cs.piccolo)) out.push('Piccolo');
  if (cs.allies) {
    const allies = cs.allies
      .split(/,\s*|\s+y\s+/i)
      .map(cleanName)
      .filter(Boolean)
      .slice(0, 4);
    out.push(...allies);
  }
  return out.length > 0 ? out : ['Goku'];
}

/** Spans que reutilizan tal cual la historia detallada de un tomo legacy (alcance 1:1). */
const LEGACY_STORY_ALIAS: Record<string, string> = {
  'dbs-goku-black': 'vol-super-black',
};

const SERIES_ICON_EMOJI: Record<StorySpan['seriesId'], string> = {
  classic: '🐉',
  z: '💥',
  super: '🪐',
  daima: '✨',
  gt: '🌌',
};

/** Parsea una cadena "mm:ss" a segundos totales. Devuelve undefined si no tiene formato válido. */
export function parseTimeToSeconds(time?: string): number | undefined {
  if (!time) return undefined;
  const match = time.trim().match(/^(\d{1,3}):([0-5]\d)$/);
  if (!match) return undefined;
  const mins = Number.parseInt(match[1], 10);
  const secs = Number.parseInt(match[2], 10);
  return mins * 60 + secs;
}

/** Formatea segundos a "mm:ss" o "hh:mm:ss". */
export function formatSecondsToTime(totalSeconds: number): string {
  const safeSec = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = safeSec % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function buildEpisodeMilestones(span: StorySpan, accentHex: string, auraGradient: string): ChapterMilestone[] {
  const iconEmoji = SERIES_ICON_EMOJI[span.seriesId];
  return span.milestones.map((m, index) => ({
    episode: `Cap. ${m.episode}`,
    title: m.title,
    synopsis: m.description,
    sceneHighlight: m.description,
    accentColor: accentHex,
    bgGradient: auraGradient,
    iconEmoji,
    characterFocus: span.seriesTitle,
    absoluteEpisode: m.episode,
    startSec: parseTimeToSeconds(m.time),
    momentKey: `${span.id}:${m.episode}:${index}`,
  }));
}

export function spanToVolume(span: StorySpan): VolumeData {
  const seriesTag = SERIES_TAG_BY_ID[span.seriesId];
  const saga = coarseSagaForSpan(span);
  const episodesCount = span.endEpisode - span.startEpisode + 1;
  const coverArt = COVER_TEMPLATES[span.seriesId];
  const generatedMilestones = buildEpisodeMilestones(span, coverArt.accentHex, coverArt.auraGradient);
  const curated = SPAN_DETAILED_STORIES[span.id];
  const aliased = !curated ? LEGACY_STORY_ALIAS[span.id] : undefined;
  const legacyStory: DetailedStoryNarrative | undefined = aliased ? DETAILED_STORIES[aliased] : undefined;
  const detailedStory: DetailedStoryNarrative | undefined =
    DETAILED_STORIES[span.id] ??
    legacyStory ??
    (curated
      ? {
          prologue: curated.prologue,
          escalation: curated.escalation,
          turningPoint: curated.turningPoint,
          aftermath: curated.aftermath,
          keyBattles: curated.keyBattles,
          episodeMilestones: generatedMilestones,
        }
      : ({
          prologue: span.previouslyOn,
          escalation: span.detailedPlot.slice(0, 600),
          turningPoint: span.quickCatchUpKeys.join(' '),
          aftermath: span.detailedPlot.slice(600, 1200) || span.detailedPlot,
          keyBattles: [],
          episodeMilestones: generatedMilestones,
        } as DetailedStoryNarrative));

  return {
    id: span.id,
    volumeNumber: `Lapso ${String(span.order).padStart(2, '0')}`,
    volumeIndex: span.order,
    seriesTag,
    seriesId: span.seriesId,
    sagaId: span.sagaId,
    order: span.order,
    seriesOrder: span.seriesOrder,
    title: span.title,
    subtitle: `${span.sagaName} • ${span.dominantVibe}`,
    startEpisode: span.startEpisode,
    endEpisode: span.endEpisode,
    episodesRange: `Caps ${pad3(span.startEpisode)} al ${pad3(span.endEpisode)}`,
    episodesCount,
    officialYear: span.inUniverseYears,
    officialYearNumber: parseYearNumber(span.inUniverseYears),
    saga,
    sagaLabel: span.sagaName,
    coverArt: COVER_TEMPLATES[span.seriesId],
    narrative: {
      detonante: {
        title: span.sagaName,
        description: span.previouslyOn,
        statusQuoBreaker: span.worldStateAtStart.threatLevel,
        exactEpisodePoint: `Capítulo ${span.startEpisode}: "${span.milestones[0]?.title ?? span.title}"`,
      },
      climax: {
        title: span.title,
        description: span.detailedPlot,
        decisiveBattle: span.milestones[span.milestones.length - 1]?.title ?? span.title,
        forbiddenTechniqueOrCost: span.worldStateAtStart.dragonBallsStatus,
        iconicMoment: span.quickCatchUpKeys[0] ?? span.title,
      },
      lore: {
        title: span.dominantVibe,
        secretSummary: span.detailedPlot.slice(0, 280),
        cosmicBackground: span.detailedPlot,
        deityInvolved: seriesTag,
        cosmicImpact: span.worldStateAtStart.threatLevel,
        unrevealedFact: span.quickCatchUpKeys[span.quickCatchUpKeys.length - 1] ?? '',
      },
      characters: charactersFromSpan(span),
      keyArtifacts: [],
    },
    detailedStory,
    characters: charactersFromSpan(span),
    keyArtifacts: [],
    tmdbId: span.tmdbId,
    canonStatus: span.seriesId === 'gt' ? 'EXPANDED' : 'CANON',
    previouslyOn: span.previouslyOn,
    detailedPlot: span.detailedPlot,
    fillerEpisodes: span.fillerEpisodes,
    recommendedStartEpisode: span.recommendedStartEpisode,
    quickCatchUpKeys: span.quickCatchUpKeys,
    dragonBallsStatus: span.worldStateAtStart.dragonBallsStatus,
    threatLevel: span.worldStateAtStart.threatLevel,
    interChapter: SPAN_LORE[span.id]?.interChapter,
    keyFacts: SPAN_LORE[span.id]?.keyFacts,
    behindTheScenes: SPAN_LORE[span.id]?.behindTheScenes,
  };
}

/** Comparador in-universe: ordena por año oficial y desempata con el orden global. */
export function compareInUniverse(a: VolumeData, b: VolumeData): number {
  const yearDiff = a.officialYearNumber - b.officialYearNumber;
  if (yearDiff !== 0) return yearDiff;
  return (a.order ?? 0) - (b.order ?? 0);
}

/** Helper para mostrar el rango de año sin prefijos redundantes: "Año 749 – 750" → "749–750". */
export function formatYearShort(year: string): string {
  return year
    .replace(/^años?\s*/i, '')
    .replace(/\s*[–—-]\s*/g, '–')
    .trim();
}

/** 35 lapsos (sagas/subsagas) derivados 1:1 del JSON canónico. */
export const SPAN_VOLUMES: VolumeData[] = [...DRAGON_BALL_STORY_SPANS]
  .sort((a, b) => a.order - b.order)
  .map(spanToVolume);

/** Agrupación Serie > Saga > Lapsos para la vista por sagas y subsagas. */
export interface SagaGroup {
  seriesId: StorySpan['seriesId'];
  seriesTag: VolumeData['seriesTag'];
  sagaId: string;
  sagaName: string;
  volumes: VolumeData[];
  startEpisode: number;
  endEpisode: number;
}

/**
 * Agrupa tramos consecutivos de la misma saga respetando el orden de entrada recibido.
 */
export function groupVolumesBySaga(volumes: VolumeData[]): SagaGroup[] {
  const groups: SagaGroup[] = [];
  for (const v of volumes) {
    const key = `${v.seriesId ?? v.seriesTag}::${v.sagaId ?? v.sagaLabel}`;
    const current = groups[groups.length - 1];
    const currentKey = current ? `${current.seriesId ?? current.seriesTag}::${current.sagaId ?? current.sagaName}` : null;

    if (current && currentKey === key) {
      current.volumes.push(v);
      current.startEpisode = Math.min(current.startEpisode, v.order ?? 0);
      current.endEpisode = Math.max(current.endEpisode, v.order ?? 0);
    } else {
      groups.push({
        seriesId: (v.seriesId ?? 'z') as StorySpan['seriesId'],
        seriesTag: v.seriesTag,
        sagaId: v.sagaId ?? v.sagaLabel,
        sagaName: v.sagaLabel,
        volumes: [v],
        startEpisode: v.order ?? 0,
        endEpisode: v.order ?? 0,
      });
    }
  }
  return groups;
}

export interface EraGroup {
  seriesId: StorySpan['seriesId'];
  seriesTag: VolumeData['seriesTag'];
  yearsLabel: string;
  accentHex: string;
  sagas: SagaGroup[];
}

const ERA_CANONICAL_YEARS: Record<StorySpan['seriesId'], string> = {
  classic: 'Año 749 – 756',
  z: 'Año 761 – 774',
  daima: 'Año 774 – 775',
  super: 'Año 778 – 780',
  gt: 'Año 789 – 790',
};

/**
 * Agrupa tramos consecutivos por serie/era respetando el orden in-universe recibido.
 */
export function groupVolumesByEra(volumes: VolumeData[]): EraGroup[] {
  const chunks: VolumeData[][] = [];
  for (const v of volumes) {
    const lastChunk = chunks[chunks.length - 1];
    if (lastChunk && lastChunk[0].seriesId === v.seriesId) {
      lastChunk.push(v);
    } else {
      chunks.push([v]);
    }
  }

  return chunks.map((chunk) => {
    const first = chunk[0];
    const seriesId = (first.seriesId ?? 'z') as StorySpan['seriesId'];
    const coverArt = COVER_TEMPLATES[seriesId] ?? COVER_TEMPLATES.z;
    const startY = parseYearNumber(first.officialYear);
    const endY = Math.max(
      ...chunk.map((v) => {
        const m = v.officialYear.match(/\d{3,4}/g);
        return m ? Math.max(...m.map(Number)) : v.officialYearNumber;
      })
    );
    const yearsLabel =
      ERA_CANONICAL_YEARS[seriesId] ??
      (startY === endY ? `Año ${startY}` : `Año ${startY} – ${endY}`);

    return {
      seriesId,
      seriesTag: first.seriesTag,
      yearsLabel,
      accentHex: coverArt.accentHex,
      sagas: groupVolumesBySaga(chunk),
    };
  });
}

