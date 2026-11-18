import type { SettingsFormValues } from "./settings"
import { usePlayerStore, useUIStore } from "@/lib/store"
import { usePerformanceStore } from "@/lib/hardware/performance-store"
import { normalizeThemePreference } from "@/lib/theme/themes-registry"

export function syncStoresWithSettings(data: Partial<SettingsFormValues>) {
    if (!data) return
    const playerState = usePlayerStore.getState()
    const uiState = useUIStore.getState()
    const playerUpdates: Record<string, unknown> = {}
    const uiUpdates: Record<string, unknown> = {}

    if (data.library) {
        const lib = data.library as Record<string, unknown>
        if (lib.preferredAudioProfile !== undefined && lib.preferredAudioProfile !== playerState.preferredAudioProfile) {
            playerUpdates.preferredAudioProfile = lib.preferredAudioProfile
        }
        if (lib.autoSkipIntro !== undefined && lib.autoSkipIntro !== playerState.autoSkipIntro) {
            playerUpdates.autoSkipIntro = lib.autoSkipIntro
        }
        if (lib.autoSkipOutro !== undefined && lib.autoSkipOutro !== playerState.autoSkipOutro) {
            playerUpdates.autoSkipOutro = lib.autoSkipOutro
        }
        if (lib.autoDisableSubtitlesWhenDubbed !== undefined && lib.autoDisableSubtitlesWhenDubbed !== playerState.autoDisableSubtitlesWhenDubbed) {
            playerUpdates.autoDisableSubtitlesWhenDubbed = lib.autoDisableSubtitlesWhenDubbed
        }
        if (lib.marathonMode !== undefined && lib.marathonMode !== playerState.marathonMode) {
            playerUpdates.marathonMode = lib.marathonMode
        }
    }
    if (data.theme) {
        const theme = normalizeThemePreference(data.theme) as Record<string, unknown>
        if (theme.bgMusicEnabled !== undefined && theme.bgMusicEnabled !== uiState.bgMusicEnabled) {
            uiUpdates.bgMusicEnabled = theme.bgMusicEnabled
        }
        if (theme.bgMusicVolume !== undefined && theme.bgMusicVolume !== uiState.bgMusicVolume) {
            uiUpdates.bgMusicVolume = theme.bgMusicVolume
        }
        if (theme.bgMusicDir !== undefined && theme.bgMusicDir !== uiState.bgMusicDir) {
            uiUpdates.bgMusicDir = theme.bgMusicDir
        }
        if (theme.bgMusicTracks !== undefined && theme.bgMusicTracks !== uiState.bgMusicTracks) {
            uiUpdates.bgMusicTracks = theme.bgMusicTracks
        }
        if (theme.seriesSoundtrackMode !== undefined && theme.seriesSoundtrackMode !== uiState.seriesSoundtrackMode) {
            uiUpdates.seriesSoundtrackMode = theme.seriesSoundtrackMode
        }
        if (theme.uiSoundsEnabled !== undefined && theme.uiSoundsEnabled !== uiState.uiSoundsEnabled) {
            uiUpdates.uiSoundsEnabled = theme.uiSoundsEnabled
        }
        if (theme.uiSoundsVolume !== undefined && theme.uiSoundsVolume !== uiState.uiSoundsVolume) {
            uiUpdates.uiSoundsVolume = theme.uiSoundsVolume
        }
        const visualKeys = [
            "themeEra", "themeMode", "enableColorSettings",
            "themeEnableBlurringEffects", "themeEnableLiquidGlass",
            "themeEnableMediaPageBlurredBackground",
            "themeAnimeLibraryCollectionDefaultSorting",
        ] as const
        const currentVisual = (uiState.themeVisual ?? {}) as Record<string, unknown>
        const nextVisual: Record<string, unknown> = { ...currentVisual }
        let visualDirty = false
        for (const key of visualKeys) {
            if (theme[key] !== undefined && theme[key] !== currentVisual[key]) {
                nextVisual[key] = theme[key]
                visualDirty = true
            } else if (theme[key] === undefined && currentVisual[key] !== undefined) {
                delete nextVisual[key]
                visualDirty = true
            }
        }
        if (visualDirty) {
            uiUpdates.themeVisual = nextVisual
        }
    }
    if (data.platform) {
        const platform = data.platform as Record<string, unknown>
        if (platform.hideAudienceScore !== undefined && platform.hideAudienceScore !== uiState.hideAudienceScore) {
            uiUpdates.hideAudienceScore = platform.hideAudienceScore
        } else if (platform.hideAudienceScore === undefined && uiState.hideAudienceScore !== undefined) {
            uiUpdates.hideAudienceScore = undefined
        }
    }
    if (Object.keys(playerUpdates).length > 0) {
        usePlayerStore.setState(playerUpdates)
    }
    if (Object.keys(uiUpdates).length > 0) {
        useUIStore.setState(uiUpdates)
    }
    if (data.mediastream) {
        const ms = data.mediastream as Record<string, unknown>
        const perfState = usePerformanceStore.getState()
        const perfUpdates: Record<string, unknown> = {}
        if (ms.performanceProfile !== undefined && ms.performanceProfile !== perfState.performanceProfile) {
            perfUpdates.performanceProfile = ms.performanceProfile
        }
        if (ms.autoGovernorEnabled !== undefined && ms.autoGovernorEnabled !== perfState.autoGovernorEnabled) {
            perfUpdates.autoGovernorEnabled = ms.autoGovernorEnabled
        }
        if (Object.keys(perfUpdates).length > 0) {
            usePerformanceStore.setState(perfUpdates)
        }
    }
}

