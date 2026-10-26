import { memo } from "react"
import type { CharacterDTO } from "@/api/types/series.types"
import { CharacterAvatar } from "./character-avatar"

interface CharacterCarouselProps {
  characters: CharacterDTO[]
  sagaId?: string
  onSelect?: (name: string) => void
}

// Entrada CSS con stagger acotado (antes: stagger framer-motion con spring JS
// por avatar en cada cambio de saga). Mismo efecto, cero JS por frame.
const ENTER_STAGGER_CAP = 8
const ENTER_STAGGER_MS = 40

export const CharacterCarousel = memo(function CharacterCarousel({ characters, sagaId, onSelect }: CharacterCarouselProps) {
  if (!characters || characters.length === 0) return null

  const carouselKey = sagaId ?? (characters.map(c => c.name).slice(0, 4).join("-") || "characters")

  return (
    <section aria-label="Personajes" className="w-full">
      <h2 className="type-title font-bold text-on-surface mb-4">Personajes</h2>

      {/* px-1/pt-1 dan 4 px al anillo de foco (outline 2 px + offset 2 px) dentro
          del recorte del scroller; -mx-1/-mt-1 lo compensan para no mover los avatares.
          scroll-px-1 mantiene ese margen al hacer snap. */}
      <div
        key={carouselKey}
        className="flex overflow-x-auto gap-4 -mx-1 -mt-1 px-1 pt-1 pb-4 scroll-px-1 no-scrollbar snap-x"
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
    </section>
  )
})
