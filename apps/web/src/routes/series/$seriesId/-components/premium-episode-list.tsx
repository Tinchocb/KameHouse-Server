import React from "react"
import { useNavigate } from "@tanstack/react-router"
import { EpisodeBadge } from "@/components/ui/episode-badge"
import { IconStatusFolderPlus, IconNavigationSearch, IconUiClose, IconMediaPlay, IconUiListPlus, IconUiCheck } from "@/components/ui/icons";
import type { PremiumEpisode } from "@/api/types/series.types"
import { cn } from "@/components/ui/core/styling"
import { IconButton } from "@/components/ui/button"
import { useHoverPreload } from "@/hooks/use-hover-preload"
import { useThemeSettings } from "@/lib/theme/theme-hooks"
import { useIsMinimalistMode } from "@/lib/theme/use-classic-mode"
import { DeferredImage } from "@/components/shared/deferred-image"
import { ElasticCounter, IconSwap } from "@/components/ui/kinetics"
import { isImageLoaded } from "@/lib/helpers/images"
import { toast } from "sonner"
import { useQueueStore } from "@/lib/store"
import { cleanEpisodeTitle } from "../-hooks/use-series-data"
import { useSagaEpisodesReady } from "../-hooks/use-saga-episodes-ready"
import { EpisodeVirtualList, type EpisodeVirtualRowProps } from "./episode-virtual-list"

// Ancho real de la miniatura por breakpoint (w-32 / sm:w-48 / md:w-56 / lg:w-60).
const THUMBNAIL_SIZES = "(max-width: 639px) 128px, (max-width: 767px) 192px, (max-width: 1023px) 224px, 240px"
const THUMBNAIL_TRANSITION: React.CSSProperties = {
    transition: "opacity 450ms var(--ease-out), transform 500ms var(--ease-out)",
}
const NO_EPISODES: PremiumEpisode[] = []

/** Primera carga de la ficha: filas vacías del alto real mientras bajan las miniaturas. */
function EpisodeListSkeleton() {
    return (
        <div aria-busy="true" aria-label="Cargando episodios" className="flex flex-col gap-3.5 sm:gap-4">
            {Array.from({ length: 4 }, (_, i) => (
                <div
                    key={i}
                    className="surface-content flex items-stretch gap-3.5 sm:gap-5 p-3 sm:p-3.5 rounded-2xl h-[150px] sm:h-[142px] md:h-[165px]"
                >
                    <div className="relative aspect-[16/9] w-32 sm:w-48 md:w-56 lg:w-60 shrink-0 rounded-xl bg-surface-container-high animate-pulse motion-reduce:animate-none" />
                    <div className="flex-1 flex flex-col justify-center gap-2">
                        <div className="h-4 w-2/3 rounded-md bg-surface-container-high animate-pulse motion-reduce:animate-none" />
                        <div className="h-3 w-1/3 rounded-md bg-surface-container-high animate-pulse motion-reduce:animate-none" />
                    </div>
                </div>
            ))}
        </div>
    )
}


interface PremiumEpisodeListProps {
  episodes: PremiumEpisode[]
  activeSagaId?: string
  activeSubSagaStart?: number
  activeSubSagaEnd?: number
  onPlay?: (episodeNumber: number) => void
  onPreload?: (filePath: string) => void
  /** MediaId real de la serie: la cola y la continuidad lo necesitan (el id del episodio NO es mediaId). */
  seriesMediaId?: number
  /** Elemento contenedor con scroll (para virtualización correcta) */
  scrollElement?: HTMLElement | null
  /** Callback para limpiar el sub-arco activo */
  onClearSubSaga?: () => void
}

