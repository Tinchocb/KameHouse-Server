import { Play, Plus, Info } from "lucide-react"

interface SeriesHeroProps {
  title: string
  romajiTitle?: string
  backdropUrl: string
  rating?: number
  year?: number
  ageRating?: string
  sagaCount?: number
  synopsis: string
}

export function SeriesHero({
  title,
  romajiTitle,
  backdropUrl,
  rating,
  year,
  ageRating,
  sagaCount,
  synopsis,
}: SeriesHeroProps) {
  return (
    <div className="relative w-full h-[60vh] min-h-[500px] flex items-end">
      {/* Background Image with absolute positioning */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img
          src={backdropUrl}
          alt={title}
          className="w-full h-full object-cover opacity-75"
        />
        {/* Cinematic blend gradients with luxury non-linear falloff */}
        <div 
          className="absolute inset-0 z-[1]" 
          style={{
            background: 'linear-gradient(to right, #050506 0%, #050506 20%, rgba(5, 5, 6, 0.95) 35%, rgba(5, 5, 6, 0.7) 50%, rgba(5, 5, 6, 0.2) 75%, transparent 100%)'
          }}
        />
        <div 
          className="absolute inset-0 z-[1]" 
          style={{
            background: 'linear-gradient(to top, #050506 0%, rgba(5, 5, 6, 0.9) 15%, rgba(5, 5, 6, 0.4) 40%, transparent 80%)'
          }}
        />
      </div>

      {/* Content Container */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-8 pb-12">
        <div className="max-w-2xl space-y-6">
          {/* Titles */}
          <div className="space-y-1">
            {romajiTitle && (
              <h2 className="text-amber-500/80 text-lg font-medium tracking-wide uppercase">
                {romajiTitle}
              </h2>
            )}
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight drop-shadow-2xl">
              {title}
            </h1>
          </div>

          {/* Metadata Row */}
          <div className="flex items-center space-x-4 text-sm font-semibold text-gray-300">
            {rating && (
              <span className="text-green-400 drop-shadow-md">
                {(rating).toFixed(1)} TMDB
              </span>
            )}
            {year && <span>{year}</span>}
            {ageRating && (
              <span className="px-2 py-0.5 border border-gray-600 rounded-sm text-gray-400">
                {ageRating}
              </span>
            )}
            {sagaCount !== undefined && (
              <span>{sagaCount} Sagas</span>
            )}
            <span className="px-2 py-0.5 bg-white/10 rounded-sm text-gray-300">
              HD
            </span>
          </div>

          {/* Synopsis */}
          <p className="text-gray-300 text-lg leading-relaxed line-clamp-3 drop-shadow-md">
            {synopsis}
          </p>

          {/* Action Buttons */}
          <div className="flex items-center space-x-4 pt-4">
            <button className="flex items-center space-x-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white px-8 py-3 rounded-md font-bold transition-all duration-300 hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(245,158,11,0.3)] group">
              <Play className="w-6 h-6 fill-current group-hover:scale-110 transition-transform" />
              <span>REPRODUCIR S1:E1</span>
            </button>
            <button className="flex items-center justify-center w-12 h-12 rounded-full border-2 border-white/30 hover:border-white text-white transition-colors bg-black/20 hover:bg-white/10 backdrop-blur-sm">
              <Plus className="w-6 h-6" />
            </button>
            <button className="flex items-center justify-center w-12 h-12 rounded-full border-2 border-white/30 hover:border-white text-white transition-colors bg-black/20 hover:bg-white/10 backdrop-blur-sm">
              <Info className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
