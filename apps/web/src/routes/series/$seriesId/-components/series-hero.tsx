import * as React from "react"
import { toast } from "sonner"
import { useQueueStore } from "@/lib/store"
import { useUIStore } from "@/lib/stores/ui-store"
import type { Anime_Entry } from "@/api/generated/types"
import { IconUiCheck, IconUiListPlus } from "@/components/ui/icons";
import { IconSwap, useTransientFlag } from "@/components/ui/kinetics/icon-swap"
import { getHighResImage, getMediumResImage } from "@/lib/helpers/images"
import { stripHtml } from "@/lib/helpers/sanitizer"
import { getSeriesIdFromMedia, getSeriesEraId, DRAGON_BALL_SERIES_INFO } from "@/lib/helpers/series"
import { ERAS, ERA_COLOR_MAP } from "@/lib/config/eras"
import { MediaHero } from "@/components/ui/media-hero"
import type { HeroArt } from "@/lib/config/hero-art"
import { MediaMetadataCapsule } from "@/components/ui/media-metadata-capsule"
import { useHideAudienceScore } from "@/lib/theme/theme-hooks"
import { PlayCta } from "@/components/ui/play-cta"
import { GlassIconButton } from "@/components/ui/glass-icon-button"
import { useSound } from "@/hooks/use-sound"
import { SeriesHeroCollapse } from "./series-hero-collapse"
import { summarizeSeriesAudio } from "./series-audio-summary"

interface SeriesHeroProps {
  entry: Anime_Entry | undefined
  backdropUrl: string | null
  /** Arte curado del hero (punto focal + composición). */
  backdropArt?: HeroArt | null
  /** Contenedor con scroll (el <main> del detalle) para el parallax del backdrop. */
  scrollContainerRef?: React.RefObject<HTMLElement | HTMLDivElement | null>
  onPlay?: () => void
  /** Fired on hover/focus intent so the backend can warm the media container ahead of the click. */
  onPlayHover?: () => void
  /** Línea bajo la sinopsis, ej. "Vas en: Saga Freezer · 42%". */
  footerText?: React.ReactNode
  sagaCount?: number
  /** Cuando hay progreso de continuidad el CTA cambia a "Continuar". */
  hasProgress?: boolean
  resumeEpisodeNumber?: number
  resumeEpisodeTitle?: string
  /** Avance del episodio en curso (0–100) y tiempo que falta, para la franja de la tarjeta. */
  resumePercent?: number
  resumeTimeLeftLabel?: string
  /** Activa el switch de Z o Kai en la tarjeta de presentación */
  isZSeries?: boolean
  zVariant?: 'z' | 'kai'
  onZVariantChange?: (variant: 'z' | 'kai') => void
}

// ── Component — hero unificado sobre MediaHero compartido (paridad Movies) ───

