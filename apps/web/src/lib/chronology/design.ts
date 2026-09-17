import { ERA_COLOR_MAP, type EraId } from "@/components/ui/media-spotlight-helpers";
import type { ThreatLevel } from "./types";

export const SERIES_ERA_MAP: Record<string, EraId> = {
  classic: "db",
  z: "dbz",
  super: "dbs",
  daima: "dbdaima",
  gt: "dbgt",
};

export const SERIES_LABEL: Record<string, string> = {
  classic: "Dragon Ball",
  z: "Dragon Ball Z",
  super: "Dragon Ball Super",
  daima: "Dragon Ball Daima",
  gt: "Dragon Ball GT",
};

export const ERA_ORDER = ["classic", "z", "super", "daima", "gt"] as const;

export const SERIES_ORDER = ERA_ORDER;

export function getSeriesAccent(seriesId: string): string {
  return ERA_COLOR_MAP[SERIES_ERA_MAP[seriesId] ?? "dbz"]?.accent ?? ERA_COLOR_MAP.dbz.accent;
}

export function getSeriesGlow(seriesId: string): string {
  return ERA_COLOR_MAP[SERIES_ERA_MAP[seriesId] ?? "dbz"]?.glow ?? ERA_COLOR_MAP.dbz.glow;
}

export const THREAT_LEVEL_BADGES: Record<ThreatLevel, { label: string; color: string }> = {
  "Bajo / Cómico": { label: "Ligero", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  "Competitivo / Deportivo": { label: "Deportivo", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  "Aventura Épica / Bélica / Pulp": { label: "Épico", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  "Místico / Desafío Mágico": { label: "Místico", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  "Deportivo / Ideológico": { label: "Ideológico", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  "Terror / Tragedia / Venganza": { label: "Trágico", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  "Artes Marciales Divinas / Clímax Épico": { label: "Divino", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  "Ciencia Ficción / Giro Cósmico / Entrenamiento Divino": { label: "Cósmico", color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
  "Tragedia Bélica / Clímax Agónico": { label: "Apocalíptico", color: "bg-red-600/20 text-red-400 border-red-600/30" },
  "Thriller Espacial / Guerra a Tres Bandas": { label: "Guerra 3 Bandas", color: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
  "Acción Frenética / Revelación de Poder": { label: "Revelación", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  "Clímax Histórico del Anime / Ira Trascendental": { label: "Histórico", color: "bg-yellow-400/20 text-yellow-300 border-yellow-400/30" },
  "Mágico / Demoníaco": { label: "Demónico", color: "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30" },
  "Viajes en el Tiempo / Tensión Tecnológica / Desesperación": { label: "Temporal", color: "bg-purple-600/20 text-purple-400 border-purple-600/30" },
  "Fantasía Oscura / Relleno Toei": { label: "Relleno", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
};

export const ERA_BACKDROP: Record<string, string> = {
  classic: "/backdrops/db.webp",
  z: "/backdrops/dbz.webp",
  super: "/backdrops/dbs.webp",
  daima: "/backdrops/dbdaima.webp",
  gt: "/backdrops/dbgt.webp",
};

export const SPAN_ART: Record<string, string> = {
  "db-pilaf": "/sagas/original/busqueda-esferas.webp",
  "db-torneo-21": "/sagas/original/torneo-21-combates.webp",
  "db-red-ribbon": "/sagas/original/coronel-silver.webp",
  "db-uranai-baba": "/sagas/original/cinco-guerreros.webp",
  "db-torneo-22": "/sagas/original/combates-22.webp",
  "db-piccolo-daimaku": "/sagas/original/liberacion-piccolo.webp",
  "db-piccolo-jr": "/sagas/original/goku-vs-piccolo-jr.webp",
  "dbz-saiyajin-raditz": "/sagas/z/raditz-saga.jpg",
  "dbz-saiyajin-vegeta": "/sagas/z/vegeta-saga.jpg",
  "dbz-namek-viaje": "/sagas/z/goku-llega-namek.webp",
  "dbz-namek-ginyu-freezer": "/sagas/z/captain-ginyu-saga.jpg",
  "dbz-freezer-super-saiyajin": "/sagas/z/ssj-explosion-namek.webp",
  "dbz-garlic-jr": "/sagas/garlic-jr.jpg",
  "dbz-androides-trunks": "/sagas/z/trunks-saga.jpg",
  "dbz-cell-imperfecto-perfeccion": "/sagas/z/imperfect-cell-saga.jpg",
  "dbz-juegos-de-cell": "/sagas/z/cell-games-saga.jpg",
  "dbz-torneo-otro-mundo": "/sagas/z/other-world-saga.webp",
  "dbz-buu-majin-vegeta": "/sagas/z/majin-buu-saga.jpg",
  "dbz-buu-ssj3-fusion": "/sagas/z/fusion-saga.jpg",
  "dbz-buu-gotenks-gohan-mistico": "/sagas/majin-buu.jpg",
  "dbz-buu-vegetto-kidbuu-final": "/sagas/z/kid-buu-saga.jpg",
  "dbs-batalla-dioses": "/sagas/super/ssg-batalla.webp",
  "dbs-resurreccion-f": "/sagas/super/freezer-dorado.webp",
  "dbs-torneo-u6": "/sagas/super/torneo-u6.webp",
  "dbs-goku-black": "/sagas/super/goku-black-aparicion.webp",
  "dbs-reclutamiento-u7": "/sagas/super/reclutamiento-u7.webp",
  "dbs-torneo-del-poder": "/sagas/super/ultra-instinto-completo-victoria.webp",
  "db-daima-conspiracion": "/sagas/daima.jpg",
  "db-daima-climax": "/sagas/daima.jpg",
  "dbgt-black-star": "/sagas/gt/viaje-galaxia.webp",
  "dbgt-baby-ssj4": "/sagas/gt/ssj4-baby.webp",
  "dbgt-super-17": "/sagas/gt/super-17-batalla.webp",
  "dbgt-dragones-malignos": "/sagas/gt/omega-shenron.webp",
};

export function getThreatBadge(threat: ThreatLevel) {
  return THREAT_LEVEL_BADGES[threat] ?? { label: threat, color: "bg-white/5 text-zinc-400 border-white/10" };
}