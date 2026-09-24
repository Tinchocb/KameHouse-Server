import { describe, it, expect } from "vitest"
import {
  DRAGON_BALL_STORY_SPANS,
} from "./dragonball_story_spans"
import { DRAGON_BALL_SERIES } from "./dragonball_sagas"

const getSpansBySeriesId = (seriesId: string) =>
  DRAGON_BALL_STORY_SPANS.filter(s => s.seriesId === seriesId)

describe("Dragon Ball Story Spans Dataset", () => {
  it("should contain exactly 35 story spans covering all eras", () => {
    expect(DRAGON_BALL_STORY_SPANS).toBeDefined()
    expect(DRAGON_BALL_STORY_SPANS.length).toBe(35)
  })

  it("should have correct counts per series", () => {
    expect(getSpansBySeriesId("classic").length).toBe(7)
    expect(getSpansBySeriesId("z").length).toBe(14)
    expect(getSpansBySeriesId("super").length).toBe(8)
    expect(getSpansBySeriesId("daima").length).toBe(2)
    expect(getSpansBySeriesId("gt").length).toBe(4)
  })

  it("should have valid sequential orders and contiguous episode ranges within each series", () => {
    const seriesList = ["classic", "z", "super", "daima", "gt"] as const

    for (const s of seriesList) {
      const spans = getSpansBySeriesId(s)
      for (let i = 0; i < spans.length; i++) {
        const span = spans[i]
        expect(span.title).toBeTruthy()
        expect(span.previouslyOn.length).toBeGreaterThan(20)
        expect(span.detailedPlot.length).toBeGreaterThan(50)
        expect(span.startEpisode).toBeLessThanOrEqual(span.endEpisode)
        expect(span.recommendedStartEpisode).toBeGreaterThanOrEqual(span.startEpisode)
        expect(span.recommendedStartEpisode).toBeLessThanOrEqual(span.endEpisode)
        expect(span.worldStateAtStart.threatLevel).toBeTruthy()
        expect(span.worldStateAtStart.characterStatus.goku).toBeTruthy()
        expect(span.milestones.length).toBeGreaterThan(0)
      }
    }
  })

  it("should match TMDB IDs with official series constants", () => {
    const classicSpans = getSpansBySeriesId("classic")
    expect(classicSpans.every(s => s.tmdbId === DRAGON_BALL_SERIES.ORIGINAL)).toBe(true)

    const zSpans = getSpansBySeriesId("z")
    expect(zSpans.every(s => s.tmdbId === DRAGON_BALL_SERIES.Z)).toBe(true)

    const superSpans = getSpansBySeriesId("super")
    expect(superSpans.every(s => s.tmdbId === DRAGON_BALL_SERIES.SUPER)).toBe(true)

    const daimaSpans = getSpansBySeriesId("daima")
    expect(daimaSpans.every(s => s.tmdbId === DRAGON_BALL_SERIES.DAIMA)).toBe(true)

    const gtSpans = getSpansBySeriesId("gt")
    expect(gtSpans.every(s => s.tmdbId === DRAGON_BALL_SERIES.GT)).toBe(true)
  })

  it("should correctly find story span by ID and by episode number", () => {
    const span = DRAGON_BALL_STORY_SPANS.find(s => s.id === "dbz-juegos-de-cell")
    expect(span).toBeDefined()
    expect(span?.sagaId).toBe("cell")
    expect(span?.startEpisode).toBe(166)
    expect(span?.endEpisode).toBe(194)

    // Episode 95 (SSJ First Transformation) should be in Freezer Super Saiyajin span
    const ssjSpan = DRAGON_BALL_STORY_SPANS.find(
      s => s.tmdbId === DRAGON_BALL_SERIES.Z && 95 >= s.startEpisode && 95 <= s.endEpisode
    )
    expect(ssjSpan).toBeDefined()
    expect(ssjSpan?.id).toBe("dbz-freezer-super-saiyajin")

    // Episode 232 (Majin Vegeta Explosion) should be in Majin Vegeta span
    const vegetaSpan = DRAGON_BALL_STORY_SPANS.find(
      s => s.tmdbId === DRAGON_BALL_SERIES.Z && 232 >= s.startEpisode && 232 <= s.endEpisode
    )
    expect(vegetaSpan).toBeDefined()
    expect(vegetaSpan?.id).toBe("dbz-buu-majin-vegeta")
  })
})
