"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { cn } from "@/components/ui/core/styling";
import {
  IconBadgesSparkles,
  IconBadgesChevronRight,
  IconStatusImageOff,
  IconStatusSkull,
  IconStatusSparkles,
  IconStatusZap,
  IconStatusGem,
  IconStatusRadar,
  IconNavigationSearch,
  IconTimeClock,
  IconTimeCalendar,
  IconMediaPlay,
  IconMediaClapperboard,
  IconNavigationChevronLeft,
  IconNavigationChevronRight,
  IconUiCheckCircle,
} from "@/components/ui/icons";
import { WatchProgressBar } from "@/components/ui/watch-progress-bar";
import { DeferredImage } from "@/components/shared/deferred-image";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionBar } from "@/components/ui/sectionbar/sectionbar";
import type { StorySpan } from "@/lib/config/dragonball_story_spans";
import {
  getMoviesForSpan,
  getGokuAgeForSpan,
  getUniverseLoreForSpan,
} from "@/lib/config/dragonball_chronology_enrichment";
import type { StageCollectionEntry } from "@/lib/config/dragonball_stages";
import {
  SERIES_LABEL,
  ERA_ORDER,
  ERA_BACKDROP,
  SPAN_ART,
  getSeriesAccent,
  getThreatBadge,
} from "@/lib/chronology/design";
import type { ThreatLevel } from "@/lib/chronology/types";

export function getSpanDefaultArt(spanId: string, seriesId: string): string {
  return SPAN_ART[spanId] ?? ERA_BACKDROP[seriesId] ?? "/backdrops/dbz.webp";
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

interface TimelineItem {
  span: StorySpan;
  entry: StageCollectionEntry | undefined;
  progress: SpanProgress;
  art: SpanStill;
  backdrop: string;
  globalIdx: number;
  accent: string;
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
  const prefersReduced = reduceMotion ?? false;
  return prefersReduced ? { duration: 0.2, ease: "easeOut" as const } : { type: "spring" as const, stiffness: 280, damping: 28 };
}

function shortSagaName(sagaName: string) {
  return sagaName.replace("Saga del ", "").replace("Saga de ", "").replace("Saga ", "");
}

function CanonBadge({ span }: { span: StorySpan }) {
  if (span.seriesId === "gt") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-600/50 bg-zinc-800/50 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400">
        <span aria-hidden className="text-sm leading-none">◇</span> Línea alternativa
      </span>
    );
  }
  if (span.hasFiller) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-400">
        <span aria-hidden className="text-[10px] leading-none">◆</span> Relleno · {span.fillerEpisodes.length} EP
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-success/30 bg-brand-success/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-brand-success">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-success" /> Canon
    </span>
  );
}

function HeroArt({ src, fallbackSrc, alt, priority }: { src: string; fallbackSrc: string; alt: string; priority?: boolean }) {
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
          <span className="line-clamp-2 px-2 text-center text-[11px] font-bold uppercase tracking-wider">{alt}</span>
        </div>
      }
    />
  );
}

