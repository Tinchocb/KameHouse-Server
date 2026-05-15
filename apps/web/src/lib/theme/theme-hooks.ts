import { Models_Theme } from "@/api/generated/types"

import React from "react"
import { useWindowSize } from "react-use"

export const enum ThemeLibraryScreenBannerType {
    Dynamic = "dynamic",
    Custom = "custom",
}

export const enum ThemeMediaPageBannerType {
    Default = "default",
    BlurWhenUnavailable = "blur-when-unavailable",
    DimWhenUnavailable = "dim-when-unavailable",
    HideWhenUnavailable = "hide-when-unavailable",
    Blur = "blur",
    Dim = "dim",
    Hide = "hide",
}

export const ThemeMediaPageBannerTypeOptions = [
    {
        value: ThemeMediaPageBannerType.Default as string, label: "Default",
        description: "Always show a banner image. If not available, the cover image will be used instead.",
    },
    {
        value: ThemeMediaPageBannerType.BlurWhenUnavailable as string, label: "Blur when unavailable",
        description: "Show the banner image if available. If not available, the cover image will be used and blurred.",
    },
    {
        value: ThemeMediaPageBannerType.DimWhenUnavailable as string, label: "Dim if unavailable",
        description: "Show the banner image if available. If not available, the banner will be dimmed.",
    },
    {
        value: ThemeMediaPageBannerType.HideWhenUnavailable as string, label: "Hide if unavailable",
        description: "Show the banner image if available. If not available, the banner will be hidden.",
    },
    {
        value: ThemeMediaPageBannerType.Dim as string, label: "Dim",
        description: "Always dim the banner image.",
    },
    {
        value: ThemeMediaPageBannerType.Blur as string, label: "Blur",
        description: "Always blur the banner image.",
    },
    {
        value: ThemeMediaPageBannerType.Hide as string, label: "Hide",
        description: "Always hide the banner image.",
    },
]

export const enum ThemeMediaPageBannerSize {
    Default = "default", // block height
    Small = "small",
}

export const ThemeMediaPageBannerSizeOptions = [
    {
        value: ThemeMediaPageBannerSize.Default as string, label: "Large",
        description: "Fill a large portion of the screen.",
    },
    {
        value: ThemeMediaPageBannerSize.Small as string, label: "Smaller",
        description: "Use a smaller banner size, displaying more of the image.",
    },
]

export const enum ThemeMediaPageInfoBoxSize {
    // Default = "default",
    Fluid = "fluid",
    Boxed = "boxed",
}

export const ThemeMediaPageInfoBoxSizeOptions = [
    {
        value: ThemeMediaPageInfoBoxSize.Fluid as string, label: "Fluid",
        // description: "Full-width info box with rearrangement of elements.",
    },
    {
        value: ThemeMediaPageInfoBoxSize.Boxed as string, label: "Boxed",
        // description: "Display the media banner as a box",
    },
]

export type ThemeSettings = Omit<Models_Theme, "id">
export const THEME_DEFAULT_VALUES: ThemeSettings = {
    enableColorSettings: false,
    animeEntryScreenLayout: "stacked",
    smallerEpisodeCarouselSize: false,
    expandSidebarOnHover: false,
    backgroundColor: "#070707",
    accentColor: "#6152df",
    sidebarBackgroundColor: "#070707",
    hideTopNavbar: false,
    enableMediaCardBlurredBackground: false,
    libraryScreenBannerType: ThemeLibraryScreenBannerType.Dynamic,
    libraryScreenCustomBannerImage: "",
    libraryScreenCustomBannerPosition: "50% 50%",
    libraryScreenCustomBannerOpacity: 100,
    libraryScreenCustomBackgroundImage: "",
    libraryScreenCustomBackgroundOpacity: 10,
    disableLibraryScreenGenreSelector: false,
    libraryScreenCustomBackgroundBlur: "",
    enableMediaPageBlurredBackground: false,
    disableSidebarTransparency: false,
    useLegacyEpisodeCard: false,
    disableCarouselAutoScroll: false,
    mediaPageBannerType: ThemeMediaPageBannerType.Default,
    mediaPageBannerSize: ThemeMediaPageBannerSize.Default,
    mediaPageBannerInfoBoxSize: ThemeMediaPageInfoBoxSize.Fluid,
    showEpisodeCardAnimeInfo: false,
    continueWatchingDefaultSorting: "AIRDATE_DESC",
    animeLibraryCollectionDefaultSorting: "TITLE",
    showAnimeUnwatchedCount: false,
    hideEpisodeCardDescription: false,
    hideDownloadedEpisodeCardFilename: false,
    customCSS: "",
    mobileCustomCSS: "",
    unpinnedMenuItems: [],
    enableBlurringEffects: false,
    enableEpisodeCardHoverEffects: true,
}

export type ThemeSettingsHook = {
    hasCustomBackgroundColor: boolean
} & ThemeSettings

/**
 * Get the current theme settings
 * This hook will return the default values if some values are not set
 */
export function useThemeSettings(): ThemeSettingsHook {
    return {
        ...THEME_DEFAULT_VALUES,
        hasCustomBackgroundColor: false,
        mediaPageBannerInfoBoxSize: "fluid",
        showEpisodeCardAnimeInfo: true,
    }
}



export function useIsMobile(): { isMobile: boolean } {
    const { width } = useWindowSize()
    return { isMobile: React.useMemo(() => width < 1024, [width]) }
}
