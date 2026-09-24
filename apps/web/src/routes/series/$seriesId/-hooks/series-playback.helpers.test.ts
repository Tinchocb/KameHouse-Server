import { describe, expect, it } from "vitest"
import type { Anime_Entry, Anime_Episode, Anime_LocalFile } from "@/api/generated/types"
import {
    candidatePath,
    findEpisodeForLocalFile,
    findNextPlayableEpisode,
    getResumeTimeForEpisode,
    isResumable,
    isWatchedProgress,
    resolveEpisodeTitle,
    selectDefaultTarget,
    selectTargetByNumber,
} from "./series-playback.helpers"

const ep = (n: number, extra: Partial<Anime_Episode> = {}) =>
    ({ episodeNumber: n, absoluteEpisodeNumber: n, watched: false, ...extra }) as Anime_Episode
const file = (n: number, extra: Partial<Anime_LocalFile> = {}) =>
    ({ path: `/anime/ep${n}.mkv`, name: `ep${n}.mkv`, metadata: { episode: n }, ...extra }) as unknown as Anime_LocalFile
const entry = (localFiles: Anime_LocalFile[], format = "TV") =>
    ({ media: { format }, localFiles }) as unknown as Anime_Entry

describe("resume rule (> 10 s y < 95 %)", () => {
    it("respeta los límites", () => {
        expect(isResumable(10, 1000)).toBe(false)
        expect(isResumable(11, 1000)).toBe(true)
        expect(isResumable(949, 1000)).toBe(true)
        expect(isResumable(950, 1000)).toBe(false)
        expect(isResumable(100, 0)).toBe(false)
    })

    it("marca visto a partir del 95 %", () => {
        expect(isWatchedProgress(940, 1000)).toBe(false)
        expect(isWatchedProgress(950, 1000)).toBe(true)
    })

    it("solo reanuda el episodio de continuity", () => {
        const item = { episodeNumber: 3, currentTime: 300, duration: 1400 }
        expect(getResumeTimeForEpisode(item, 3)).toBe(300)
        expect(getResumeTimeForEpisode(item, 4)).toBeUndefined()
        expect(getResumeTimeForEpisode(undefined, 3)).toBeUndefined()
    })
})

describe("selectDefaultTarget", () => {
    it("prioriza el episodio de continuity sobre el primero sin ver", () => {
        const eps = [ep(1, { watched: true }), ep(2), ep(3)]
        const c = selectDefaultTarget(entry([file(1), file(2), file(3)]), eps, 3)
        expect(c).toMatchObject({ kind: "episode", ep: { episodeNumber: 3 } })
        expect(candidatePath(c)).toBe("/anime/ep3.mkv")
    })

    it("ignora continuity huérfana y cae al primero sin ver", () => {
        const eps = [ep(1, { watched: true }), ep(2)]
        const c = selectDefaultTarget(entry([file(1), file(2)]), eps, 99)
        expect(c).toMatchObject({ kind: "episode", ep: { episodeNumber: 2 } })
    })

    it("películas usan archivos locales", () => {
        const c = selectDefaultTarget(entry([file(1), file(2)], "MOVIE"), [ep(1)], 2)
        expect(c).toMatchObject({ kind: "file", file: { path: "/anime/ep2.mkv" } })
    })

    it("sin archivos devuelve empty", () => {
        expect(selectDefaultTarget(entry([]), [], null)).toEqual({ kind: "empty" })
        expect(selectDefaultTarget(null, [], null)).toEqual({ kind: "empty" })
        expect(candidatePath({ kind: "empty" })).toBeNull()
    })
})

describe("selectTargetByNumber", () => {
    const files = [file(1), file(2), file(5)]
    const eps = [ep(1), ep(2), ep(3), ep(5)]

    it("resuelve el episodio exacto", () => {
        expect(selectTargetByNumber(eps, files, 2)).toMatchObject({ kind: "episode", ep: { episodeNumber: 2 } })
    })

    it("salta huecos sin archivo hasta el siguiente reproducible", () => {
        const t = selectTargetByNumber(eps, files, 3)
        expect(t).toMatchObject({ kind: "episode", ep: { episodeNumber: 5 }, skippedFrom: 3 })
    })

    it("cae a archivos locales sin metadatos", () => {
        expect(selectTargetByNumber([], files, 4)).toMatchObject({ kind: "file", file: { path: "/anime/ep5.mkv" } })
    })

    it("NaN / inexistente → not-found; existente sin archivo → missing-file", () => {
        expect(selectTargetByNumber(eps, files, Number("abc"))).toEqual({ kind: "not-found" })
        expect(selectTargetByNumber(eps, files, 9)).toEqual({ kind: "not-found" })
        expect(selectTargetByNumber([ep(1), ep(7)], [file(1)], 7)).toEqual({ kind: "missing-file" })
    })
})

describe("findNextPlayableEpisode", () => {
    it("salta episodios sin archivo", () => {
        const eps = [ep(1), ep(2), ep(3)]
        expect(findNextPlayableEpisode(eps, [file(1), file(3)], 1)).toMatchObject({ ep: { episodeNumber: 3 } })
    })

    it("null al final o si el actual no está en la lista", () => {
        expect(findNextPlayableEpisode([ep(1)], [file(1)], 1)).toBeNull()
        expect(findNextPlayableEpisode([ep(1)], [file(1)], 42)).toBeNull()
    })
})

describe("findEpisodeForLocalFile", () => {
    it("respeta la temporada cuando ambos la declaran", () => {
        const eps = [
            ep(3, { absoluteEpisodeNumber: 10, seasonNumber: 1 }),
            ep(3, { absoluteEpisodeNumber: 15, seasonNumber: 2 }),
        ]
        const lf = file(3, { metadata: undefined, parsedInfo: { episode: 3, season: 2 } } as unknown as Partial<Anime_LocalFile>)
        expect(findEpisodeForLocalFile(eps, lf)?.absoluteEpisodeNumber).toBe(15)
    })
})

describe("resolveEpisodeTitle", () => {
    it("usa la cadena de fallbacks", () => {
        expect(resolveEpisodeTitle(ep(4, { titleSpanish: "Hola" }), null)).toBe("Hola")
        expect(resolveEpisodeTitle(ep(4), null)).toBe("Episodio 4")
    })
})
