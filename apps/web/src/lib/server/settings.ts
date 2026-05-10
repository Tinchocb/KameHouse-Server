import { GettingStarted_Variables } from "@/api/generated/endpoint.types"
import { z } from "zod"

export const DEFAULT_TORRENT_PROVIDER = ""

export const DEFAULT_DOH_PROVIDER = ""

export const DEFAULT_MPV_TYPE = "socket"

export const enum TORRENT_CLIENT {
    NONE = "none",
}

export const enum TORRENT_PROVIDER {
    NONE = "none",
}

export const _gettingStartedSchema = z.object({
    enableTranscode: z.boolean().optional().default(false),
    enableTorrentStreaming: z.boolean().optional().default(false),
})

export const settingsSchema = z.object({
    library: z.object({
        libraryPath: z.string().optional().default(""),
        defaultPlayer: z.string(),
        torrentProvider: z.string().default(DEFAULT_TORRENT_PROVIDER),
        autoScan: z.boolean().optional().default(false),
        mediaPlayerHost: z.string(),
        vlcUsername: z.string().optional().default(""),
        vlcPassword: z.string().optional().default(""),
        vlcPort: z.number(),
        vlcPath: z.string().optional().default(""),
        mpcPort: z.number(),
        mpcPath: z.string().optional().default(""),
        mpvSocket: z.string().optional().default(""),
        mpvPath: z.string().optional().default(""),
        mpvArgs: z.string().optional().default(""),
        iinaSocket: z.string().optional().default(""),
        iinaPath: z.string().optional().default(""),
        iinaArgs: z.string().optional().default(""),
        defaultTorrentClient: z.string().optional().default("none"),
        hideTorrentList: z.boolean().optional().default(false),
        tmdbApiKey: z.string().optional().default(""),
        tmdbLanguage: z.string().optional().default("es-MX"),
        hideAudienceScore: z.boolean().optional().default(false),
        autoUpdateProgress: z.boolean().optional().default(false),

        enableOnlinestream: z.boolean().optional().default(false),
        includeOnlineStreamingInLibrary: z.boolean().optional().default(false),
        disableAnimeCardTrailers: z.boolean().optional().default(false),

        enableRichPresence: z.boolean().optional().default(false),
        enableAnimeRichPresence: z.boolean().optional().default(false),


        dohProvider: z.string().optional().default(""),
        openTorrentClientOnStart: z.boolean().optional().default(false),
        openWebURLOnStart: z.boolean().optional().default(false),
        refreshLibraryOnStart: z.boolean().optional().default(false),
        richPresenceHideKameHouseRepositoryButton: z.boolean().optional().default(false),
        richPresenceShowPlatformMediaButton: z.boolean().optional().default(false),
        richPresenceShowPlatformProfileButton: z.boolean().optional().default(false),
        richPresenceUseMediaTitleStatus: z.boolean().optional().default(true),

        autoPlayNextEpisode: z.boolean().optional().default(false),
        showActiveTorrentCount: z.boolean().optional().default(false),
        enableWatchContinuity: z.boolean().optional().default(false),
        seriesPaths: z.array(z.string()).optional().default([]),
        moviePaths: z.array(z.string()).optional().default([]),
        autoSyncOfflineLocalData: z.boolean().optional().default(false),
        scannerMatchingThreshold: z.number().optional().default(0.5),
        scannerMatchingAlgorithm: z.string().optional().default(""),
        autoSyncToLocalAccount: z.boolean().optional().default(false),
        autoSaveCurrentMediaOffline: z.boolean().optional().default(false),
        disableCacheLayer: z.boolean().optional().default(false),
        autoSelectTorrentProvider: z.string().optional().default(""),
        useFallbackMetadataProvider: z.boolean().optional().default(false),
        vcTranslate: z.boolean().optional().default(false),
        vcTranslateApiKey: z.string().optional().default(""),
        vcTranslateProvider: z.string().optional().default(""),
        vcTranslateTargetLanguage: z.string().optional().default(""),
        scannerUseLegacyMatching: z.boolean().optional().default(false),
        scannerConfig: z.string().optional().default(""),
        scannerStrictStructure: z.boolean().optional().default(false),
        scannerProvider: z.string().optional().default("tmdb"),
        // Service toggles
        disableLocalScanning: z.boolean().optional().default(false),
        disableTorrentStreaming: z.boolean().optional().default(false),
        disableTorrentProvider: z.boolean().optional().default(false),
        primaryMetadataProvider: z.string().optional().default("tmdb"),
        fanartApiKey: z.string().optional().default(""),
        omdbApiKey: z.string().optional().default(""),
        openSubsApiKey: z.string().optional().default(""),
    }),
    mediaPlayer: z.object({
        host: z.string(),
        defaultPlayer: z.string(),
        vlcPort: z.number(),
        vlcUsername: z.string().optional().default(""),
        vlcPassword: z.string().optional().default(""),
        vlcPath: z.string().optional().default(""),
        mpcPort: z.number(),
        mpcPath: z.string().optional().default(""),
        mpvSocket: z.string().optional().default(""),
        mpvPath: z.string().optional().default(""),
        mpvArgs: z.string().optional().default(""),
        iinaSocket: z.string().optional().default(""),
        iinaPath: z.string().optional().default(""),
        iinaArgs: z.string().optional().default(""),
        vcTranslate: z.boolean().optional().default(false),
        vcTranslateApiKey: z.string().optional().default(""),
        vcTranslateProvider: z.string().optional().default(""),
        vcTranslateTargetLanguage: z.string().optional().default(""),
    }),
    torrent: z.object({
        showBufferingStatus: z.boolean().optional().default(false),
        showNetworkSpeed: z.boolean().optional().default(false),
    }),
    mediastream: z.object({
        transcodeEnabled: z.boolean().default(false),
        transcodeHwAccel: z.string().default("cpu"),
        transcodePreset: z.string().default("fast"),
        disableAutoSwitchToDirectPlay: z.boolean().default(false),
        directPlayOnly: z.boolean().default(false),
        transcodeFfmpegPath: z.string().default(""),
        transcodeFfprobePath: z.string().default(""),
        transcodeHwAccelCustomSettings: z.string().default(""),
    }),
    torrentstream: z.object({
        enabled: z.boolean().default(false),
        autoSelect: z.boolean().default(false),
        preferredResolution: z.string().default("-"),
        disableIPV6: z.boolean().default(false),
        downloadDir: z.string().default(""),
        addToLibrary: z.boolean().default(false),
        includeInLibrary: z.boolean().default(false),
        torrentioUrl: z.string().default(""),
        cacheLimitGB: z.number().default(5),
        cachePath: z.string().default(""),
        torrentClientHost: z.string().default(""),
        torrentClientPort: z.number().default(43213),
        streamUrlAddress: z.string().default(""),
        slowSeeding: z.boolean().default(false),
        preloadNextStream: z.boolean().default(false),
    }),
    theme: z.object({
        themeAnimeEntryScreenLayout: z.string().min(0).optional(),
        themeSmallerEpisodeCarouselSize: z.boolean().default(false),
        themeExpandSidebarOnHover: z.boolean().default(false),
        themeEnableColorSettings: z.boolean().default(false),
        themeBackgroundColor: z.string().min(0).default("#070707"),
        themeAccentColor: z.string().min(0).default("#6152df"),
        themeSidebarBackgroundColor: z.string().min(0).optional(),
        themeHideTopNavbar: z.boolean().default(false),
        themeEnableMediaCardBlurredBackground: z.boolean().default(false),
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
        themeUseLegacyEpisodeCard: z.boolean().default(false),
        themeDisableCarouselAutoScroll: z.boolean().default(false),
        themeMediaPageBannerType: z.string().default("default"),
        themeMediaPageBannerSize: z.string().default("default"),
        themeMediaPageBannerInfoBoxSize: z.string().default("default"),
        themeShowEpisodeCardAnimeInfo: z.boolean().default(true),
        themeContinueWatchingDefaultSorting: z.string().default("LAST_WATCHED_DESC"),
        themeAnimeLibraryCollectionDefaultSorting: z.string().default("TITLE_ASC"),

        themeShowAnimeUnwatchedCount: z.boolean().default(true),

        themeHideEpisodeCardDescription: z.boolean().default(false),
        themeHideDownloadedEpisodeCardFilename: z.boolean().default(false),
        themeCustomCSS: z.string().default(""),
        themeMobileCustomCSS: z.string().default(""),
        themeUnpinnedMenuItems: z.array(z.string()).default([]),
        themeEnableBlurringEffects: z.boolean().default(true),
    }),
    notifications: z.object({
        disableNotifications: z.boolean().default(false),
        disableAutoDownloaderNotifications: z.boolean().default(false),
        disableAutoScannerNotifications: z.boolean().default(false),
    }),
})

