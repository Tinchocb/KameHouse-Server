import { GettingStarted_Variables } from "@/api/generated/endpoint.types"
import { z } from "zod"

export const DEFAULT_TORRENT_PROVIDER = ""

export const DEFAULT_TORRENT_CLIENT = "qbittorrent"

export const DEFAULT_DOH_PROVIDER = ""

export const DEFAULT_MPV_TYPE = "socket"

export const enum TORRENT_CLIENT {
    QBITTORRENT = "qbittorrent",
    TRANSMISSION = "transmission",
    NONE = "none",
}

export const enum TORRENT_PROVIDER {
    NONE = "none",
}

export const enum DEBRID_SERVICE {
    TORBOX = "torbox",
    REALDEBRID = "realdebrid",
    ALLDEBRID = "alldebrid",
}

export const _gettingStartedSchema = z.object({
    enableTranscode: z.boolean().optional().default(false),
    enableTorrentStreaming: z.boolean().optional().default(false),
    debridProvider: z.string().optional().default("none"),
    debridApiKey: z.string().optional().default(""),
})

export const settingsSchema = z.object({
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
    defaultTorrentClient: z.string().optional().default(DEFAULT_TORRENT_CLIENT),
    hideTorrentList: z.boolean().optional().default(false),
    qbittorrentPath: z.string().optional().default(""),
    qbittorrentHost: z.string().optional().default(""),
    qbittorrentPort: z.number(),
    qbittorrentUsername: z.string().optional().default(""),
    qbittorrentPassword: z.string().optional().default(""),
    qbittorrentTags: z.string().optional().default(""),
    qbittorrentCategory: z.string().optional().default(""),
    tmdbApiKey: z.string().optional().default(""),
    transmissionPath: z.string().optional().default(""),
    transmissionHost: z.string().optional().default(""),
    transmissionPort: z.number().optional().default(9091),
    transmissionUsername: z.string().optional().default(""),
    transmissionPassword: z.string().optional().default(""),
    hideAudienceScore: z.boolean().optional().default(false),
    autoUpdateProgress: z.boolean().optional().default(false),

    enableOnlinestream: z.boolean().optional().default(false),
    includeOnlineStreamingInLibrary: z.boolean().optional().default(false),
    disableAnimeCardTrailers: z.boolean().optional().default(false),
    enableManga: z.boolean().optional().default(true),
    mangaLocalSourceDirectory: z.string().optional().default(""),
    enableRichPresence: z.boolean().optional().default(false),
    enableAnimeRichPresence: z.boolean().optional().default(false),
    enableMangaRichPresence: z.boolean().optional().default(false),

    dohProvider: z.string().optional().default(""),
    openTorrentClientOnStart: z.boolean().optional().default(false),
    openWebURLOnStart: z.boolean().optional().default(false),
    refreshLibraryOnStart: z.boolean().optional().default(false),
    richPresenceHideKameHouseRepositoryButton: z.boolean().optional().default(false),
    richPresenceShowAniListMediaButton: z.boolean().optional().default(false),
    richPresenceShowAniListProfileButton: z.boolean().optional().default(false),
    richPresenceUseMediaTitleStatus: z.boolean().optional().default(true),
    disableNotifications: z.boolean().optional().default(false),
    disableAutoDownloaderNotifications: z.boolean().optional().default(false),
    disableAutoScannerNotifications: z.boolean().optional().default(false),
    defaultMangaProvider: z.string().optional().default(""),
    mangaAutoUpdateProgress: z.boolean().optional().default(false),
    autoPlayNextEpisode: z.boolean().optional().default(false),
    showActiveTorrentCount: z.boolean().optional().default(false),
    enableWatchContinuity: z.boolean().optional().default(false),
    libraryPaths: z.array(z.string()).optional().default([]),
    autoSyncOfflineLocalData: z.boolean().optional().default(false),
    scannerMatchingThreshold: z.number().optional().default(0.5),
    scannerMatchingAlgorithm: z.string().optional().default(""),
    autoSyncToLocalAccount: z.boolean().optional().default(false),
    nakamaIsHost: z.boolean().optional().default(false),
    nakamaHostPassword: z.string().optional().default(""),
    nakamaRemoteServerURL: z.string().optional().default(""),
    nakamaRemoteServerPassword: z.string().optional().default(""),
    nakamaHostShareLocalAnimeLibrary: z.boolean().optional().default(false),
    nakamaEnabled: z.boolean().optional().default(false),
    nakamaHostEnablePortForwarding: z.boolean().optional().default(false),
    nakamaUsername: z.string().optional().default(""),
    includeNakamaAnimeLibrary: z.boolean().optional().default(false),
    nakamaHostUnsharedAnimeIds: z.array(z.number()).optional().default([]),
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
    disableDebridService: z.boolean().optional().default(false),
    disableTorrentProvider: z.boolean().optional().default(false),
    disableJellyfin: z.boolean().optional().default(false),
    jellyfinEnabled: z.boolean().optional().default(false),
    jellyfinServerUrl: z.string().url().optional().or(z.literal("")),
    jellyfinApiKey: z.string().optional().default(""),
    jellyfinUsername: z.string().optional().default(""),
    jellyfinPassword: z.string().optional().default(""),
    jellyfinScanOnItemAdd: z.boolean().optional().default(true),
    jellyfinScanDelayMs: z.number().optional().default(5000),

    // Mediastream
    transcodeEnabled: z.boolean().default(false),
    transcodeHwAccel: z.string().default("cpu"),
    transcodePreset: z.string().default("fast"),
    transcodeDisableAutoSwitchToDirectPlay: z.boolean().default(false),
    transcodeDirectPlayOnly: z.boolean().default(false),
    transcodeFfmpegPath: z.string().default(""),
    transcodeFfprobePath: z.string().default(""),
    transcodeHwAccelCustomSettings: z.string().default(""),

    // Torrentstream
    torrentstreamEnabled: z.boolean().default(false),
    torrentstreamAutoSelect: z.boolean().default(false),
    torrentstreamPreferredResolution: z.string().default("-"),
    torrentstreamDisableIPv6: z.boolean().default(false),
    torrentstreamDownloadDir: z.string().default(""),
    torrentstreamAddToLibrary: z.boolean().default(false),
    torrentstreamIncludeInLibrary: z.boolean().default(false),
    torrentstreamTorrentClientHost: z.string().default(""),
    torrentstreamTorrentClientPort: z.number().default(43213),
    torrentstreamStreamUrlAddress: z.string().default(""),
    torrentstreamSlowSeeding: z.boolean().default(false),
    torrentstreamPreloadNextStream: z.boolean().default(false),

    // Debrid
    debridEnabled: z.boolean().default(false),
    debridProvider: z.string().default(""),
    debridApiKey: z.string().default(""),
    debridIncludeDebridStreamInLibrary: z.boolean().default(false),
    debridStreamAutoSelect: z.boolean().default(false),
    debridStreamPreferredResolution: z.string().default("-"),

    // Theme (UI Settings)
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
    themeMangaLibraryCollectionDefaultSorting: z.string().default("TITLE_ASC"),
    themeShowAnimeUnwatchedCount: z.boolean().default(true),
    themeShowMangaUnreadCount: z.boolean().default(true),
    themeHideEpisodeCardDescription: z.boolean().default(false),
    themeHideDownloadedEpisodeCardFilename: z.boolean().default(false),
    themeCustomCSS: z.string().default(""),
    themeMobileCustomCSS: z.string().default(""),
    themeUnpinnedMenuItems: z.array(z.string()).default([]),
    themeEnableBlurringEffects: z.boolean().default(true),
})

