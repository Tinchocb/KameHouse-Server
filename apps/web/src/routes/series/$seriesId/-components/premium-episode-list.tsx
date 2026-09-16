import React from "react"
import { useNavigate } from "@tanstack/react-router"
import { EpisodeBadge } from "@/components/ui/episode-badge"
import { IconStatusFolderPlus, IconNavigationSearch, IconUiClose, IconMediaPlay } from "@/components/ui/icons";
import type { PremiumEpisode } from "@/api/types/series.types"
import { cn } from "@/components/ui/core/styling"
import { useHoverPreload } from "@/hooks/use-hover-preload"
import { useThemeSettings } from "@/lib/theme/theme-hooks"
import { useVirtualizer } from "@tanstack/react-virtual"
import { DeferredImage } from "@/components/shared/deferred-image"
import { WatchProgressBar } from "@/components/ui/watch-progress-bar"

// Alto del `pb-4` de cada fila, que estimateSize tiene que contar junto con la tarjeta.
const ROW_GAP_PX = 16


interface PremiumEpisodeListProps {
  episodes: PremiumEpisode[]
  activeSagaId?: string
  activeSubSagaStart?: number
  activeSubSagaEnd?: number
  onPlay?: (episodeNumber: number) => void
  onPreload?: (filePath: string) => void
  /** Progreso de episodios vistos dentro de la saga activa */
  sagaProgress?: { watched: number; total: number; percent: number }
  /** Estadísticas de episodios filler dentro de la saga activa */
  fillerStats?: { filler: number; total: number; percent: number }
  /** Elemento contenedor con scroll (para virtualización correcta) */
  scrollElement?: HTMLElement | null
}