export const gettingStartedSchema = _gettingStartedSchema.extend(settingsSchema.shape)

export const getDefaultSettings = (data: z.infer<typeof gettingStartedSchema>): GettingStarted_Variables => ({
    library: {
        // libraryPath: data.library.libraryPath, // Deprecated in backend schema
        autoUpdateProgress: true,

        torrentProvider: data.library.torrentProvider || DEFAULT_TORRENT_PROVIDER,
        autoSelectTorrentProvider: "",
        autoScan: false,
        disableAnimeCardTrailers: false,

        enableOnlinestream: data.library.enableOnlinestream,
        dohProvider: DEFAULT_DOH_PROVIDER,
        openTorrentClientOnStart: false,
        openWebURLOnStart: false,
        refreshLibraryOnStart: false,
        autoPlayNextEpisode: false,
        enableWatchContinuity: data.library.enableWatchContinuity,
        seriesPaths: [],
        moviePaths: [],
        autoSyncOfflineLocalData: false,
        includeOnlineStreamingInLibrary: false,
        scannerMatchingThreshold: 0,
        scannerMatchingAlgorithm: "",
        autoSyncToLocalAccount: false,
        autoSaveCurrentMediaOffline: false,
        useFallbackMetadataProvider: false,
        scannerUseLegacyMatching: false,
        scannerStrictStructure: false,
        scannerProvider: data.library.scannerProvider || "tmdb",
        scannerConfig: "",
        disableLocalScanning: data.library.disableLocalScanning,
        disableTorrentStreaming: data.library.disableTorrentStreaming,
        disableDebridService: true,
        disableTorrentProvider: data.library.disableTorrentProvider,
        tmdbApiKey: data.library.tmdbApiKey,
        tmdbLanguage: "es-MX",
        primaryMetadataProvider: data.library.primaryMetadataProvider || "tmdb",
        fanartApiKey: data.library.fanartApiKey || "",
        omdbApiKey: data.library.omdbApiKey || "",
        openSubsApiKey: data.library.openSubsApiKey || "",
    },
    mediaPlayer: {
        host: data.mediaPlayer.host,
        defaultPlayer: data.mediaPlayer.defaultPlayer,
        vlcPort: data.mediaPlayer.vlcPort,
        vlcUsername: data.mediaPlayer.vlcUsername || "",
        vlcPassword: data.mediaPlayer.vlcPassword,
        vlcPath: data.mediaPlayer.vlcPath || "",
        mpcPort: data.mediaPlayer.mpcPort,
        mpcPath: data.mediaPlayer.mpcPath || "",
        mpvSocket: data.mediaPlayer.mpvSocket || "",
        mpvPath: data.mediaPlayer.mpvPath || "",
        mpvArgs: "",
        iinaSocket: data.mediaPlayer.iinaSocket || "",
        iinaPath: data.mediaPlayer.iinaPath || "",
        iinaArgs: "",
        vcTranslate: false,
        vcTranslateApiKey: "",
        vcTranslateProvider: "",
        vcTranslateTargetLanguage: "",
    },
    torrent: {
        // showBufferingStatus: data.torrent.showBufferingStatus || false, // Deprecated in backend schema
        // showNetworkSpeed: data.torrent.showNetworkSpeed || false, // Deprecated in backend schema
    } as any,
    Platform: {
        hideAudienceScore: false,

        disableCacheLayer: false,
    },
    enableTorrentStreaming: data.enableTorrentStreaming,
    enableTranscode: data.enableTranscode,
    notifications: {
        disableNotifications: data.notifications.disableNotifications,
        disableAutoDownloaderNotifications: data.notifications.disableAutoDownloaderNotifications,
        disableAutoScannerNotifications: data.notifications.disableAutoScannerNotifications,
    },
    debridProvider: "none",
    debridApiKey: "",
})


export function useDefaultSettingsPaths() {

    return {
        getDefaultVlcPath: (os: string) => {
            switch (os) {
                case "windows":
                    return "C:\\Program Files\\VideoLAN\\VLC\\vlc.exe"
                case "linux":
                    return "/usr/bin/vlc" // Default path for VLC on most Linux distributions
                case "darwin":
                    return "/Applications/VLC.app/Contents/MacOS/VLC" // Default path for VLC on macOS
                default:
                    return "C:\\Program Files\\VideoLAN\\VLC\\vlc.exe"
            }
        },
    }

}

export function getDefaultMpvSocket(os: string) {
    switch (os) {
        case "windows":
            return "\\\\.\\pipe\\mpv_ipc"
        case "linux":
            return "/tmp/mpv_socket" // Default socket for VLC on most Linux distributions
        case "darwin":
            return "/tmp/mpv_socket" // Default socket for VLC on macOS
        default:
            return "/tmp/mpv_socket"
    }
}

export function getDefaultIinaSocket(_os: string) {
    return "/tmp/iina_socket"
}
