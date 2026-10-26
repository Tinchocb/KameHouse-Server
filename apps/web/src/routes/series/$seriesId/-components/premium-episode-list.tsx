"use no memo"
import React from "react"
import { useNavigate } from "@tanstack/react-router"
import { EpisodeBadge } from "@/components/ui/episode-badge"
import { IconStatusFolderPlus, IconNavigationSearch, IconUiClose, IconMediaPlay, IconUiListPlus, IconUiCheck } from "@/components/ui/icons";
import type { PremiumEpisode } from "@/api/types/series.types"
import { cn } from "@/components/ui/core/styling"
import { IconButton } from "@/components/ui/button"
import { useHoverPreload } from "@/hooks/use-hover-preload"
import { useThemeSettings } from "@/lib/theme/theme-hooks"
import { useVirtualizer } from "@tanstack/react-virtual"
import { DeferredImage } from "@/components/shared/deferred-image"
import { ElasticCounter, IconSwap } from "@/components/ui/kinetics"
import { useReducedMotion } from "@/components/ui/kinetics/hooks"
import { isImageLoaded } from "@/lib/helpers/images"
import { toast } from "sonner"
import { useQueueStore } from "@/lib/store"
import { cleanEpisodeTitle } from "../-hooks/use-series-data"
import { useSagaEpisodesReady } from "../-hooks/use-saga-episodes-ready"

