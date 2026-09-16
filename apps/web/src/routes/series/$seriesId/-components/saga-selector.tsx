import type { SagaDTO, SubSagaDTO } from "@/api/types/series.types"
import type { SagaDefinition } from "@/lib/config/dragonball_sagas"
import { cn } from "@/components/ui/core/styling"
import { SubSagaTimeline } from "./sub-saga-timeline"
import { ChronologySubSagaTimeline, type ChronologySubSagaItem } from "@/components/chronology"
import { getSpansBySeries } from "@/lib/chronology/loader"
import { useState, useEffect, useRef, useCallback } from "react"
import { motion } from "framer-motion"
import { IconNavigationChevronRight, IconNavigationLayers, IconNavigationChevronLeft } from "@/components/ui/icons";
import { WatchProgressBar } from "@/components/ui/watch-progress-bar"
import { useSpringPreset } from "@/components/ui/kinetics/hooks"

/** "(Relleno)" vive en los datos al final del título: se muestra como chip. */
const FILLER_SUFFIX_RE = /\s*\(relleno\)\s*$/i

function splitFillerSuffix(title: string): { clean: string; isFiller: boolean } {
  if (!FILLER_SUFFIX_RE.test(title)) return { clean: title, isFiller: false }
  return { clean: title.replace(FILLER_SUFFIX_RE, "").trim(), isFiller: true }
}

const SCROLL_END_THRESHOLD = 4

function useScrollFadeMask() {
  const ref = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  const checkPosition = useCallback(() => {
    const el = ref.current
    if (!el) return
    if (el.scrollHeight <= el.clientHeight + SCROLL_END_THRESHOLD) {
      setIsAtBottom(true)
      return
    }
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_END_THRESHOLD
    setIsAtBottom(atBottom)
  }, [])

  useEffect(() => {
    checkPosition()
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => checkPosition())
    ro.observe(el)
    window.addEventListener("resize", checkPosition)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", checkPosition)
    }
  }, [checkPosition])

  return { ref, isAtBottom, checkPosition }
}

