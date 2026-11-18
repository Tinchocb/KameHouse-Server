import { GettingStarted_Variables } from "@/api/generated/endpoint.types"
import type { Models_Settings } from "@/api/generated/types"
import { z } from "zod"
import { normalizeThemePreference } from "@/lib/theme/themes-registry"


const _gettingStartedSchema = z.object({
    enableTranscode: z.boolean().optional().default(false),
})

export const settingsSchema = z.object({
    library: z.object({
        seriesPaths: z.array(z.string()).nullish().transform(v => v ?? []),
        moviePaths: z.array(z.string()).nullish().transform(v => v ?? []),
        autoScan: z.boolean().default(false),
        unifiedScan: z.boolean().default(false),
        refreshLibraryOnStart: z.boolean().default(false),
        autoPlayNextEpisode: z.boolean().default(true),
        autoDetectSkipTimes: z.boolean().default(true),
        enableWatchContinuity: z.boolean().default(true),
        scannerMatchingThreshold: z.number().default(0),
        tmdbApiKey: z.string().default(""),
        tmdbLanguage: z.string().default("es-MX"),
        scannerStrictStructure: z.boolean().default(false),
        scannerProvider: z.string().default("anilist"),
        disableLocalScanning: z.boolean().default(false),
        disableCloudSource: z.boolean().default(false),
        lastScanAt: z.unknown().optional(),
        preferredAudioProfile: z.enum(["latino", "castellano", "japanese", "english", "auto"]).default("latino"),
        autoSkipIntro: z.boolean().default(false),
        autoSkipOutro: z.boolean().default(false),
        autoDisableSubtitlesWhenDubbed: z.boolean().default(true),
        marathonMode: z.boolean().default(false),
    }).passthrough().default({}),
    mediaPlayer: z.object({}).passthrough().default({}),
    googleDrive: z.object({
        enabled: z.boolean().default(false),
        clientId: z.string().default(""),
        clientSecret: z.string().default(""),
        refreshToken: z.string().default(""),
        folderId: z.string().default(""),
        folderName: z.string().default(""),
        disableAutoSync: z.boolean().default(false),
        scanIntervalMinutes: z.number().default(60),
    }).passthrough().default({}),
    mediastream: z.object({
        transcodeEnabled: z.boolean().default(false),
        transcodeHwAccel: z.string().default("auto"),
        transcodeThreads: z.number().default(0),
        transcodePreset: z.string().default("fast"),
        disableAutoSwitchToDirectPlay: z.boolean().default(false),
        directPlayOnly: z.boolean().default(false),
        preTranscodeEnabled: z.boolean().default(false),
        preTranscodeLibraryDir: z.string().default(""),
        transcodeHwAccelCustomSettings: z.string().default(""),
        ffmpegPath: z.string().default(""),
        ffprobePath: z.string().default(""),
        performanceProfile: z.enum(["auto", "ultra", "balanced", "eco"]).default("auto"),
        autoGovernorEnabled: z.boolean().default(true),
    }).passthrough().default({}),
    theme: z.object({
        enableColorSettings: z.boolean().default(false),
        backgroundColor: z.string().default("#050506"),
        accentColor: z.string().default("#C8102E"),
        themeEra: z.string().default(""),
        themeMode: z.string().default(""),
        themeEnableLiquidGlass: z.boolean().default(true),
        themeLibraryScreenBannerType: z.string().default("dynamic"),
        themeLibraryScreenCustomBannerImage: z.string().default(""),
        themeLibraryScreenCustomBannerPosition: z.string().default("50% 50%"),
        themeLibraryScreenCustomBannerOpacity: z.number().default(10),
        themeLibraryScreenCustomBackgroundImage: z.string().default(""),
        themeLibraryScreenCustomBackgroundOpacity: z.number().default(10),
        themeLibraryScreenCustomBackgroundBlur: z.string().default("none"),
        themeEnableMediaPageBlurredBackground: z.boolean().default(false),
        themeMediaPageBannerType: z.string().default("default"),
        themeMediaPageBannerSize: z.string().default("default"),
        themeMediaPageBannerInfoBoxSize: z.string().default("default"),
        themeAnimeLibraryCollectionDefaultSorting: z.string().default("TITLE_ASC"),
        themeShowAnimeUnwatchedCount: z.boolean().default(true),
        themeHideEpisodeCardDescription: z.boolean().default(false),
        themeHideDownloadedEpisodeCardFilename: z.boolean().default(false),
        themeCustomCSS: z.string().max(20000).default(""),
        themeMobileCustomCSS: z.string().max(20000).default(""),
        themeEnableBlurringEffects: z.boolean().default(true),
        bgMusicEnabled: z.boolean().default(true),
        bgMusicVolume: z.number().min(0).max(1).default(0.25),
        bgMusicDir: z.string().default(""),
        bgMusicTracks: z.array(z.object({ name: z.string(), file: z.string() })).default([]),
        seriesSoundtrackMode: z.boolean().default(true),
        uiSoundsEnabled: z.boolean().default(true),
        uiSoundsVolume: z.number().min(0).max(1).default(1.0),
    }).passthrough().default({}).transform(normalizeThemePreference),
    notifications: z.object({
        disableNotifications: z.boolean().default(false),
        disableAutoScannerNotifications: z.boolean().default(false),
    }).passthrough().default({}),
    platform: z.object({
        hideAudienceScore: z.boolean().default(false),
    }).passthrough().default({}),
}).passthrough()

