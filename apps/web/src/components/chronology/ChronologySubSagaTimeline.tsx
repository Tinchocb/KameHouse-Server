"use client";

import { cn } from "@/components/ui/core/styling";
import { IconNavigationLayers, IconNavigationChevronRight, IconBadgesFlag, IconBadgesSparkles, IconBadgesChevronRight, IconMediaPlay } from "@/components/ui/icons";
import type { ThreatLevel } from "@/lib/chronology/types";
import { useState, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { SectionBar } from "@/components/ui/sectionbar/sectionbar";
import { getThreatBadge } from "@/lib/chronology/design";

export interface ChronologySubSagaItem {
  id: string;
  index: number;
  title: string;
  episodeRange: string;
  threatLevel: ThreatLevel;
  canon: boolean;
  hasFiller: boolean;
  fillerEpisodes: number[];
  quickCatchUpKeys: string[];
  milestones: { episode: number; title: string; description: string }[];
  recommendedStartEpisode: number;
  startEpisode?: number;
}

interface ChronologySubSagaTimelineProps {
  items: ChronologySubSagaItem[];
  activeId?: string;
  onSelect: (id: string) => void;
  showCatchUp?: boolean;
  className?: string;
  label?: string;
  icon?: React.ElementType;
}

function SpringTransition(reduceMotion: boolean | null | undefined) {
  const prefersReduced = reduceMotion ?? false;
  return prefersReduced
    ? { duration: 0.2, ease: "easeOut" as const }
    : { type: "spring" as const, stiffness: 280, damping: 28 };
}

export function ChronologySubSagaTimeline({
  items,
  activeId,
  onSelect,
  showCatchUp = true,
  className,
  label = "Sub-sagas",
  icon = IconNavigationLayers,
}: ChronologySubSagaTimelineProps) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const sections = useMemo(() => {
    return items.map((item) => {
      const isActive = item.id === activeId;
      const isExpanded = expandedItem === item.id;
      const badge = getThreatBadge(item.threatLevel);
      return { item, isActive, isExpanded, badge };
    });
  }, [items, activeId, expandedItem]);

  if (items.length === 0) return null;

  return (
    <SectionBar
      label={label}
      icon={icon}
      variant="minimal"
      collapsible={false}
      className={cn(className)}
    >
      <div className="sectionbar-divide divide-y divide-white/[0.06] p-4 sm:p-5 space-y-3">
        <AnimatePresence mode="popLayout">
          {sections.map(({ item, isActive, isExpanded, badge }) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={SpringTransition(reduceMotion)}
              className="group relative"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (e.currentTarget === e.target || (e.target as HTMLElement).closest('[data-action]')) {
                    return;
                  }
                  onSelect(item.id);
                }}
                aria-label={item.title}
                aria-current={isActive ? "true" : undefined}
                aria-expanded={isExpanded}
                title={item.title}
                className={cn(
                  "group relative w-full flex items-start justify-between gap-3 p-4 rounded-xl border text-left cursor-pointer select-none transition-[background-color,border-color,transform] duration-base hover:translate-x-[2px] active:scale-[0.98]",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent/70",
                  isActive
                    ? "bg-brand-accent/[0.08] border-brand-accent/30 border-l-[3px] border-l-brand-accent shadow-[0_0_12px_hsl(var(--brand-accent)/0.1)] text-white"
                    : "bg-white/[0.02] hover:bg-white/[0.04] border-white/[0.04] hover:border-white/10 text-zinc-300 hover:text-white"
                )}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <span
                    className={cn(
                      "text-xs font-mono font-bold shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5 transition-colors",
                      isActive ? "bg-brand-accent/20 text-brand-accent" : "bg-white/[0.04] text-zinc-500 group-hover:text-zinc-300"
                    )}
                  >
                    {item.index < 10 ? `0${item.index}` : `${item.index}`}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm font-semibold leading-snug truncate transition-colors",
                        isActive ? "text-white" : "text-zinc-200 group-hover:text-white"
                      )}
                    >
                      {item.title}
                    </p>

                    <div className="flex items-center flex-wrap gap-2 mt-2">
                      <span className="text-[11px] font-medium text-zinc-500 group-hover:text-zinc-400 whitespace-nowrap shrink-0">
                        {item.episodeRange}
                      </span>

                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border shrink-0",
                          badge.color
                        )}
                      >
                        {badge.label}
                      </span>

                      {!item.canon && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                          NO CANÓN
                        </span>
                      )}

                      {item.hasFiller && (
                        <span
                          className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0"
                          title={`Episodios de relleno: ${item.fillerEpisodes.join(", ")}`}
                        >
                          Relleno
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-start gap-1.5">
                  {isActive ? (
                    <div className="w-2 h-2 rounded-full bg-brand-accent shadow-[0_0_8px_hsl(var(--brand-accent))] mt-1.5 flex-shrink-0" />
                  ) : (
                    <>
                      <button
                        data-action="expand"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedItem((prev) => (prev === item.id ? null : item.id));
                        }}
                        className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-300 transition-colors mt-0.5 flex-shrink-0"
                        aria-label={isExpanded ? "Ocultar detalles" : "Ver detalles"}
                      >
                        <motion.span
                          className={cn("block transition-transform duration-200", isExpanded && "rotate-90")}
                          animate={{ rotate: isExpanded ? 90 : 0 }}
                          transition={SpringTransition(reduceMotion)}
                        >
                          <IconNavigationChevronRight className="w-4 h-4" />
                        </motion.span>
                      </button>
                      <IconNavigationChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors mt-1 flex-shrink-0" />
                    </>
                  )}
                </div>
              </button>

