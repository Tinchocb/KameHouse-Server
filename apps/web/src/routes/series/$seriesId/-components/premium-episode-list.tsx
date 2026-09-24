"use no memo"
import React from "react"
import { useNavigate } from "@tanstack/react-router"
import { EpisodeBadge } from "@/components/ui/episode-badge"
import { IconStatusFolderPlus, IconNavigationSearch, IconUiClose, IconMediaPlay, IconUiListPlus } from "@/components/ui/icons";
import type { PremiumEpisode } from "@/api/types/series.types"
import { cn } from "@/components/ui/core/styling"
import { useHoverPreload } from "@/hooks/use-hover-preload"
import { useThemeSettings } from "@/lib/theme/theme-hooks"
import { useVirtualizer } from "@tanstack/react-virtual"
import { DeferredImage } from "@/components/shared/deferred-image"
import { WatchProgressBar } from "@/components/ui/watch-progress-bar"
import { MagneticIndicator, ElasticCounter } from "@/components/ui/kinetics"
import { useQueueStore } from "@/lib/store"
import { toast } from "sonner"

// Alto del `pb-4` de cada fila, que estimateSize tiene que contar junto con la tarjeta.
const ROW_GAP_PX = 16


interface PremiumEpisodeListProps {
  episodes: PremiumEpisode[]
  activeSagaId?: string
  activeSubSagaStart?: number
  activeSubSagaEnd?: number
  onPlay?: (episodeNumber: number) => void
  onPreload?: (filePath: string) => void
  /** MediaId real de la serie: la cola y la continuidad lo necesitan (el id del episodio NO es mediaId). */
  seriesMediaId?: number
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
  seriesMediaId,
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
      <div className="flex flex-col gap-4 animate-fade-in">
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
            className="mt-6 px-6 py-2.5 rounded-full bg-brand-accent text-on-primary font-display text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-brand-primary cursor-pointer"
          >
            Configurar biblioteca
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Saga Metrics Header ──────────────────────────────────────────────── */}
      {sagaProgress && sagaProgress.total > 0 && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 min-h-[60px] rounded-2xl bg-gradient-to-r from-zinc-900/60 via-zinc-900/40 to-zinc-950/60 border border-white/[0.12] shadow-[0_4px_20px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-2 h-2 rounded-full bg-brand-accent shadow-[0_0_8px_hsl(var(--brand-accent))] animate-pulse shrink-0" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 truncate">
              <span className="text-white font-extrabold">{sagaProgress.watched}</span> / {sagaProgress.total} EPISODIOS VISTOS
            </span>
            {fillerStats && fillerStats.filler > 0 && (
              <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-400 border border-amber-400/25 uppercase tracking-wider shrink-0">
                {fillerStats.filler} RELLENO{fillerStats.filler !== 1 ? "S" : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 w-36 sm:w-48 shrink-0">
            <div className="flex-1">
              <WatchProgressBar percent={sagaProgress.percent} variant="compact" animateOnMount />
            </div>
            <span className="text-xs font-mono font-extrabold text-brand-accent shrink-0">
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
            className="text-3xs font-mono font-bold text-on-surface-variant hover:text-white uppercase tracking-wider shrink-0 transition-colors cursor-pointer"
          >
            Ver todos
          </button>
        </div>
      )}

      {/* ── Search and Filters ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input — Sculpted Glass */}
        <div className="relative flex-1">
          {/* z-10: el input tiene backdrop-blur (contexto de apilamiento propio) y,
              al venir después en el DOM, se pintaba encima del ícono. */}
          <div
            className="absolute left-3.5 top-1/2 -translate-y-1/2 z-10 w-4 h-4 text-zinc-400 pointer-events-none"
          >
            <IconNavigationSearch className="w-4 h-4" />
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
              "bg-zinc-900/50 border border-white/[0.12] backdrop-blur-xl text-white placeholder:text-zinc-500 shadow-glass-highlight-sm",
              "focus:outline-none focus:ring-0 focus:border-white/40 focus:bg-zinc-900/80",
              "hover:border-white/25",
              "transition-all duration-200 ease-out",
              isSearchFocused && "bg-zinc-900/90 border-white/50 shadow-[shadow:var(--glass-highlight-md),0_0_16px_rgba(255,255,255,0.08)]",
            )}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors cursor-pointer animate-scale-in"
              aria-label="Limpiar búsqueda"
            >
              <IconUiClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Type Filter Capsule */}
        <div className="flex bg-zinc-900/50 border border-white/[0.12] rounded-full p-1 shadow-glass-highlight-sm backdrop-blur-xl overflow-x-auto hide-scrollbar shrink-0 gap-1">
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
                  "relative px-3.5 py-1 text-xs font-mono font-bold uppercase tracking-wider rounded-full transition-colors whitespace-nowrap cursor-pointer select-none",
                  isSelected
                    ? "text-zinc-950 font-extrabold"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.08]"
                )}
              >
                {isSelected && (
                  <MagneticIndicator
                    layoutId="activeEpisodeFilterCapsule"
                    className="bg-white shadow-md rounded-full"
                  />
                )}
                <span className="relative z-10">{f.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Results count */}
      {searchQuery && (
        <div className="text-label-sm text-on-surface-variant px-1 flex items-center gap-1 font-mono">
          <ElasticCounter value={filteredEpisodes.length} />
          <span>de {episodes.length} episodios</span>
        </div>
      )}

      {/* Episode List — instancia estable, sin remount al cambiar saga */}
      {filteredEpisodes.length === 0 ? (
        <div className="sectionbar flex flex-col items-center justify-center text-center p-8 sm:p-12 animate-fade-in">
          <div className="w-12 h-12 rounded-2xl bg-brand-accent/10 border border-brand-accent/25 flex items-center justify-center mb-4 shadow-[0_0_12px_hsl(var(--brand-accent)/0.15)]">
            <IconNavigationSearch className="w-6 h-6 text-brand-accent" />
          </div>
          <p className="sectionbar-header-title !text-sm">No se encontraron episodios</p>
          <p className="text-xs text-on-surface-variant mt-1.5 max-w-sm leading-relaxed font-medium">
            No hay coincidencias para los filtros actuales. Prueba con otro término de búsqueda o restablece los filtros.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("")
              setTypeFilter("all")
            }}
            className="mt-6 px-6 py-2.5 rounded-full bg-brand-accent text-on-primary font-display text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-[transform,filter] duration-base ease-smooth-out shadow-brand-primary cursor-pointer"
          >
            Restablecer filtros
          </button>
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
            seriesMediaId={seriesMediaId}
        />
      )}
    </div>
  )
}
)

