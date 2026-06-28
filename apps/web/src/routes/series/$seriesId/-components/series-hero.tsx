import { Play, Star, ListPlus } from "lucide-react"
import { DeferredImage } from "@/components/shared/deferred-image"
import { getLowResImage, getMediumResImage } from "@/lib/helpers/images"
import * as React from "react"
import { useRef, useMemo } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"
import { toast } from "sonner"
import { useAppStore } from "@/lib/store"

interface SeriesHeroProps {
  entry: any
  backdropUrl: string
  onPlay?: () => void
  sagaCount?: number
}

export function SeriesHero({
  entry,
  backdropUrl,
  onPlay,
  sagaCount,
}: SeriesHeroProps) {
  const containerRef = useRef<HTMLElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const setBackdropUrl = useIntelligenceStore(s => s.setBackdropUrl)

  const media = entry?.media
  const title = media?.titleSpanish || media?.titleRomaji || media?.titleEnglish || "Título Desconocido"
  const romajiTitle = media?.titleRomaji
  const rating = media?.score ? media.score / 10 : undefined
  const year = media?.year
  const ageRating = media?.isNsfw ? "18+" : "PG-13"
  const synopsis = media?.description || ""
  const hasBannerImage = !!media?.bannerImage
  const backdropSrc = media?.bannerImage ?? media?.posterImage ?? null

  // Sync current backdrop with global DynamicBackdrop blur background
  React.useEffect(() => {
    if (backdropUrl) {
      setBackdropUrl(backdropUrl)
    }
    return () => {
      setBackdropUrl(null)
    }
  }, [backdropUrl, setBackdropUrl])

  // Smooth Parallax capture scroll listener (independent of window scroll)
  React.useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target
      if (!backdropRef.current || !containerRef.current) return

      if (target === document || target === window) {
        const scrolled = window.scrollY || document.documentElement.scrollTop
        backdropRef.current.style.transform = `translate3d(0, ${scrolled * 0.4}px, 0)`
      } else if (target instanceof HTMLElement && target.contains(containerRef.current)) {
        const scrolled = target.scrollTop
        backdropRef.current.style.transform = `translate3d(0, ${scrolled * 0.4}px, 0)`
      }
    }
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true })
    return () => window.removeEventListener("scroll", handleScroll, { capture: true })
  }, [])

  useGSAP(() => {
    gsap.from(".series-hero-animate", {
      y: 35,
      opacity: 0,
      duration: 1.4,
      stagger: 0.1,
      ease: "power4.out",
      delay: 0.15
    })
  }, { scope: containerRef, dependencies: [] })

  // Technical details from files
  const tech = entry?.localFiles?.[0]?.technicalInfo

  const qualityBadge = useMemo(() => {
    if (!tech?.videoStream) return null
    const w = tech.videoStream.width
    if (w === undefined) return null
    if (w >= 3840) return "4K UHD"
    if (w >= 1920) return "1080P FHD"
    if (w >= 1280) return "720P HD"
    return null
  }, [tech])

  const codecBadge = useMemo(() => {
    if (!tech?.videoStream?.codec) return null
    const c = tech.videoStream.codec.toLowerCase()
    if (c.includes("hevc") || c.includes("x265") || c.includes("h265")) return "HEVC"
    if (c.includes("avc") || c.includes("x264") || c.includes("h264")) return "AVC"
    return c.toUpperCase()
  }, [tech])

  const audioBadge = useMemo(() => {
    if (!tech?.audioStreams || tech.audioStreams.length === 0) return null
    const langs = tech.audioStreams.map((a: any) => a.language?.toLowerCase() || "")
    const hasSpa = langs.some((l: string) => l.includes("spa") || l.includes("esp") || l.includes("lat"))
    const hasJpn = langs.some((l: string) => l.includes("jap") || l.includes("jpn"))
    const labels: string[] = []
    if (hasSpa) labels.push("ESPAÑOL")
    if (hasJpn) labels.push("JAPONÉS")
    return labels.length > 0 ? labels.join(" / ") : null
  }, [tech])

  const addToQueue = useAppStore(state => state.addToQueue)

  const castList = useMemo(() => {
    if (!media?.characters?.edges) return []
    return media.characters.edges
      .map((edge: any) => edge.node?.name?.full || edge.node?.name?.userPreferred)
      .filter(Boolean)
      .slice(0, 5)
  }, [media])

  const genres = useMemo(() => {
    return (media?.genres as string[]) || []
  }, [media])

  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (entry?.localFiles && entry.localFiles.length > 0) {
      const localFile = entry.localFiles[0]
      const epNum = localFile.parsedInfo?.episode || localFile.metadata?.episode || 1

      addToQueue({
        id: entry.mediaId!,
        title: title,
        playableUrl: localFile.path || "",
        thumbnail: getMediumResImage(media?.posterImage || ""),
        mediaId: entry.mediaId!,
        episodeNumber: Number(epNum),
        malId: media?.idMal ?? null,
        mediaFormat: media?.format ?? "TV"
      })
      toast.success("Añadido a la cola de reproducción")
    } else {
      toast.error("No hay archivos locales disponibles para reproducir.")
    }
  }


  return (
    <section ref={containerRef} className="relative w-full h-[98vh] max-h-[420px] flex flex-col justify-center overflow-hidden bg-transparent select-none">
      {/* Cinematic Grain Overlay */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none mix-blend-overlay z-20"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
      />

      {/* Ambient Blur Background - subtle for series pages */}
      <div className="absolute inset-0 overflow-hidden bg-transparent z-0">
        {backdropSrc && (
          <div
            className="absolute inset-0 opacity-100"
            style={{
              backgroundImage: `url(${getLowResImage(backdropSrc)})`,
              backgroundSize: "cover",
              backgroundPosition: "center 20%",
              filter: "blur(15px) brightness(0.8) saturate(110%)",
            }}
          />
        )}
      </div>

      {/* High Res Crisp Parallax Backdrop with Ken Burns */}
      <div className="absolute inset-0 z-0">
        {backdropUrl && (
          hasBannerImage ? (
            <div
              ref={backdropRef}
              className="absolute right-0 top-0 h-full w-full md:w-[80%] lg:w-[75%] overflow-hidden cursor-pointer z-0 will-change-transform group/backdrop"
              onClick={onPlay}
            >
              <DeferredImage
                src={backdropUrl}
                alt={title}
                priority={true}
                className="w-full h-full object-cover object-[center_20%] opacity-90 transition-all [transition-duration:20s] ease-out group-hover/backdrop:scale-[1.03] animate-ken-burns"
                style={{
                  WebkitMaskImage: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.15) 12%, black 40%)",
                  maskImage: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.15) 12%, black 40%)",
                }}
              />
            </div>
          ) : (
            <div
              ref={backdropRef}
              className="absolute right-0 top-0 h-full w-auto overflow-hidden cursor-pointer z-0 will-change-transform group/backdrop"
              onClick={onPlay}
            >
              <DeferredImage
                src={backdropUrl}
                alt={title}
                priority={true}
                className="h-full w-auto object-contain object-right-top opacity-[0.75] transition-all [transition-duration:20s] ease-out group-hover/backdrop:scale-[1.03] animate-ken-burns"
              />
            </div>
          )
        )}
      </div>

      {/* Gradient izquierdo */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background: hasBannerImage
            ? "linear-gradient(to right, rgba(7,7,10,0.85) 0%, rgba(7,7,10,0.7) 25%, rgba(7,7,10,0.2) 60%, transparent 90%)"
            : "linear-gradient(to right, rgba(7,7,10,0.85) 0%, rgba(7,7,10,0.7) 30%, rgba(7,7,10,0.15) 70%, transparent 95%)",
        }}
      />
      {/* Gradient inferior */}
      <div
        className="absolute inset-x-0 bottom-0 h-32 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to top, transparent 0%, rgba(7,7,10,0.35) 50%, transparent 100%)" }}
      />
      {/* Vignette superior */}
      <div
        className="absolute inset-x-0 top-0 h-16 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, rgba(7,7,10,0.4) 0%, transparent 100%)" }}
      />

      {/* Content Container */}
      <div className="relative z-20 w-full max-w-[1800px] mx-auto px-6 md:px-12 lg:px-12 flex flex-col pointer-events-none">
        <div className="max-w-3xl space-y-7">

          {/* Metadata Row */}
          <div className="series-hero-animate flex flex-wrap items-center text-zinc-300 text-xs font-semibold tracking-wide gap-y-1.5">
            {rating && (
              <span className="flex items-center gap-1">
                <Star size={12} fill="currentColor" className="text-amber-500 stroke-none" />
                {(rating).toFixed(1)} Ki
              </span>
            )}
            {year && (
              <>
                {(rating) && <span className="text-zinc-600 mx-2 select-none">|</span>}
                <span>{year}</span>
              </>
            )}
            {ageRating && (
              <>
                {(rating || year) && <span className="text-zinc-600 mx-2 select-none">|</span>}
                <span>{ageRating}</span>
              </>
            )}
            {sagaCount !== undefined && (
              <>
                {(rating || year || ageRating) && <span className="text-zinc-600 mx-2 select-none">|</span>}
                <span>{sagaCount} {sagaCount === 1 ? "Saga" : "Sagas"}</span>
              </>
            )}
            <span className="text-[var(--brand-secondary)] font-bold flex items-center gap-1.5">
              {(rating || year || ageRating || sagaCount !== undefined) && <span className="text-zinc-600 mr-2 select-none">|</span>}
              SERIE
            </span>
            {genres.length > 0 && (
              <>
                <span className="text-zinc-600 mx-2 select-none">|</span>
                <span className="text-zinc-400">{genres.join(" | ")}</span>
              </>
            )}

            {/* Quality details inline with low-profile colors */}
            {qualityBadge && (
              <>
                <span className="text-zinc-600 mx-2 select-none">|</span>
                <span className="text-emerald-400/90 font-bold uppercase tracking-wider text-[10px]">{qualityBadge}</span>
              </>
            )}
            {codecBadge && (
              <>
                <span className="text-zinc-600 mx-2 select-none">|</span>
                <span className="text-indigo-400/95 font-bold uppercase tracking-wider text-[10px]">{codecBadge}</span>
              </>
            )}
            {audioBadge && (
              <>
                <span className="text-zinc-600 mx-2 select-none">|</span>
                <span className="text-zinc-400/95 font-bold uppercase tracking-wider text-[10px]">{audioBadge}</span>
              </>
            )}
          </div>

          {/* Titles */}
          <div className="series-hero-animate space-y-2">
            {romajiTitle && (
              <h2 className="text-[var(--brand-secondary)] font-bold uppercase tracking-[0.25em] text-xs md:text-sm animate-ki-shimmer bg-gradient-to-r from-[var(--brand-secondary)] via-amber-500 to-brand-orange bg-clip-text text-transparent select-none drop-shadow-[0_2px_8px_rgba(255,110,58,0.25)]">
                {romajiTitle}
              </h2>
            )}
            <h1 className="font-sans font-extrabold leading-[1.05] tracking-tight text-white drop-shadow-[0_4px_25px_rgba(0,0,0,0.85)] cursor-pointer hover:text-[var(--brand-secondary)] transition-colors duration-500 z-10 relative select-none" style={{ fontSize: "max(2.5rem, min(5.5vw, 4.5rem))" }} onClick={onPlay}>
              {title}
            </h1>
          </div>

          {/* Synopsis */}
          <p className="series-hero-animate text-zinc-300 text-sm md:text-base leading-relaxed line-clamp-3 drop-shadow-md font-medium select-none max-w-2xl border-l-[3px] border-[var(--brand-secondary)]/20 pl-4 py-0.5">
            {synopsis}
          </p>

          {/* Cast list at the bottom of the left column */}
          {castList.length > 0 && (
            <p className="series-hero-animate text-zinc-400 text-xs font-semibold tracking-wide select-none drop-shadow-sm">
              {castList.join(", ")}
            </p>
          )}

          {/* Action Buttons */}
          <div className="series-hero-animate flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={onPlay}
              className="group/play relative flex items-center gap-4 px-9 py-4.5 bg-gradient-to-r from-[var(--brand-secondary)] via-orange-500 to-amber-500 text-white rounded-2xl overflow-hidden shadow-[0_12px_40px_rgba(255,110,58,0.35)] hover:shadow-[0_18px_50px_rgba(255,110,58,0.55)] transition-all duration-500 hover:scale-105 active:scale-95 border border-white/10 hover:border-[var(--brand-secondary)]/40"
            >
              {/* Glossy shine */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-transparent opacity-0 group-hover/play:opacity-100 transition-opacity duration-500 z-0" />
              {/* Glow halo */}
              <div className="absolute -inset-10 bg-[var(--brand-secondary)]/30 blur-xl group-hover/play:opacity-100 opacity-0 transition-opacity duration-500 -z-10 animate-pulse" />

              <div className="p-3 bg-black/40 backdrop-blur-[var(--blur-xl)] rounded-xl border border-white/10 text-white group-hover/play:bg-white group-hover/play:text-black transition-all duration-300 shadow-inner z-10 shrink-0">
                <Play className="w-4 h-4 fill-current" />
              </div>

              <div className="flex flex-col items-start z-10 select-none text-left">
                <span className="font-sans text-[14px] tracking-[0.15em] font-extrabold uppercase text-white transition-colors">
                  Reproducir
                </span>
                <span className="text-[9px] font-black text-white/60 tracking-[0.1em] uppercase transition-colors mt-0.5">
                  Comenzar episodio
                </span>
              </div>
            </button>

            {/* Queue Button */}
            {entry?.localFiles && entry.localFiles.length > 0 && (
              <button
                onClick={handleAddToQueue}
                className="group/queue flex items-center justify-center p-4.5 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-[var(--blur-card)] border border-[var(--glass-border)] rounded-2xl hover:bg-[var(--glass-hover)] hover:border-[var(--glass-strong)] transition-all duration-300 text-white/70 hover:text-white transition-all duration-300 shadow-lg"
                title="Añadir a la cola"
              >
                <ListPlus className="w-5 h-5 transition-transform group-hover/queue:-translate-y-0.5" />
              </button>
            )}
          </div>
        </div>

      </div>
    </section>
  )
}
