import * as React from "react"
import { Models_Theme } from "@/api/generated/types"
import { useGetSettings } from "@/api/hooks/settings.hooks"


const enum ThemeLibraryScreenBannerType {
    Dynamic = "dynamic",
    Custom = "custom",
}

const enum ThemeMediaPageBannerType {
    Default = "default",
    BlurWhenUnavailable = "blur-when-unavailable",
    DimWhenUnavailable = "dim-when-unavailable",
    HideWhenUnavailable = "hide-when-unavailable",
    Blur = "blur",
    Dim = "dim",
    Hide = "hide",
}

const enum ThemeMediaPageBannerSize {
    Default = "default", // block height
    Small = "small",
}

const enum ThemeMediaPageInfoBoxSize {
    // Default = "default",
    Fluid = "fluid",
    Boxed = "boxed",
}

export type ThemeSettings = Omit<Models_Theme, "id" | "createdAt" | "updatedAt"> & {
    sidebarBackgroundColor?: string
    themeAnimeEntryScreenLayout?: string
    themeUseLegacyEpisodeCard?: boolean
    homeItems?: string[]
}

export type ThemeMode = "classic" | "era"

/**
 * Resolves the effective UI mode. `themeMode` is the explicit source of truth;
 * for legacy settings saved before the field existed ("" / unknown), derive it:
 * era users keep their palette, old "Modo Avanzado" (blur) users keep effects,
 * everyone else lands on the premium Classic mode.
 */
export function resolveThemeMode(t: Pick<ThemeSettings, "themeMode" | "themeEra" | "themeEnableBlurringEffects">): ThemeMode {
    if (t.themeMode === "classic" || t.themeMode === "era") return t.themeMode
    // "advanced" es un valor legacy que ya no forma parte del union ThemeMode
    if ((t.themeMode as string) === "advanced") return "era"
    if (t.themeEra?.startsWith("era-")) return "era"
    // Solo derivar a "era" por blur si el usuario NO eligió modo explícitamente
    if (!t.themeMode && t.themeEnableBlurringEffects) return "era"
    return "classic"
}

const THEME_DEFAULT_VALUES: ThemeSettings = {
    enableColorSettings: false,
    backgroundColor: "#050506",
    accentColor: "#C8102E",
    sidebarBackgroundColor: "",
    themeEra: "classic",
    themeMode: "",
    themeEnableLiquidGlass: false,
    homeItems: [],
    // "side-by-side" is what the detail page has always rendered (saga selector
    // beside the episode list); "stacked" is the opt-in that pushes it above.
    themeAnimeEntryScreenLayout: "side-by-side",
    themeSmallerEpisodeCarouselSize: false,
    themeExpandSidebarOnHover: false,
    themeDisableSidebarTransparency: false,
    themeEnableSidebarGradient: false,
    // Glass sutil activo por defecto para preservar el look Clásico premium;
    // el toggle de Apariencia puede desactivarlo (flat mode).
    themeEnableBlurringEffects: true,
    themeEnableCinematicGrain: false,
    themeDisableCarouselAutoScroll: false,
    themeUseLegacyEpisodeCard: false,
    themeLibraryScreenBannerType: ThemeLibraryScreenBannerType.Dynamic,
    themeLibraryScreenCustomBannerImage: "",
    themeLibraryScreenCustomBannerPosition: "50% 50%",
    themeLibraryScreenCustomBannerOpacity: 10,
    themeLibraryScreenCustomBackgroundImage: "",
    themeLibraryScreenCustomBackgroundOpacity: 10,
    themeLibraryScreenCustomBackgroundBlur: "none",
    themeDisableLibraryScreenGenreSelector: false,
    themeMediaPageBannerType: ThemeMediaPageBannerType.Default,
    themeMediaPageBannerSize: ThemeMediaPageBannerSize.Default,
    themeMediaPageBannerInfoBoxSize: ThemeMediaPageInfoBoxSize.Fluid,
    // Was always-on ambient design behavior before this setting existed — now opt-in for flat default.
    themeEnableMediaPageBlurredBackground: false,
    themeShowEpisodeCardAnimeInfo: true,
    themeShowAnimeUnwatchedCount: true,
    themeHideEpisodeCardDescription: false,
    themeHideDownloadedEpisodeCardFilename: false,
    themeAnimeLibraryCollectionDefaultSorting: "TITLE_ASC",
    themeCustomCSS: "",
    themeMobileCustomCSS: "",
    themeUnpinnedMenuItems: [],
    bgMusicEnabled: true,
    bgMusicVolume: 0.25,
    bgMusicDir: "",
    bgMusicTracks: [],
    seriesSoundtrackMode: true,
    uiSoundsEnabled: true,
    uiSoundsVolume: 1.0,
}

