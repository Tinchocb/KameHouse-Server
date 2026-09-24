import { describe, it, expect } from "vitest"
import { SPAN_VOLUMES, compareInUniverse } from "./spansToVolumes"
import { CHRONOLOGY_INTERLUDES } from "./interludes"
import { DRAGON_BALL_MOVIES_LORE } from "@/lib/config/dragonball_movies_lore"

describe("Chronology interludes (lore entre lapsos)", () => {
  const sorted = [...SPAN_VOLUMES].sort(compareInUniverse)
  const pairInterludes = CHRONOLOGY_INTERLUDES.filter((il) => il.toVolumeId !== null)
  const epilogues = CHRONOLOGY_INTERLUDES.filter((il) => il.toVolumeId === null)

  it("cada par consecutivo del orden in-universe tiene exactamente un interludio", () => {
    expect(sorted.length).toBe(35)
    expect(pairInterludes.length).toBe(sorted.length - 1)

    const seen = new Set<string>()
    for (let i = 0; i < sorted.length - 1; i++) {
      const key = `${sorted[i].id}::${sorted[i + 1].id}`
      const matches = pairInterludes.filter(
        (il) => `${il.fromVolumeId}::${il.toVolumeId}` === key
      )
      expect(matches.length).toBe(1)
      seen.add(key)
    }
    expect(seen.size).toBe(sorted.length - 1)
  })

  it("ningún interludio apunta a un par no consecutivo", () => {
    const consecutive = new Set<string>()
    for (let i = 0; i < sorted.length - 1; i++) {
      consecutive.add(`${sorted[i].id}::${sorted[i + 1].id}`)
    }
    for (const il of pairInterludes) {
      expect(consecutive.has(`${il.fromVolumeId}::${il.toVolumeId}`)).toBe(true)
    }
  })

  it("hay un epílogo con toVolumeId null desde el último lapso", () => {
    expect(epilogues.length).toBe(1)
    const last = sorted[sorted.length - 1]
    expect(epilogues[0].fromVolumeId).toBe(last.id)
    expect(epilogues[0].toVolumeId).toBeNull()
  })

  it("todos los movieIds existen en DRAGON_BALL_MOVIES_LORE", () => {
    for (const il of CHRONOLOGY_INTERLUDES) {
      for (const movieId of il.movieIds ?? []) {
        expect(
          DRAGON_BALL_MOVIES_LORE[movieId],
          `movieId "${movieId}" del interludio "${il.id}"`
        ).toBeDefined()
      }
    }
  })

  it("ningún summary está vacío", () => {
    for (const il of CHRONOLOGY_INTERLUDES) {
      expect(il.summary.trim().length).toBeGreaterThan(0)
      expect(il.title.trim().length).toBeGreaterThan(0)
    }
  })
})