PremiumEpisodeList.displayName = "PremiumEpisodeList"

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
    seriesMediaId?: number
}

function cleanEpisodeTitle(title: string | undefined): string {
    if (!title) return ""
    return title
        .replace(/^[«"'\s]+|[»"'\s]+$/g, "")
        .replace(/^«\s*/, "")
        .replace(/\s*»$/, "")
        .trim()
}

const MemoizedEpisodeRow = React.memo(function MemoizedEpisodeRow({
    ep,
    isHighlighted,
    virtualStart,
    scrollMargin,
    priority = false,
    themeUseLegacyEpisodeCard,
    themeHideEpisodeCardDescription,
    themeHideDownloadedEpisodeCardFilename: _themeHideDownloadedEpisodeCardFilename,
    onPlay,
    onMouseEnter,
    onMouseLeave,
    seriesMediaId,
}: EpisodeVirtualRowProps) {
    const handlePlay = React.useCallback(() => {
        onPlay?.(ep.number)
    }, [onPlay, ep.number])

    const handleMouseEnter = React.useCallback(() => {
        onMouseEnter(ep.id)
    }, [onMouseEnter, ep.id])

    const handleMouseLeave = React.useCallback(() => {
        onMouseLeave(ep.id)
    }, [onMouseLeave, ep.id])

    const [currentThumbnail, setCurrentThumbnail] = React.useState(ep.thumbnailUrl)
    const [prevThumbnailUrl, setPrevThumbnailUrl] = React.useState(ep.thumbnailUrl)

    if (ep.thumbnailUrl !== prevThumbnailUrl) {
        setPrevThumbnailUrl(ep.thumbnailUrl)
        setCurrentThumbnail(ep.thumbnailUrl)
    }

    const handleThumbnailError = React.useCallback(() => {
        console.warn(`[Thumbnail] Error cargando miniatura de EP ${ep.number}:`, ep.thumbnailUrl)
        if (ep.fallbackThumbnailUrl && currentThumbnail !== ep.fallbackThumbnailUrl) {
            setCurrentThumbnail(ep.fallbackThumbnailUrl)
        }
    }, [ep.number, ep.thumbnailUrl, ep.fallbackThumbnailUrl, currentThumbnail])

    const displayTitle = cleanEpisodeTitle(ep.title) || `Episodio ${ep.number}`

    const handleQuickQueue = React.useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        if (!ep.localFilePath) {
            toast.error("Archivo no disponible.")
            return
        }
        // mediaId debe ser el de la SERIE (continuidad/player lo usan para el
        // sync); el id del episodio es solo número de episodio. El id del item
        // coincide con el de SeriesHero para que la cola deduplique.
        const queueMediaId = seriesMediaId && seriesMediaId > 0 ? seriesMediaId : (Number(ep.id) || ep.number)
        useQueueStore.getState().addToQueue({
            id: queueMediaId,
            title: displayTitle,
            playableUrl: ep.localFilePath,
            thumbnail: currentThumbnail || "",
            mediaId: queueMediaId,
            episodeNumber: ep.number,
        })
        toast.success("Añadido a la cola", { description: displayTitle })
    }, [ep.id, ep.number, ep.localFilePath, displayTitle, currentThumbnail, seriesMediaId])

    return (
        <div
            className="absolute top-0 left-0 w-full pb-3.5 sm:pb-4"
            style={{
                transform: `translate3d(0, ${virtualStart - scrollMargin}px, 0)`,
                contain: "layout style paint",
            }}
        >
            <div className="h-full">
                    <article
                        id={`episode-${ep.number}`}
                        aria-labelledby={`episode-title-${ep.number}`}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        className={cn(
                            "group h-full w-full flex items-stretch gap-2 p-3 sm:p-3.5 rounded-2xl select-none",
                            "border transition-colors duration-200",
                            isHighlighted
                                ? "bg-zinc-900/95 border-brand-accent/50 shadow-[0_6px_28px_rgba(0,0,0,0.7),0_0_16px_hsl(var(--brand-accent)/0.2)] ring-1 ring-brand-accent/30"
                                : "bg-gradient-to-r from-zinc-900/50 via-zinc-900/35 to-zinc-950/50 border-white/[0.09] hover:border-white/20 hover:bg-zinc-900/70 shadow-[shadow:0_6px_24px_rgba(0,0,0,0.5),var(--glass-highlight-sm)]"
                        )}
                    >
                        <button
                            type="button"
                            onClick={handlePlay}
                            aria-label={`Reproducir episodio ${ep.number}, ${displayTitle}${ep.isWatched ? ", visto" : ""}`}
                            className="flex flex-1 min-w-0 items-stretch gap-3.5 sm:gap-5 text-left cursor-pointer rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent/70"
                        >
                        {/* Thumbnail en proporción cinematográfica 16/9 */}
                        <div className="relative aspect-[16/9] w-32 sm:w-48 md:w-56 lg:w-60 shrink-0 rounded-xl overflow-hidden border border-white/10 bg-zinc-950 shadow-md">
                            {currentThumbnail ? (
                                <DeferredImage
                                    src={currentThumbnail}
                                    alt={displayTitle}
                                    priority={priority}
                                    loading={priority ? "eager" : "lazy"}
                                    decoding="async"
                                    className="w-full h-full"
                                    imgClassName="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    showSkeleton={true}
                                    onError={handleThumbnailError}
                                    fallback={
                                        <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-zinc-900">
                                            <div className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center mb-1.5 shadow-sm">
                                                <IconMediaPlay className="w-4 h-4 ml-0.5 text-zinc-300" />
                                            </div>
                                            <span className="text-2xs font-mono font-bold uppercase tracking-wider text-zinc-400">EP {ep.number}</span>
                                        </div>
                                    }
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-zinc-900">
                                    <div className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center mb-1.5 shadow-sm">
                                        <IconMediaPlay className="w-4 h-4 ml-0.5 text-zinc-300" />
                                    </div>
                                    <span className="text-2xs font-mono font-bold uppercase tracking-wider text-zinc-400">EP {ep.number}</span>
                                </div>
                            )}

                            {/* Scrim interno del thumbnail */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent z-10 pointer-events-none" />

                            {/* Badge de "VISTO" si ya fue reproducido */}
                            {ep.isWatched && (
                                <div className="absolute top-2 right-2 z-20 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md border border-emerald-500/30 text-3xs font-mono font-bold text-emerald-400 flex items-center gap-1 shadow-sm">
                                    <svg className="w-3 h-3 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>VISTO</span>
                                </div>
                            )}

                            {/* Progress bar en thumbnail */}
                            {ep.isWatched || (ep.progressPercent != null && ep.progressPercent > 0 && ep.progressPercent < 100) ? (
                                <div className="absolute bottom-0 inset-x-0 h-1 bg-black/70 z-20 pointer-events-none">
                                    <div
                                        className="h-full bg-brand-accent shadow-[0_0_6px_hsl(var(--brand-accent)/0.8)] [transition:width_var(--duration-fast)_var(--ease-smooth-out)]"
                                        style={{ width: `${ep.isWatched ? 100 : (ep.progressPercent || 0)}%` }}
                                    />
                                </div>
                            ) : null}
                        </div>

                        {/* Episode Info */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                            {/* Title over Episode */}
                            <span id={`episode-title-${ep.number}`} className="block font-display text-sm sm:text-base font-bold uppercase tracking-wide leading-snug line-clamp-1 sm:line-clamp-2 text-zinc-100 group-hover:text-white transition-colors">
                                {displayTitle}
                            </span>

                            {/* Episode Badges Row */}
                            <div className="flex items-center gap-2 mt-1.5 mb-1 flex-wrap">
                                <span className="px-2 py-0.5 rounded-md bg-brand-accent/15 border border-brand-accent/30 text-brand-accent text-2xs font-mono font-bold tracking-wider">
                                    EP {ep.number}
                                </span>
                                <span className="text-zinc-500 text-xs font-mono font-medium">
                                    {ep.duration ? `${ep.duration} min` : "24 min"}
                                </span>

                                {/* Type Badges */}
                                {ep.episodeType === 'Filler' && (
                                    <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-400 border border-amber-400/30 uppercase tracking-wider">
                                        Relleno
                                    </span>
                                )}
                                {ep.episodeType === 'Hyped' && (
                                    <EpisodeBadge variant="premium" className="shadow-brand-secondary">
                                        Destacado
                                    </EpisodeBadge>
                                )}
                            </div>

                            {/* Description */}
                            {!themeUseLegacyEpisodeCard && !themeHideEpisodeCardDescription && ep.description && (
                                <span className="text-xs sm:text-sm text-zinc-400 line-clamp-2 leading-relaxed mt-1">
                                    {ep.description}
                                </span>
                            )}
                        </div>
                        </button>
                        {/* Acciones rápidas: hermanas del botón principal, no anidadas */}
                        <div className="flex flex-col items-center justify-center gap-2 shrink-0">
                                    <button
                                        type="button"
                                        onClick={handleQuickQueue}
                                        aria-label="Añadir a la cola"
                                        title="Añadir a la cola"
                                        className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-white/[0.06] border border-white/15 text-zinc-300 flex items-center justify-center hover:bg-white/[0.12] hover:text-white hover:border-white/30 active:scale-95 transition-all cursor-pointer"
                                    >
                                        <IconUiListPlus className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handlePlay}
                                        aria-label="Reproducir episodio"
                                        title="Reproducir"
                                        className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-brand-accent text-on-primary flex items-center justify-center hover:brightness-110 active:scale-95 transition-all shadow-brand-primary cursor-pointer"
                                    >
                                        <IconMediaPlay className="w-4 h-4 ml-px" />
                                    </button>
                        </div>
                    </article>
            </div>
        </div>
    )
})

interface EpisodeVirtualListProps {
    filteredEpisodes: PremiumEpisode[]
    activeSubSagaStart?: number
    activeSubSagaEnd?: number
    ts: ReturnType<typeof useThemeSettings>
    onPlay?: (episodeNumber: number) => void
    onMouseEnter: (id: string) => void
    onMouseLeave: (id: string) => void
    scrollElement?: Element | null
    seriesMediaId?: number
}

function EpisodeVirtualList({
    filteredEpisodes,
    activeSubSagaStart,
    activeSubSagaEnd,
    ts,
    onPlay,
    onMouseEnter,
    onMouseLeave,
    scrollElement,
    seriesMediaId,
}: EpisodeVirtualListProps) {
    const listRef = React.useRef<HTMLDivElement>(null)
    const [scrollMargin, setScrollMargin] = React.useState(() => {
        if (typeof window === "undefined") return 0
        return window.innerWidth < 768 ? 550 : 700
    })

    const getScrollElement = React.useCallback(() => {
        return (
            (scrollElement as HTMLElement | null) ??
            listRef.current?.closest("main") ??
            listRef.current?.parentElement ??
            (typeof document !== "undefined" ? document.documentElement : null)
        )
    }, [scrollElement])

    React.useLayoutEffect(() => {
        const el = listRef.current
        const scrollEl = (scrollElement as HTMLElement | null) ?? el?.closest("main") ?? el?.parentElement
        if (!el || !scrollEl) return

        const updateOffset = () => {
            if (!listRef.current || !scrollEl) return
            let top = 0
            let node: HTMLElement | null = listRef.current
            while (node && node !== scrollEl && node !== document.body) {
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

    // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer devuelve funciones no memoizables por diseño; React Compiler lo omite a proposito.
    const virtualizer = useVirtualizer({
        count: filteredEpisodes.length,
        getScrollElement,
        estimateSize,
        initialRect: {
            width: typeof window !== "undefined" ? window.innerWidth : 1280,
            height: typeof window !== "undefined" ? window.innerHeight : 800,
        },
        overscan: 5,
        scrollMargin,
        useFlushSync: false,
    })

    const prevActiveSubSagaStart = React.useRef<number | undefined>(undefined)
    React.useEffect(() => {
        if (activeSubSagaStart != null && activeSubSagaStart !== prevActiveSubSagaStart.current) {
            prevActiveSubSagaStart.current = activeSubSagaStart
            const targetIndex = filteredEpisodes.findIndex(e => e.number === activeSubSagaStart)
            if (targetIndex >= 0) {
                virtualizer.scrollToIndex(targetIndex, { align: "start", behavior: "smooth" })
            }
        }
    }, [activeSubSagaStart, filteredEpisodes, virtualizer])

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
                        seriesMediaId={seriesMediaId}
                    />
                )
            })}
        </div>
    )
}
