import { describe, expect, it } from "vitest"
import type { Models_Settings } from "@/api/generated/types"
import { buildGettingStartedPayload, findIgnoredBinaryPaths, settingsSchema } from "./settings"

describe("theme settings persistence", () => {
    it("saves legacy Neutro as Por era without changing disabled effects", () => {
        const parsed = settingsSchema.parse({ theme: {
            themeMode: "classic", themeEra: "classic",
            themeEnableBlurringEffects: false, themeEnableLiquidGlass: false,
            themeCustomCSS: "/* keep */",
        } })
        expect(parsed.theme).toMatchObject({
            themeMode: "era", themeEra: "era-universe",
            themeEnableBlurringEffects: false, themeEnableLiquidGlass: false,
            themeCustomCSS: "/* keep */",
        })
        expect(settingsSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed)
    })
})

describe("findIgnoredBinaryPaths", () => {
    it("avisa cuando el servidor reemplazó la ruta escrita", () => {
        expect(findIgnoredBinaryPaths(
            { ffmpegPath: "D:/tools/ffmpeg.exe", ffprobePath: "" },
            { ffmpegPath: "C:/ProgramData/chocolatey/bin/ffmpeg.exe", ffprobePath: "/usr/bin/ffprobe" },
        )).toEqual([{ label: "FFmpeg", wanted: "D:/tools/ffmpeg.exe", used: "C:/ProgramData/chocolatey/bin/ffmpeg.exe" }])
    })

    it("no avisa si la ruta quedó o si el campo estaba vacío", () => {
        expect(findIgnoredBinaryPaths({ ffmpegPath: "C:/a/ffmpeg.exe " }, { ffmpegPath: "C:/a/ffmpeg.exe" })).toEqual([])
        expect(findIgnoredBinaryPaths({ ffmpegPath: "" }, { ffmpegPath: "C:/a/ffmpeg.exe" })).toEqual([])
        expect(findIgnoredBinaryPaths(undefined, undefined)).toEqual([])
    })
})

describe("buildGettingStartedPayload", () => {
    it("conserva los ajustes guardados que el asistente no pregunta", () => {
        const current = {
            library: {
                seriesPaths: ["D:/viejo"],
                moviePaths: ["D:/peliculas"],
                preferredAudioProfile: "japanese",
                autoSkipIntro: true,
                autoSkipOutro: true,
                unifiedScan: true,
                marathonMode: true,
                autoDisableSubtitlesWhenDubbed: false,
                tmdbLanguage: "ja-JP",
                scannerProvider: "anilist",
            },
            mediaPlayer: {},
        } as unknown as Models_Settings

        const payload = buildGettingStartedPayload({ current, mediastream: { transcodeEnabled: false }, seriesPaths: ["D:/anime"] })

        expect(payload.library.seriesPaths).toEqual(["D:/anime"])
        expect(payload.library).toMatchObject({
            moviePaths: ["D:/peliculas"],
            preferredAudioProfile: "japanese",
            autoSkipIntro: true,
            autoSkipOutro: true,
            unifiedScan: true,
            marathonMode: true,
            autoDisableSubtitlesWhenDubbed: false,
            tmdbLanguage: "ja-JP",
            scannerProvider: "anilist",
        })
    })

    it("sin ajustes guardados usa los valores por defecto", () => {
        const payload = buildGettingStartedPayload({ current: null, seriesPaths: ["D:/anime"] })

        expect(payload.library).toMatchObject({
            seriesPaths: ["D:/anime"],
            preferredAudioProfile: "latino",
            autoDisableSubtitlesWhenDubbed: true,
            tmdbLanguage: "es-MX",
        })
        expect(payload.enableTranscode).toBe(false)
    })

    it("enableTranscode sigue el estado real del transcoder", () => {
        expect(buildGettingStartedPayload({ current: null, mediastream: { transcodeEnabled: true }, seriesPaths: ["D:/a"] }).enableTranscode).toBe(true)
        expect(buildGettingStartedPayload({ current: null, mediastream: null, seriesPaths: ["D:/a"] }).enableTranscode).toBe(false)
    })
})
