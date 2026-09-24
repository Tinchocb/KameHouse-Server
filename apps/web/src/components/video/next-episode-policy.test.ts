import { describe, expect, it } from "vitest"
import {
    getSegmentStatus,
    isNearEnd,
    shouldAutoAdvanceMarathon,
    shouldShowNextEpisode,
} from "./next-episode-policy"

describe("getSegmentStatus", () => {
    it("calcula restante y progreso", () => {
        expect(getSegmentStatus(40, 0, 85)).toEqual({ remaining: 45, progress: 47 })
        expect(getSegmentStatus(85, 0, 85)).toEqual({ remaining: 0, progress: 100 })
    })

    it("no divide por cero en ventanas degeneradas", () => {
        expect(getSegmentStatus(10, 10, 10)).toEqual({ remaining: 0, progress: 0 })
    })
})

describe("isNearEnd", () => {
    it("detecta cercanía por tiempo o ventana ED", () => {
        expect(isNearEnd(1400, 1250)).toBe(true)
        expect(isNearEnd(1400, 1000)).toBe(false)
        expect(isNearEnd(1400, 1000, 900)).toBe(true)
        expect(isNearEnd(0, 0)).toBe(false)
    })
})

const BASE = {
    mediaFormat: "TV",
    marathonMode: false,
    tvMode: false,
    hasNextEpisode: true,
    total: 1400,
    curr: 1000,
    inEdWindow: false,
}

describe("shouldShowNextEpisode", () => {
    it("muestra cerca del final o en ventana ED", () => {
        expect(shouldShowNextEpisode({ ...BASE, curr: 1390 })).toBe(true)
        expect(shouldShowNextEpisode({ ...BASE, inEdWindow: true })).toBe(true)
        expect(shouldShowNextEpisode(BASE)).toBe(false)
    })

    it("oculta en películas, maratón puro o sin siguiente", () => {
        expect(shouldShowNextEpisode({ ...BASE, curr: 1390, mediaFormat: "MOVIE" })).toBe(false)
        expect(shouldShowNextEpisode({ ...BASE, curr: 1390, marathonMode: true })).toBe(false)
        expect(shouldShowNextEpisode({ ...BASE, curr: 1390, hasNextEpisode: false })).toBe(false)
    })

    it("en TV usa umbral de 3s", () => {
        expect(shouldShowNextEpisode({ ...BASE, tvMode: true, curr: 1398 })).toBe(true)
        expect(shouldShowNextEpisode({ ...BASE, tvMode: true, curr: 1390 })).toBe(false)
    })
})

describe("shouldAutoAdvanceMarathon", () => {
    it("avanza al terminar o en últimos 3s", () => {
        const p = { marathonMode: true, hasNextEpisode: true, hasOnNext: true, mediaFormat: "TV", ended: false, total: 1400, curr: 1000 }
        expect(shouldAutoAdvanceMarathon(p)).toBe(false)
        expect(shouldAutoAdvanceMarathon({ ...p, curr: 1398 })).toBe(true)
        expect(shouldAutoAdvanceMarathon({ ...p, ended: true })).toBe(true)
    })

    it("no avanza sin maratón, sin siguiente o en películas", () => {
        const p = { marathonMode: true, hasNextEpisode: true, hasOnNext: true, mediaFormat: "TV", ended: true, total: 1400, curr: 1000 }
        expect(shouldAutoAdvanceMarathon({ ...p, marathonMode: false })).toBe(false)
        expect(shouldAutoAdvanceMarathon({ ...p, hasNextEpisode: false })).toBe(false)
        expect(shouldAutoAdvanceMarathon({ ...p, hasOnNext: false })).toBe(false)
        expect(shouldAutoAdvanceMarathon({ ...p, mediaFormat: "MOVIE" })).toBe(false)
    })
})