type ThemeSettingsHook = {
    hasCustomBackgroundColor: boolean
    hasEraTheme: boolean
    hasCustomBackground: boolean
    hasCustomAccentColor: boolean
    effectiveMode: ThemeMode
} & ThemeSettings

/**
 * Maps the info-box size to one of the two values the UI actually offers. The
 * backend column defaults to "default", a legacy value dropped from the enum, so
 * it (and anything unset) resolves to Fluid.
 */
function normalizeInfoBoxSize(value: string | undefined | null): string {
    return value === ThemeMediaPageInfoBoxSize.Boxed
        ? ThemeMediaPageInfoBoxSize.Boxed
        : ThemeMediaPageInfoBoxSize.Fluid
}

/**
 * Get the current theme settings
 * Reads the real settings persisted on the server (Settings → Apariencia),
 * falling back to THEME_DEFAULT_VALUES for anything not yet set.
 */
export function useThemeSettings(): ThemeSettingsHook {
    const { data: serverSettings } = useGetSettings()
    const theme = serverSettings?.theme as (Models_Theme & Partial<ThemeSettings>) | undefined

    return React.useMemo(() => {
        const merged: ThemeSettings = theme
            ? {
                ...THEME_DEFAULT_VALUES,
                ...theme,
                backgroundColor: theme.backgroundColor || THEME_DEFAULT_VALUES.backgroundColor,
                accentColor: theme.accentColor || THEME_DEFAULT_VALUES.accentColor,
                themeLibraryScreenBannerType: theme.themeLibraryScreenBannerType || THEME_DEFAULT_VALUES.themeLibraryScreenBannerType,
                themeLibraryScreenCustomBannerPosition: theme.themeLibraryScreenCustomBannerPosition || THEME_DEFAULT_VALUES.themeLibraryScreenCustomBannerPosition,
                themeMediaPageBannerType: theme.themeMediaPageBannerType || THEME_DEFAULT_VALUES.themeMediaPageBannerType,
                themeMediaPageBannerSize: theme.themeMediaPageBannerSize || THEME_DEFAULT_VALUES.themeMediaPageBannerSize,
                // El backend arrastra un "default" legacy que no es ninguna de las dos
                // opciones reales (fluid/boxed) — normalizarlo evita que el form guarde
                // un valor que el selector no ofrece.
                themeMediaPageBannerInfoBoxSize: normalizeInfoBoxSize(theme.themeMediaPageBannerInfoBoxSize),
                themeAnimeEntryScreenLayout: theme.themeAnimeEntryScreenLayout || THEME_DEFAULT_VALUES.themeAnimeEntryScreenLayout,
                themeAnimeLibraryCollectionDefaultSorting: theme.themeAnimeLibraryCollectionDefaultSorting || THEME_DEFAULT_VALUES.themeAnimeLibraryCollectionDefaultSorting,
            }
            : { ...THEME_DEFAULT_VALUES }

        // Derived from raw (un-coalesced) persisted values — used to drive the
        // three independent color toggles in Settings → Apariencia, since the
        // backend model has no separate enableCustomBg/enableCustomAccent fields.
        const rawBackgroundColor = theme?.backgroundColor ?? ""
        const rawAccentColor = theme?.accentColor ?? ""

        const effectiveMode = resolveThemeMode(merged)
        
        let effectiveEra = merged.themeEra
        if (effectiveMode === "era") {
            if (!effectiveEra || !effectiveEra.startsWith("era-")) {
                effectiveEra = "era-universe"
            }
        } else if (effectiveMode === "classic") {
            if (!effectiveEra || (!effectiveEra.startsWith("classic") && effectiveEra !== "classic")) {
                effectiveEra = "classic"
            }
        }

        return {
            ...merged,
            themeEra: effectiveEra,
            // El toggle del usuario manda en ambos modos. En Clásico la
            // intensidad la modulan los tokens de [data-mode="classic"] (sutil);
            // en Por Era es el glass completo con tintes de saga.
            themeEnableBlurringEffects: merged.themeEnableBlurringEffects,
            effectiveMode,
            hasCustomBackgroundColor: merged.enableColorSettings && !!merged.backgroundColor,
            hasEraTheme: effectiveEra !== "",
            hasCustomBackground: rawBackgroundColor !== "",
            hasCustomAccentColor: rawAccentColor !== "",
        }
    }, [theme])
}



