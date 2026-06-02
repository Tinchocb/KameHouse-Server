import type { CharacterDTO } from "@/api/types/series.types"

interface CharacterCarouselProps {
  characters: CharacterDTO[]
}

export function CharacterCarousel({ characters }: CharacterCarouselProps) {
  if (!characters || characters.length === 0) return null

  return (
    <div className="w-full py-6">
      <h3 className="text-xl font-bold text-white mb-4">Personajes Clave</h3>
      
      <div className="flex overflow-x-auto gap-6 pb-4 scrollbar-hide snap-x">
        {characters.map((char, idx) => (
          <div key={idx} className="flex flex-col items-center gap-3 snap-start min-w-[100px] group cursor-pointer">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-transparent group-hover:border-amber-500 transition-colors duration-300 relative shadow-lg">
              <img 
                src={char.avatarUrl} 
                alt={char.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-white line-clamp-1">{char.name}</p>
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mt-0.5">{char.roleTag}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