export const PremiumEpisodeList = React.memo(function PremiumEpisodeList({
  episodes,
  activeSagaId,
  activeSubSagaStart,
  activeSubSagaEnd,
  onPlay,
  onPreload,
  sagaProgress,
  fillerStats,
  scrollElement,
}: PremiumEpisodeListProps) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [typeFilter, setTypeFilter] = React.useState<"all" | "canon" | "filler" | "unwatched">("all")
  const [isSearchFocused, setIsSearchFocused] = React.useState(false)
  const ts = useThemeSettings()

  const { onMouseEnter, onMouseLeave } = useHoverPreload({
    delay: 300,
    onPreload: (epId) => {
      const ep = episodes.find(e => e.id === epId)
      if (ep?.localFilePath && onPreload) onPreload(ep.localFilePath)
    },
  })

  const filteredEpisodes = React.useMemo(() => {
    let result = episodes
    if (typeFilter === "canon") result = result.filter(ep => ep.episodeType !== "Filler")
    if (typeFilter === "filler") result = result.filter(ep => ep.episodeType === "Filler")
    if (typeFilter === "unwatched") result = result.filter(ep => !ep.isWatched)

    if (!searchQuery.trim()) return result
    const query = searchQuery.toLowerCase().trim()
    return result.filter(ep => {
      const matchesNumber = (ep.number?.toString() ?? "").includes(query)
      const matchesTitle = (ep.title?.toLowerCase() ?? "").includes(query)
      return matchesNumber || matchesTitle
    })
  }, [episodes, searchQuery, typeFilter])

  const hasLocalEpisodes = episodes.length > 0
  const navigate = useNavigate()

  // Sin archivos locales: panel SectionBar con CTA (§5.7) en vez de caja dashed.
  if (!hasLocalEpisodes) {
    return (
      <div className="flex flex-col gap-4 mt-6 animate-fade-in">
        <div className="sectionbar flex flex-col items-center justify-center text-center px-6 py-12 md:py-16">
          <div className="w-12 h-12 rounded-2xl bg-brand-accent/10 border border-brand-accent/25 flex items-center justify-center mb-4 shadow-[0_0_12px_hsl(var(--brand-accent)/0.15)]">
            <IconStatusFolderPlus className="w-6 h-6 text-brand-accent" />
          </div>
          <p className="sectionbar-header-title !text-sm">No hay episodios detectados</p>
          <p className="text-xs text-on-surface-variant mt-1.5 max-w-sm leading-relaxed font-medium">
            No encontramos archivos locales {activeSagaId ? "en esta saga" : "en esta serie"}. Agrega los archivos a tu biblioteca y re-escanea para verlos aquí.
          </p>
          <button
            type="button"
            onClick={() => navigate({ to: "/settings" })}
            className="mt-6 px-6 py-2.5 rounded-full bg-brand-accent text-white font-display text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-[var(--shadow-brand-primary)] cursor-pointer"
          >
            Configurar biblioteca
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 mt-6">
      {/* ── Saga Metrics Header ──────────────────────────────────────────────── */}
      {sagaProgress && sagaProgress.total > 0 && (
        <div className="flex items-center justify-between gap-4 px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-overlay-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse shrink-0" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 truncate">
              <span className="text-white font-semibold">{sagaProgress.watched}</span> / {sagaProgress.total} EPISODIOS VISTOS
            </span>
            {fillerStats && fillerStats.filler > 0 && (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-status-warning/10 text-status-warning border border-status-warning/20 uppercase tracking-wider shrink-0">
                {fillerStats.filler} RELLENO{fillerStats.filler !== 1 ? "S" : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 w-36 sm:w-48 shrink-0">
            <div className="flex-1">
              <WatchProgressBar percent={sagaProgress.percent} variant="compact" animateOnMount />
            </div>
            <span className="text-xs font-mono font-bold text-brand-accent shrink-0">
              {sagaProgress.percent}%
            </span>
          </div>
        </div>
      )}

      {/* ── Active Sub-saga Indicator ────────────────────────────────────────── */}
      {activeSubSagaStart != null && activeSubSagaEnd != null && (
        <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-brand-accent/[0.08] border border-brand-accent/25">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-accent shrink-0" />
            <span className="text-xs font-semibold text-white truncate">
              Arco activo · Eps {activeSubSagaStart}–{activeSubSagaEnd}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setTypeFilter("all")}
            className="text-[10px] font-mono font-bold text-zinc-400 hover:text-white uppercase tracking-wider shrink-0 transition-colors cursor-pointer"
          >
            Ver todos
          </button>
        </div>
      )}

      {/* ── Search and Filters ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input — Sculpted Glass */}
        <div className="relative flex-1">
          <div
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none"
          >
            <IconNavigationSearch />
          </div>
          <input
            type="text"
            placeholder="Buscar episodio... (/)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className={cn(
              "w-full pl-10 pr-10 py-2.5 rounded-full text-xs font-medium",
              "bg-zinc-950/45 border border-white/20 border-t-white/40 border-b-white/10 backdrop-blur-overlay-2xl text-white placeholder-zinc-500 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.2)]",
              "focus:outline-none focus:ring-0 focus:border-white/50",
              "hover:border-white/30",
              "transition-all duration-200 ease-out",
              isSearchFocused && "bg-zinc-900/70 border-white/50 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.3),0_0_14px_rgba(255,255,255,0.1)]",
            )}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors cursor-pointer animate-scale-in"
              aria-label="Limpiar búsqueda"
            >
              <IconUiClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Type Filter Capsule */}
        <div className="flex bg-zinc-950/45 border border-white/20 border-t-white/40 border-b-white/10 rounded-full p-1 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.25)] backdrop-blur-overlay-2xl overflow-x-auto hide-scrollbar shrink-0 gap-1">
          {[
            { id: "all" as const, label: "Todos" },
            { id: "canon" as const, label: "Canon" },
            { id: "filler" as const, label: "Relleno" },
            { id: "unwatched" as const, label: "No vistos" }
          ].map(f => {
            const isSelected = typeFilter === f.id
            return (
              <button
                key={f.id}
                onClick={() => setTypeFilter(f.id)}
                className={cn(
                  "relative px-3.5 py-1 text-xs font-mono font-bold uppercase tracking-wider rounded-full transition-all whitespace-nowrap cursor-pointer select-none",
                  isSelected
                    ? "text-zinc-950 font-extrabold bg-white/95 shadow-[0_2px_10px_rgba(255,255,255,0.3),inset_0_1px_1px_rgba(255,255,255,1)]"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.06]"
                )}
              >
                <span className="relative z-10">{f.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Results count */}
      {searchQuery && (
        <div className="text-label-sm text-on-surface-variant px-1">
          {filteredEpisodes.length} de {episodes.length} episodios
        </div>
      )}

      {/* Episode List — instancia estable, sin remount al cambiar saga */}
      {filteredEpisodes.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-12 text-on-surface-variant animate-fade-in"
        >
          <IconNavigationSearch className="w-8 h-8 mb-3 opacity-50" />
          <p className="text-sm font-medium">No se encontraron episodios</p>
          <p className="text-xs text-on-surface-variant/70 mt-1">Intenta con otro término de búsqueda</p>
        </div>
      ) : (
        <EpisodeVirtualList
            filteredEpisodes={filteredEpisodes}
            activeSubSagaStart={activeSubSagaStart}
            activeSubSagaEnd={activeSubSagaEnd}
            ts={ts}
            onPlay={onPlay}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            scrollElement={scrollElement}
        />
      )}
    </div>
  )
}
)

PremiumEpisodeList.displayName = "PremiumEpisodeList"

function EpisodeVirtualList({
    filteredEpisodes, activeSubSagaStart, activeSubSagaEnd, ts, onPlay, onMouseEnter, onMouseLeave, scrollElement
}: {
    filteredEpisodes: PremiumEpisode[]
    activeSubSagaStart?: number
    activeSubSagaEnd?: number
    ts: ReturnType<typeof useThemeSettings>
    onPlay?: (episodeNumber: number) => void
    onMouseEnter: (id: string) => void
    onMouseLeave: (id: string) => void
    scrollElement?: Element | null
}) {
    const listRef = React.useRef<HTMLDivElement>(null)
    const [scrollMargin, setScrollMargin] = React.useState(() => {
        if (typeof window === "undefined") return 0
        return window.innerWidth < 768 ? 550 : 700
    })

    const getScrollElement = React.useCallback(() => {
        return scrollElement ?? null
    }, [scrollElement])

    React.useLayoutEffect(() => {
        const el = listRef.current
        if (!el || !scrollElement) return

        // Distancia entre el tope de la lista y el tope del contenido scrolleable (sin forzar reflow).
        const updateOffset = () => {
            if (!listRef.current || !scrollElement) return
            let top = 0
            let node: HTMLElement | null = listRef.current
            while (node && node !== scrollElement && node !== document.body) {
                top += node.offsetTop
                node = node.offsetParent as HTMLElement | null
            }
            if (top > 0) {
                setScrollMargin(prev => (Math.abs(prev - top) <= 1 ? prev : top))
            }
        }
        updateOffset()

        window.addEventListener("resize", updateOffset, { passive: true })
        return () => {
            window.removeEventListener("resize", updateOffset)
        }
    }, [scrollElement])

    const estimateSize = React.useCallback(() => {
        if (ts.themeUseLegacyEpisodeCard) return 96 + ROW_GAP_PX
        if (typeof window !== "undefined") {
            if (window.innerWidth < 640) return 90 + ROW_GAP_PX
            if (window.innerWidth < 768) return 134 + ROW_GAP_PX
            return 164 + ROW_GAP_PX
        }
        return 164 + ROW_GAP_PX
    }, [ts.themeUseLegacyEpisodeCard])

    const virtualizer = useVirtualizer({
        count: filteredEpisodes.length,
        getScrollElement,
        estimateSize,
        initialRect: {
            width: typeof window !== "undefined" ? window.innerWidth : 1280,
            height: typeof window !== "undefined" ? window.innerHeight : 800,
        },
        overscan: 6,
        scrollMargin,
        useFlushSync: false,
    })



interface EpisodeVirtualRowProps {
    ep: PremiumEpisode
    isHighlighted: boolean
    virtualStart: number
    scrollMargin: number
    priority?: boolean
    themeUseLegacyEpisodeCard?: boolean
    themeHideEpisodeCardDescription?: boolean
    themeHideDownloadedEpisodeCardFilename?: boolean
    onPlay?: (episodeNumber: number) => void
    onMouseEnter: (id: string) => void
    onMouseLeave: (id: string) => void
}

const MemoizedEpisodeRow = React.memo(function MemoizedEpisodeRow({
    ep,
    isHighlighted,
    virtualStart,
    scrollMargin,
    priority = false,
    themeUseLegacyEpisodeCard,
    themeHideEpisodeCardDescription,
    themeHideDownloadedEpisodeCardFilename,
    onPlay,
    onMouseEnter,
    onMouseLeave,
}: EpisodeVirtualRowProps) {
    const handlePlay = React.useCallback(() => {
        onPlay?.(ep.number)
    }, [onPlay, ep.number])

    const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onPlay?.(ep.number)
        }
    }, [onPlay, ep.number])

    const handleMouseEnter = React.useCallback(() => {
        onMouseEnter(ep.id)
    }, [onMouseEnter, ep.id])

    const handleMouseLeave = React.useCallback(() => {
        onMouseLeave(ep.id)
    }, [onMouseLeave, ep.id])

    const [currentThumbnail, setCurrentThumbnail] = React.useState(ep.thumbnailUrl)

    React.useEffect(() => {
        setCurrentThumbnail(ep.thumbnailUrl)
    }, [ep.thumbnailUrl])

    const handleThumbnailError = React.useCallback(() => {
        console.warn(`[Thumbnail] Error cargando miniatura de EP ${ep.number}:`, ep.thumbnailUrl)
        if (ep.fallbackThumbnailUrl && currentThumbnail !== ep.fallbackThumbnailUrl) {
            console.info(`[Thumbnail] Usando miniatura de respaldo para EP ${ep.number}:`, ep.fallbackThumbnailUrl)
            setCurrentThumbnail(ep.fallbackThumbnailUrl)
        }
    }, [ep.number, ep.thumbnailUrl, ep.fallbackThumbnailUrl, currentThumbnail])

    return (
        <div
            className="absolute top-0 left-0 w-full pb-4"
            style={{
                transform: `translate3d(0, ${virtualStart - scrollMargin}px, 0)`,
                contain: "layout style paint",
            }}
        >
            <div className="h-full">
                <div
                    id={`episode-${ep.number}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Episodio ${ep.number}, ${ep.title}${ep.isWatched ? ", visto" : ""}`}
                    onClick={handlePlay}
                    onKeyDown={handleKeyDown}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    className={cn(
                        // Sin elevación animada en hover: el cambio de shadow
                        // repinta la fila completa; con fondo/borde alcanza.
                        "h-full group flex gap-2.5 sm:gap-4 rounded-xl cursor-pointer transition-[background-color,border-color,color,transform] duration-200 ease-out active:scale-95",
                        themeUseLegacyEpisodeCard ? "p-2 items-center" : "p-2.5 sm:p-3",
                        "border",
                        !themeUseLegacyEpisodeCard && "shadow-card",
                        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent/70",
                        isHighlighted
                            ? "bg-white/[0.08] border border-white/30 border-t-white/50 border-l-[3px] border-l-brand-accent shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_16px_rgba(0,0,0,0.5)] text-white"
                            : "bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 hover:border-white/20 hover:border-t-white/35 text-zinc-300 hover:text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]",
                    )}
                >
                    {/* Left Thumbnail (Desktop) / Minimalist Icon (Mobile) */}
                    <div className="relative aspect-[16/10] w-28 sm:w-44 md:w-56 shrink-0 rounded-lg overflow-hidden bg-zinc-900 border border-white/10 flex items-center justify-center">
                        {currentThumbnail ? (
                            <DeferredImage
                                src={currentThumbnail}
                                alt={ep.title}
                                priority={priority}
                                className="w-full h-full"
                                imgClassName="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
                                showSkeleton={true}
                                onError={handleThumbnailError}
                                fallback={
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900/95 text-zinc-300 relative select-none border border-white/5">
                                        <div className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center mb-1.5 shadow-sm">
                                            <IconMediaPlay className="w-4 h-4 ml-0.5 text-zinc-200" />
                                        </div>
                                        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-300">EP {ep.number}</span>
                                    </div>
                                }
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900/95 text-zinc-300 relative select-none border border-white/5">
                                <div className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center mb-1.5 shadow-sm">
                                    <IconMediaPlay className="w-4 h-4 ml-0.5 text-zinc-200" />
                                </div>
                                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-300">EP {ep.number}</span>
                            </div>
                        )}

                        {/* Play Overlay */}
                        <div className="absolute inset-0 bg-scrim/40 opacity-0 group-hover:opacity-100 transition-opacity duration-base flex items-center justify-center backdrop-blur-overlay-xs pointer-events-none">
                            <div className="w-10 h-10 rounded-full bg-brand-accent text-on-primary flex items-center justify-center shadow-lg transform group-hover:scale-110 active:scale-95 transition-transform">
                                <IconMediaPlay className="w-5 h-5 ml-0.5 fill-current" />
                            </div>
                        </div>
                    </div>

                    {/* Episode Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-label-sm font-black text-brand-accent tracking-wider uppercase font-mono">
                                EP {ep.number}
                            </span>
                            <span className="text-zinc-600 text-xs">•</span>
                            <span className="text-xs text-zinc-400 font-medium">
                                {ep.duration ? `${ep.duration} min` : "24 min"}
                            </span>

                            {/* Type Badge */}
                            {ep.episodeType === 'Filler' && (
                                <EpisodeBadge variant="filler">Relleno</EpisodeBadge>
                            )}
                            {ep.episodeType === 'Hyped' && (
                                <EpisodeBadge variant="premium" className="shadow-brand-secondary">Premium</EpisodeBadge>
                            )}

                            {ep.resolution && (
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-400 border border-white/[0.06] uppercase">
                                    {ep.resolution}
                                </span>
                            )}
                            {ep.videoCodec && (
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-500 border border-white/[0.06] uppercase">
                                    {ep.videoCodec}
                                </span>
                            )}

                        </div>
                        <h3 className="font-bold text-sm sm:text-base text-on-surface group-hover:text-brand-accent transition-colors truncate">
                            {ep.title}
                        </h3>

                        {!themeUseLegacyEpisodeCard && !themeHideEpisodeCardDescription && (
                            <p className="text-sm text-on-surface-variant line-clamp-2 mb-2 leading-relaxed">
                                {ep.description}
                            </p>
                        )}

                        {!themeHideDownloadedEpisodeCardFilename && ep.localFilePath && (
                            <p className="text-label-sm font-numeric text-on-surface-variant/50 truncate mb-1">
                                {ep.localFilePath.split(/[\\\/]/).pop()}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
})

    return (
        <div ref={listRef} className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
                const ep = filteredEpisodes[virtualRow.index]
                const isHighlighted = activeSubSagaStart != null &&
                                    activeSubSagaEnd != null &&
                                    ep.number >= activeSubSagaStart &&
                                    ep.number <= activeSubSagaEnd;

                return (
                    <MemoizedEpisodeRow
                        key={ep.id}
                        ep={ep}
                        isHighlighted={isHighlighted}
                        virtualStart={virtualRow.start}
                        scrollMargin={virtualizer.options.scrollMargin || 0}
                        priority={virtualRow.index < 4}
                        themeUseLegacyEpisodeCard={ts.themeUseLegacyEpisodeCard}
                        themeHideEpisodeCardDescription={ts.themeHideEpisodeCardDescription}
                        themeHideDownloadedEpisodeCardFilename={ts.themeHideDownloadedEpisodeCardFilename}
                        onPlay={onPlay}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                    />
                )
            })}
        </div>
    )
}