/** Valores tal como los guarda el formulario (antes de los defaults y transforms de zod). */
export type SettingsFormInput = z.input<typeof settingsSchema>
export type SettingsFormValues = z.infer<typeof settingsSchema>

const gettingStartedSchema = _gettingStartedSchema.extend({
    library: settingsSchema.shape.library,
    mediaPlayer: settingsSchema.shape.mediaPlayer,
    notifications: settingsSchema.shape.notifications.optional(),
})

const getDefaultSettings = (data: z.infer<typeof gettingStartedSchema>, existingSettings?: Models_Settings | null): GettingStarted_Variables => {
    const libraryData = data.library
    return {
        library: {
            autoScan: libraryData.autoScan ?? existingSettings?.library?.autoScan ?? false,
            unifiedScan: libraryData.unifiedScan ?? existingSettings?.library?.unifiedScan ?? false,
            refreshLibraryOnStart: existingSettings?.library?.refreshLibraryOnStart ?? false,
            autoPlayNextEpisode: libraryData.autoPlayNextEpisode ?? existingSettings?.library?.autoPlayNextEpisode ?? true,
            autoDetectSkipTimes: libraryData.autoDetectSkipTimes ?? existingSettings?.library?.autoDetectSkipTimes ?? true,
            enableWatchContinuity: libraryData.enableWatchContinuity ?? existingSettings?.library?.enableWatchContinuity ?? true,
            seriesPaths: libraryData.seriesPaths ?? existingSettings?.library?.seriesPaths ?? [],
            moviePaths: libraryData.moviePaths ?? existingSettings?.library?.moviePaths ?? [],
            scannerMatchingThreshold: existingSettings?.library?.scannerMatchingThreshold ?? 0,
            scannerStrictStructure: existingSettings?.library?.scannerStrictStructure ?? false,
            scannerProvider: libraryData.scannerProvider || existingSettings?.library?.scannerProvider || "anilist",
            disableLocalScanning: libraryData.disableLocalScanning ?? existingSettings?.library?.disableLocalScanning ?? false,
            disableCloudSource: libraryData.disableCloudSource ?? existingSettings?.library?.disableCloudSource ?? false,
            // Anti-wipe: el wizard no pide key/idioma; si vienen vacios se
            // conserva lo guardado en vez de pisarlo con "".
            tmdbApiKey: libraryData.tmdbApiKey || existingSettings?.library?.tmdbApiKey || "",
            tmdbLanguage: libraryData.tmdbLanguage || existingSettings?.library?.tmdbLanguage || "es-MX",
            preferredAudioProfile: libraryData.preferredAudioProfile ?? existingSettings?.library?.preferredAudioProfile ?? "latino",
            autoSkipIntro: libraryData.autoSkipIntro ?? existingSettings?.library?.autoSkipIntro ?? false,
            autoSkipOutro: libraryData.autoSkipOutro ?? existingSettings?.library?.autoSkipOutro ?? false,
            autoDisableSubtitlesWhenDubbed: libraryData.autoDisableSubtitlesWhenDubbed ?? existingSettings?.library?.autoDisableSubtitlesWhenDubbed ?? true,
            marathonMode: libraryData.marathonMode ?? existingSettings?.library?.marathonMode ?? false,
        },
        mediaPlayer: existingSettings?.mediaPlayer || {},
        enableTranscode: data.enableTranscode,
    } as GettingStarted_Variables
}

/**
 * Payload de POST /api/v1/start. Parte de los ajustes guardados y solo cambia lo que el
 * asistente pregunta (las carpetas). Lo que no pregunta sigue siendo lo guardado: antes,
 * los defaults de zod lo sustituían y pisaban, p. ej., el idioma de audio o los saltos.
 * El transcoder se lee de su estado real (status.mediastreamSettings).
 */
export function buildGettingStartedPayload(input: {
    current: Models_Settings | null | undefined
    mediastream?: { transcodeEnabled?: boolean } | null
    seriesPaths: string[]
}): GettingStarted_Variables {
    const data = gettingStartedSchema.parse({
        enableTranscode: input.mediastream?.transcodeEnabled ?? false,
        mediaPlayer: input.current?.mediaPlayer || {},
        library: { ...input.current?.library, seriesPaths: input.seriesPaths },
    })
    return getDefaultSettings(data, input.current)
}

/**
 * El servidor solo acepta binarios de FFmpeg/FFprobe "seguros" (carpeta bin de
 * KameHouse o el del PATH del sistema) y reemplaza el resto en silencio por el
 * detectado. Devuelve las rutas que el usuario escribió y no quedaron, para
 * avisarle en vez de mostrar "guardado" como si nada.
 */
export function findIgnoredBinaryPaths(
    sent: { ffmpegPath?: string | null; ffprobePath?: string | null } | null | undefined,
    stored: { ffmpegPath?: string | null; ffprobePath?: string | null } | null | undefined,
): { label: "FFmpeg" | "FFprobe"; wanted: string; used: string }[] {
    const out: { label: "FFmpeg" | "FFprobe"; wanted: string; used: string }[] = []
    for (const [key, label] of [["ffmpegPath", "FFmpeg"], ["ffprobePath", "FFprobe"]] as const) {
        const wanted = (sent?.[key] ?? "").trim()
        const used = (stored?.[key] ?? "").trim()
        if (wanted && used && wanted !== used) out.push({ label, wanted, used })
    }
    return out
}