export const PremiumEpisodeList = React.memo(function PremiumEpisodeList({
  episodes,
  activeSagaId,
  activeSubSagaStart,
  activeSubSagaEnd,
  onPlay,
  onPreload,
  seriesMediaId,
  scrollElement,
  onClearSubSaga,
}: PremiumEpisodeListProps) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [isSearchFocused, setIsSearchFocused] = React.useState(false)
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const ts = useThemeSettings()

  const hasKeyboard = React.useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches,
    []
  )

  // Atajo '/' para enfocar el buscador instantáneamente
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault()
        e.stopPropagation()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [])

  // La saga nueva se muestra entera cuando sus primeras miniaturas ya están descargadas;
  // mientras tanto queda la anterior en pantalla (o un esqueleto en la primera carga).
  const { episodes: readyEpisodes, pending: isSagaPending } = useSagaEpisodesReady(
    episodes,
    `${seriesMediaId ?? ""}:${activeSagaId ?? "all"}`,
    THUMBNAIL_SIZES,
  )
  const shownEpisodes = readyEpisodes ?? NO_EPISODES

  const episodesById = React.useMemo(
    () => new Map(episodes.map((e) => [e.id, e])),
    [episodes],
  )

  const { onMouseEnter, onMouseLeave } = useHoverPreload({
    delay: 300,
    onPreload: (epId) => {
      const ep = episodesById.get(epId)
      if (ep?.localFilePath && onPreload) onPreload(ep.localFilePath)
    },
  })

  const filteredEpisodes = React.useMemo(() => {
    if (!searchQuery.trim()) return shownEpisodes
    const query = searchQuery.toLowerCase().trim()
    return shownEpisodes.filter(ep => {
      const matchesNumber = (ep.number?.toString() ?? "").includes(query)
      const matchesTitle = (ep.title?.toLowerCase() ?? "").includes(query)
      return matchesNumber || matchesTitle
    })
  }, [shownEpisodes, searchQuery])

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
            className="mt-6 px-6 py-2.5 rounded-full bg-brand-accent text-on-primary font-display text-xs uppercase tracking-widest hover:brightness-110 motion-safe:active:scale-[0.97] transition-[transform,filter] duration-base ease-smooth-out shadow-brand-primary cursor-pointer"
          >
            Configurar biblioteca
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Active Sub-saga Indicator ────────────────────────────────────────── */}
      {activeSubSagaStart != null && activeSubSagaEnd != null && (
        <div className="episode-active-subsaga-banner flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-brand-accent/[0.08] border border-brand-accent/25">
          <div className="flex items-center gap-2 min-w-0">
            <div className="subsaga-dot w-1.5 h-1.5 rounded-full bg-brand-accent shrink-0" />
            <span className="text-xs font-semibold text-on-surface truncate">
              Arco activo · Eps {activeSubSagaStart}–{activeSubSagaEnd}
            </span>
          </div>
          {onClearSubSaga && (
            <button
              type="button"
              onClick={onClearSubSaga}
              className="text-3xs font-mono font-bold text-on-surface-variant hover:text-on-surface uppercase tracking-wider shrink-0 transition-[color,transform] duration-fast motion-safe:active:scale-[0.97] cursor-pointer"
            >
              Ver todos
            </button>
          )}
        </div>
      )}

      {/* ── Search Bar — Sculpted Glass ────────────────────────────────────── */}
      <div className="relative w-full">
        {/* z-10: el input tiene backdrop-blur (contexto de apilamiento propio) y,
            al venir después en el DOM, se pintaba encima del ícono. */}
        <div
          className="absolute left-3.5 top-1/2 -translate-y-1/2 z-10 w-4 h-4 text-on-surface-variant/70 pointer-events-none flex items-center justify-center"
        >
          <IconNavigationSearch className="w-4 h-4" />
        </div>
        <input
          ref={searchInputRef}
          type="text"
          placeholder={hasKeyboard ? "Buscar episodio… (/)" : "Buscar episodio…"}
          aria-label="Buscar episodio"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          autoComplete="off"
          spellCheck={false}
          className={cn(
            "glass-frosted-pill w-full h-11 pl-10 pr-10 text-xs font-medium text-on-surface placeholder:text-on-surface-variant/60",
            "focus:outline-none focus:border-[var(--glass-border-strong)] focus:ring-1 focus:ring-brand-accent/40",
            "transition-[border-color,box-shadow] duration-base ease-smooth-out",
            isSearchFocused && "border-[var(--glass-border-strong)] shadow-[shadow:var(--double-bezel-shadow)]",
          )}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 min-w-8 min-h-8 w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:text-on-surface motion-safe:active:scale-[0.97] transition-[color,transform] duration-fast ease-smooth-out cursor-pointer animate-scale-in [animation-duration:var(--duration-base)] [animation-timing-function:var(--ease-out)]"
            aria-label="Limpiar búsqueda"
          >
            <IconUiClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results count */}
      {searchQuery && (
        <div className="text-label-sm text-on-surface-variant px-1 flex items-center gap-1 font-mono">
          <ElasticCounter value={filteredEpisodes.length} />
          <span>de {shownEpisodes.length} episodios</span>
        </div>
      )}

      {/* Episode List — instancia estable, sin remount al cambiar saga */}
      {readyEpisodes === null ? (
        <EpisodeListSkeleton />
      ) : filteredEpisodes.length === 0 ? (
        <div className="sectionbar flex flex-col items-center justify-center text-center p-8 sm:p-12 animate-fade-in">
          <div className="w-12 h-12 rounded-2xl bg-brand-accent/10 border border-brand-accent/25 flex items-center justify-center mb-4 shadow-[0_0_12px_hsl(var(--brand-accent)/0.15)]">
            <IconNavigationSearch className="w-6 h-6 text-brand-accent" />
          </div>
          <p className="sectionbar-header-title !text-sm">No se encontraron episodios</p>
          <p className="text-xs text-on-surface-variant mt-1.5 max-w-sm leading-relaxed font-medium">
            {searchQuery
              ? `No hay coincidencias para "${searchQuery}". Prueba con otro número o término de búsqueda.`
              : "No se encontraron episodios en esta selección."}
          </p>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="mt-6 px-6 py-2.5 rounded-full bg-brand-accent text-on-primary font-display text-xs uppercase tracking-widest hover:brightness-110 motion-safe:active:scale-[0.97] transition-[transform,filter] duration-base ease-smooth-out shadow-brand-primary cursor-pointer"
            >
              Limpiar búsqueda
            </button>
          )}
        </div>
      ) : (
        <div
          aria-busy={isSagaPending || undefined}
          inert={isSagaPending}
          className={cn(
            "transition-opacity duration-fast ease-out",
            isSagaPending && "opacity-60 pointer-events-none",
          )}
        >
          <EpisodeVirtualList
              filteredEpisodes={filteredEpisodes}
              activeSubSagaStart={activeSubSagaStart}
              activeSubSagaEnd={activeSubSagaEnd}
              ts={ts}
              onPlay={isSagaPending ? undefined : onPlay}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
              scrollElement={scrollElement}
              seriesMediaId={seriesMediaId}
              RowComponent={MemoizedEpisodeRow}
          />
        </div>
      )}
    </div>
  )
}
)