<motion.div
                initial={false}
                animate={{
                    maxHeight: isExpanded && showCatchUp ? 2000 : 0,
                    opacity: isExpanded && showCatchUp ? 1 : 0,
                }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="grid overflow-hidden"
                style={{
                    gridTemplateRows: isExpanded && showCatchUp ? "1fr" : "0fr",
                }}
              >
                <div className="overflow-hidden min-h-0" aria-hidden={!(isExpanded && showCatchUp)}>
                  <div className="ml-10 pl-3 border-l border-white/[0.05] pb-3 pt-2">
                    {item.milestones.length > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                          <IconBadgesFlag className="w-3.5 h-3.5 text-brand-accent/80" />
                          <span>Hitós clave</span>
                        </div>
                        <ul className="space-y-1.5 text-[11px] text-zinc-400">
                          {item.milestones.slice(0, 3).map((ms, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="w-6 text-right font-mono text-brand-accent/60 shrink-0">
                                Ep {ms.episode}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-zinc-200 truncate">{ms.title}</p>
                                <p className="text-zinc-500 truncate">{ms.description}</p>
                              </div>
                            </li>
                          ))}
                          {item.milestones.length > 3 && (
                            <li className="text-center text-zinc-500 py-1">
                              +{item.milestones.length - 3} más...
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    {item.quickCatchUpKeys.length > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                          <IconBadgesSparkles className="w-3.5 h-3.5 text-brand-accent/80" />
                          <span>Catch-up rápido</span>
                        </div>
                        <ul className="space-y-1 text-[11px] text-zinc-400">
                          {item.quickCatchUpKeys.slice(0, 2).map((key, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <IconBadgesChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-brand-accent/60" />
                              <span>{key}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center gap-3 pt-2 border-t border-white/[0.04]">
                      <button
                        data-action="jump"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(item.id);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-accent/15 text-brand-accent text-xs font-semibold rounded-lg border border-brand-accent/30 hover:bg-brand-accent/25 transition-colors"
                      >
                        <IconMediaPlay className="w-3.5 h-3.5" />
                        <span>Ir al episodio {item.recommendedStartEpisode}</span>
                      </button>

                      {item.recommendedStartEpisode !== item.startEpisode && (
                        <span className="text-[10px] text-zinc-500">
                          Inicio recomendado: Ep {item.recommendedStartEpisode}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </SectionBar>
  );
}