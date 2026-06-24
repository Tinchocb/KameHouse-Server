import React from "react"
import { Play, Check } from "lucide-react"
import type { PremiumEpisode } from "@/api/types/series.types"
import { cn } from "@/components/ui/core/styling"

interface PremiumEpisodeListProps {
  episodes: PremiumEpisode[]
  activeSubSagaStart?: number
  activeSubSagaEnd?: number
  onPlay?: (episodeNumber: number) => void
  onPreload?: (filePath: string) => void
}

export function PremiumEpisodeList({ 
  episodes,
  activeSubSagaStart,
  activeSubSagaEnd,
  onPlay,
  onPreload
}: PremiumEpisodeListProps) {
  const preloadTimeoutsRef = React.useRef<Map<string, NodeJS.Timeout>>(new Map())

  const handleMouseEnter = (ep: PremiumEpisode) => {
    if (!ep.localFilePath || !onPreload) return
    
    // Debounce: wait 300ms before preloading to avoid accidental triggers
    const existing = preloadTimeoutsRef.current.get(ep.id)
    if (existing) clearTimeout(existing)
    
    const timeout = setTimeout(() => {
      onPreload(ep.localFilePath!)
      preloadTimeoutsRef.current.delete(ep.id)
    }, 300)
    
    preloadTimeoutsRef.current.set(ep.id, timeout)
  }

  const handleMouseLeave = (ep: PremiumEpisode) => {
    const existing = preloadTimeoutsRef.current.get(ep.id)
    if (existing) {
      clearTimeout(existing)
      preloadTimeoutsRef.current.delete(ep.id)
    }
  }

  React.useEffect(() => {
    return () => {
      preloadTimeoutsRef.current.forEach(t => clearTimeout(t))
      preloadTimeoutsRef.current.clear()
    }
  }, [])

  return (
    <div className="flex flex-col gap-4 mt-6">
      {episodes.map((ep) => {
        const isHighlighted = activeSubSagaStart != null && 
                            activeSubSagaEnd != null && 
                            ep.number >= activeSubSagaStart && 
                            ep.number <= activeSubSagaEnd;
        return (
          <div 
            key={ep.id}
            id={`episode-${ep.number}`}
            onClick={() => onPlay?.(ep.number)}
            onMouseEnter={() => handleMouseEnter(ep)}
            onMouseLeave={() => handleMouseLeave(ep)}
            className={cn(
              "group flex gap-6 p-4 rounded-xl transition-all duration-300 cursor-pointer shadow-lg",
              isHighlighted
                ? "liquid-glass-frosted liquid-glass-frosted-interactive !bg-brand-orange/[0.03] !border-brand-orange/20 border-l-[3.5px] !border-l-brand-orange shadow-[0_8px_24px_rgba(255,110,58,0.04)] hover:!bg-brand-orange/[0.06] hover:!border-brand-orange/30"
                : "liquid-glass-frosted liquid-glass-frosted-interactive"
            )}
          >
          {/* Thumbnail */}
          <div className="relative w-72 md:w-80 aspect-video rounded-lg overflow-hidden flex-shrink-0 bg-gray-900 shadow-md">
            <img 
              src={ep.thumbnailUrl} 
              alt={ep.title}
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
            />
            {/* Play Overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300 cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/40">
                <Play className="w-6 h-6 text-white ml-1" fill="currentColor" />
              </div>
            </div>
            
            {/* Progress/Watched Indicator */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
              {ep.isWatched && <div className="h-full bg-amber-500 w-full" />}
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-col justify-center flex-grow min-w-0 py-1">
            <div className="flex justify-between items-start mb-1">
              <h4 className="text-lg font-bold text-white truncate">
                <span className="text-gray-400 mr-2">{ep.number}.</span>
                {ep.title}
              </h4>
              
              {/* Type Badge */}
              {ep.episodeType === 'Filler' && (
                <span className="text-[10px] font-mono uppercase bg-red-900/40 text-red-400 border border-red-900/50 px-2 py-0.5 rounded">
                  Filler
                </span>
              )}
              {ep.episodeType === 'Hyped' && (
                <span className="text-[10px] font-mono uppercase bg-amber-900/40 text-amber-400 border border-amber-900/50 px-2 py-0.5 rounded shadow-[0_0_8px_rgba(245,158,11,0.2)]">
                  Premium
                </span>
              )}
            </div>

            <p className="text-sm text-gray-400 line-clamp-2 mb-4 leading-relaxed">
              {ep.description}
            </p>

            {/* Technical Pills & Status */}
            <div className="flex items-center justify-between mt-auto">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-medium liquid-glass-frosted-subtle text-gray-300 px-2.5 py-1 rounded-md">
                  {ep.resolution}
                </span>
                <span className="text-[10px] font-mono font-medium liquid-glass-frosted-subtle text-gray-300 px-2.5 py-1 rounded-md">
                  {ep.videoCodec}
                </span>
                <span className="text-[10px] font-mono font-medium liquid-glass-frosted-subtle text-gray-300 px-2.5 py-1 rounded-md">
                  {ep.audioCodec}
                </span>
              </div>
              
              <div className="flex items-center justify-center w-6 h-6 rounded-full border border-gray-600 group-hover:border-gray-400 transition-colors">
                {ep.isWatched && <Check className="w-3.5 h-3.5 text-amber-500" strokeWidth={3} />}
              </div>
            </div>
          </div>
        </div>
      )})}
    </div>
  )
}
