import * as React from "react"
import { Models_Theme } from "@/api/generated/types"
import { useGetSettings } from "@/api/hooks/settings.hooks"
import { useAppStore } from "@/lib/store"
import { normalizeThemePreference, type ThemeMode } from "./themes-registry"

export type { ThemeMode }


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

type ThemeSettings = Omit<Models_Theme, "id" | "createdAt" | "updatedAt">

/**
 * Resolves the effective UI mode. `themeMode` is the explicit source of truth.
 * Only two themes exist: Minimalista ("classic-minimalist") and Por era ("era").
 * For backward compatibility: legacy "classic" (Neutro) and "advanced" are converted
 * to "era" with Universo DB, preserving transparency and visual effects.
 */
export function resolveThemeMode(t: Partial<Pick<ThemeSettings, "themeMode" | "themeEra" | "themeEnableBlurringEffects">>): ThemeMode {
    return normalizeThemePreference(t).themeMode
}

const THEME_DEFAULT_VALUES: ThemeSettings = {
    enableColorSettings: false,
    backgroundColor: "#050506",
    accentColor: "#C8102E",
    themeEra: "era-universe",
    themeMode: "era",
    themeEnableLiquidGlass: false,
    themeSmallerEpisodeCarouselSize: false,
    themeExpandSidebarOnHover: false,
    themeDisableSidebarTransparency: false,
    themeEnableSidebarGradient: false,
    // Glass sutil activo por defecto para preservar el look Clásico premium;
    // el toggle de Apariencia puede desactivarlo (flat mode).
    themeEnableBlurringEffects: true,
    themeEnableCinematicGrain: false,
    themeDisableCarouselAutoScroll: false,
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
 * Local visual overrides (themeVisual store, written instantly by Apariencia
 * controls) win over the server while set — this is what gives toggles
 * immediate effect before Guardar. syncStoresWithSettings pushes the server
 * back into the store on load/save/discard/WS-refresh.
 */
export function useThemeSettings(): ThemeSettingsHook {
    const { data: serverSettings } = useGetSettings()
    const themeVisual = useAppStore((s) => s.themeVisual)
    const serverTheme = serverSettings?.theme as (Models_Theme & Partial<ThemeSettings>) | undefined

    const theme = React.useMemo(() => {
        const definedLocal = Object.fromEntries(
            Object.entries(themeVisual ?? {}).filter(([, v]) => v !== undefined)
        )
        if (!serverTheme && Object.keys(definedLocal).length === 0) return undefined
        return { ...serverTheme, ...definedLocal } as (Models_Theme & Partial<ThemeSettings>)
    }, [serverTheme, themeVisual])

    return React.useMemo(() => {
        // Sin preferencias disponibles, el primer arranque offline usa Por era.
        if (!theme) {
            return {
                ...THEME_DEFAULT_VALUES,
                themeEra: "era-universe",
                themeMode: "era" as const,
                effectiveMode: "era" as ThemeMode,
                hasEraTheme: true,
                hasCustomBackground: false,
                hasCustomAccentColor: false,
            }
        }
        const merged: ThemeSettings = {
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
            themeAnimeLibraryCollectionDefaultSorting: theme.themeAnimeLibraryCollectionDefaultSorting || THEME_DEFAULT_VALUES.themeAnimeLibraryCollectionDefaultSorting,
        }

        // Derived from raw (un-coalesced) persisted values — used to drive the
        // three independent color toggles in Settings → Apariencia, since the
        // backend model has no separate enableCustomBg/enableCustomAccent fields.
        const rawBackgroundColor = theme?.backgroundColor ?? ""
        const rawAccentColor = theme?.accentColor ?? ""

        const normalized = normalizeThemePreference({ ...merged, themeMode: theme.themeMode ?? "" })
        const effectiveMode = normalized.themeMode
        
        const effectiveEra = normalized.themeEra

        // Por era respeta la preferencia guardada de Liquid Glass.
        // Minimalista es plano por diseño (sin transparencias ni Liquid Glass).
        const effectiveLiquidGlass =
            effectiveMode === "era"
                ? (theme?.themeEnableLiquidGlass !== false)
                : false

        // El toggle de blur de merged manda en ambos modos; los tokens de
        // cada tema modulan la intensidad.
        return {
            ...merged,
            themeMode: effectiveMode,
            themeEra: effectiveEra,
            themeEnableLiquidGlass: effectiveLiquidGlass,
            effectiveMode,
            hasEraTheme: effectiveEra !== "",
            hasCustomBackground: rawBackgroundColor !== "",
            hasCustomAccentColor: rawAccentColor !== "",
        }
    }, [theme])
}

/**
 * Lee el flag de puntuación de audiencia con efecto inmediato:
 * el override local (toggle de Apariencia) gana mientras existe;
 * si no, manda el servidor. Converge vía syncStoresWithSettings
 * al cargar/guardar/descartar.
 */
export function useHideAudienceScore(): boolean {
    const { data: serverSettings } = useGetSettings()
    const local = useAppStore((s) => s.hideAudienceScore)
    return !!(local ?? serverSettings?.platform?.hideAudienceScore ?? false)
}



