
interface MovieHeroWidescreenProps {
  title: string
  romajiTitle?: string
  backdropUrl: string
  collectionNumber?: number
  rating?: number
}

export function MovieHeroWidescreen({
  title,
  romajiTitle,
  backdropUrl,
  collectionNumber,
  rating,
}: MovieHeroWidescreenProps) {
  return (
    <div className="relative w-full h-[55vh] min-h-[450px] flex items-end">
      {/* Background Image with absolute positioning */}
      <div className="absolute inset-0 z-0">
        <img
          src={backdropUrl}
          alt={title}
          className="w-full h-full object-cover"
        />
        {/* Gradients to blend into the background (#050506) */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050506] via-[#050506]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050506]/90 via-[#050506]/40 to-transparent" />
      </div>

      {/* Content Container */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-8 pb-12">
        <div className="max-w-3xl space-y-4">
          
          {/* Metadata Badges */}
          <div className="flex items-center space-x-3 text-sm font-bold text-gray-300">
            {collectionNumber && (
              <span className="px-2 py-1 bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded uppercase tracking-wider text-[10px] shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                Película {collectionNumber}
              </span>
            )}
            {rating && (
              <span className="text-green-400 drop-shadow-md">
                {(rating).toFixed(1)} TMDB
              </span>
            )}
            {romajiTitle && (
              <span className="text-gray-400 font-medium tracking-wide">
                {romajiTitle}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-white tracking-tight drop-shadow-2xl">
            {title}
          </h1>
        </div>
      </div>
    </div>
  )
}
