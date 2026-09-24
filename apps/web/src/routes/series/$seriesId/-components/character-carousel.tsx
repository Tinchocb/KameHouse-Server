import { memo } from "react"
import type { CharacterDTO } from "@/api/types/series.types"
import { CharacterAvatar } from "./character-avatar"

interface CharacterCarouselProps {
  characters: CharacterDTO[]
  onSelect?: (name: string) => void
}

// Entrada CSS con stagger acotado (antes: stagger framer-motion con spring JS
// por avatar en cada cambio de saga). Mismo efecto, cero JS por frame.
const ENTER_STAGGER_CAP = 8
const ENTER_STAGGER_MS = 40

export const CharacterCarousel = memo(function CharacterCarousel({ characters, onSelect }: CharacterCarouselProps) {
  if (!characters || characters.length === 0) return null

  return (
    <div className="w-full py-6">
      <h3 className="font-display text-2xl tracking-widest text-on-surface/95 uppercase mb-4">Personajes Clave</h3>

      <div
        key={characters[0]?.name ?? "characters"}
        className="flex overflow-x-auto gap-4 pb-4 no-scrollbar snap-x"
      >
        {characters.map((char, idx) => (
          <div
            key={char.name ?? idx}
            className="snap-start min-w-[100px] animate-fade-in"
            style={{ animationDelay: `${Math.min(idx, ENTER_STAGGER_CAP) * ENTER_STAGGER_MS}ms` }}
          >
            <CharacterAvatar
              name={char.name}
              avatarUrl={char.avatarUrl}
              roleTag={char.roleTag}
              onSelect={onSelect}
            />
          </div>
        ))}
      </div>
    </div>
  )
})
