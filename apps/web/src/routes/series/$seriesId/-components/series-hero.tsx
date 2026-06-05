import { Play, Plus, Info, Star, Sparkles, Film } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "@/components/shared/deferred-image"
import { getLowResImage, getMediumResImage } from "@/lib/helpers/images"
import * as React from "react"

interface SeriesHeroProps {
  title: string
  romajiTitle?: string
  backdropUrl: string
  posterUrl?: string
  rating?: number
  year?: number
  ageRating?: string
  sagaCount?: number
  synopsis: string
  onPlay?: () => void
}

export function SeriesHero({
  title,
  romajiTitle,
  backdropUrl,
  posterUrl,
  rating,
  year,
  ageRating,
  sagaCount,
  synopsis,
  onPlay,
}: SeriesHeroProps) {
  // Dynamic gradient fallback if no posterUrl
  const stringToColor = (str: string) => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    const h = Math.abs(hash % 360)
    return `hsl(${h}, 60%, 12%)`
  }
  const accentColor = stringToColor(title)

  return (
    <section className="relative w-full min-h-[60vh] md:min-h-[70vh] flex flex-col justify-end overflow-hidden bg-[#050506] select-none">
      {/* Cinematic Grain Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay z-20"
        style={{ backgroundImage: `url("https://grainy-gradients.vercel.app/noise.svg")` }}
      />

      {/* Ambient Blur Background */}
      <div className="absolute inset-0 overflow-hidden bg-[#050506] z-0">
        {posterUrl ? (
          <div
            className="absolute left-1/2 top-0 -translate-x-1/2 w-full h-full opacity-35"
            style={{
              backgroundImage: `url(${getLowResImage(posterUrl)})`,
              backgroundSize: "cover",
              backgroundPosition: "center 20%",
              filter: "blur(120px) saturate(150%) brightness(0.25)",
            }}
          />
        ) : (
          <div 
            className="absolute inset-0 opacity-30 blur-[150px]"
            style={{ 
              background: `radial-gradient(circle at 50% 30%, ${accentColor}, transparent 80%)` 
            }}
          />
        )}
      </div>

      {/* High Res Crisp Backdrop */}
      {backdropUrl && (
        <div 
          className="absolute inset-0 overflow-hidden cursor-pointer z-0 group/backdrop"
          onClick={onPlay}
        >
          <DeferredImage
            src={backdropUrl}
            alt={title}
            className="w-full h-full object-cover object-center opacity-40 grayscale-[0.05] transition-all duration-1000 scale-[1.01] group-hover/backdrop:scale-105 group-hover/backdrop:opacity-55"
          />
        </div>
      )}

      {/* Cinematic Gradient Masking */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#050506] via-[#050506]/50 to-transparent opacity-100 z-10 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#050506]/95 via-transparent to-transparent opacity-100 z-10 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#050506]/15 via-transparent to-transparent opacity-100 z-10 pointer-events-none" />

      {/* Content Container */}
      <div className="relative z-20 w-full max-w-[1500px] mx-auto px-6 sm:px-12 pb-14 pt-48 flex flex-col items-start gap-5">
        <div className="max-w-3xl space-y-5">
          
          {/* Metadata Row */}
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-zinc-300">
            {rating && (
              <div className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-brand-orange to-amber-500 text-black font-black text-[10px] tracking-widest rounded shadow-md">
                <Star size={10} fill="currentColor" className="stroke-none" />
                {(rating).toFixed(1)} Ki
              </div>
            )}
            {year && (
              <div className="px-2.5 py-1 bg-white/5 backdrop-blur-md text-white/80 border border-white/10 rounded font-black text-[10px] tracking-widest uppercase">
                {year}
              </div>
            )}
            {ageRating && (
              <span className="px-2.5 py-1 bg-white/5 backdrop-blur-md text-zinc-400 border border-white/10 rounded font-black text-[10px] tracking-widest uppercase">
                {ageRating}
              </span>
            )}
            {sagaCount !== undefined && (
              <span className="px-2.5 py-1 bg-white/5 backdrop-blur-md text-zinc-400 border border-white/10 rounded font-black text-[10px] tracking-widest uppercase">
                {sagaCount} Sagas
              </span>
            )}
            <span className="px-2.5 py-1 bg-gradient-to-r from-brand-orange/20 to-orange-500/20 backdrop-blur-md text-brand-orange border border-brand-orange/30 rounded font-black text-[10px] tracking-widest uppercase flex items-center gap-1 shadow-sm">
              <Film size={10} className="animate-pulse" />
              SERIE
            </span>
          </div>

          {/* Titles */}
          <div className="space-y-1">
            {romajiTitle && (
              <h2 className="text-brand-orange font-bold uppercase tracking-[0.15em] text-xs md:text-sm animate-ki-shimmer bg-gradient-to-r from-brand-orange via-amber-500 to-brand-orange bg-clip-text text-transparent">
                {romajiTitle}
              </h2>
            )}
            <h1 className="text-[clamp(2.5rem,6vw,5.5rem)] font-bebas font-normal leading-[0.9] tracking-wider text-white uppercase drop-shadow-[0_4px_30px_rgba(0,0,0,0.85)] cursor-pointer hover:text-brand-orange transition-colors duration-300" onClick={onPlay}>
              {title}
            </h1>
          </div>

          {/* Synopsis */}
          <p className="text-zinc-400 text-sm md:text-base leading-relaxed line-clamp-3 drop-shadow-md font-medium select-none">
            {synopsis}
          </p>

          {/* Action Buttons */}
          <div className="flex items-center gap-4 pt-3">
            <button 
              onClick={onPlay}
              className="group/play relative flex items-center gap-4 px-8 py-4 bg-gradient-to-r from-brand-orange via-orange-500 to-amber-500 text-white rounded-2xl overflow-hidden shadow-[0_10px_35px_rgba(255,110,58,0.3)] hover:shadow-[0_15px_45px_rgba(255,110,58,0.5)] transition-all duration-500 hover:scale-105 active:scale-95 border border-white/10 hover:border-brand-orange/40"
            >
              {/* Glossy shine */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-transparent opacity-0 group-hover/play:opacity-100 transition-opacity duration-500 z-0" />
              {/* Glow halo */}
              <div className="absolute -inset-10 bg-brand-orange/30 blur-xl group-hover/play:opacity-100 opacity-0 transition-opacity duration-500 -z-10 animate-pulse" />

              <div className="p-2.5 bg-black/40 backdrop-blur-xl rounded-xl border border-white/10 text-white group-hover/play:bg-white group-hover/play:text-black transition-all duration-300 shadow-inner z-10 shrink-0">
                <Play className="w-4 h-4 fill-current" />
              </div>
              
              <div className="flex flex-col items-start z-10 select-none text-left">
                <span className="font-bebas text-[16px] tracking-[0.2em] font-black uppercase text-white transition-colors">
                  Reproducir
                </span>
                <span className="text-[9px] font-black text-white/60 tracking-[0.1em] uppercase transition-colors mt-0.5">
                  Comenzar episodio
                </span>
              </div>
            </button>
            <button className="flex items-center justify-center p-4 rounded-2xl border bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300 hover:scale-105 active:scale-95">
              <Plus className="w-5 h-5" />
            </button>
            <button className="flex items-center justify-center p-4 rounded-2xl border bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300 hover:scale-105 active:scale-95">
              <Info className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
