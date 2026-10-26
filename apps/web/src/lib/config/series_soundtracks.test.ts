import { describe, expect, it, vi } from "vitest"
import { getSeriesEraKey, resolveSeriesSoundtrackPlaylist } from "./series_soundtracks"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

vi.mock("@/api/client/server-url", () => ({ getServerBaseUrl: () => "http://localhost:43211" }))

describe("soundtracks instrumentales por serie", () => {
    it.each([
        ["dragon_ball", "db"], ["dragon_ball_z", "dbz"],
        ["dragon_ball_kai", "dbkai"], ["dragon_ball_gt", "dbgt"],
        ["dragon_ball_super", "dbs"], ["dragon_ball_daima", "dbdaima"],
        ["Dragon Ball Z Kai OST", "dbkai"], [12971, "dbz"], [61709, "dbkai"],
    ])("reconoce %s como %s", (id, era) => {
        expect(getSeriesEraKey(id)).toBe(era)
    })

    it("no confunde palabras que contienen gt o super con una serie", () => {
        expect(getSeriesEraKey("night theme")).toBeNull()
        expect(getSeriesEraKey("supermarket")).toBeNull()
    })

    const tracks = [
        "Dragon Ball - Makafushigi Adventure instrumental.m4a",
        "Dragon Ball Z - Cha-La Head-Cha-La karaoke.mp3",
        "Dragon Ball Z Kai - Dragon Soul off-vocal.mp3",
        "Dragon Ball GT - Dan Dan Kokoro Hikareteku sin voz.mp3",
        "Dragon Ball Super - Chouzetsu Dynamic instrumental.mp3",
        "Dragon Ball Daima - Jaka Jaan instrumental.mp3",
        "Dragon Ball Z - Faulconer Battle.mp3",
        "Dragon Ball Z - Cha-La Head-Cha-La.mp3",
        "Dragon Ball GT - Dan Dan Kokoro Hikareteku.mp3",
        "Dragon Ball Super - OP1.mp3",
        "Dragon Ball Daima - English Dub.mp3",
        "Dragon Ball Z - vocal theme.mp3",
    ].map(file => ({ name: file, file }))

    it.each(["db", "dbz", "dbkai", "dbgt", "dbs", "dbdaima"])("elige el opening instrumental de %s sin mezclar series ni versiones con voz", era => {
        const result = resolveSeriesSoundtrackPlaylist(era, tracks, "D:/OST japonesa")
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({ seriesKey: era, isLocal: true })
        const url = new URL(result[0].url)
        expect(url.searchParams.get("dir")).toBe("D:/OST japonesa")
        expect(url.searchParams.get("file")).toBe(result[0].title)
    })

    it.each(["db", "dbz", "dbkai", "dbgt", "dbs", "dbdaima"])("incluye un archivo instrumental propio para %s sin configuración", era => {
        const result = resolveSeriesSoundtrackPlaylist(era)
        expect(result).toHaveLength(1)
        expect(result[0].url).toBe(`/sounds/music/opening-instrumentals/${era}.m4a`)
        expect(existsSync(resolve(process.cwd(), "public", result[0].url.slice(1)))).toBe(true)
    })

    it("reconoce el título del opening sin exigir el nombre de la serie", () => {
        const result = resolveSeriesSoundtrackPlaylist("dbkai", [{ name: "Dragon Soul (instrumental)", file: "Dragon Soul (instrumental).mp3" }], "D:/OST")
        expect(result[0].isLocal).toBe(true)
    })

    it("una canción con voz no reemplaza el instrumental incluido", () => {
        const result = resolveSeriesSoundtrackPlaylist("dbkai", [{ name: "Dragon Soul", file: "Dragon Soul.mp3" }], "D:/OST")
        expect(result[0].isLocal).toBe(false)
    })

    it("no crea playlists para series desconocidas", () => {
        expect(resolveSeriesSoundtrackPlaylist(null, tracks, "D:/OST")).toEqual([])
    })
})