export const gettingStartedSchema = _gettingStartedSchema.extend(settingsSchema.shape)

export const getDefaultSettings = (data: z.infer<typeof gettingStartedSchema>): GettingStarted_Variables => ({
    library: {
        libraryPath: data.libraryPath,
        autoUpdateProgress: true,

        torrentProvider: data.torrentProvider || DEFAULT_TORRENT_PROVIDER,
        autoSelectTorrentProvider: "",
        autoScan: false,
        disableAnimeCardTrailers: false,
        enableManga: data.enableManga,
        enableOnlinestream: data.enableOnlinestream,
        dohProvider: DEFAULT_DOH_PROVIDER,
        openTorrentClientOnStart: false,
        openWebURLOnStart: false,
        refreshLibraryOnStart: false,
        autoPlayNextEpisode: false,
        enableWatchContinuity: data.enableWatchContinuity,
        libraryPaths: [],
        autoSyncOfflineLocalData: false,
        includeOnlineStreamingInLibrary: false,
        scannerMatchingThreshold: 0,
        scannerMatchingAlgorithm: "",
        autoSyncToLocalAccount: false,
        autoSaveCurrentMediaOffline: false,
        useFallbackMetadataProvider: false,
        scannerUseLegacyMatching: false,
        scannerStrictStructure: false,
        scannerProvider: data.scannerProvider || "tmdb",
        scannerConfig: "",
        disableLocalScanning: data.disableLocalScanning,
        disableTorrentStreaming: data.disableTorrentStreaming,
        disableDebridService: data.disableDebridService,
        disableTorrentProvider: data.disableTorrentProvider,
        disableJellyfin: data.disableJellyfin,
        tmdbApiKey: data.tmdbApiKey,
        tmdbLanguage: "en",
    },
    nakama: {
        enabled: false,
        isHost: false,
        hostPassword: "",
        remoteServerURL: "",
        remoteServerPassword: "",
        hostShareLocalAnimeLibrary: false,
        username: data.nakamaUsername,
        includeNakamaAnimeLibrary: false,
        hostUnsharedAnimeIds: [],
        hostEnablePortForwarding: false,
    },
    manga: {
        defaultMangaProvider: "",
        mangaAutoUpdateProgress: false,
        mangaLocalSourceDirectory: "",
    },
    mediaPlayer: {
        host: data.mediaPlayerHost,
        defaultPlayer: data.defaultPlayer,
        vlcPort: data.vlcPort,
        vlcUsername: data.vlcUsername || "",
        vlcPassword: data.vlcPassword,
        vlcPath: data.vlcPath || "",
        mpcPort: data.mpcPort,
        mpcPath: data.mpcPath || "",
        mpvSocket: data.mpvSocket || "",
        mpvPath: data.mpvPath || "",
        mpvArgs: "",
        iinaSocket: data.iinaSocket || "",
        iinaPath: data.iinaPath || "",
        iinaArgs: "",
        vcTranslate: false,
        vcTranslateApiKey: "",
        vcTranslateProvider: "",
        vcTranslateTargetLanguage: "",
    },
    discord: {
        enableRichPresence: data.enableRichPresence,
        enableAnimeRichPresence: true,
        enableMangaRichPresence: true,
        richPresenceHideKameHouseRepositoryButton: false,
        richPresenceShowAniListMediaButton: false,
        richPresenceShowAniListProfileButton: false,
        richPresenceUseMediaTitleStatus: true,
    },
    torrent: {
        defaultTorrentClient: data.defaultTorrentClient,
        qbittorrentPath: data.qbittorrentPath,
        qbittorrentHost: data.qbittorrentHost,
        qbittorrentPort: data.qbittorrentPort,
        qbittorrentPassword: data.qbittorrentPassword,
        qbittorrentUsername: data.qbittorrentUsername,
        qbittorrentTags: "",
        qbittorrentCategory: "",
        transmissionPath: data.transmissionPath,
        transmissionHost: data.transmissionHost,
        transmissionPort: data.transmissionPort,
        transmissionUsername: data.transmissionUsername,
        transmissionPassword: data.transmissionPassword,
        showActiveTorrentCount: false,
        hideTorrentList: false,
    },
    anilist: {
        hideAudienceScore: false,

        disableCacheLayer: false,
    },
    enableTorrentStreaming: data.enableTorrentStreaming,
    enableTranscode: data.enableTranscode,
    notifications: {
        disableNotifications: false,
        disableAutoDownloaderNotifications: false,
        disableAutoScannerNotifications: false,
    },
    debridProvider: data.debridProvider,
    debridApiKey: data.debridApiKey,
    jellyfin: {
        enabled: data.jellyfinEnabled,
        serverUrl: data.jellyfinServerUrl || "",
        apiKey: data.jellyfinApiKey,
        username: data.jellyfinUsername,
        password: data.jellyfinPassword,
        scanOnItemAdd: data.jellyfinScanOnItemAdd,
        scanDelayMs: data.jellyfinScanDelayMs,
    },
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
        getDefaultQBittorrentPath: (os: string) => {
            switch (os) {
                case "windows":
                    return "C:/Program Files/qBittorrent/qbittorrent.exe"
                case "linux":
                    return "/usr/bin/qbittorrent" // Default path for Client on most Linux distributions
                case "darwin":
                    return "/Applications/qbittorrent.app/Contents/MacOS/qbittorrent" // Default path for Client on macOS
                default:
                    return "C:/Program Files/qBittorrent/qbittorrent.exe"
            }
        },
        getDefaultTransmissionPath: (os: string) => {
            switch (os) {
                case "windows":
                    return "C:/Program Files/Transmission/transmission-qt.exe"
                case "linux":
                    return "/usr/bin/transmission-gtk"
                case "darwin":
                    return "/Applications/Transmission.app/Contents/MacOS/Transmission"
                default:
                    return "C:/Program Files/Transmission/transmission-qt.exe"
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

export function getDefaultIinaSocket(os: string) {
    return "/tmp/iina_socket"
}