interface SagaSelectorProps {
  sagas: SagaDTO[]
  localSagas?: SagaDefinition[]
  chronologySeriesId?: string
  sagasProgressMap?: Record<string, { watched: number; total: number; percent: number }>
  activeSagaId?: string
  onSelectSaga: (sagaId: string) => void
  activeSubSagaId?: string
  onSelectSubSaga?: (subSagaId: string) => void
  className?: string
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export function SagaSelector({
  sagas,
  localSagas,
  chronologySeriesId,
  sagasProgressMap,
  activeSagaId,
  onSelectSaga,
  activeSubSagaId,
  onSelectSubSaga,
  className,
  isCollapsed = false,
  onToggleCollapse,
}: SagaSelectorProps) {
  const [isSubMenuOpen, setIsSubMenuOpen] = useState(() => {
    return !!activeSubSagaId
  })
  // Indicador activo con spring canónico (tabs/indicator 480/34, §12.4).
  const activeCardTransition = useSpringPreset("tabIndicator")
  const activeSaga = sagas.find(s => s.id === activeSagaId)
  const hasSubSagas = activeSaga?.subSagas && activeSaga.subSagas.length > 0

  const { ref: mainListRef, isAtBottom: mainListIsAtBottom, checkPosition: mainListCheckPosition } = useScrollFadeMask()
  const { ref: subListRef, isAtBottom: subListIsAtBottom, checkPosition: subListCheckPosition } = useScrollFadeMask()

  const [prevSubSagaId, setPrevSubSagaId] = useState(activeSubSagaId)
  if (activeSubSagaId !== prevSubSagaId) {
    setPrevSubSagaId(activeSubSagaId)
    if (activeSubSagaId) {
      setIsSubMenuOpen(true)
    }
  }

  useEffect(() => {
    mainListCheckPosition()
  }, [sagas, mainListCheckPosition])

  useEffect(() => {
    if (isSubMenuOpen) {
      subListCheckPosition()
    }
  }, [isSubMenuOpen, activeSagaId, subListCheckPosition])

  // ── Chronology data for active saga ───────────────────────────────────────────
  const [chronologyItems, setChronologyItems] = useState<ChronologySubSagaItem[]>([])
  const [isChronologyLoading, setIsChronologyLoading] = useState(false)

  useEffect(() => {
    if (!activeSagaId || !chronologySeriesId) {
      setChronologyItems([])
      return
    }

    let mounted = true
    setIsChronologyLoading(true)

    getSpansBySeries(chronologySeriesId).then((spans) => {
      if (!mounted) return

      // Filter spans for the active saga
      const sagaSpans = spans.filter(s => s.sagaId === activeSagaId)

      const items: ChronologySubSagaItem[] = sagaSpans.map((span, idx) => ({
        id: span.id,
        index: idx + 1,
        title: span.title,
        episodeRange: `Eps ${span.startEpisode}–${span.endEpisode}`,
        threatLevel: span.worldStateAtStart.threatLevel,
        canon: span.canon,
        hasFiller: span.hasFiller,
        fillerEpisodes: span.fillerEpisodes,
        quickCatchUpKeys: span.quickCatchUpKeys,
        milestones: span.milestones.map(m => ({
          episode: m.episode,
          title: m.title,
          description: m.description,
        })),
        recommendedStartEpisode: span.recommendedStartEpisode,
      }))

      setChronologyItems(items)
      setIsChronologyLoading(false)
    }).catch(() => {
      if (mounted) {
        setChronologyItems([])
        setIsChronologyLoading(false)
      }
    })

    return () => { mounted = false }
  }, [activeSagaId, chronologySeriesId])

  // ── Colapsado: pastillas numéricas elegantes ──────────────────────────────
  if (isCollapsed) {
    return (
      <div className={cn(
        "sectionbar w-full max-h-[calc(100vh-8rem)] flex flex-col items-center py-4 px-2 select-none",
        className
      )}>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Expandir panel de sagas"
            aria-label="Expandir panel de sagas"
            className="w-10 h-10 mb-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <IconNavigationChevronRight className="w-4 h-4 text-brand-accent" />
          </button>
        )}

        <div className="w-8 h-px bg-white/[0.06] my-1 shrink-0" />

        <div className="flex-1 w-full overflow-y-auto no-scrollbar flex flex-col items-center gap-2 pt-2 pb-2">
          {sagas.map((saga, index) => {
            const isActive = saga.id === activeSagaId
            const orderNum = index + 1
            const orderFormatted = orderNum < 10 ? `0${orderNum}` : `${orderNum}`
            const localSaga = localSagas?.find(s => s.id === saga.id)
            const title = localSaga?.title || saga.name

            return (
              <button
                key={saga.id}
                type="button"
                onClick={() => onSelectSaga(saga.id)}
                title={title}
                aria-label={title}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 cursor-pointer border transition-[background-color,border-color,color,transform,box-shadow] duration-200 text-xs font-mono font-bold select-none",
                  "hover:scale-105 active:scale-95",
                  isActive
                    ? "bg-brand-accent/15 text-white border-brand-accent/40 shadow-[0_0_14px_hsl(var(--brand-accent)/0.25)] ring-1 ring-brand-accent/30"
                    : "bg-white/[0.02] hover:bg-white/[0.06] text-zinc-400 hover:text-white border-white/[0.05] hover:border-white/15"
                )}
              >
                {orderFormatted}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
      <div className={cn(
      "sectionbar w-full max-h-[calc(100vh-8rem)] flex flex-col p-4 sm:p-5 overflow-hidden relative",
      className
    )}>
      {/* Sin AnimatePresence mode="wait": el modo espera 200ms con el panel
          vacío en cada toggle saga/sub-arco. Entrada CSS direccional. */}
      {!isSubMenuOpen || !hasSubSagas ? (
          <div
            key="main-menu"
            className="w-full h-full flex flex-col min-h-0 animate-slide-right"
            style={{ animationDuration: "200ms" }}
          >
            <div className="sectionbar-header mb-3 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="sectionbar-header-icon">
                  <IconNavigationLayers className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="sectionbar-header-title">
                    Sagas
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/10 text-on-surface-variant border border-white/10">
                    {sagas.length}
                  </span>
                </div>
              </div>
              {onToggleCollapse && (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  title="Colapsar panel de sagas"
                  aria-label="Colapsar panel de sagas"
                  className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <IconNavigationChevronLeft className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="relative flex-grow min-h-0 flex flex-col overflow-hidden">
              <div
                ref={mainListRef}
                onScroll={mainListCheckPosition}
                className={cn(
                  "flex flex-col gap-1.5 overflow-y-auto pr-0.5 no-scrollbar flex-grow min-h-0 pb-3 content-start",
                  !mainListIsAtBottom && "[-webkit-mask-image:linear-gradient(to_bottom,black_85%,transparent_100%)] [mask-image:linear-gradient(to_bottom,black_85%,transparent_100%)]"
                )}
              >
                {sagas.map((saga, index) => {
                  const isActive = saga.id === activeSagaId
                  const orderNum = index + 1
                  const orderFormatted = orderNum < 10 ? `0${orderNum}` : `${orderNum}`
                  const localSaga = localSagas?.find(s => s.id === saga.id)
                  const rawTitle = localSaga?.title || saga.name
                  const { clean: sagaTitle, isFiller } = splitFillerSuffix(rawTitle)
                  const startEp = saga.startEp || localSaga?.startEp
                  const endEp = saga.endEp || localSaga?.endEp
                  const episodeRangeText = (startEp && endEp) ? `Eps ${startEp}–${endEp}` : (saga.episodeRange ? `Eps ${saga.episodeRange}` : undefined)
                  const subSagasCount = saga.subSagas?.length || localSaga?.subSagas?.length || 0
                  const progress = sagasProgressMap?.[saga.id]

                  return (
                    <div
                      key={saga.id}
                      onClick={() => onSelectSaga(saga.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          onSelectSaga(saga.id)
                        }
                      }}
                      aria-label={rawTitle}
                      aria-current={isActive ? "true" : undefined}
                      className={cn(
                        "group relative flex flex-col p-3 rounded-xl border text-left cursor-pointer select-none transition-[border-color,transform] duration-200 hover:translate-x-0.5 active:scale-[0.98]",
                        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent/70",
                        isActive
                          ? "border-brand-accent/35 text-white"
                          : "bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.05] hover:border-white/10 text-zinc-300 hover:text-white"
                      )}
                    >
                      {/* Indicador activo con layoutId (spring tabIndicator 480/34) */}
                      {isActive && (
                        <motion.span
                          layoutId="activeSagaCard"
                          transition={activeCardTransition}
                          aria-hidden
                          className="absolute inset-0 rounded-xl bg-brand-accent/[0.09] border-l-[3px] border-l-brand-accent shadow-[0_0_15px_hsl(var(--brand-accent)/0.12)] pointer-events-none"
                        />
                      )}
                      <div className="relative flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <span className={cn(
                            "text-xs font-mono font-bold shrink-0 w-6 h-6 rounded-md flex items-center justify-center mt-0.5 transition-colors",
                            isActive
                              ? "bg-brand-accent/20 text-brand-accent"
                              : "bg-white/[0.04] text-zinc-500 group-hover:text-zinc-300"
                          )}>
                            {orderFormatted}
                          </span>

                          <div className="min-w-0 flex-1">
                            <h4 className={cn(
                              "text-sm font-semibold leading-snug line-clamp-2 transition-colors",
                              isActive ? "text-white" : "text-zinc-200 group-hover:text-white"
                            )}>
                              {sagaTitle}
                            </h4>

                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[11px] text-zinc-500 group-hover:text-zinc-400">
                              {episodeRangeText && (
                                <span className="font-mono">{episodeRangeText}</span>
                              )}
                              {progress && progress.total > 0 && (
                                <span className={cn(
                                  "font-mono font-bold",
                                  progress.percent === 100 ? "text-brand-accent" : "text-on-surface-variant"
                                )}>
                                  {progress.watched}/{progress.total}
                                </span>
                              )}
                              {isFiller && (
                                <span className="text-[10px] font-mono font-bold px-2 py-px rounded-full bg-status-warning/10 text-status-warning border border-status-warning/20 uppercase tracking-wider">
                                  Relleno
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {subSagasCount > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onSelectSaga(saga.id)
                              setIsSubMenuOpen(true)
                            }}
                            title={`Ver ${subSagasCount} sub-arcos`}
                            aria-label={`Ver ${subSagasCount} sub-arcos de ${rawTitle}`}
                            className={cn(
                              "shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer mt-0.5 min-h-7",
                              isActive
                                ? "bg-brand-accent/20 text-brand-accent border border-brand-accent/30 hover:bg-brand-accent/30"
                                : "bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08] border border-white/[0.06]"
                            )}
                          >
                            <span>{subSagasCount} {subSagasCount === 1 ? "arco" : "arcos"}</span>
                            <IconNavigationChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {progress && progress.total > 0 && (
                        <div className="relative mt-2">
                          <WatchProgressBar percent={progress.percent} variant="compact" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div
            key="sub-menu"
            className="w-full h-full flex flex-col min-h-0 animate-slide-left"
            style={{ animationDuration: "200ms" }}
          >
            <div className="flex items-center gap-2 mb-3 px-1 flex-shrink-0">
              <button
                onClick={() => {
                  setIsSubMenuOpen(false)
                  if (onSelectSubSaga && activeSubSagaId) {
                    onSelectSubSaga("")
                  }
                }}
                aria-label="Volver a sagas"
                title="Volver a sagas"
                className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
              >
                <IconNavigationChevronLeft className="w-4 h-4 text-brand-accent" />
                <span>Sagas</span>
              </button>
              <span className="text-xs text-zinc-600">/</span>
              <span className="text-xs font-semibold text-white truncate min-w-0 flex-1">
                {localSagas?.find(s => s.id === activeSaga?.id)?.title || activeSaga?.name}
              </span>
            </div>

            {activeSubSagaId && (
              <div className="mb-2 px-1">
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectSubSaga) onSelectSubSaga("")
                  }}
                  className="text-[11px] font-mono font-semibold text-brand-accent hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>✕ Quitar filtro de sub-arco</span>
                </button>
              </div>
            )}

            <div className="flex-grow min-h-0 flex flex-col overflow-hidden relative">
              <div
                ref={subListRef}
                onScroll={subListCheckPosition}
                className={cn(
                  "flex-grow overflow-y-auto pr-0.5 no-scrollbar pb-3",
                  !subListIsAtBottom && "[-webkit-mask-image:linear-gradient(to_bottom,black_85%,transparent_100%)] [mask-image:linear-gradient(to_bottom,black_85%,transparent_100%)]"
                )}
              >
                {isChronologyLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex gap-1.5">
                      {[1, 2, 3].map(i => (
                        <div
                          key={i}
                          className="w-6 h-6 rounded-lg bg-white/10 animate-pulse"
                          style={{ animationDelay: `${i * 120}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                ) : chronologyItems.length > 0 ? (
                  <ChronologySubSagaTimeline
                    items={chronologyItems}
                    activeId={activeSubSagaId}
                    onSelect={(subId) => {
                      const isSubActive = subId === activeSubSagaId
                      if (onSelectSubSaga) {
                        onSelectSubSaga(isSubActive ? "" : subId)
                      }
                    }}
                    showCatchUp={true}
                  />
                ) : (
                  <SubSagaTimeline
                    activeId={activeSubSagaId}
                    items={(activeSaga?.subSagas || []).map((sub, idx) => {
                      const localSub = localSagas?.find(s => s.id === activeSaga?.id)?.subSagas?.find(ss => ss.id === sub.id)
                      const startEp = sub.startEp || localSub?.startEp
                      const endEp = sub.endEp || localSub?.endEp
                      const range = (startEp && endEp) ? `Eps ${startEp}–${endEp}` : (sub.episodeRange ? `Eps ${sub.episodeRange}` : undefined)
                      return {
                        id: sub.id,
                        index: idx + 1,
                        title: localSub?.title || sub.name,
                        episodeRange: range,
                      }
                    })}
                    onSelect={(subId) => {
                      const sub = activeSaga?.subSagas?.find(s => s.id === subId)
                      if (!sub) return
                      const isSubActive = subId === activeSubSagaId
                      if (onSelectSubSaga) {
                        onSelectSubSaga(isSubActive ? "" : subId)
                      }
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  )
}
