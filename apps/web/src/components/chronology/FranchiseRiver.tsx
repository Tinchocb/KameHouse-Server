"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/components/ui/core/styling";
import { IconUiCheckCircle, IconUiAlertTriangle, IconNavigationLayers, IconBadgesSparkles, IconTimeClock } from "@/components/ui/icons";
import { getSeriesList } from "@/lib/chronology/loader";
import type { TimelineSeries } from "@/lib/chronology/types";
import {
  SERIES_ORDER,
  SERIES_LABEL,
  getSeriesAccent,
  getSeriesGlow,
  getThreatBadge,
} from "@/lib/chronology/design";
import { SectionBar } from "@/components/ui/sectionbar/sectionbar";


type CanonTab = "canon" | "non-canon" | "all";

const TAB_CONFIG: { value: CanonTab; label: string; icon: React.ReactNode }[] = [
  { value: "canon", label: "Canón", icon: <IconUiCheckCircle className="w-3.5 h-3.5" /> },
  { value: "non-canon", label: "No Canón", icon: <IconUiAlertTriangle className="w-3.5 h-3.5" /> },
  { value: "all", label: "Todo", icon: <IconNavigationLayers className="w-3.5 h-3.5" /> },
];

const NODE_RADIUS = 14;
const NODE_SPACING = 280;
const START_X = 120;
const RIVER_Y = 60;
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
  return prefersReduced
    ? { duration: 0.2, ease: "easeOut" as const }
    : { type: "spring" as const, stiffness: 380, damping: 30, mass: 0.8 };
}

function CanonBadge({ canon }: { canon: boolean }) {
  if (!canon) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
        <IconBadgesSparkles className="w-3 h-3" />
        No Canón
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-brand-success/20 text-brand-success border border-brand-success/30">
      <IconUiCheckCircle className="w-3 h-3" />
      Canón
    </span>
  );
}