PremiumEpisodeList.displayName = "PremiumEpisodeList"

/**
 * Lo que se ve en la miniatura mientras carga o si falla: el número del episodio
 * sobre la tarjeta, en vez de un bloque vacío que parpadea. Mientras carga, un
 * brillo recorre la tarjeta (solo transform, en el compositor).
 */
function ThumbnailPlaceholder({ number, loading = false }: { number: number; loading?: boolean }) {
    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-surface-container-high overflow-hidden">
            {loading && (
                <div
                    aria-hidden
                    className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.06] to-transparent motion-reduce:hidden"
                />
            )}
            <div className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center mb-1.5 shadow-[shadow:var(--elevation-1)]">
                <IconMediaPlay className="w-4 h-4 ml-0.5 text-on-surface-variant" />
            </div>
            <span className="text-2xs font-mono font-bold uppercase tracking-wider text-on-surface-variant">EP {number}</span>
        </div>
    )
}

const MemoizedEpisodeRow = React.memo(function MemoizedEpisodeRow({
    ep,
    isHighlighted,
    virtualStart,
    scrollMargin,
    rowIndex,
    measureRef,
    priority = false,
    themeHideEpisodeCardDescription,
    onPlay,
    onMouseEnter,
    onMouseLeave,
    seriesMediaId,
}: EpisodeVirtualRowProps) {
    const isMinimalist = useIsMinimalistMode()
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
    // Una miniatura ya descargada en la sesión (fila que vuelve a montarse) no muestra el brillo de carga.
    const [thumbnailLoaded, setThumbnailLoaded] = React.useState(() => isImageLoaded(ep.thumbnailUrl))

    if (ep.thumbnailUrl !== prevThumbnailUrl) {
        setPrevThumbnailUrl(ep.thumbnailUrl)
        setCurrentThumbnail(ep.thumbnailUrl)
        setThumbnailLoaded(isImageLoaded(ep.thumbnailUrl))
    }

    const handleThumbnailLoad = React.useCallback(() => setThumbnailLoaded(true), [])

    const handleThumbnailError = React.useCallback(() => {
        console.warn(`[Thumbnail] Error cargando miniatura de EP ${ep.number}:`, ep.thumbnailUrl)
        if (ep.fallbackThumbnailUrl && currentThumbnail !== ep.fallbackThumbnailUrl) {
            setCurrentThumbnail(ep.fallbackThumbnailUrl)
        }
    }, [ep.number, ep.thumbnailUrl, ep.fallbackThumbnailUrl, currentThumbnail])

    const displayTitle = cleanEpisodeTitle(ep.title) || `Episodio ${ep.number}`

    const [justQueued, setJustQueued] = React.useState(false)
    const queuedTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    React.useEffect(() => () => {
        if (queuedTimerRef.current) clearTimeout(queuedTimerRef.current)
    }, [])

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
        // Confirmación en el mismo botón (el aviso sale lejos, arriba): el ícono pasa a tilde un momento.
        setJustQueued(true)
        if (queuedTimerRef.current) clearTimeout(queuedTimerRef.current)
        queuedTimerRef.current = setTimeout(() => setJustQueued(false), 1400)
    }, [ep.id, ep.number, ep.localFilePath, displayTitle, currentThumbnail, seriesMediaId])

    return (
        <div
            ref={measureRef}
            data-index={rowIndex}
            className="absolute top-0 left-0 w-full pb-3.5 sm:pb-4"
            style={{
                transform: `translate3d(0, ${virtualStart - scrollMargin}px, 0)`,
                contain: "layout style paint",
            }}
        >
            {/* Sin revelado por fila: la saga se muestra completa de una vez (ver useSagaEpisodesReady). */}
            <div className="h-full">
                {isMinimalist ? (
                    <article
                        id={`episode-${ep.number}`}
                        aria-labelledby={`episode-title-${ep.number}`}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        className="ep-row-item select-none flex items-center justify-between gap-3"
                    >
                        <button
                            type="button"
                            onClick={handlePlay}
                            aria-label={`Reproducir episodio ${ep.number}, ${displayTitle}${ep.isWatched ? ", visto" : ""}`}
                            className="flex flex-1 min-w-0 items-center gap-3.5 sm:gap-4 text-left cursor-pointer rounded-xl transition-transform duration-fast ease-out-strong motion-safe:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent p-1"
                        >
                            {/* Thumbnail 16/9 con badge de duración y barra de progreso */}
                            <div className="ep-pic-box relative aspect-[16/9] w-32 sm:w-48 md:w-56 shrink-0 rounded-lg overflow-hidden border border-[var(--neutral-separator)] bg-surface-container-lowest group/thumb shadow-[shadow:var(--double-bezel-ring)]">
                                <ThumbnailPlaceholder number={ep.number} loading={Boolean(currentThumbnail) && !thumbnailLoaded} />
                                {currentThumbnail && (
                                    <DeferredImage
                                        src={currentThumbnail}
                                        alt={displayTitle}
                                        priority
                                        loading="eager"
                                        fetchPriority={priority ? "high" : "auto"}
                                        decoding="async"
                                        placeholderColor="transparent"
                                        className="w-full h-full"
                                        sizes={THUMBNAIL_SIZES}
                                        imgClassName="w-full h-full object-cover transition-transform duration-300 motion-safe:group-hover/thumb:scale-105"
                                        style={THUMBNAIL_TRANSITION}
                                        showSkeleton={false}
                                        timeoutMs={30000}
                                        onLoad={handleThumbnailLoad}
                                        onError={handleThumbnailError}
                                        fallback={<ThumbnailPlaceholder number={ep.number} />}
                                    />
                                )}
                                <span className="ep-dur-pill">
                                    {ep.duration ? `${ep.duration}:00` : "24:00"}
                                </span>
                                {(ep.isWatched || (ep.progressPercent != null && ep.progressPercent > 0)) && (
                                    <div className="ep-progress-line">
                                        <i style={{ width: `${Math.min(100, ep.isWatched ? 100 : (ep.progressPercent || 0))}%` }} />
                                    </div>
                                )}
                            </div>

                            {/* Middle: Status + Title + Synopsis */}
                            <div className="min-w-0 flex-1 flex flex-col justify-center">
                                <div className="ep-status-line">
                                    <span className="ep-num-tag text-xs font-mono font-bold">
                                        #{ep.number < 10 ? `0${ep.number}` : ep.number}
                                    </span>
                                    {ep.progressPercent && ep.progressPercent > 0 && !ep.isWatched ? (
                                        <span className="ep-status-amber text-xs">Vas por aquí</span>
                                    ) : ep.isWatched ? (
                                        <span className="text-status-success text-xs font-semibold flex items-center gap-1">
                                            <IconUiCheck className="w-3 h-3" /> Visto
                                        </span>
                                    ) : ep.episodeType === "Filler" ? (
                                        <span className="text-amber-400/80 text-xs font-medium">Relleno</span>
                                    ) : (
                                        <span className="text-xs">Disponible</span>
                                    )}
                                </div>
                                <h4
                                    id={`episode-title-${ep.number}`}
                                    className="ep-name-h4 text-[15px] font-bold text-white transition-colors leading-snug line-clamp-1 sm:line-clamp-2 text-balance"
                                >
                                    {displayTitle}
                                </h4>
                                {!themeHideEpisodeCardDescription && ep.description && (
                                    <p className="ep-synopsis-p text-xs sm:text-[13px] text-white/55 line-clamp-2 leading-relaxed mt-1 max-w-2xl">
                                        {ep.description}
                                    </p>
                                )}
                            </div>
                        </button>

                        {/* Right: Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={handlePlay}
                                className={cn(
                                    "ep-action-btn episode-row-redundant-play",
                                    ep.progressPercent && ep.progressPercent > 0 && !ep.isWatched ? "solid" : ""
                                )}
                            >
                                <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                                <span>{ep.progressPercent && ep.progressPercent > 0 && !ep.isWatched ? "Continuar" : "Ver"}</span>
                            </button>
                            <IconButton
                                intent="secondary"
                                size="sm"
                                onClick={handleQuickQueue}
                                aria-label={justQueued ? "Añadido a la cola" : "Añadir a la cola"}
                                title="Añadir a la cola"
                                className={cn("rounded-lg", justQueued && "text-status-success")}
                                icon={
                                    <IconSwap subtle swapKey={justQueued ? "check" : "queue"} className="flex items-center justify-center">
                                        {justQueued ? (
                                            <IconUiCheck className="w-4 h-4" />
                                        ) : (
                                            <IconUiListPlus className="w-4 h-4" />
                                        )}
                                    </IconSwap>
                                }
                            />
                        </div>
                    </article>
                ) : (
                    <article
                        id={`episode-${ep.number}`}
                        aria-labelledby={`episode-title-${ep.number}`}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        className={cn(
                            "surface-content surface-content-row group h-full w-full flex items-stretch gap-2 p-3 sm:p-3.5 rounded-2xl select-none",
                            isHighlighted && "episode-row-highlighted",
                            "transition-[background-color,border-color,box-shadow] duration-base ease-smooth-out",
                            isHighlighted
                                ? "border-brand-accent/50 shadow-[shadow:var(--glass-highlight-sm),var(--elevation-3),0_0_16px_hsl(var(--brand-accent)/0.2)] ring-1 ring-brand-accent/30"
                                : "hover:border-white/25 hover:bg-[color-mix(in_srgb,var(--surface-content)_85%,transparent)] shadow-[shadow:var(--glass-highlight-sm),var(--elevation-2)]"
                        )}
                    >
                        <button
                            type="button"
                            onClick={handlePlay}
                            aria-label={`Reproducir episodio ${ep.number}, ${displayTitle}${ep.isWatched ? ", visto" : ""}`}
                            className="flex flex-1 min-w-0 items-stretch gap-3.5 sm:gap-5 text-left cursor-pointer rounded-xl transition-transform duration-fast ease-out-strong motion-safe:active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent/70"
                        >
                        {/* Thumbnail en proporción cinematográfica 16/9 */}
                        <div className="relative aspect-[16/9] w-32 sm:w-48 md:w-56 lg:w-60 shrink-0 rounded-xl overflow-hidden border border-[var(--neutral-separator)] bg-surface-container-high shadow-[shadow:var(--double-bezel-ring)]">
                            {/* La tarjeta con el número queda debajo; la foto entra encima con un fundido. */}
                            <ThumbnailPlaceholder number={ep.number} loading={Boolean(currentThumbnail) && !thumbnailLoaded} />
                            {currentThumbnail && (
                                /* La lista ya está virtualizada: solo existen las filas cercanas a la
                                   vista, así que la imagen se pide al montar la fila (sin esperar otro
                                   IntersectionObserver ni el lazy del navegador) y con prioridad normal. */
                                <DeferredImage
                                    src={currentThumbnail}
                                    alt={displayTitle}
                                    priority
                                    loading="eager"
                                    fetchPriority={priority ? "high" : "auto"}
                                    decoding="async"
                                    placeholderColor="transparent"
                                    className="w-full h-full"
                                    // La miniatura mide 128–240 px: sin esto el srcSet de TMDB
                                    // bajaba la variante de 500/780 px y cada foto tardaba el doble.
                                    sizes={THUMBNAIL_SIZES}
                                    imgClassName="w-full h-full object-cover motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105"
                                    // Opacidad (entrada) y transform (hover) juntas. En línea porque
                                    // las clases de duración/curva chocaban con las de DeferredImage
                                    // y ganaba la que venía después en el CSS: la foto aparecía de golpe.
                                    style={THUMBNAIL_TRANSITION}
                                    showSkeleton={false}
                                    // Las miniaturas del servidor se generan en frío con cola: no cortar antes que ella.
                                    timeoutMs={30000}
                                    onLoad={handleThumbnailLoad}
                                    onError={handleThumbnailError}
                                    fallback={<ThumbnailPlaceholder number={ep.number} />}
                                />
                            )}

                            {/* Scrim interno del thumbnail */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent z-10 pointer-events-none" />

                            {/* Play al apuntar la fila (solo con mouse): anticipa qué hace el clic */}
                            <div
                                aria-hidden
                                className="absolute inset-0 z-20 hidden [@media(hover:hover)_and_(pointer:fine)]:flex items-center justify-center pointer-events-none"
                            >
                                <span className="w-10 h-10 rounded-full bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] text-white shadow-[shadow:var(--double-bezel-control-shadow)] flex items-center justify-center opacity-0 scale-90 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-100 group-focus-visible:opacity-100 motion-safe:group-focus-visible:scale-100 transition-[opacity,transform] duration-200 ease-out-strong">
                                    <IconMediaPlay className="w-4 h-4 ml-0.5" />
                                </span>
                            </div>

                            {/* Badge de "VISTO" si ya fue reproducido */}
                            {ep.isWatched && (
                                <div className="episode-badge-watched absolute top-2 right-2 z-20 px-2 py-0.5 rounded-md bg-black/85 border border-status-success/30 text-xs font-mono font-bold text-status-success flex items-center gap-1 shadow-[shadow:var(--elevation-1)]">
                                    <svg className="w-3 h-3 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>VISTO</span>
                                </div>
                            )}

                            {/* Progress bar en thumbnail */}
                            {ep.isWatched || (ep.progressPercent != null && ep.progressPercent > 0 && ep.progressPercent < 100) ? (
                                <div className="absolute bottom-0 inset-x-0 h-1 bg-black/70 z-20 pointer-events-none overflow-hidden">
                                    <div
                                        className="episode-progress-bar-fill h-full w-full bg-brand-accent shadow-[0_0_6px_hsl(var(--brand-accent)/0.8)] origin-left transition-transform duration-fast ease-smooth-out"
                                        style={{ transform: `scaleX(${Math.min(100, Math.max(0, ep.isWatched ? 100 : (ep.progressPercent || 0))) / 100})` }}
                                    />
                                </div>
                            ) : null}
                        </div>

                        {/* Episode Info */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                            {/* Title over Episode */}
                            <span id={`episode-title-${ep.number}`} className="block font-display text-sm sm:text-base font-bold uppercase tracking-wide leading-snug line-clamp-1 sm:line-clamp-2 text-on-surface [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-on-surface transition-colors text-balance">
                                {displayTitle}
                            </span>

                            {/* Episode Badges Row */}
                            <div className="flex items-center gap-2 mt-1.5 mb-1 flex-wrap">
                                <span className="episode-badge-ep px-2 py-0.5 rounded-md bg-brand-accent/15 border border-brand-accent/30 text-brand-accent-readable text-xs font-mono font-bold tracking-wider">
                                    EP {ep.number}
                                </span>
                                <span className="text-on-surface-variant text-xs font-mono font-medium">
                                    {ep.duration ? `${ep.duration} min` : "24 min"}
                                </span>

                                {/* Type Badges */}
                                {ep.episodeType === 'Filler' && (
                                    <span className="episode-badge-filler text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-400 border border-amber-400/30 uppercase tracking-wider">
                                        Relleno
                                    </span>
                                )}
                                {ep.episodeType === 'Hyped' && (
                                    <EpisodeBadge className="shadow-brand-secondary">
                                        Destacado
                                    </EpisodeBadge>
                                )}
                            </div>

                            {/* Description */}
                            {!themeHideEpisodeCardDescription && ep.description && (
                                <span className="text-xs sm:text-sm text-on-surface-variant line-clamp-2 leading-relaxed mt-1">
                                    {ep.description}
                                </span>
                            )}
                        </div>
                        </button>
                        {/* Acciones rápidas: hermanas del botón principal, no anidadas */}
                        <div className="flex flex-col items-center justify-center gap-2 shrink-0">
                            <IconButton
                                intent="secondary"
                                size="md"
                                onClick={handleQuickQueue}
                                aria-label={justQueued ? "Añadido a la cola" : "Añadir a la cola"}
                                title="Añadir a la cola"
                                className={cn(justQueued && "text-status-success")}
                                icon={
                                    <IconSwap subtle swapKey={justQueued ? "check" : "queue"} className="flex items-center justify-center">
                                        {justQueued ? (
                                            <IconUiCheck className="w-4 h-4" />
                                        ) : (
                                            <IconUiListPlus className="w-4 h-4" />
                                        )}
                                    </IconSwap>
                                }
                            />
                            <IconButton
                                intent="primary"
                                size="md"
                                onClick={handlePlay}
                                aria-label="Reproducir episodio"
                                title="Reproducir"
                                className="episode-row-redundant-play shadow-brand-primary"
                                icon={<IconMediaPlay className="w-4 h-4 ml-px fill-current" />}
                            />
                        </div>
                    </article>
                )}
            </div>
        </div>
    )
})
