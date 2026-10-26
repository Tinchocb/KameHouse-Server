import { describe, expect, it } from "vitest"
import type { VolumeData } from "../types"
import { ERA_KEYS } from "./eraBar"
import {
    AIR_YEARS_BY_ERA,
    TIMELINE_ORDERS,
    compareRelease,
    eraKeysForOrder,
    parseTimelineOrder,
} from "./releaseOrder"

type Vol = Parameters<typeof compareRelease>[0]
const vol = (p: Partial<Vol>): Vol => p as Vol

describe("órdenes de la línea de tiempo", () => {
    it("hay dos órdenes: la cronológica y la de estreno", () => {
        expect(TIMELINE_ORDERS).toEqual(["chronological", "release"])
    })

    it("un valor desconocido o ausente cae en la cronológica", () => {
        expect(parseTimelineOrder("release")).toBe("release")
        expect(parseTimelineOrder("lo que sea")).toBe("chronological")
        expect(parseTimelineOrder(null)).toBe("chronological")
        expect(parseTimelineOrder(undefined)).toBe("chronological")
    })
})

describe("compareRelease (orden de estreno)", () => {
    it("ordena por serie según la fecha de emisión", () => {
        const classic = vol({ seriesId: "classic" as VolumeData["seriesId"], startEpisode: 150, order: 0 })
        const z = vol({ seriesId: "z" as VolumeData["seriesId"], startEpisode: 1, order: 0 })
        expect(compareRelease(classic, z)).toBeLessThan(0)
        expect(compareRelease(z, classic)).toBeGreaterThan(0)
    })

    it("dentro de la misma serie, el episodio de inicio decide; después el orden interno", () => {
        const a = vol({ seriesId: "z" as VolumeData["seriesId"], startEpisode: 5, order: 9 })
        const b = vol({ seriesId: "z" as VolumeData["seriesId"], startEpisode: 10, order: 0 })
        expect(compareRelease(a, b)).toBeLessThan(0)

        const c = vol({ seriesId: "z" as VolumeData["seriesId"], startEpisode: 5, order: 1 })
        expect(compareRelease(c, a)).toBeLessThan(0)
    })

    it("un volumen sin serie va al final", () => {
        const sinSerie = vol({ seriesId: undefined, startEpisode: 1, order: 0 })
        const daima = vol({ seriesId: "daima" as VolumeData["seriesId"], startEpisode: 1, order: 0 })
        expect(compareRelease(sinSerie, daima)).toBeGreaterThan(0)
    })
})

describe("eras en el orden de la barra", () => {
    it("la cronológica usa el orden in-universe tal cual", () => {
        expect(eraKeysForOrder("chronological")).toEqual(ERA_KEYS)
    })

    it("la de estreno pone las eras por año de emisión", () => {
        expect(eraKeysForOrder("release")).toEqual(["db-clasico", "db-z", "db-gt", "db-super", "db-daima"])
    })

    it("los años de emisión son a nivel de serie", () => {
        expect(AIR_YEARS_BY_ERA["db-z"]).toBe("1989–1996")
        expect(AIR_YEARS_BY_ERA["db-daima"]).toBe("2024–2025")
    })
})
