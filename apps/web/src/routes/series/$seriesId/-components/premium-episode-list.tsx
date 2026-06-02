import { Play, Check } from "lucide-react"
import type { PremiumEpisode } from "@/api/types/series.types"

interface PremiumEpisodeListProps {
  episodes: PremiumEpisode[]
}

export function PremiumEpisodeList({ episodes }: PremiumEpisodeListProps) {
  return (
    <div className="flex flex-col gap-4 mt-6">
      {episodes.map((ep) => (
        <div 
          key={ep.id}
          id={`episode-${ep.number}`}
          className="group flex gap-6 p-4 rounded-xl hover:bg-white/5 transition-all duration-300 border border-transparent hover:border-white/10"
        >
          {/* Thumbnail */}
          <div className="relative w-64 aspect-video rounded-lg overflow-hidden flex-shrink-0 bg-gray-900 shadow-md">
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
              {ep.episodeType === 'Canon' && (
                <span className="text-[10px] font-mono uppercase bg-blue-900/40 text-blue-400 border border-blue-900/50 px-2 py-0.5 rounded">
                  Canon
                </span>
              )}
            </div>

            <p className="text-sm text-gray-400 line-clamp-2 mb-4 leading-relaxed">
              {ep.description}
            </p>

            {/* Technical Pills & Status */}
            <div className="flex items-center justify-between mt-auto">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-medium bg-white/10 text-gray-300 px-2 py-1 rounded-sm">
                  {ep.resolution}
                </span>
                <span className="text-[10px] font-mono font-medium bg-white/10 text-gray-300 px-2 py-1 rounded-sm">
                  {ep.videoCodec}
                </span>
                <span className="text-[10px] font-mono font-medium bg-white/10 text-gray-300 px-2 py-1 rounded-sm">
                  {ep.audioCodec}
                </span>
              </div>
              
              <div className="flex items-center justify-center w-6 h-6 rounded-full border border-gray-600 group-hover:border-gray-400 transition-colors">
                {ep.isWatched && <Check className="w-3.5 h-3.5 text-amber-500" strokeWidth={3} />}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
