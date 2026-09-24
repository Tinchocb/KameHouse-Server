import type { SagaDTO } from "@/api/types/series.types"
import type { SagaDefinition } from "@/lib/config/dragonball_sagas"
import type { Anime_Episode } from "@/api/generated/types"
import { cn } from "@/components/ui/core/styling"
import { ArcCinematicCard } from "./arc-cinematic-card"
import { useState, useEffect, useRef, useCallback } from "react"
import { m } from "framer-motion"
import { IconNavigationChevronRight, IconNavigationLayers, IconNavigationChevronLeft } from "@/components/ui/icons"
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
  // New props for cinematic cards
  episodes?: Anime_Episode[]
  heroBackdrop?: string | null
}

export function SagaSelector({
  sagas,
  localSagas,
  sagasProgressMap,
  activeSagaId,
  onSelectSaga,
  activeSubSagaId,
  onSelectSubSaga,
  className,
  isCollapsed = false,
  onToggleCollapse,
  episodes: _episodes = [],
  heroBackdrop: _heroBackdrop = null,
}: SagaSelectorProps) {
  const [isSubMenuOpen, setIsSubMenuOpen] = useState(() => {
    return !!activeSubSagaId
  })
  const activeSaga = sagas.find(s => s.id === activeSagaId)
  const hasSubSagas = activeSaga?.subSagas && activeSaga.subSagas.length > 0
  const tabIndicatorSpring = useSpringPreset("tabIndicator")

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

  // ── Colapsado: pastillas numéricas elegantes ──────────────────────────────
  if (isCollapsed) {
    return (
      <div className={cn(
        "sectionbar w-full max-h-[calc(100dvh-8rem)] flex flex-col items-center py-4 px-2 select-none",
        className
      )}>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Expandir panel de sagas"
            aria-label="Expandir panel de sagas"
            className="w-10 h-10 mb-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-on-surface-variant hover:text-white flex items-center justify-center transition-[background-color,color,transform] active:scale-95 duration-150 cursor-pointer"
          >
            <IconNavigationChevronRight className="w-4 h-4 text-brand-accent" />
          </button>
        )}

        <div className="w-8 h-px bg-white/[0.06] my-1 shrink-0" />

        <div className="flex-1 w-full overflow-y-auto no-scrollbar flex flex-col items-center gap-2 pt-2 pb-2">
          {sagas.map((saga, _index) => {
            const isActive = saga.id === activeSagaId
            const orderNum = _index + 1
            const orderFormatted = orderNum < 10 ? `0${orderNum}` : `${orderNum}`
            const localSaga = localSagas?.find(s => s.id === saga.id)
            const title = localSaga?.title || saga.name
            const subSagasCount = saga.subSagas?.length || localSaga?.subSagas?.length || 0
            const hasArcs = subSagasCount > 0

            const handleCollapsedSelect = () => {
              // Single click: solo selecciona. Segundo click sobre la activa abre arcos.
              if (hasArcs && isActive) {
                setIsSubMenuOpen(true)
                if (onToggleCollapse) onToggleCollapse()
                return
              }
              onSelectSaga(saga.id)
            }

            const handleCollapsedOpenArcs = () => {
              if (!hasArcs) return
              if (saga.id !== activeSagaId) {
                onSelectSaga(saga.id)
              }
              setIsSubMenuOpen(true)
              if (onToggleCollapse) onToggleCollapse()
            }

            return (
              <button
                key={saga.id}
                type="button"
                onClick={handleCollapsedSelect}
                onDoubleClick={hasArcs ? handleCollapsedOpenArcs : undefined}
                title={hasArcs ? `${title} — doble click para ver arcos` : title}
                aria-label={title}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 cursor-pointer border transition-[background-color,border-color,color,transform,box-shadow] duration-200 text-xs font-mono font-bold select-none",
                  "hover:scale-105 active:scale-95",
                  isActive
                    ? "text-white border-brand-accent/40"
                    : "bg-white/[0.02] hover:bg-white/[0.06] text-on-surface-variant hover:text-white border-white/[0.05] hover:border-white/15"
                )}
              >
                {isActive && (
                  <m.div
                    layoutId="activeCollapsedSagaPill"
                    transition={tabIndicatorSpring}
                    className="absolute inset-0 rounded-xl bg-brand-accent/20 border border-brand-accent/40 pointer-events-none"
                  />
                )}
                <span className="relative z-10">{orderFormatted}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
      <div className={cn(
      "sectionbar w-full max-h-[calc(100dvh-8rem)] flex flex-col p-4 overflow-hidden relative bg-bg-primary border border-white/[0.12] shadow-[shadow:0_12px_40px_rgba(0,0,0,0.85),var(--glass-highlight-sm)] rounded-2xl [background:var(--classic-page-gradient)]",
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
            <div className="sectionbar-header mb-3 flex-shrink-0 min-h-8">
              <div className="flex items-center gap-3">
                <div className="sectionbar-header-icon">
                  <IconNavigationLayers className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="sectionbar-header-title">
                    Sagas
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-3xs font-mono font-bold bg-white/10 text-on-surface-variant border border-white/10">
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
                  className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-on-surface-variant hover:text-white transition-[background-color,color,transform] active:scale-95 duration-150 cursor-pointer"
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
                  "flex flex-col gap-2.5 overflow-y-auto pr-0.5 no-scrollbar flex-grow min-h-0 pb-3 content-start",
                  !mainListIsAtBottom && "[-webkit-mask-image:linear-gradient(to_bottom,black_85%,transparent_100%)] [mask-image:linear-gradient(to_bottom,black_85%,transparent_100%)]"
                )}
              >
                {sagas.map((saga, _index) => {
                  const isActive = saga.id === activeSagaId
                  const localSaga = localSagas?.find(s => s.id === saga.id)
                  const rawTitle = localSaga?.title || saga.name
                  const { clean: sagaTitle, isFiller } = splitFillerSuffix(rawTitle)
                  const startEp = saga.startEp || localSaga?.startEp
                  const endEp = saga.endEp || localSaga?.endEp
                  const episodeRangeText = (startEp && endEp) ? `EP. ${startEp} — ${endEp}` : (saga.episodeRange ? `EP. ${saga.episodeRange}` : `EP. 1 — 1`)
                  const subSagasCount = saga.subSagas?.length || localSaga?.subSagas?.length || 0
                  const progress = sagasProgressMap?.[saga.id]
                  const epCount = (endEp && startEp) ? endEp - startEp + 1 : (localSaga?.endEp && localSaga?.startEp ? localSaga.endEp - localSaga.startEp + 1 : 0)

                  const handleClick = () => {
                    // Single click: solo selecciona la saga (no abre arcos).
                    // Si ya está activa y tiene arcos, el segundo click simple
                    // también los abre (fallback táctil / teclado).
                    if (subSagasCount > 0 && isActive) {
                      setIsSubMenuOpen(true)
                      return
                    }
                    onSelectSaga(saga.id)
                  }

                  const handleDoubleClick = () => {
                    // Doble click: abre los arcos de la saga.
                    if (subSagasCount === 0) return
                    if (saga.id !== activeSagaId) {
                      onSelectSaga(saga.id)
                    }
                    setIsSubMenuOpen(true)
                  }

                  return (
                    <ArcCinematicCard
                      key={saga.id}
                      layoutId="activeSagaCard"
                      topLeft={episodeRangeText}
                      topRight={subSagasCount > 0 ? `${subSagasCount} ${subSagasCount === 1 ? "ARCO" : "ARCOS"}` : (isFiller ? "RELLENO" : undefined)}
                      title={sagaTitle}
                      metaLeft={`${epCount} eps`}
                      isActive={isActive}
                      progressPercent={progress?.percent}
                      isFiller={isFiller}
                      onClick={handleClick}
                      onDoubleClick={subSagasCount > 0 ? handleDoubleClick : undefined}
                      nativeTitle={subSagasCount > 0 ? `${sagaTitle} — doble click para ver arcos` : sagaTitle}
                      onHover={() => {}}
                    />
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
                className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-on-surface-variant hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
              >
                <IconNavigationChevronLeft className="w-4 h-4 text-brand-accent" />
                <span>Sagas</span>
              </button>
              <span className="text-xs text-on-surface-variant/40">/</span>
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
                  className="text-2xs font-mono font-semibold text-brand-accent hover:underline flex items-center gap-1 cursor-pointer"
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
                  "flex flex-col gap-3 overflow-y-auto pr-0.5 no-scrollbar flex-grow min-h-0 pb-3 content-start",
                  !subListIsAtBottom && "[-webkit-mask-image:linear-gradient(to_bottom,black_85%,transparent_100%)] [mask-image:linear-gradient(to_bottom,black_85%,transparent_100%)]"
                )}
              >
                {(activeSaga?.subSagas || []).map((sub) => {
                  const isActive = sub.id === activeSubSagaId
                  const localSub = localSagas?.find(s => s.id === activeSaga?.id)?.subSagas?.find(ss => ss.id === sub.id)
                  const { clean: subTitle, isFiller } = splitFillerSuffix(localSub?.title || sub.name)
                  const startEp = sub.startEp || localSub?.startEp
                  const endEp = sub.endEp || localSub?.endEp
                  const episodeRangeText = (startEp && endEp) ? `EP. ${startEp} — ${endEp}` : (sub.episodeRange ? `EP. ${sub.episodeRange}` : `EP. 1 — 1`)
                  const epCount = (endEp && startEp) ? endEp - startEp + 1 : (localSub?.endEp && localSub?.startEp ? localSub.endEp - localSub.startEp + 1 : 0)

                  return (
                    <ArcCinematicCard
                      key={sub.id}
                      layoutId="activeSubSagaCard"
                      topLeft={episodeRangeText}
                      topRight={isFiller ? "RELLENO" : undefined}
                      title={subTitle}
                      metaLeft={`${epCount} eps`}
                      isActive={isActive}
                      isFiller={isFiller}
                      onClick={() => {
                        const isSubActive = sub.id === activeSubSagaId
                        if (onSelectSubSaga) {
                          onSelectSubSaga(isSubActive ? "" : sub.id)
                        }
                      }}
                      onHover={() => {}}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        )}
    </div>
  )
}
