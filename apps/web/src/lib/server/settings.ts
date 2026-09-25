import { GettingStarted_Variables } from "@/api/generated/endpoint.types"
import type { Models_Settings } from "@/api/generated/types"
import { z } from "zod"

export { persistLibraryPatch, persistThemePatch } from "./persist-settings"


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
        scannerUseLegacyMatching: z.boolean().default(false),
        scannerStrictStructure: z.boolean().default(false),
        scannerProvider: z.string().default("anilist"),
        disableLocalScanning: z.boolean().default(false),
        disableCloudSource: z.boolean().default(false),
        primaryMetadataProvider: z.string().default("anilist"),
        lastScanAt: z.unknown().optional(),
        preferredAudioProfile: z.enum(["latino", "castellano", "japanese", "english", "auto"]).default("latino"),
        autoSkipIntro: z.boolean().default(false),
        autoSkipOutro: z.boolean().default(false),
        autoSkipFiller: z.boolean().default(false),
        autoDisableSubtitlesWhenDubbed: z.boolean().default(true),
        marathonMode: z.boolean().default(false),
        tvMode: z.boolean().default(false),
    }).passthrough().default({}),
    mediaPlayer: z.object({}).passthrough().default({}),
    googleDrive: z.object({
        enabled: z.boolean().default(false),
        clientId: z.string().default(""),
        clientSecret: z.string().default(""),
        refreshToken: z.string().default(""),
        folderId: z.string().default(""),
        folderName: z.string().default(""),
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
        themeEnableLiquidGlass: z.boolean().default(false),
        themeSmallerEpisodeCarouselSize: z.boolean().default(false),
        themeExpandSidebarOnHover: z.boolean().default(false),
        themeLibraryScreenBannerType: z.string().default("dynamic"),
        themeLibraryScreenCustomBannerImage: z.string().default(""),
        themeLibraryScreenCustomBannerPosition: z.string().default("50% 50%"),
        themeLibraryScreenCustomBannerOpacity: z.number().default(10),
        themeLibraryScreenCustomBackgroundImage: z.string().default(""),
        themeLibraryScreenCustomBackgroundOpacity: z.number().default(10),
        themeLibraryScreenCustomBackgroundBlur: z.string().default("none"),
        themeEnableMediaPageBlurredBackground: z.boolean().default(false),
        themeDisableSidebarTransparency: z.boolean().default(false),
        themeDisableLibraryScreenGenreSelector: z.boolean().default(false),
        themeDisableCarouselAutoScroll: z.boolean().default(false),
        themeMediaPageBannerType: z.string().default("default"),
        themeMediaPageBannerSize: z.string().default("default"),
        themeMediaPageBannerInfoBoxSize: z.string().default("default"),
        themeShowEpisodeCardAnimeInfo: z.boolean().default(true),
        themeAnimeLibraryCollectionDefaultSorting: z.string().default("TITLE_ASC"),
        themeShowAnimeUnwatchedCount: z.boolean().default(true),
        themeHideEpisodeCardDescription: z.boolean().default(false),
        themeHideDownloadedEpisodeCardFilename: z.boolean().default(false),
        themeCustomCSS: z.string().max(20000).default(""),
        themeMobileCustomCSS: z.string().max(20000).default(""),
        themeUnpinnedMenuItems: z.array(z.string()).nullish().transform(v => v ?? []),
        themeEnableSidebarGradient: z.boolean().default(false),
        themeEnableBlurringEffects: z.boolean().default(true),
        themeEnableCinematicGrain: z.boolean().default(false),
        bgMusicEnabled: z.boolean().default(true),
        bgMusicVolume: z.number().min(0).max(1).default(0.25),
        bgMusicDir: z.string().default(""),
        bgMusicTracks: z.array(z.object({ name: z.string(), file: z.string() })).default([]),
        seriesSoundtrackMode: z.boolean().default(true),
        uiSoundsEnabled: z.boolean().default(true),
        uiSoundsVolume: z.number().min(0).max(1).default(1.0),
    }).passthrough().default({}),
    notifications: z.object({
        disableNotifications: z.boolean().default(false),
        disableAutoScannerNotifications: z.boolean().default(false),
    }).passthrough().default({}),
    platform: z.object({
        hideAudienceScore: z.boolean().default(false),
    }).passthrough().default({}),
}).passthrough()

export type SettingsFormValues = z.infer<typeof settingsSchema>

export const gettingStartedSchema = _gettingStartedSchema.extend({
    library: settingsSchema.shape.library,
    mediaPlayer: settingsSchema.shape.mediaPlayer,
    notifications: settingsSchema.shape.notifications.optional(),
})

export const getDefaultSettings = (data: z.infer<typeof gettingStartedSchema>, existingSettings?: Models_Settings | null): GettingStarted_Variables => {
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
            scannerUseLegacyMatching: existingSettings?.library?.scannerUseLegacyMatching ?? false,
            scannerStrictStructure: existingSettings?.library?.scannerStrictStructure ?? false,
            scannerProvider: libraryData.scannerProvider || existingSettings?.library?.scannerProvider || "anilist",
            disableLocalScanning: libraryData.disableLocalScanning ?? existingSettings?.library?.disableLocalScanning ?? false,
            disableCloudSource: libraryData.disableCloudSource ?? existingSettings?.library?.disableCloudSource ?? false,
            primaryMetadataProvider: libraryData.primaryMetadataProvider || existingSettings?.library?.primaryMetadataProvider || "anilist",
            // Anti-wipe: el wizard no pide key/idioma; si vienen vacios se
            // conserva lo guardado en vez de pisarlo con "".
            tmdbApiKey: libraryData.tmdbApiKey || existingSettings?.library?.tmdbApiKey || "",
            tmdbLanguage: libraryData.tmdbLanguage || existingSettings?.library?.tmdbLanguage || "es-MX",
            preferredAudioProfile: libraryData.preferredAudioProfile ?? existingSettings?.library?.preferredAudioProfile ?? "latino",
            autoSkipIntro: libraryData.autoSkipIntro ?? existingSettings?.library?.autoSkipIntro ?? false,
            autoSkipOutro: libraryData.autoSkipOutro ?? existingSettings?.library?.autoSkipOutro ?? false,
            autoSkipFiller: libraryData.autoSkipFiller ?? existingSettings?.library?.autoSkipFiller ?? false,
            autoDisableSubtitlesWhenDubbed: libraryData.autoDisableSubtitlesWhenDubbed ?? existingSettings?.library?.autoDisableSubtitlesWhenDubbed ?? true,
            marathonMode: libraryData.marathonMode ?? existingSettings?.library?.marathonMode ?? false,
            tvMode: libraryData.tvMode ?? existingSettings?.library?.tvMode ?? false,
        },
        mediaPlayer: existingSettings?.mediaPlayer || {},
        enableTranscode: data.enableTranscode ?? existingSettings?.mediastream?.transcodeEnabled ?? false,
    } as GettingStarted_Variables
}