function SeriesNode({
  series,
  progress,
  isActive,
  onSelect,
  watchedEpisodes,
}: {
  series: TimelineSeries;
  progress: number;
  isActive: boolean;
  onSelect: () => void;
  watchedEpisodes: Record<string, Set<number>>;
}) {
  const accent = getSeriesAccent(series.id);
  const glow = getSeriesGlow(series.id);
  const isWatched = progress > 0;
  const isCompleted = progress >= 1;
  const reduceMotion = useReducedMotion();

  const ringR = NODE_RADIUS;
  const ringC = 2 * Math.PI * ringR;
  const ringColor = isCompleted
    ? "hsl(var(--brand-success))"
    : isWatched
    ? accent
    : "rgba(255,255,255,0.15)";

  return (
    <g
      key={series.id}
      className="cursor-pointer group"
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      aria-label={`${series.title} ${isCompleted ? "(completada)" : isWatched ? `(${Math.round(progress * 100)}%)` : "(pendiente)"}`}
      aria-current={isActive ? "true" : undefined}
    >
      <motion.circle
        cx={START_X}
        cy={RIVER_Y}
        r={NODE_RADIUS + (isActive ? 4 : 0)}
        fill={isActive
          ? accent
          : isCompleted
          ? "hsl(var(--brand-success))"
          : isWatched
          ? `color-mix(in srgb, ${accent} 30%, transparent)`
          : "rgba(255,255,255,0.1)"}
        stroke={isActive ? accent : "transparent"}
        strokeWidth={isActive ? 3 : 0}
        className="transition-all duration-300"
        animate={{ r: isActive ? NODE_RADIUS + 4 : NODE_RADIUS }}
        transition={SpringTransition(reduceMotion)}
      />

      {progress > 0 && progress < 1 && (
        <motion.path
          d={`M ${START_X - NODE_RADIUS} ${RIVER_Y} A ${NODE_RADIUS} ${NODE_RADIUS} 0 0 1 ${START_X + NODE_RADIUS * 2 * progress} ${RIVER_Y}`}
          stroke={isCompleted ? "hsl(var(--brand-success))" : accent}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={SpringTransition(reduceMotion)}
        />
      )}

      {isCompleted && (
        <motion.path
          d={`M ${START_X - 4} ${RIVER_Y} L ${START_X - 1} ${RIVER_Y + 3} L ${START_X + 4} ${RIVER_Y - 3}`}
          stroke="hsl(var(--brand-success))"
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ ...SpringTransition(reduceMotion), delay: 0.2 }}
        />
      )}

      {isActive && !reduceMotion && (
        <motion.circle
          cx={START_X}
          cy={RIVER_Y}
          r={NODE_RADIUS + 8}
          fill="none"
          stroke={glow}
          strokeWidth={2}
          strokeDasharray="8 6"
          animate={{ opacity: [0.4, 0.8, 0.4], r: [NODE_RADIUS + 8, NODE_RADIUS + 14, NODE_RADIUS + 8] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <text
        x={START_X}
        y={RIVER_Y + 38}
        textAnchor="middle"
        className={cn(
          "text-xs font-medium select-none transition-colors",
          isActive ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"
        )}
      >
        {series.title}
      </text>

      <text
        x={START_X}
        y={RIVER_Y + 52}
        textAnchor="middle"
        className="text-[10px] font-mono text-zinc-600"
      >
        Año {series.inUniverseStartYear}–{series.inUniverseEndYear}
      </text>

      <text
        x={START_X}
        y={RIVER_Y + 64}
        textAnchor="middle"
        className="text-[10px] text-zinc-500"
      >
        {series.totalEpisodes} eps
      </text>

      {!series.canon && (
        <text
          x={START_X + NODE_RADIUS + 2}
          y={RIVER_Y - NODE_RADIUS - 2}
          textAnchor="start"
          className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30"
        >
          NO CANÓN
        </text>
      )}

      {isActive && (
        <path
          d={`M ${START_X} ${RIVER_Y + NODE_RADIUS + 8} L ${START_X} ${RIVER_Y + NODE_RADIUS + 20}`}
          stroke={accent}
          strokeWidth={2}
          strokeDasharray="4 3"
          opacity={0.6}
        />
      )}
    </g>
  );
}

function SeriesNodeWrapper({
  series,
  progress,
  isActive,
  onSelect,
  watchedEpisodes,
  index,
}: {
  series: TimelineSeries;
  progress: number;
  isActive: boolean;
  onSelect: () => void;
  watchedEpisodes: Record<string, Set<number>>;
  index: number;
}) {
  const x = START_X + index * NODE_SPACING;

  return (
    <g transform={`translate(${x - START_X}, 0)`}>
      <SeriesNode
        series={series}
        progress={progress}
        isActive={isActive}
        onSelect={onSelect}
        watchedEpisodes={watchedEpisodes}
      />
    </g>
  );
}

export interface FranchiseRiverProps {
  className?: string;
  activeSeriesId?: string;
  onSeriesSelect?: (seriesId: string) => void;
  watchedEpisodes?: Record<string, Set<number>>;
}

export function FranchiseRiver({
  className,
  activeSeriesId,
  onSeriesSelect,
  watchedEpisodes = {},
}: FranchiseRiverProps) {
  const [activeTab, setActiveTab] = useState<CanonTab>("canon");
  const [seriesList, setSeriesList] = useState<TimelineSeries[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let mounted = true;
    getSeriesList().then((data) => {
      if (mounted) {
        const ordered = [...data].sort((a, b) => SERIES_ORDER.indexOf(a.id) - SERIES_ORDER.indexOf(b.id));
        setSeriesList(ordered);
        setIsLoading(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  const filteredSeries = useMemo(() => {
    return seriesList.filter((s) => {
      if (activeTab === "all") return true;
      return (s.canon ? "canon" : "non-canon") === activeTab;
    });
  }, [seriesList, activeTab]);

  const getProgress = (series: TimelineSeries) => {
    const watched = watchedEpisodes[series.id];
    if (!watched || watched.size === 0) return 0;
    return watched.size / series.totalEpisodes;
  };

  const totalWidth = START_X * 2 + filteredSeries.length * NODE_SPACING;

  if (isLoading) {
    return (
      <SectionBar label="Línea Temporal" variant="minimal" className={cn("min-h-[200px]", className)}>
        <div className="flex items-center justify-center h-32">
          <motion.div
            className="flex gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                className="w-6 h-6 rounded-full bg-white/10"
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.15, ...SpringTransition(reduceMotion) }}
              />
            ))}
          </motion.div>
        </div>
      </SectionBar>
    );
  }

  return (
    <SectionBar
      label="Línea Temporal"
      icon={IconTimeClock}
      variant="minimal"
      className={cn(className)}
    >
      <div className="p-5 md:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2" role="tablist" aria-label="Filtrar por canonicidad">
            {TAB_CONFIG.map((tab) => (
              <button
                key={tab.value}
                role="tab"
                aria-selected={activeTab === tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-200 active:scale-95",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent/70",
                  activeTab === tab.value
                    ? "bg-brand-accent/15 text-white shadow-[0_0_12px_hsl(var(--brand-accent)/0.2)]"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                )}
              >
                <span className={cn("flex-shrink-0", activeTab === tab.value ? "text-brand-accent" : "text-zinc-500")}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </div>

          <div
            key={activeTab}
            className="text-xs font-mono text-zinc-500 ml-auto animate-fade-in whitespace-nowrap"
          >
            {filteredSeries.length} {filteredSeries.length === 1 ? "serie" : "series"}
          </div>
        </div>

        <div
          className="relative overflow-x-auto scrollbar-hide pb-4 -mx-5 md:-mx-6 px-5 md:px-6 touch-pan-x"
          style={{ maxWidth: "100%", contentVisibility: "auto", contain: "content" }}
          role="region"
          aria-label="Línea temporal de la franquicia"
          tabIndex={0}
        >
          <svg
            viewBox={`0 0 ${totalWidth} 140`}
            preserveAspectRatio="none"
            className="w-full min-w-[800px] block animate-fade-in"
            style={{ minWidth: totalWidth, contentVisibility: "auto", contain: "content" }}
          >
            <defs>
              <linearGradient id="riverGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--brand-accent) / 0.08)" />
                <stop offset="50%" stopColor="hsl(var(--brand-accent) / 0.15)" />
                <stop offset="100%" stopColor="hsl(var(--brand-accent) / 0.08)" />
              </linearGradient>
            </defs>

            <motion.path
              d={`M ${START_X} ${RIVER_Y} Q ${totalWidth / 2} ${RIVER_Y - 15} ${totalWidth - START_X} ${RIVER_Y}`}
              stroke="url(#riverGradient)"
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeDasharray="8 6"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={reduceMotion ? { duration: 0.5 } : { duration: 1.2, ease: "easeOut" }}
            />

            <AnimatePresence mode="popLayout">
              {filteredSeries.map((series, index) => (
                <SeriesNodeWrapper
                  key={series.id}
                  series={series}
                  progress={getProgress(series)}
                  isActive={series.id === activeSeriesId}
                  onSelect={() => onSeriesSelect?.(series.id)}
                  watchedEpisodes={watchedEpisodes}
                  index={index}
                />
              ))}
            </AnimatePresence>

            {filteredSeries.length > 1 && filteredSeries.slice(0, -1).map((_, index) => (
              <motion.line
                key={`conn-${index}`}
                x1={START_X + index * NODE_SPACING + NODE_RADIUS + 8}
                y1={RIVER_Y}
                x2={START_X + (index + 1) * NODE_SPACING - NODE_RADIUS - 8}
                y2={RIVER_Y}
                stroke="hsl(var(--brand-accent) / 0.15)"
                strokeWidth={2}
                strokeDasharray="12 8"
                className="pointer-events-none"
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ ...SpringTransition(reduceMotion), delay: 0.3 + index * 0.05 }}
              />
            ))}
          </svg>

          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />
        </div>
      </div>
    </SectionBar>
  );
}