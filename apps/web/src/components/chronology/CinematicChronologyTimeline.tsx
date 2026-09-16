"use client";

import React, { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { cn } from "@/components/ui/core/styling";
import { IconBadgesSparkles, IconStatusImageOff, IconNavigationSearch, IconTimeClock, IconMediaPlay, IconBadgesChevronRight, IconStatusSkull, IconMediaClapperboard, IconNavigationChevronLeft, IconNavigationChevronRight } from "@/components/ui/icons";
import { WatchProgressBar } from "@/components/ui/watch-progress-bar";
import { DeferredImage } from "@/components/shared/deferred-image";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionBar } from "@/components/ui/sectionbar/sectionbar";
import type { StorySpan } from "@/lib/config/dragonball_story_spans";
import {
  getMoviesForSpan,
  getGokuAgeForSpan,
} from "@/lib/config/dragonball_chronology_enrichment";
import type { StageCollectionEntry } from "@/lib/config/dragonball_stages";
import {
  SERIES_LABEL,
  ERA_ORDER,
  ERA_BACKDROP,
  getSeriesAccent,
} from "@/lib/chronology/design";

export function getSpanDefaultArt(spanId: string, seriesId: string): string {
  const path = `/sagas/${seriesId}/${spanId}.webp`;
  return path || ERA_BACKDROP[seriesId] || "/backdrops/dbz.jpg";
}

export interface SpanStill {
  src: string;
  isEpisode: boolean;
  downloaded: boolean;
  episodeLabel?: string;
}

export interface SpanProgress {
  watched: number;
  total: number;
  percent: number;
  isComplete: boolean;
  isStarted: boolean;
}

export function getSpanProgress(
  entry: StageCollectionEntry | undefined,
  span: StorySpan
): SpanProgress {
  const total = Math.max(1, span.endEpisode - span.startEpisode + 1);
  const linear =
    entry?.listData?.progress ??
    Math.max(0, (entry?.libraryData?.mainFileCount ?? 0) - (entry?.libraryData?.unwatchedCount ?? 0));
  const watched = Math.min(total, Math.max(0, (linear || 0) - span.startEpisode + 1));
  const percent = Math.round((watched / total) * 100);
  return { watched, total, percent, isComplete: watched >= total, isStarted: watched > 0 };
}

const EP_MINUTES = 24;

function formatHours(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h <= 0) return `~${m} min`;
  if (m === 0) return `~${h} h`;
  return `~${h} h ${m} min`;
}

function SpringTransition(reduceMotion: boolean | null | undefined) {
  const prefersRedced = reduceMotion ?? false;
  return prefersRedced ? { duration: 0.2, ease: "easeOut" as const } : { type: "spring" as const, stiffness: 280, damping: 28 };
}

function CanonLine({ span }: { span: StorySpan }) {
  if (span.seriesId === "gt") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-zinc-800/50 text-zinc-400 border border-zinc-600/50">
        <span aria-hidden className="text-sm leading-none">◇</span> Línea alternativa
      </span>
    );
  }
  if (span.hasFiller) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
        <span aria-hidden className="text-[10px] leading-none">◆</span> Relleno · {span.fillerEpisodes.length} EP
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-brand-success/20 text-brand-success border border-brand-success/30">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-success" /> Canon
    </span>
  );
}

function ThreatBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    "Bajo / Cómico": "bg-green-500/20 text-green-400 border-green-500/30",
    "Competitivo / Deportivo": "bg-blue-500/20 text-blue-400 border-blue-500/30",
    "Aventura Épica / Bélica / Pulp": "bg-orange-500/20 text-orange-400 border-orange-500/30",
    "Místico / Desafío Mágico": "bg-purple-500/20 text-purple-400 border-purple-500/30",
    "Deportivo / Ideológico": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    "Terror / Tragedia / Venganza": "bg-red-500/20 text-red-400 border-red-500/30",
    "Artes Marciales Divinas / Clímax Épico": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    "Ciencia Ficción / Giro Cósmico / Entrenamiento Divino": "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    "Tragedia Bélica / Clímax Agónico": "bg-red-600/20 text-red-400 border-red-600/30",
    "Thriller Espacial / Guerra a Tres Bandas": "bg-violet-500/20 text-violet-400 border-violet-500/30",
    "Acción Frenética / Revelación de Poder": "bg-amber-500/20 text-amber-400 border-amber-500/30",
    "Clímax Histórico del Anime / Ira Trascendental": "bg-yellow-400/20 text-yellow-300 border-yellow-400/30",
    "Mágico / Demoníaco": "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30",
    "Viajes en el Tiempo / Tensión Tecnológica / Desesperación": "bg-purple-600/20 text-purple-400 border-purple-600/30",
    "Fantasía Oscura / Relleno Toei": "bg-slate-500/20 text-slate-400 border-slate-500/30",
  };
  const color = colors[level] ?? "bg-white/5 text-zinc-400 border-white/10";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${color}`}>
      {level}
    </span>
  );
}

function DragonBallsStatus({ status }: { status: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-white/5 border border-white/10">
      <IconBadgesSparkles className="w-3 h-3 text-amber-400" />
      {status}
    </div>
  );
}

function GokuAge({ age }: { age: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-brand-accent/20 text-brand-accent border border-brand-accent/30">
      <IconBadgesSparkles className="w-3 h-3" />
      Goku: {age}
    </div>
  );
}

function SpanThumb({ src, fallbackSrc, alt, priority }: { src: string; fallbackSrc: string; alt: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  const finalSrc = failed ? fallbackSrc : src;
  return (
    <DeferredImage
      src={finalSrc}
      alt={alt}
      priority={priority}
      onError={() => { if (!failed) setFailed(true); }}
      className="absolute inset-0"
      imgClassName="object-cover"
      fallback={
        <div className="flex flex-col items-center justify-center gap-2 text-on-surface-variant">
          <IconStatusImageOff className="h-7 w-7 opacity-60" />
          <span className="px-2 text-center text-[11px] font-bold uppercase tracking-wider line-clamp-2">{alt}</span>
        </div>
      }
    />
  );
}

interface CinematicChronologyTimelineProps {
  spans: StorySpan[];
  tmdbMap: Map<number, StageCollectionEntry>;
  onClose: () => void;
  searchQuery?: string;
  activeId?: string | null;
  stills?: Map<string, SpanStill>;
  className?: string;
}

export function CinematicChronologyTimeline({
  spans,
  tmdbMap,
  onClose,
  searchQuery = "",
  activeId,
  stills,
  className,
}: CinematicChronologyTimelineProps) {
  const [eraSel, setEraSel] = useState<string>("all");
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const reduceMotion = useReducedMotion();

  const items = useMemo(() => {
    return spans.map((span) => {
      const entry = tmdbMap.get(span.tmdbId);
      const backdrop = ERA_BACKDROP[span.seriesId] ?? "/backdrops/dbz.jpg";
      const still = stills?.get(span.id);
      const art: SpanStill = still ?? {
        src: getSpanDefaultArt(span.id, span.seriesId),
        isEpisode: false,
        downloaded: !!entry?.mediaId,
      };
      return {
        span,
        entry,
        progress: getSpanProgress(entry, span),
        art,
        backdrop,
        globalIdx: span.order,
        accent: getSeriesAccent(span.seriesId),
      };
    });
  }, [spans, tmdbMap, stills]);

  const currentIdx = useMemo(() => {
    if (activeId) {
      const found = items.findIndex((i) => i.span.id === activeId);
      if (found >= 0) return found;
    }
    return items.findIndex((i) => i.progress.isStarted && !i.progress.isComplete) ?? 0;
  }, [activeId, items]);

  const visibleItems = useMemo(() => (eraSel === "all" ? items : items.filter((i) => i.span.seriesId === eraSel)), [items, eraSel]);
  const presentEras = useMemo(() => {
    const ids = new Set(visibleItems.map((i) => i.span.seriesId));
    return ERA_ORDER.filter((id) => ids.has(id)).map((id) => ({ id, label: SERIES_LABEL[id] ?? id }));
  }, [visibleItems]);

  const selectedItem = visibleItems[selectedIdx] ?? visibleItems[0];
  const selectedMovies = useMemo(() => (selectedItem ? getMoviesForSpan(selectedItem.span) : []), [selectedItem]);
  const selectedMediaId = selectedItem ? tmdbMap.get(selectedItem.span.tmdbId)?.mediaId : undefined;

  if (items.length === 0) {
    return (
      <SectionBar variant="minimal" label="Resultados" className="min-h-[40dvh] flex items-center justify-center px-6">
        <EmptyState title="Sin resultados" message={`Nada para “${searchQuery}”. Prueba con “Freezer”, “Torneo” o “Año 762”.`} icon={<IconNavigationSearch className="h-10 w-10 text-brand-accent" />} />
      </SectionBar>
    );
  }

  const goPrev = () => setSelectedIdx((i) => Math.max(0, i - 1));
  const goNext = () => setSelectedIdx((i) => Math.min(visibleItems.length - 1, i + 1));

  return (
    <div className={cn("page-container space-y-6 pt-6 pb-16", className)}>
      <SectionBar
        label="Cronología"
        icon={IconTimeClock}
        variant="minimal"
        badge={<span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tabular-nums bg-[var(--glass-bg)] text-on-surface-variant border border-[var(--glass-border-side)]">{items.length} arcos</span>}
      >
        <div className="sectionbar-minimal flex items-center gap-1 overflow-x-auto no-scrollbar rounded-full border border-white/20 border-t-white/40 border-b-white/10 bg-zinc-950/40 p-1.5" role="tablist" aria-label="Filtrar por era">
          {[{ id: "all", label: "Todas" }, ...presentEras].map((era) => {
            const isSelected = eraSel === era.id;
            return (
              <button key={era.id} type="button" role="tab" aria-selected={isSelected} onClick={() => { setEraSel(era.id); setSelectedIdx(0); }} className={cn("relative min-h-[44px] shrink-0 cursor-pointer whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition-colors", isSelected ? "text-zinc-950" : "text-zinc-300 hover:bg-white/[0.06] hover:text-white")}>
                {isSelected && <motion.span layoutId="chrono-era-pill" transition={SpringTransition(reduceMotion)} className="absolute inset-0 rounded-full bg-white/95 shadow-[0_2px_14px_rgba(255,255,255,0.4),inset_0_1px_1px_rgba(255,255,255,1)]" aria-hidden />}
                <span className="relative z-10">{era.label}</span>
              </button>
            );
          })}
        </div>
      </SectionBar>

      <div className="space-y-6">
        <div className="sectionbar-strong overflow-hidden relative">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 scale-110 opacity-25 blur-2xl">
              <SpanThumb src={selectedItem.art.src} fallbackSrc={selectedItem.backdrop} alt="" />
            </div>
            <div className="absolute -top-[20%] left-[10%] h-[70%] w-[50%] rounded-full" style={{ background: `radial-gradient(ellipse, color-mix(in srgb, ${selectedItem.accent} 35%, transparent) 0%, transparent 70%)` }} />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-zinc-950/20" />
          </div>

          <div className="relative grid gap-0 md:grid-cols-[1.15fr_1fr]">
            <div className="relative aspect-video overflow-hidden md:aspect-auto md:min-h-[340px]">
              <SpanThumb src={selectedItem.art.src} fallbackSrc={selectedItem.backdrop} alt={selectedItem.span.title} priority />
              <div className="scrim-hero-bottom pointer-events-none absolute inset-0" />
              {selectedMediaId ? (
                <Link to="/series/$seriesId" params={{ seriesId: String(selectedMediaId) }} search={{ tab: "episodes", saga: selectedItem.span.sagaId, autoplay: String(selectedItem.span.recommendedStartEpisode) }} onClick={onClose} aria-label={`Ver ${selectedItem.span.title}`} className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-accent text-on-primary shadow-brand-primary transition-transform hover:scale-105 active:scale-95">
                  <IconMediaPlay className="ml-0.5 h-6 w-6 fill-current" />
                </Link>
              ) : null}
              <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
                <span className="badge badge-muted backdrop-blur-overlay-md tabular-nums">EP {selectedItem.span.startEpisode}–{selectedItem.span.endEpisode}</span>
                {selectedItem.span.id === items[currentIdx]?.span.id && <span className="badge backdrop-blur-overlay-md" style={{ backgroundColor: `color-mix(in srgb, ${selectedItem.accent} 15%, transparent)`, borderColor: `color-mix(in srgb, ${selectedItem.accent} 45%, transparent)`, color: selectedItem.accent }}>Arco actual</span>}
              </div>
            </div>

            <div className="flex min-w-0 flex-col justify-center space-y-3 p-5 sm:p-7">
              <div>
                <p className="font-mono text-[11px] font-black uppercase tracking-[0.25em] text-on-surface-variant">{selectedItem.span.sagaName} · {selectedItem.span.inUniverseYears}</p>
                <h2 className="text-edge-glow mt-1.5 font-display text-2xl font-black uppercase leading-tight tracking-wide text-white text-balance sm:text-3xl">{selectedItem.span.title}</h2>
              </div>
              <p className="font-mono text-[11px] uppercase tabular-nums tracking-widest text-on-surface-variant">{selectedItem.progress.total} episodios · {formatHours(selectedItem.progress.total * EP_MINUTES)}</p>
              <CanonLine span={selectedItem.span} />
              <div className="flex items-center gap-2.5">
                <WatchProgressBar percent={selectedItem.progress.percent} variant="compact" color={selectedItem.accent} className="flex-1" />
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-on-surface-variant">{selectedItem.progress.watched}/{selectedItem.progress.total} · {selectedItem.progress.percent}%</span>
              </div>
              {selectedMediaId ? (
                <Link to="/series/$seriesId" params={{ seriesId: String(selectedMediaId) }} search={{ tab: "episodes", saga: selectedItem.span.sagaId, autoplay: String(selectedItem.span.recommendedStartEpisode) }} onClick={onClose} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-accent text-on-primary text-xs font-black uppercase tracking-wider cursor-pointer transition-transform hover:scale-105 active:scale-95">
                  <IconMediaPlay className="h-3.5 w-3.5 fill-current" />
                  <span>{selectedItem.progress.isComplete ? "Rever" : selectedItem.progress.isStarted ? `Continuar EP ${selectedItem.span.startEpisode + selectedItem.progress.watched}` : `Comenzar EP ${selectedItem.span.recommendedStartEpisode}`}</span>
                </Link>
              ) : (
                <span className="badge badge-muted min-h-[44px] !py-2"><IconMediaPlay className="h-3 w-3" /> No en biblioteca</span>
              )}
            </div>
          </div>

          <div className="relative border-t border-white/10 p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              {selectedItem.span.quickCatchUpKeys.slice(0, 3).map((key, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium bg-white/[0.04] border border-white/10 text-on-surface-variant">
                  <IconBadgesChevronRight className="w-3 h-3 text-brand-accent/80" />
                  {key}
                </span>
              ))}
            </div>

            <div className="prose prose-invert max-w-none text-sm leading-relaxed text-on-surface-variant">
              <p>{selectedItem.span.previouslyOn}</p>
              <p className="font-medium text-on-surface-variant/90">{selectedItem.span.detailedPlot}</p>
            </div>

            <div className="sectionbar-minimal rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <ThreatBadge level={selectedItem.span.dominantVibe} />
                <GokuAge age={getGokuAgeForSpan(selectedItem.span.id).physical} />
                <DragonBallsStatus status={selectedItem.span.worldStateAtStart?.dragonBallsStatus ?? "Desconocido"} />
              </div>
              {selectedItem.span.worldStateAtStart?.activeVillains?.[0] && (
                <div className="flex flex-wrap gap-2">
                  {selectedItem.span.worldStateAtStart.activeVillains.slice(0, 4).map((v, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30">
                      <IconStatusSkull className="h-3 w-3" />
                      {v}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {selectedItem.span.milestones.length > 0 && (
              <div className="sectionbar-minimal rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Hitos clave</p>
                <ul className="space-y-1.5 text-[11px] text-zinc-400">
                  {selectedItem.span.milestones.slice(0, 3).map((ms, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-6 text-right font-mono text-brand-accent/60 shrink-0">Ep {ms.episode}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-zinc-200 truncate">{ms.title}</p>
                        <p className="text-zinc-500 truncate">{ms.description}</p>
                      </div>
                    </li>
                  ))}
                  {selectedItem.span.milestones.length > 3 && <li className="text-center text-zinc-500 py-1">+{selectedItem.span.milestones.length - 3} más...</li>}
                </ul>
              </div>
            )}
          </div>
        </div>

        {selectedMovies.length > 0 && (
          <SectionBar label="Películas de este arco" icon={IconMediaClapperboard} variant="minimal" badge={<span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--glass-bg)] text-on-surface-variant border border-[var(--glass-border-side)]">{selectedMovies.length}</span>}>
            <div className="space-y-2">
              {selectedMovies.map((m) => {
                const movieMediaId = m.tmdbId ? tmdbMap.get(m.tmdbId)?.mediaId : undefined;
                return (
                  <div key={m.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `color-mix(in srgb, ${selectedItem.accent} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${selectedItem.accent} 30%, transparent)`, color: selectedItem.accent }}>
                      <IconMediaClapperboard className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-on-surface">{m.title}</p>
                      <p className="truncate text-[11px] text-on-surface-variant">{movieMediaId ? "Disponible en KameHouse" : "No disponible"} · {m.canonStatus}</p>
                    </div>
                    {movieMediaId ? (
                      <Link to="/series/$seriesId" params={{ seriesId: String(movieMediaId) }} onClick={onClose} aria-label={`Ver ${m.title}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-on-surface transition-colors hover:bg-white/[0.12] active:scale-95">
                        <IconMediaPlay className="ml-0.5 h-4 w-4 fill-current" />
                      </Link>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </SectionBar>
        )}

        <div className="flex items-center justify-between gap-4">
          <button type="button" onClick={goPrev} disabled={selectedIdx === 0} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/10 text-zinc-300 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <IconNavigationChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Anterior</span>
          </button>
          <div className="flex-1 text-center text-xs font-mono text-zinc-500">
            {selectedIdx + 1} / {visibleItems.length} · {visibleItems[selectedIdx]?.span.sagaName ?? ""}
          </div>
          <button type="button" onClick={goNext} disabled={selectedIdx >= visibleItems.length - 1} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/10 text-zinc-300 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <span className="hidden sm:inline">Siguiente</span>
            <IconNavigationChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}