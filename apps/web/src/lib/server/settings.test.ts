import { describe, expect, it } from "vitest"
import type { Models_Settings } from "@/api/generated/types"
import type { SaveSettings_Variables } from "@/api/generated/endpoint.types"
import { buildGettingStartedPayload, findIgnoredBinaryPaths, settingsSchema } from "./settings"

/**
 * Guardián de tipos (QA-04): cada campo que settingsSchema declara tiene que existir en el modelo
 * generado de PATCH /settings. Si el backend renombra o quita uno, `pnpm typecheck` falla aquí.
 * No exige lo contrario: el modelo tiene campos que el formulario no edita (p. ej. `tvMode`, o
 * id/createdAt/updatedAt de la entidad) y `mediaPlayer` es un mapa libre.
 */
type Expect<T extends true> = T
type DeclaredFieldsExist<Shape, Model> = [Exclude<keyof Shape, keyof NonNullable<Model>>] extends [never] ? true : false
/** Forma de una sección de settingsSchema sin el envoltorio de default ni de transform. */
type SectionShape<Z> = Z extends { shape: infer S }
    ? S
    : Z extends { removeDefault(): infer I }
      ? SectionShape<I>
      : Z extends { innerType(): infer I }
        ? SectionShape<I>
        : never

export type SettingsSchemaMatchesGeneratedModel = [
    Expect<DeclaredFieldsExist<typeof settingsSchema.shape, SaveSettings_Variables>>,
    Expect<DeclaredFieldsExist<SectionShape<typeof settingsSchema.shape.library>, SaveSettings_Variables["library"]>>,
    Expect<DeclaredFieldsExist<SectionShape<typeof settingsSchema.shape.mediaPlayer>, SaveSettings_Variables["mediaPlayer"]>>,
    Expect<DeclaredFieldsExist<SectionShape<typeof settingsSchema.shape.mediastream>, SaveSettings_Variables["mediastream"]>>,
    Expect<DeclaredFieldsExist<SectionShape<typeof settingsSchema.shape.theme>, SaveSettings_Variables["theme"]>>,
    Expect<DeclaredFieldsExist<SectionShape<typeof settingsSchema.shape.notifications>, SaveSettings_Variables["notifications"]>>,
    Expect<DeclaredFieldsExist<SectionShape<typeof settingsSchema.shape.platform>, SaveSettings_Variables["platform"]>>,
    Expect<DeclaredFieldsExist<SectionShape<typeof settingsSchema.shape.googleDrive>, SaveSettings_Variables["googleDrive"]>>,
]

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