export function getEffectiveSettings(server: Partial<SettingsFormValues> | null | undefined): SettingsFormValues {
    const playerState = usePlayerStore.getState()
    const uiState = useUIStore.getState()
    const perfState = usePerformanceStore.getState()
    const base = (server || {}) as Partial<SettingsFormValues>

    return {
        ...base,
        googleDrive: {
            enabled: base.googleDrive?.enabled ?? false,
            clientId: base.googleDrive?.clientId ?? "",
            clientSecret: base.googleDrive?.clientSecret ?? "",
            refreshToken: base.googleDrive?.refreshToken ?? "",
            folderId: base.googleDrive?.folderId ?? "",
            folderName: base.googleDrive?.folderName ?? "",
            disableAutoSync: base.googleDrive?.disableAutoSync ?? false,
            scanIntervalMinutes: base.googleDrive?.scanIntervalMinutes ?? 60,
        },
        library: {
            ...base.library,
            seriesPaths: base.library?.seriesPaths ?? [],
            moviePaths: base.library?.moviePaths ?? [],
            autoScan: base.library?.autoScan ?? false,
            unifiedScan: base.library?.unifiedScan ?? false,
            refreshLibraryOnStart: base.library?.refreshLibraryOnStart ?? false,
            autoPlayNextEpisode: base.library?.autoPlayNextEpisode ?? true,
            autoDetectSkipTimes: base.library?.autoDetectSkipTimes ?? true,
            enableWatchContinuity: base.library?.enableWatchContinuity ?? true,
            scannerMatchingThreshold: base.library?.scannerMatchingThreshold ?? 0,
            scannerProvider: base.library?.scannerProvider || "anilist",
            tmdbLanguage: base.library?.tmdbLanguage || "es-MX",
            tmdbApiKey: base.library?.tmdbApiKey || "",
            scannerStrictStructure: base.library?.scannerStrictStructure ?? false,
            disableLocalScanning: base.library?.disableLocalScanning ?? false,
            disableCloudSource: base.library?.disableCloudSource ?? false,
            preferredAudioProfile: base.library?.preferredAudioProfile || playerState.preferredAudioProfile || "latino",
            autoSkipIntro: base.library?.autoSkipIntro ?? playerState.autoSkipIntro ?? false,
            autoSkipOutro: base.library?.autoSkipOutro ?? playerState.autoSkipOutro ?? false,
            autoDisableSubtitlesWhenDubbed: base.library?.autoDisableSubtitlesWhenDubbed ?? playerState.autoDisableSubtitlesWhenDubbed ?? true,
            marathonMode: base.library?.marathonMode ?? playerState.marathonMode ?? false,
        },
        mediastream: {
            ...base.mediastream,
            performanceProfile: base.mediastream?.performanceProfile || perfState.performanceProfile || "auto",
            autoGovernorEnabled: base.mediastream?.autoGovernorEnabled ?? perfState.autoGovernorEnabled ?? true,
        },
        theme: {
            ...normalizeThemePreference(base.theme ?? {}),
            bgMusicEnabled: base.theme?.bgMusicEnabled ?? uiState.bgMusicEnabled ?? true,
            bgMusicVolume: base.theme?.bgMusicVolume ?? uiState.bgMusicVolume ?? 0.25,
            bgMusicDir: base.theme?.bgMusicDir ?? uiState.bgMusicDir ?? "",
            bgMusicTracks: base.theme?.bgMusicTracks ?? uiState.bgMusicTracks ?? [],
            seriesSoundtrackMode: base.theme?.seriesSoundtrackMode ?? uiState.seriesSoundtrackMode ?? true,
            uiSoundsEnabled: base.theme?.uiSoundsEnabled ?? uiState.uiSoundsEnabled ?? true,
            uiSoundsVolume: base.theme?.uiSoundsVolume ?? uiState.uiSoundsVolume ?? 1.0,
        },
    } as SettingsFormValues
}