// Alto medido de cada fila (tarjeta + padding inferior) por breakpoint. Móvil ~163 px
// (154–193 según título y descripción), tablet ~156 y escritorio ~181. Una estimación lejana
// obligaba a corregir cada fila al montarla y el alto total del scroll quedaba mal.
const ROW_HEIGHT_PX = { mobile: 164, tablet: 156, desktop: 181 } as const
// Filas montadas fuera de pantalla: sus miniaturas se piden antes de asomar
// (16 episodios por lado), dando más margen de carga al desplazarse rápido.
const LIST_OVERSCAN = 16
// Al entrar a la ficha casi todas las filas están bajo el pliegue. Montarlas todas junto con la
// entrada de la página costaba un commit y un layout largos; se empieza con pocas y se amplía
// cuando la entrada ya terminó.
const LIST_OVERSCAN_ON_MOUNT = 4
const LIST_OVERSCAN_DELAY_MS = 450
// Al llevar el arco activo arriba, su primer episodio no debe quedar bajo la píldora de navegación flotante (~72 px).
const ARC_SCROLL_PADDING_PX = 88
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
  /** Progreso de episodios vistos dentro de la saga activa */
  sagaProgress?: { watched: number; total: number; percent: number }
  /** Estadísticas de episodios filler dentro de la saga activa */
  fillerStats?: { filler: number; total: number; percent: number }
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

  const { onMouseEnter, onMouseLeave } = useHoverPreload({
    delay: 300,
    onPreload: (epId) => {
      const ep = episodes.find(e => e.id === epId)
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
            className="mt-6 px-6 py-2.5 rounded-full bg-brand-accent text-on-primary font-display text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-[transform,filter] duration-base ease-smooth-out shadow-brand-primary cursor-pointer"
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
        <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-brand-accent/[0.08] border border-brand-accent/25">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-accent shrink-0" />
            <span className="text-xs font-semibold text-on-surface truncate">
              Arco activo · Eps {activeSubSagaStart}–{activeSubSagaEnd}
            </span>
          </div>
          {onClearSubSaga && (
            <button
              type="button"
              onClick={onClearSubSaga}
              className="text-3xs font-mono font-bold text-on-surface-variant hover:text-on-surface uppercase tracking-wider shrink-0 transition-[color,transform] duration-fast active:scale-95 cursor-pointer"
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
            "focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-brand-accent/40",
            "transition-[border-color,box-shadow] duration-base ease-smooth-out",
            isSearchFocused && "border-white/50 shadow-elevation-2",
          )}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 min-w-8 min-h-8 w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:text-on-surface active:scale-95 transition-[color,transform] duration-fast ease-smooth-out cursor-pointer animate-scale-in [animation-duration:var(--duration-base)] [animation-timing-function:var(--ease-out)]"
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
              className="mt-6 px-6 py-2.5 rounded-full bg-brand-accent text-on-primary font-display text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-[transform,filter] duration-base ease-smooth-out shadow-brand-primary cursor-pointer"
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
          />
        </div>
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
    /** Índice de la fila y ref de medición del virtualizador: la altura real varía con el largo del título. */
    rowIndex: number
    measureRef: (node: HTMLElement | null) => void
    priority?: boolean
    themeHideEpisodeCardDescription?: boolean
    themeHideDownloadedEpisodeCardFilename?: boolean
    onPlay?: (episodeNumber: number) => void
    onMouseEnter: (id: string) => void
    onMouseLeave: (id: string) => void
    seriesMediaId?: number
}

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
            <div className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center mb-1.5 shadow-sm">
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
                    <article
                        id={`episode-${ep.number}`}
                        aria-labelledby={`episode-title-${ep.number}`}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        className={cn(
                            "surface-content surface-content-row group h-full w-full flex items-stretch gap-2 p-3 sm:p-3.5 rounded-2xl select-none",
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
                            className="flex flex-1 min-w-0 items-stretch gap-3.5 sm:gap-5 text-left cursor-pointer rounded-xl transition-transform duration-fast ease-out-strong active:scale-[0.985] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent/70"
                        >
                        {/* Thumbnail en proporción cinematográfica 16/9 */}
                        <div className="relative aspect-[16/9] w-32 sm:w-48 md:w-56 lg:w-60 shrink-0 rounded-xl overflow-hidden border border-white/10 bg-surface-container-high shadow-elevation-2">
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
                                    imgClassName="w-full h-full object-cover [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105"
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
                                <span className="w-10 h-10 rounded-full bg-black/60 border border-white/25 text-white flex items-center justify-center opacity-0 scale-90 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-100 group-focus-visible:opacity-100 group-focus-visible:scale-100 transition-[opacity,transform] duration-200 ease-out-strong">
                                    <IconMediaPlay className="w-4 h-4 ml-0.5" />
                                </span>
                            </div>

                            {/* Badge de "VISTO" si ya fue reproducido */}
                            {ep.isWatched && (
                                <div className="absolute top-2 right-2 z-20 px-2 py-0.5 rounded-md bg-black/85 border border-status-success/30 text-3xs font-mono font-bold text-status-success flex items-center gap-1 shadow-sm">
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
                                        className="h-full w-full bg-brand-accent shadow-[0_0_6px_hsl(var(--brand-accent)/0.8)] origin-left transition-transform duration-fast ease-smooth-out"
                                        style={{ transform: `scaleX(${Math.min(100, Math.max(0, ep.isWatched ? 100 : (ep.progressPercent || 0))) / 100})` }}
                                    />
                                </div>
                            ) : null}
                        </div>

                        {/* Episode Info */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                            {/* Title over Episode */}
                            <span id={`episode-title-${ep.number}`} className="block font-display text-sm sm:text-base font-bold uppercase tracking-wide leading-snug line-clamp-1 sm:line-clamp-2 text-on-surface group-hover:text-on-surface transition-colors">
                                {displayTitle}
                            </span>

                            {/* Episode Badges Row */}
                            <div className="flex items-center gap-2 mt-1.5 mb-1 flex-wrap">
                                <span className="px-2 py-0.5 rounded-md bg-brand-accent/15 border border-brand-accent/30 text-brand-accent-readable text-2xs font-mono font-bold tracking-wider">
                                    EP {ep.number}
                                </span>
                                <span className="text-on-surface-variant text-xs font-mono font-medium">
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
                                    <IconSwap swapKey={justQueued ? "check" : "queue"} className="flex items-center justify-center">
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
                                className="shadow-brand-primary"
                                icon={<IconMediaPlay className="w-4 h-4 ml-px fill-current" />}
                            />
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
    // El salto a una sub-saga respeta movimiento reducido (C-02): antes era `smooth` fijo.
    const reduceMotion = useReducedMotion()
    const [overscan, setOverscan] = React.useState(LIST_OVERSCAN_ON_MOUNT)
    React.useEffect(() => {
        const timer = window.setTimeout(() => setOverscan(LIST_OVERSCAN), LIST_OVERSCAN_DELAY_MS)
        return () => window.clearTimeout(timer)
    }, [])
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
            // Posición de la lista dentro del contenido del scroller. Con offsetTop la cadena
            // de offsetParent se salteaba el scroller si no estaba posicionado.
            const top = Math.round(
                listRef.current.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop,
            )
            if (top > 0) {
                setScrollMargin(prev => (Math.abs(prev - top) <= 1 ? prev : top))
            }
        }
        updateOffset()

        // Lo de arriba de la lista (continuar viendo, personajes) carga después y la corre.
        const ro = new ResizeObserver(updateOffset)
        if (scrollEl.firstElementChild) ro.observe(scrollEl.firstElementChild)
        window.addEventListener("resize", updateOffset, { passive: true })
        return () => {
            ro.disconnect()
            window.removeEventListener("resize", updateOffset)
        }
    }, [scrollElement])

    const estimateSize = React.useCallback(() => {
        if (typeof window !== "undefined") {
            if (window.innerWidth < 640) return ROW_HEIGHT_PX.mobile
            if (window.innerWidth < 768) return ROW_HEIGHT_PX.tablet
        }
        return ROW_HEIGHT_PX.desktop
    }, [])

    // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer devuelve funciones no memoizables por diseño; React Compiler lo omite a proposito.
    const virtualizer = useVirtualizer({
        count: filteredEpisodes.length,
        getScrollElement,
        estimateSize,
        // Sin leer el DOM en el ref: al montar, la fila recibe el tamaño que ya se conoce (o la
        // estimación) y el ResizeObserver la mide con borderBoxSize después del layout. Por defecto
        // cada fila leía offsetHeight dentro del commit (un layout forzado por fila, ~67 ms al cargar).
        measureElement: (element, entry, instance) => {
            if (entry) return Math.round(entry.borderBoxSize?.[0]?.blockSize ?? (element as HTMLElement).offsetHeight)
            const cached = instance.measurementsCache[Number(element.getAttribute("data-index"))]
            return cached ? cached.size : estimateSize()
        },
        initialRect: {
            width: typeof window !== "undefined" ? window.innerWidth : 1280,
            height: typeof window !== "undefined" ? window.innerHeight : 800,
        },
        // Clave por episodio: las alturas medidas siguen al episodio al filtrar o reordenar.
        getItemKey: (index) => filteredEpisodes[index]?.id ?? index,
        overscan,
        scrollMargin,
        scrollPaddingStart: ARC_SCROLL_PADDING_PX,
        useFlushSync: false,
    })

    const prevActiveSubSagaStart = React.useRef<number | undefined>(undefined)
    React.useEffect(() => {
        if (activeSubSagaStart != null && activeSubSagaStart !== prevActiveSubSagaStart.current) {
            prevActiveSubSagaStart.current = activeSubSagaStart
            const targetIndex = filteredEpisodes.findIndex(e => e.number === activeSubSagaStart)
            if (targetIndex >= 0) {
                virtualizer.scrollToIndex(targetIndex, { align: "start", behavior: reduceMotion ? "auto" : "smooth" })
            }
        }
    }, [activeSubSagaStart, filteredEpisodes, virtualizer, reduceMotion])

    return (
        <div ref={listRef} className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
                const ep = filteredEpisodes[virtualRow.index]
                if (!ep) return null
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
                        rowIndex={virtualRow.index}
                        measureRef={virtualizer.measureElement}
                        priority={virtualRow.index < 4}
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
