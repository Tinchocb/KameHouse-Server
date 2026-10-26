import * as React from "react"
import { useThemeSettings } from "./theme-hooks"
import { useAppStore } from "@/lib/store"
import { usePerformanceStore, selectEffectiveTier } from "@/lib/hardware/performance-store"

function useMediaMatch(query: string): boolean {
    return React.useSyncExternalStore(
        (onChange) => {
            if (typeof window === "undefined" || !window.matchMedia) return () => {}
            const mql = window.matchMedia(query)
            mql.addEventListener("change", onChange)
            return () => mql.removeEventListener("change", onChange)
        },
        () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(query).matches,
        () => false,
    )
}

/** Por qué la app está en modo plano (sin transparencia). Si hay varios motivos
 *  manda el más explícito: el interruptor del usuario, luego TV, el contraste
 *  del sistema, el gobernador automático y por último el perfil de ahorro. */
export type FlatReason = "manual" | "tv" | "contrast" | "auto" | "eco"

interface TransparencyState {
    /** true ⇒ <html data-flat="true"> (superficies sólidas, 0 backdrop-filter). */
    flat: boolean
    reason: FlatReason | null
    /** El sistema pide menos transparencia (`prefers-reduced-transparency`). Solo
     *  sugerencia: Chrome en Windows lo reporta true también por ahorro de energía. */
    systemSuggestsReduce: boolean
}

export function useTransparencyState(): TransparencyState {
    const ts = useThemeSettings()
    const tvMode = useAppStore(state => state.tvMode)
    const autoThrottleActive = usePerformanceStore(state => state.autoThrottleActive)
    const effectiveTier = usePerformanceStore(selectEffectiveTier)
    const contrastMore = useMediaMatch("(prefers-contrast: more)")
    const systemSuggestsReduce = useMediaMatch("(prefers-reduced-transparency: reduce)")

    const reason: FlatReason | null =
        ts.themeEnableBlurringEffects === false ? "manual"
        : tvMode ? "tv"
        : contrastMore ? "contrast"
        : autoThrottleActive ? "auto"
        : effectiveTier === "low_power" ? "eco"
        : null

    return { flat: reason !== null, reason, systemSuggestsReduce }
}


/** Converts a "#rrggbb" hex color into the "H S% L%" triplet format used by
 *  this design system's HSL custom properties (consumed as hsl(var(--x))). */
function hexToHslTriplet(hex: string): string | null {
    const clean = hex.replace("#", "").trim()
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null

    const r = parseInt(clean.slice(0, 2), 16) / 255
    const g = parseInt(clean.slice(2, 4), 16) / 255
    const b = parseInt(clean.slice(4, 6), 16) / 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0
    let s = 0
    const l = (max + min) / 2

    if (max !== min) {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break
            case g: h = (b - r) / d + 2; break
            case b: h = (r - g) / d + 4; break
        }
        h /= 6
    }

    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

function setDatasetProp(el: HTMLElement, key: string, value: string | undefined) {
    if (value === undefined) {
        if (key in el.dataset) {
            delete el.dataset[key]
        }
    } else {
        if (el.dataset[key] !== value) {
            el.dataset[key] = value
        }
    }
}

function setStyleProp(style: CSSStyleDeclaration, name: string, value: string | null) {
    if (value === null) {
        if (style.getPropertyValue(name)) {
            style.removeProperty(name)
        }
    } else {
        if (style.getPropertyValue(name) !== value) {
            style.setProperty(name, value)
        }
    }
}

/**
 * Applies the user's custom color palette (Settings → Apariencia → Paleta de
 * Colores) as CSS custom property overrides on the document root, when
 * enabled. Falls back to the design system defaults otherwise.
 */
export function useApplyCustomTheme() {
    const ts = useThemeSettings()
    const { flat: flatOn } = useTransparencyState()

    React.useLayoutEffect(() => {
        const root = document.documentElement.style
        const html = document.documentElement

        const applyDOMChanges = () => {
            const mode = ts.effectiveMode
            setDatasetProp(html, "mode", mode)

            // 1. Efectos por modo — el plano (data-flat) lo decide useTransparencyState:
            // interruptor "Reducir transparencia", TV, contraste alto del sistema,
            // gobernador automático o perfil de ahorro. Con flat: 0 backdrop-filter.
            setDatasetProp(html, "flat", flatOn ? "true" : undefined)

            const liquidOn = !flatOn && Boolean(ts.themeEnableLiquidGlass)
            setDatasetProp(html, "liquid", liquidOn ? "true" : undefined)

            // 2. Paleta — Clásico soporta presets clásicos o color personalizado;
            // Por Era aplica la era elegida + overrides del preset Personalizado.
            const eraOn = mode === "era" && ts.hasEraTheme
            const bgOn = ts.enableColorSettings && ts.hasCustomBackground
            const accentOn = ts.enableColorSettings && ts.hasCustomAccentColor

            if (mode === "classic") {
                const classicTheme = ts.themeEra?.startsWith("classic") ? ts.themeEra : "classic"
                setDatasetProp(html, "theme", classicTheme)
            } else if (eraOn) {
                setDatasetProp(html, "theme", ts.themeEra)
            } else {
                setDatasetProp(html, "theme", undefined)
            }

            setStyleProp(root, "--glow-color-1", null)
            setStyleProp(root, "--glow-color-2", null)
            setStyleProp(root, "--glow-color-3", null)
            setStyleProp(root, "--glow-color-4", null)
            setStyleProp(root, "--glow-color-5", null)

            if (bgOn) {
                setStyleProp(root, "--bg-primary", ts.backgroundColor)
            } else {
                setStyleProp(root, "--bg-primary", null)
            }

            if (accentOn) {
                const hsl = hexToHslTriplet(ts.accentColor)
                if (hsl) {
                    setStyleProp(root, "--brand-accent", hsl)
                    setStyleProp(root, "--brand-accent-hex", ts.accentColor)
                }
            } else {
                setStyleProp(root, "--brand-accent", null)
                setStyleProp(root, "--brand-accent-hex", null)
            }
        }

        applyDOMChanges()
    }, [
        ts.effectiveMode,
        ts.themeEra,
        flatOn,
        ts.themeEnableLiquidGlass,
        ts.enableColorSettings,
        ts.hasEraTheme,
        ts.hasCustomBackground,
        ts.hasCustomAccentColor,
        ts.backgroundColor,
        ts.accentColor,
    ])
}

/** Strips constructs that could exfiltrate data or break out of the <style>
 *  context from user-provided custom CSS: @import rules and javascript: URLs. */
function sanitizeCustomCss(css: string): string {
    return css
        .slice(0, 20000)
        .replace(/@import[^;]*;?/gi, "")
        .replace(/url\(\s*["']?\s*javascript:[^)]*\)/gi, "url()")
}

/**
 * Renders the user's custom global CSS (Settings → Apariencia → CSS
 * Personalizado) as a live <style> tag. Mount once near the app root.
 */
export function CustomThemeStyles() {
    const ts = useThemeSettings()
    const css = [ts.themeCustomCSS, ts.themeMobileCustomCSS].filter(Boolean).join("\n\n")
    if (!css) return null
    return React.createElement("style", { id: "kamehouse-custom-css" }, sanitizeCustomCss(css))
}
