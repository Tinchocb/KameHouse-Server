import * as React from "react"
import { toast } from "sonner"
import { useAppStore } from "@/lib/store"
import type { Anime_Entry } from "@/api/generated/types"
import { IconUiListPlus } from "@/components/ui/icons";
import { getHighResImage, getMediumResImage } from "@/lib/helpers/images"
import { stripHtml } from "@/lib/helpers/sanitizer"
import { getSeriesIdFromMedia, getSeriesEraId, DRAGON_BALL_SERIES_INFO } from "@/lib/helpers/series"
import { ERAS, ERA_COLOR_MAP, type EraId } from "@/lib/config/eras"
import { MediaHero } from "@/components/ui/media-hero"
import { MediaMetadataCapsule } from "@/components/ui/media-metadata-capsule"
import { PlayCta } from "@/components/ui/play-cta"
import { GlassIconButton } from "@/components/ui/glass-icon-button"

interface SeriesHeroProps {
  entry: Anime_Entry | undefined
  backdropUrl: string | null
  /** Contenedor con scroll (el <main> del detalle) para el parallax del backdrop. */
  scrollContainerRef?: React.RefObject<HTMLElement | HTMLDivElement | null>
  onPlay?: () => void
  /** Fired on hover/focus intent so the backend can warm the media container ahead of the click. */
  onPlayHover?: () => void
  /** Línea bajo la sinopsis, ej. "Vas en: Saga Freezer · 42%". */
  footerText?: React.ReactNode
  sagaCount?: number
  /** Cuando hay progreso de continuidad el CTA cambia a "Reanudar". */
  hasProgress?: boolean
  resumeEpisodeNumber?: number
  resumeEpisodeTitle?: string
}

// ── Component — hero unificado sobre MediaHero compartido (paridad Movies) ───

export const SeriesHero = React.memo(function SeriesHero({
  entry,
  backdropUrl,
  scrollContainerRef,
  onPlay,
  onPlayHover,
  footerText,
  sagaCount,
  hasProgress,
  resumeEpisodeNumber,
  resumeEpisodeTitle,
}: SeriesHeroProps) {
  const media = entry?.media
  const heroSeriesId = getSeriesIdFromMedia(media, media?.titleSpanish || media?.titleRomaji || undefined)
  const title = (heroSeriesId ? DRAGON_BALL_SERIES_INFO[heroSeriesId]?.title : undefined)
    || media?.titleSpanish
    || media?.titleRomaji
    || media?.titleEnglish
    || "Título Desconocido"
  const rating = media?.score ? media.score / 10 : undefined
  const year = media?.year
  // Sinopsis canónica en español primero; la de la API (AniList) viene en inglés.
  const synopsis = (heroSeriesId ? DRAGON_BALL_SERIES_INFO[heroSeriesId]?.description : undefined)
    || stripHtml(media?.description)
  const hasBannerImage = !!media?.bannerImage
  const posterUrl = getHighResImage(media?.posterImage || "")
  // El total real vive en media.totalEpisodes; localFiles puede ser 1 solo
  // archivo (pack) y mostraba "1 EPISODIOS" por error.
  const totalEpisodes = media?.totalEpisodes || entry?.localFiles?.length || undefined

  const eraId: EraId = getSeriesEraId(heroSeriesId) ?? "dbz"
  const eraAccent = ERA_COLOR_MAP[eraId].accent
  const eraLabel = ERAS.find(e => e.id === eraId)?.title ?? "Dragon Ball"

  const addToQueue = useAppStore(state => state.addToQueue)

  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (entry?.localFiles && entry.localFiles.length > 0) {
      const validFiles = entry.localFiles.filter(f => Boolean(f.path))
      if (validFiles.length === 0) {
        toast.error("No hay archivos locales disponibles para reproducir.")
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
        id: entry.mediaId!,
        title: title,
        subtitle: epTitle,
        playableUrl: target.path || "",
        thumbnail: getMediumResImage(media?.posterImage || ""),
        mediaId: entry.mediaId!,
        episodeNumber: epNum,
        malId: media?.idMal ?? null,
        mediaFormat: media?.format ?? "TV"
      })
      toast.success("Añadido a la cola de reproducción", {
        description: `${title} · ${epTitle}`,
      })
    } else {
      toast.error("No hay archivos locales disponibles para reproducir.")
    }
  }

  const topBadge = (
    <span
      className="inline-flex items-center font-mono text-label-sm tracking-display font-bold uppercase px-3 py-1 rounded-full border backdrop-blur-overlay-sm"
      style={{
        color: eraAccent,
        borderColor: `color-mix(in srgb, ${eraAccent} 27%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${eraAccent} 8%, transparent)`,
        boxShadow: `0 0 15px color-mix(in srgb, ${eraAccent} 15%, transparent)`
      }}
    >
      {eraLabel}
    </span>
  )

  const metadataRow = (
    <MediaMetadataCapsule
      format="SERIE"
      year={year}
      episodes={totalEpisodes}
      sagas={sagaCount}
      rating={rating}
    />
  )

  const actionButtons = (
    <>
      {onPlay && (
        <PlayCta
          onClick={onPlay}
          onHoverIntent={onPlayHover}
          label={hasProgress ? "Reanudar" : "Reproducir"}
          sublabel={hasProgress
            ? (resumeEpisodeNumber != null ? `Continuar · Ep ${resumeEpisodeNumber}` : "Continuar viendo")
            : "Comenzar episodio"}
        />
      )}
      {entry?.localFiles && entry.localFiles.length > 0 && (
        <GlassIconButton
          onClick={handleAddToQueue}
          icon={<IconUiListPlus className="w-5 h-5" />}
          title="Añadir a la cola"
        />
      )}
    </>
  )

  return (
    <MediaHero
      scrollContainerRef={scrollContainerRef}
      backdropUrl={backdropUrl || null}
      posterUrl={posterUrl}
      hasBannerImage={hasBannerImage}
      title={title}
      topBadge={topBadge}
      metadataRow={metadataRow}
      synopsis={synopsis}
      footerText={footerText}
      actionButtons={actionButtons}
      showPosterColumn={true}
      onBackdropClick={onPlay}
      onTitleClick={onPlay}
    />
  )
})
