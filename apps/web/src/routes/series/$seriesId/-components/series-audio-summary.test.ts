import { describe, expect, it } from "vitest"
import type { Anime_LocalFile } from "@/api/generated/types"
import { summarizeSeriesAudio } from "./series-audio-summary"

const file = (technicalInfo: unknown) => ({ technicalInfo }) as unknown as Anime_LocalFile

describe("summarizeSeriesAudio", () => {
    it("junta doblajes y subtítulos de todos los archivos, con el japonés primero", () => {
        const summary = summarizeSeriesAudio([
            file({ videoStream: { width: 1920 }, audioStreams: [{ language: "spa-lat" }, { language: "jpn" }], subtitleStreams: [{ language: "spa" }] }),
            file({ videoStream: { width: 1280 }, audioStreams: [{ language: "jpn" }], subtitleStreams: [{ language: "spa" }, { language: "eng" }] }),
        ])
        expect(summary).toEqual({ dubs: ["Japonés", "Latino"], subs: ["Español", "Inglés"], quality: "1080p" })
    })

    it("distingue latino y castellano por el código o por el nombre de la pista", () => {
        expect(summarizeSeriesAudio([file({ audioStreams: [{ language: "spa", title: "Español Castellano" }] })]).dubs).toEqual(["Castellano"])
        expect(summarizeSeriesAudio([file({ audioStreams: [{ language: "und", title: "Latino" }] })]).dubs).toEqual(["Latino"])
        expect(summarizeSeriesAudio([file({ audioStreams: [{ language: "spa" }] })]).dubs).toEqual(["Español"])
    })

    it("sin archivos o sin datos técnicos no inventa nada", () => {
        expect(summarizeSeriesAudio(null)).toEqual({ dubs: [], subs: [], quality: null })
        expect(summarizeSeriesAudio([file(undefined)])).toEqual({ dubs: [], subs: [], quality: null })
    })

    it("ignora pistas sin idioma reconocible", () => {
        expect(summarizeSeriesAudio([file({ audioStreams: [{ language: "und", title: "Commentary" }] })]).dubs).toEqual([])
    })

    it("etiqueta la calidad según el ancho del video", () => {
        expect(summarizeSeriesAudio([file({ videoStream: { width: 3840 } })]).quality).toBe("4K")
        expect(summarizeSeriesAudio([file({ videoStream: { width: 720 } })]).quality).toBe("SD")
    })
})