export const SeriesHero = React.memo(function SeriesHero({
  entry,
  backdropUrl,
  backdropArt,
  scrollContainerRef,
  onPlay,
  onPlayHover,
  footerText,
  sagaCount,
  hasProgress,
  resumeEpisodeNumber,
  resumeEpisodeTitle,
  resumePercent,
  resumeTimeLeftLabel,
  isZSeries,
  zVariant = 'z',
}: SeriesHeroProps) {
  const media = entry?.media
  const heroSeriesId = getSeriesIdFromMedia(media, media?.titleSpanish || media?.titleRomaji || undefined)
  const title = (heroSeriesId ? DRAGON_BALL_SERIES_INFO[heroSeriesId]?.title : undefined)
    || media?.titleSpanish
    || media?.titleRomaji
    || media?.titleEnglish
    || "Título Desconocido"
  const rating = media?.score ? media.score / 10 : undefined
  const hideAudienceScore = useHideAudienceScore()
  const year = media?.year
  // Sinopsis canónica en español primero; la de la API (AniList) viene en inglés.
  const synopsis = (heroSeriesId ? DRAGON_BALL_SERIES_INFO[heroSeriesId]?.description : undefined)
    || stripHtml(media?.description)
  const hasBannerImage = !!media?.bannerImage
  const posterUrl = getHighResImage(media?.posterImage || "")
  // El total real vive en media.totalEpisodes; localFiles puede ser 1 solo
  // archivo (pack) y mostraba "1 EPISODIOS" por error.
  const totalEpisodes = media?.totalEpisodes || entry?.localFiles?.length || undefined

  const { playSound } = useSound()
  const addToQueue = useQueueStore(state => state.addToQueue)
  // El botón confirma en el lugar (ícono → ✓) además del toast.
  const [justQueued, flashQueued] = useTransientFlag(1600)

  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (entry?.localFiles && entry.localFiles.length > 0) {
      const validFiles = entry.localFiles.filter(f => Boolean(f.path))
      if (validFiles.length === 0) {
        toast.error("No hay archivos locales disponibles para reproducir.")
        return
      }
      if (entry.mediaId == null) {
        toast.error("Contenido sin identificador: no se puede encolar.")
        return
      }

      const sorted = [...validFiles].sort((a, b) => {
        const epA = Number(a.parsedInfo?.episode || a.metadata?.episode || 0)
        const epB = Number(b.parsedInfo?.episode || b.metadata?.episode || 0)
        return epA - epB
      })

      const target = (resumeEpisodeNumber != null
        ? sorted.find(f => Number(f.parsedInfo?.episode || f.metadata?.episode) === resumeEpisodeNumber)
        : null) || sorted[0]

      const epNum = Number(target.parsedInfo?.episode || target.metadata?.episode || 1)
      const epTitle = (resumeEpisodeNumber === epNum && resumeEpisodeTitle)
        ? resumeEpisodeTitle
        : `Episodio ${epNum}`

      addToQueue({
        id: entry.mediaId,
        title: title,
        subtitle: epTitle,
        playableUrl: target.path || "",
        thumbnail: getMediumResImage(media?.posterImage || ""),
        mediaId: entry.mediaId,
        episodeNumber: epNum,
        malId: media?.idMal ?? null,
        mediaFormat: media?.format ?? "TV"
      })
      flashQueued()
      playSound("category", 0.3)
      toast.success("Añadido a la cola de reproducción", {
        description: `${title} · ${epTitle}`,
      })
    } else {
      toast.error("No hay archivos locales disponibles para reproducir.")
    }
  }

  const effectiveEpisodes = isZSeries
    ? (zVariant === 'kai' ? 167 : 291)
    : totalEpisodes
  const effectiveSagaCount = isZSeries
    ? (zVariant === 'kai' ? 4 : (sagaCount ?? 7))
    : sagaCount
  const effectiveYear = isZSeries
    ? (zVariant === 'kai' ? 2009 : 1989)
    : year

  // Doblajes, subtítulos y calidad salen de los archivos locales; los géneros, de la ficha.
  const cardEnabled = useUIStore((s) => s.seriesHeroCardEnabled)
  const audio = React.useMemo(() => summarizeSeriesAudio(entry?.localFiles), [entry?.localFiles])
  const genreList = media?.genres
  const genres = Array.isArray(genreList) ? genreList.slice(0, 3) : []
  const eraId = getSeriesEraId(heroSeriesId)
  const eraInfo = eraId ? ERAS.find((e) => e.id === eraId) : undefined
  const eraColors = eraId ? ERA_COLOR_MAP[eraId] : undefined

  const topBadge = (
    <div className="flex flex-wrap items-center gap-2.5">
      <span
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-2xs font-extrabold uppercase tracking-wider backdrop-blur-md border shadow-sm"
        style={
          eraColors
            ? {
                backgroundColor: `color-mix(in srgb, ${eraColors.accent} 20%, rgba(0,0,0,0.45))`,
                borderColor: `color-mix(in srgb, ${eraColors.accent} 45%, transparent)`,
                color: eraColors.accent,
              }
            : {
                backgroundColor: "rgba(255,255,255,0.12)",
                borderColor: "rgba(255,255,255,0.22)",
                color: "var(--label-1)",
              }
        }
      >
        {eraInfo ? `ERA ${eraInfo.shortTitle.toUpperCase()}` : "SERIE OFICIAL"}
      </span>
      {genres.length > 0 && (
        <>
          <span aria-hidden="true" className="text-on-surface/50">·</span>
          <span className="text-xs font-semibold text-on-surface/85 text-edge-glow">
            {genres.join(" · ")}
          </span>
        </>
      )}
    </div>
  )

  const metadataRow = (
    <MediaMetadataCapsule
      year={effectiveYear}
      episodes={effectiveEpisodes}
      sagas={effectiveSagaCount}
      rating={hideAudienceScore ? undefined : rating}
      quality={audio.quality}
      audio={audio.dubs.length > 0 ? audio.dubs.join(" · ") : null}
    >
      {audio.subs.length > 0 && (
        <span className="relative z-10 rounded-md border border-white/15 bg-white/10 backdrop-blur-md px-2.5 py-1 text-xs font-semibold text-on-surface">
          Subs: {audio.subs.join(" · ")}
        </span>
      )}
    </MediaMetadataCapsule>
  )

  const actionButtons = (
    <>
      {onPlay && (
        <PlayCta
          onClick={onPlay}
          onHoverIntent={onPlayHover}
          label={hasProgress ? "Continuar" : "Reproducir"}
          sublabel={hasProgress
            ? (resumeEpisodeNumber != null ? `Continuar · Ep ${resumeEpisodeNumber}` : "Continuar viendo")
            : "Comenzar episodio"}
        />
      )}
      {entry?.localFiles && entry.localFiles.length > 0 && (
        <GlassIconButton
          onClick={handleAddToQueue}
          icon={
            <IconSwap swapKey={justQueued ? "queued" : "add"}>
              {justQueued ? <IconUiCheck className="w-5 h-5" /> : <IconUiListPlus className="w-5 h-5" />}
            </IconSwap>
          }
          title={justQueued ? "Añadido a la cola" : "Añadir a la cola"}
        />
      )}
    </>
  )

  // Primer episodio de la tarjeta contraída: el que sigue si hay progreso, o el primero local.
  const firstLocal = React.useMemo(() => {
    const parsed = (entry?.localFiles ?? [])
      .map(f => ({ num: Number(f.parsedInfo?.episode || f.metadata?.episode || 0), name: f.parsedInfo?.episodeTitle }))
      .filter(f => f.num > 0)
      .sort((a, b) => a.num - b.num)
    return parsed[0] ?? null
  }, [entry])
  const cardEpisodeNumber = (hasProgress ? resumeEpisodeNumber : undefined) ?? firstLocal?.num ?? 1
  const cardEpisodeTitle = (hasProgress ? resumeEpisodeTitle : firstLocal?.name) || title
  // Subtítulo de la píldora: el episodio y, si hay progreso, cuánto falta.
  const cardSubtitle = [`Episodio ${cardEpisodeNumber}`, hasProgress ? resumeTimeLeftLabel : undefined]
    .filter(Boolean)
    .join(" · ")

  const hero = (
      <MediaHero
        scrollContainerRef={scrollContainerRef}
        backdropUrl={backdropUrl || null}
        backdropArt={backdropArt}
        posterUrl={posterUrl}
        posterShareKey={entry?.mediaId != null ? `series:${entry.mediaId}` : undefined}
        hasBannerImage={hasBannerImage}
        title={title}
        metadataRow={metadataRow}
        synopsis={synopsis}
        topBadge={topBadge}
        footerText={footerText}
        // En celular la barra inferior flota sobre la ficha: la franja reserva su alto (más el
        // safe-area) para que el CTA no quede debajo al cargar. Desde md no hay barra.
        actionButtons={
          <div className="w-full pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] md:pb-0">
            <div className="flex flex-wrap items-center gap-4">{actionButtons}</div>
          </div>
        }
        showPosterColumn={false}
        // Pantalla completa al entrar: en angosto el contenedor arranca bajo la barra superior,
        // así que el hero le resta esa altura.
        fullHeight
        // En celular, pantallas bajas: si el contenido no entra en el alto, el hero crece hacia abajo
        // y el CTA cae bajo la barra. El aire superior de 80 px (pt-20 de MediaHero) sobra ahí; con
        // 16 px el CTA queda por encima de la barra. Desde md no cambia.
        className="min-h-[calc(100svh-var(--chrome-stick))] pt-4 md:min-h-screen"
        onBackdropClick={onPlay}
        onTitleClick={onPlay}
      />
  )
  // Sin la píldora activa en Ajustes se renderiza únicamente el hero.
  if (!cardEnabled) return hero
  return (
    <SeriesHeroCollapse
      scrollContainerRef={scrollContainerRef}
      episodeNumber={cardEpisodeNumber}
      title={cardEpisodeTitle}
      subtitle={cardSubtitle}
      resumePercent={resumePercent}
      playLabel={hasProgress ? "Continuar" : "Reproducir"}
      onPlay={onPlay}
      onPlayHover={onPlayHover}
    >
      {hero}
    </SeriesHeroCollapse>
  )
})
