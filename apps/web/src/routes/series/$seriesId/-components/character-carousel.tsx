import type { CharacterDTO } from "@/api/types/series.types"

interface CharacterCarouselProps {
  characters: CharacterDTO[]
  onSelect?: (name: string) => void
}

export function CharacterCarousel({ characters, onSelect }: CharacterCarouselProps) {
  if (!characters || characters.length === 0) return null

  return (
    <div className="w-full py-6">
      <h3 className="text-xl font-bold text-on-surface mb-4">Personajes Clave</h3>
      
      <div className="flex overflow-x-auto gap-6 pb-4 scrollbar-hide snap-x">
        {characters.map((char, idx) => (
          <div 
            key={idx} 
            onClick={() => onSelect?.(char.name)}
            className="flex flex-col items-center gap-3 snap-start min-w-[100px] group cursor-pointer"
          >
            <div 
              className="w-24 h-24 rounded-full overflow-hidden border-2 border-transparent group-hover:border-brand-secondary/60 group-hover:shadow-[0_0_20px_rgba(255,110,58,0.25)] transition-all relative shadow-elevation-2 group-hover:-translate-y-1 transform-gpu"
              style={{ transition: "all 600ms cubic-bezier(0.16, 1, 0.3, 1)" }}
            >
              <img 
                src={char.avatarUrl} 
                alt={char.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out transform-gpu"
              />
              <div className="absolute inset-0 bg-surface/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-on-surface line-clamp-1">{char.name}</p>
              <p className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wider mt-0.5">{char.roleTag}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