function LoreChips({ items, accent }: { items: string[]; accent: string }) {
  if (items.length === 0) return <p className="text-[11px] text-zinc-500">Sin registros de este arco.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t, i) => (
        <span
          key={`${t}-${i}`}
          className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-medium leading-snug text-zinc-200"
        >
          <span className="mr-1.5 h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: accent }} aria-hidden />
          {t}
        </span>
      ))}
    </div>
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const spineRef = useRef<HTMLDivElement>(null);

  const items = useMemo<TimelineItem[]>(() => {
    return spans.map((span) => {
      const entry = tmdbMap.get(span.tmdbId);
      const backdrop = ERA_BACKDROP[span.seriesId] ?? "/backdrops/dbz.webp";
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

  const currentId = useMemo(() => {
    if (activeId && items.some((i) => i.span.id === activeId)) return activeId;
    return (
      items.find((i) => i.progress.isStarted && !i.progress.isComplete)?.span.id ??
      items.find((i) => !i.progress.isComplete)?.span.id ??
      items[0]?.span.id ??
      null
    );
  }, [activeId, items]);

  const eras = useMemo(() => {
    const ids = new Set(items.map((i) => i.span.seriesId));
    return ERA_ORDER.filter((id) => ids.has(id)).map((id) => ({ id, label: SERIES_LABEL[id] ?? id }));
  }, [items]);

  const visibleItems = useMemo(
    () => (eraSel === "all" ? items : items.filter((i) => i.span.seriesId === eraSel)),
    [items, eraSel]
  );

  const selected: TimelineItem | undefined =
    (selectedId ? visibleItems.find((i) => i.span.id === selectedId) : undefined) ??
    (currentId ? visibleItems.find((i) => i.span.id === currentId) : undefined) ??
    visibleItems[0];

  const selectedIdx = selected ? visibleItems.indexOf(selected) : -1;
  const selectedMovies = useMemo(() => (selected ? getMoviesForSpan(selected.span) : []), [selected]);
  const selectedMediaId = selected ? tmdbMap.get(selected.span.tmdbId)?.mediaId : undefined;

  const goTo = useCallback(
    (delta: number) => {
      if (visibleItems.length === 0) return;
      const next = Math.max(0, Math.min(visibleItems.length - 1, selectedIdx + delta));
      setSelectedId(visibleItems[next].span.id);
    },
    [visibleItems, selectedIdx]
  );

  // La columna vertebral sigue al capítulo seleccionado
  const selectedSpanId = selected?.span.id;
  useEffect(() => {
    const c = spineRef.current;
    if (!c || !selectedSpanId) return;
    const el = c.querySelector<HTMLElement>(`[data-node-id="${selectedSpanId}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
  }, [selectedSpanId, reduceMotion]);

  // Flechas navegan capítulos (sin robar el foco de inputs)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        goTo(1);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo]);

  if (items.length === 0) {
    return (
      <SectionBar variant="minimal" label="Resultados" className="flex min-h-[40dvh] items-center justify-center px-6">
        <EmptyState title="Sin resultados" message={`Nada para “${searchQuery}”. Prueba con “Freezer”, “Torneo” o “Año 762”.`} icon={<IconNavigationSearch className="h-10 w-10 text-brand-accent" />} />
      </SectionBar>
    );
  }

  if (!selected) return null;

  const threat = getThreatBadge((selected.span.worldStateAtStart?.threatLevel ?? selected.span.dominantVibe) as ThreatLevel);
  const gokuAge = getGokuAgeForSpan(selected.span.id);
  const lore = getUniverseLoreForSpan(selected.span.id);
  const villains = selected.span.worldStateAtStart?.activeVillains ?? [];
  const balls = selected.span.worldStateAtStart?.dragonBallsStatus ?? "—";
  const charStatus = selected.span.worldStateAtStart?.characterStatus;
  const targetEp =
    selected.progress.isStarted && !selected.progress.isComplete
      ? selected.span.startEpisode + selected.progress.watched
      : selected.span.recommendedStartEpisode;
  const ctaLabel = selected.progress.isComplete
    ? "Rever saga"
    : selected.progress.isStarted
      ? `Continuar EP ${targetEp}`
      : `Comenzar EP ${targetEp}`;

  const groups = (eraSel === "all" ? eras.map((e) => e.id) : [eraSel])
    .map((seriesId) => {
      const eraItems = visibleItems.filter((i) => i.span.seriesId === seriesId);
      if (eraItems.length === 0) return null;
      const watchedEps = eraItems.reduce((a, i) => a + i.progress.watched, 0);
      const totalEps = eraItems.reduce((a, i) => a + i.progress.total, 0);
      return {
        seriesId,
        label: SERIES_LABEL[seriesId] ?? seriesId,
        accent: getSeriesAccent(seriesId),
        eraItems,
        watchedEps,
        totalEps,
        percent: totalEps > 0 ? Math.round((watchedEps / totalEps) * 100) : 0,
      };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);

  return (
    <div className={cn("page-container space-y-6 pb-16 pt-6", className)}>
      <SectionBar
        label="Eras"
        icon={IconTimeClock}
        variant="minimal"
        badge={<span className="rounded-full border border-[var(--glass-border-side)] bg-[var(--glass-bg)] px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-on-surface-variant">{items.length} arcos</span>}
      >
        <div className="sectionbar-minimal no-scrollbar flex items-center gap-1 overflow-x-auto rounded-full border border-white/20 border-b-white/10 border-t-white/40 bg-zinc-950/40 p-1.5" role="tablist" aria-label="Filtrar por era">
          {[{ id: "all", label: "Todas" }, ...eras].map((era) => {
            const isSelected = eraSel === era.id;
            return (
              <button key={era.id} type="button" role="tab" aria-selected={isSelected} onClick={() => { setEraSel(era.id); setSelectedId(null); }} className={cn("relative min-h-[44px] shrink-0 cursor-pointer whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition-colors", isSelected ? "text-zinc-950" : "text-zinc-300 hover:bg-white/[0.06] hover:text-white")}>
                {isSelected && <motion.span layoutId="chrono-era-pill" transition={SpringTransition(reduceMotion)} className="absolute inset-0 rounded-full bg-white/95 shadow-[0_2px_14px_rgba(255,255,255,0.4),inset_0_1px_1px_rgba(255,255,255,1)]" aria-hidden />}
                <span className="relative z-10">{era.label}</span>
              </button>
            );
          })}
        </div>
      </SectionBar>

      <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Columna vertebral: la línea temporal */}
        <nav aria-label="Línea temporal por arco" className="sectionbar-strong p-3 lg:sticky lg:top-4">
          <div ref={spineRef} className="no-scrollbar max-h-[42dvh] space-y-4 overflow-y-auto p-1 lg:max-h-[calc(100dvh-240px)]">
            {groups.map((g) => (
              <div key={g.seriesId}>
                <div className="mb-1.5 flex items-center gap-2 px-2">
                  <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: g.accent }} />
                  <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-on-surface">{g.label}</p>
                  <span className="ml-auto font-mono text-[10px] tabular-nums text-on-surface-variant">{g.watchedEps}/{g.totalEps}</span>
                </div>
                <ol className="relative space-y-1 border-l border-white/10 pl-3">
                  {g.eraItems.map((it) => {
                    const isSel = selected.span.id === it.span.id;
                    const isCurrent = currentId === it.span.id;
                    return (
                      <li key={it.span.id}>
                        <button
                          type="button"
                          data-node-id={it.span.id}
                          onClick={() => setSelectedId(it.span.id)}
                          aria-current={isSel ? "true" : undefined}
                          aria-label={`Capítulo ${it.globalIdx}: ${it.span.sagaName} · ${it.span.inUniverseYears}`}
                          className={cn(
                            "relative flex min-h-[44px] w-full cursor-pointer items-center gap-2.5 rounded-2xl border px-3 py-2 text-left transition-all active:scale-[0.98]",
                            isSel ? "border-white/50 bg-white/[0.07]" : "border-transparent hover:border-white/15 hover:bg-white/[0.04]"
                          )}
                          style={isSel ? { boxShadow: `0 0 20px color-mix(in srgb, ${it.accent} 25%, transparent)` } : undefined}
                        >
                          <span aria-hidden className="absolute -left-[19px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-white/25" style={{ backgroundColor: isSel ? it.accent : it.progress.isComplete ? "hsl(var(--brand-success))" : "rgba(255,255,255,0.18)" }} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 font-mono text-[10px] font-black uppercase tabular-nums tracking-wider text-zinc-500">
                              Cap {String(it.globalIdx).padStart(2, "0")} · {it.span.inUniverseYears.replace("Año ", "")}
                              {isCurrent && !isSel && <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: it.accent }} />}
                            </span>
                            <span className={cn("mt-0.5 block truncate text-[13px] font-semibold leading-tight", isSel ? "text-white" : "text-zinc-300")}>
                              {shortSagaName(it.span.sagaName)}
                            </span>
                          </span>
                          {it.progress.isComplete ? (
                            <IconUiCheckCircle className="h-4 w-4 shrink-0 text-brand-success" />
                          ) : (
                            <span className="shrink-0 font-mono text-[10px] tabular-nums text-zinc-500">{it.progress.percent}%</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        </nav>

        {/* Canvas del relato */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.article
            key={selected.span.id}
            initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -14, filter: "blur(8px)" }}
            transition={SpringTransition(reduceMotion)}
            aria-label={`Capítulo ${selected.globalIdx}: ${selected.span.title}`}
            className="sectionbar-strong relative overflow-hidden"
            style={{ boxShadow: `0 0 32px color-mix(in srgb, ${selected.accent} 14%, transparent)` }}
          >
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute inset-0 scale-110 opacity-25 blur-2xl">
                <HeroArt src={selected.art.src} fallbackSrc={selected.backdrop} alt="" />
              </div>
              <div className="absolute -top-[20%] left-[10%] h-[70%] w-[50%] rounded-full" style={{ background: `radial-gradient(ellipse, color-mix(in srgb, ${selected.accent} 35%, transparent) 0%, transparent 70%)` }} />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-zinc-950/20" />
            </div>

            {/* Hero cinematográfico con arte real */}
            <div className="relative aspect-[16/9] overflow-hidden lg:aspect-[21/9] lg:max-h-[440px] lg:min-h-[320px]">
              <HeroArt src={selected.art.src} fallbackSrc={selected.backdrop} alt={selected.span.title} priority />
              <div className="scrim-hero-bottom pointer-events-none absolute inset-0" />
              <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5 sm:left-4 sm:top-4">
                <span className="badge font-mono font-black uppercase tracking-[0.2em]" style={{ backgroundColor: `color-mix(in srgb, ${selected.accent} 22%, rgba(0,0,0,0.6))`, borderColor: `color-mix(in srgb, ${selected.accent} 50%, transparent)`, color: "#fff" }}>
                  Cap {String(selected.globalIdx).padStart(2, "0")} · {SERIES_LABEL[selected.span.seriesId]}
                </span>
                <CanonBadge span={selected.span} />
              </div>
              <div className="absolute right-3 top-3 sm:right-4 sm:top-4">
                <span className="badge badge-subtle tabular-nums backdrop-blur-overlay-md">
                  <IconTimeCalendar className="h-3 w-3" /> {selected.span.inUniverseYears}
                </span>
              </div>
              {selectedMediaId ? (
                <Link
                  to="/series/$seriesId"
                  params={{ seriesId: String(selectedMediaId) }}
                  search={{ tab: "episodes", saga: selected.span.sagaId, autoplay: String(targetEp) } as never}
                  preload="intent"
                  onClick={onClose}
                  aria-label={`${ctaLabel}: ${selected.span.title}`}
                  className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-accent text-on-primary shadow-brand-primary transition-transform hover:scale-105 active:scale-95"
                >
                  <IconMediaPlay className="ml-0.5 h-6 w-6 fill-current" />
                </Link>
              ) : null}
              <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2 sm:inset-x-4 sm:bottom-4">
                <span className="badge badge-muted tabular-nums backdrop-blur-overlay-md">
                  EP {selected.span.startEpisode}–{selected.span.endEpisode} · {selected.progress.total} EP · {formatHours(selected.progress.total * EP_MINUTES)}
                </span>
                {currentId === selected.span.id && (
                  <span className="badge backdrop-blur-overlay-md" style={{ backgroundColor: `color-mix(in srgb, ${selected.accent} 15%, transparent)`, borderColor: `color-mix(in srgb, ${selected.accent} 45%, transparent)`, color: selected.accent }}>
                    Tu arco actual
                  </span>
                )}
              </div>
            </div>

            <div className="relative space-y-5 p-5 sm:p-7">
              {/* Cabecera narrativa */}
              <div className="space-y-2.5">
                <p className="font-mono text-[11px] font-black uppercase tracking-[0.25em] text-on-surface-variant">
                  {selected.span.sagaName} · {selected.span.inUniverseYears}
                </p>
                <h2 className="text-edge-glow font-display text-2xl font-black uppercase leading-tight tracking-wide text-white text-balance sm:text-3xl">
                  {selected.span.title}
                </h2>
                <p className="text-xs italic text-on-surface-variant">{selected.span.dominantVibe} · Goku: {gokuAge.physical}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${threat.color}`}>
                    {threat.label}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <WatchProgressBar percent={selected.progress.percent} variant="compact" color={selected.accent} className="flex-1" />
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-on-surface-variant">{selected.progress.watched}/{selected.progress.total} · {selected.progress.percent}%</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {selectedMediaId ? (
                    <Link
                      to="/series/$seriesId"
                      params={{ seriesId: String(selectedMediaId) }}
                      search={{ tab: "episodes", saga: selected.span.sagaId, autoplay: String(targetEp) } as never}
                      preload="intent"
                      onClick={onClose}
                      className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full bg-brand-accent px-6 py-3 text-xs font-black uppercase tracking-wider text-on-primary transition-transform hover:scale-[1.02] active:scale-95"
                    >
                      <IconMediaPlay className="h-4 w-4 fill-current" />
                      {ctaLabel}
                    </Link>
                  ) : (
                    <span className="badge badge-muted min-h-[44px] !py-2"><IconMediaPlay className="h-3 w-3" /> No en biblioteca</span>
                  )}
                  {selected.art.isEpisode && selected.art.episodeLabel && (
                    <span className="badge badge-subtle tabular-nums">{selected.art.episodeLabel}</span>
                  )}
                </div>
              </div>

              {/* Voz del narrador */}
              <div className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="flex items-center gap-1.5 font-mono text-[10px] font-black uppercase tracking-[0.25em] text-brand-accent">
                  <IconStatusSparkles className="h-3 w-3" /> La voz del narrador
                </p>
                <p className="border-l-2 pl-3 text-[13px] italic leading-relaxed text-zinc-400" style={{ borderColor: selected.accent }}>
                  Anteriormente… {selected.span.previouslyOn}
                </p>
                <p className="text-sm leading-relaxed text-zinc-200">{selected.span.detailedPlot}</p>
              </div>

              {/* Catch-up */}
              <div className="space-y-2">
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.25em] text-on-surface-variant">Entiéndelo en 10 segundos</p>
                <ul className="space-y-1.5">
                  {selected.span.quickCatchUpKeys.slice(0, 3).map((k, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[13px] font-medium leading-snug text-zinc-200">
                      <IconBadgesChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-accent" />
                      {k}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Scouter del mundo */}
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 font-mono text-[10px] font-black uppercase tracking-[0.25em] text-on-surface-variant">
                  <IconStatusRadar className="h-3 w-3 text-brand-accent" /> Scouter del mundo
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Goku · {gokuAge.physical}</p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-200">{gokuAge.notes ?? charStatus?.goku ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Esferas del dragón</p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-200">{balls}</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 sm:col-span-2">
                    <p className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                      <IconStatusSkull className="h-3 w-3 text-red-400" /> Villanos activos
                    </p>
                    <p className="mt-1 text-xs font-bold leading-relaxed text-red-300">{villains.length > 0 ? villains.join(" · ") : "—"}</p>
                  </div>
                </div>
                {charStatus && (
                  <div className="space-y-1.5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                    {[
                      ["Goku", charStatus.goku],
                      ["Vegeta", charStatus.vegeta],
                      ["Gohan", charStatus.gohan],
                      ["Piccolo", charStatus.piccolo],
                      ["Aliados", charStatus.allies],
                    ]
                      .filter(([, v]) => !!v)
                      .map(([k, v]) => (
                        <p key={k} className="text-[12px] leading-relaxed text-zinc-300">
                          <span className="mr-1.5 font-mono text-[10px] font-black uppercase tracking-wider text-zinc-500">{k}</span>
                          {v}
                        </p>
                      ))}
                  </div>
                )}
              </div>

              {/* Crónica del universo */}
              <div className="space-y-2">
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.25em] text-on-surface-variant">Crónica del universo</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                    <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      <IconBadgesSparkles className="h-3 w-3 text-emerald-300" /> Debuts ({lore.debuts.length})
                    </p>
                    <LoreChips items={lore.debuts} accent={selected.accent} />
                  </div>
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                    <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      <IconStatusZap className="h-3 w-3 text-amber-300" /> Transformaciones ({lore.transformations.length})
                    </p>
                    <LoreChips items={lore.transformations} accent={selected.accent} />
                  </div>
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                    <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      <IconStatusSkull className="h-3 w-3 text-red-300" /> Muertes ({lore.deaths.length})
                    </p>
                    <LoreChips items={lore.deaths} accent={selected.accent} />
                  </div>
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                    <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      <IconStatusGem className="h-3 w-3 text-cyan-300" /> Deseos ({lore.wishes.length})
                    </p>
                    <LoreChips items={lore.wishes} accent={selected.accent} />
                  </div>
                </div>
              </div>

              {/* Hitos con salto al player */}
              {selected.span.milestones.length > 0 && (
                <div className="space-y-2">
                  <p className="font-mono text-[10px] font-black uppercase tracking-[0.25em] text-on-surface-variant">
                    Momentos cumbre · {selected.span.milestones.length}
                  </p>
                  <ol className="relative space-y-0 border-l border-white/10">
                    {selected.span.milestones.map((ms, i) => (
                      <li key={`${ms.episode}-${i}`} className="relative flex gap-3 py-2 pl-5">
                        <span aria-hidden className="absolute -left-[5px] top-4 h-2.5 w-2.5 rounded-full border border-white/20" style={{ backgroundColor: selected.accent }} />
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-white/15 bg-zinc-950 px-2 py-0.5 font-mono text-[10px] font-black tabular-nums text-brand-accent">
                              EP {ms.episode}
                            </span>
                            <span className="text-[13px] font-bold text-white">{ms.title}</span>
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-zinc-400">{ms.description}</p>
                        </div>
                        {selectedMediaId ? (
                          <Link
                            to="/series/$seriesId"
                            params={{ seriesId: String(selectedMediaId) }}
                            search={{ tab: "episodes", saga: selected.span.sagaId, autoplay: String(ms.episode) } as never}
                            preload="intent"
                            onClick={onClose}
                            aria-label={`Ver episodio ${ms.episode}: ${ms.title}`}
                            className="flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-full border border-white/15 bg-white/[0.06] text-white transition-colors hover:bg-white/[0.12] active:scale-95"
                          >
                            <IconMediaPlay className="ml-0.5 h-4 w-4 fill-current" />
                          </Link>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Películas de la época */}
              {selectedMovies.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    <IconMediaClapperboard className="h-3 w-3" /> Películas de esta época ({selectedMovies.length})
                  </p>
                  <div className="space-y-2">
                    {selectedMovies.map((m) => {
                      const movieMediaId = m.tmdbId ? tmdbMap.get(m.tmdbId)?.mediaId : undefined;
                      return (
                        <div key={m.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `color-mix(in srgb, ${selected.accent} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${selected.accent} 30%, transparent)`, color: selected.accent }}>
                            <IconMediaClapperboard className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold text-on-surface">{m.title}</p>
                            <p className="truncate text-[11px] text-on-surface-variant">{movieMediaId ? "Disponible en KameHouse" : "No disponible"} · {m.canonStatus}</p>
                          </div>
                          {movieMediaId ? (
                            <Link to="/series/$seriesId" params={{ seriesId: String(movieMediaId) }} preload="intent" onClick={onClose} aria-label={`Ver ${m.title}`} className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/[0.06] text-on-surface transition-colors hover:bg-white/[0.12] active:scale-95">
                              <IconMediaPlay className="ml-0.5 h-4 w-4 fill-current" />
                            </Link>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.article>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between gap-4">
        <button type="button" onClick={() => goTo(-1)} disabled={selectedIdx <= 0} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-30">
          <IconNavigationChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Anterior</span>
        </button>
        <div className="flex-1 text-center font-mono text-xs text-zinc-500">
          {selectedIdx + 1} / {visibleItems.length} · {selected.span.sagaName}
        </div>
        <button type="button" onClick={() => goTo(1)} disabled={selectedIdx >= visibleItems.length - 1} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-30">
          <span className="hidden sm:inline">Siguiente</span>
          <IconNavigationChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
