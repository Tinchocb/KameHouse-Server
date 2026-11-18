import * as React from "react"
import { useThemeSettings } from "./theme-hooks"
import { resolveDomThemeContract } from "./themes-registry"
import { resolveFollowedTheme, selectScreenEra, useScreenEraStore } from "./screen-era"
import { usePerformanceStore, selectEffectiveTier } from "@/lib/hardware/performance-store"
import { useMotionTier } from "@/components/ui/kinetics/motion-tier"
import { crossfadeThemeChange } from "@/lib/helpers/transitions"
import { useMediaQuery } from "@/hooks/use-media-query"

/** Por qué la app está en modo plano (sin transparencia). Si hay varios motivos
 *  manda el más explícito: el interruptor del usuario, el tema (Minimalista es
 *  plano por diseño), el contraste del sistema, el gobernador automático y por
 *  último el perfil de ahorro. */
export type FlatReason = "manual" | "theme" | "contrast" | "auto" | "eco"

export function resolveFlatReason(input: {
    blurDisabled: boolean
    themeMode: string
    contrastMore: boolean
    autoThrottleActive: boolean
    lowPower: boolean
}): FlatReason | null {
    if (input.blurDisabled) return "manual"
    if (input.themeMode === "classic-minimalist") return "theme"
    if (input.contrastMore) return "contrast"
    if (input.autoThrottleActive) return "auto"
    if (input.lowPower) return "eco"
    return null
}

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
    const autoThrottleActive = usePerformanceStore(state => state.autoThrottleActive)
    const effectiveTier = usePerformanceStore(selectEffectiveTier)
    const contrastMore = useMediaQuery("(prefers-contrast: more)")
    const systemSuggestsReduce = useMediaQuery("(prefers-reduced-transparency: reduce)")

    const reason = resolveFlatReason({
        blurDisabled: ts.themeEnableBlurringEffects === false,
        themeMode: ts.effectiveMode,
        contrastMore,
        autoThrottleActive,
        lowPower: effectiveTier === "low_power",
    })

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
    // Universo DB: la saga de la pantalla (ficha, hero de Inicio, sección de la Cronología)
    const screenEra = useScreenEraStore(selectScreenEra)
    const screenEraFade = useScreenEraStore((s) => s.fade)
    // Fundido solo con movimiento completo: no en movimiento reducido, ahorro ni equipos modestos
    const canFade = useMotionTier() === "full"

    React.useLayoutEffect(() => {
        const root = document.documentElement.style
        const html = document.documentElement

        const applyDOMChanges = () => {
            const themeEra = resolveFollowedTheme(ts.effectiveMode, ts.themeEra, screenEra)
            const contract = resolveDomThemeContract(ts.effectiveMode, themeEra, ts.hasEraTheme)

            // 1. Contrato declarativo de los dos diseños (Minimalista · Por era)
            setDatasetProp(html, "mode", contract.mode)
            setDatasetProp(html, "uiStyle", contract.uiStyle)
            // Universo DB cambiando de saga dentro de la misma pantalla: fundido entre paletas.
            // Al entrar o salir de una pantalla cambia al instante (la ruta trae su fundido).
            const previousTheme = html.dataset.theme
            const fadePalette = canFade && screenEraFade &&
                previousTheme !== contract.theme &&
                !!previousTheme?.startsWith("era-") && !!contract.theme?.startsWith("era-")
            if (fadePalette) {
                crossfadeThemeChange(() => setDatasetProp(html, "theme", contract.theme))
            } else {
                setDatasetProp(html, "theme", contract.theme)
            }

            // 2. Efectos transversales — el plano (data-flat) lo decide useTransparencyState:
            // interruptor "Reducir transparencia", contraste alto del sistema,
            // gobernador automático o perfil de ahorro. Con flat: 0 backdrop-filter.
            setDatasetProp(html, "flat", flatOn ? "true" : undefined)

            // Por era usa Liquid Glass según la preferencia guardada; Minimalista siempre es plano.
            const liquidOn = !flatOn && contract.mode === "era" && Boolean(ts.themeEnableLiquidGlass)
            setDatasetProp(html, "liquid", liquidOn ? "true" : undefined)

            // 3. Overrides personalizados de color (cuando están habilitados).
            // Nunca en Por era: cada saga trae su paleta, y un acento o fondo guardado por
            // versiones viejas (o por el reset de fábrica) la pisaría en todas las sagas.
            const customOn = ts.enableColorSettings && ts.effectiveMode !== "era"
            const bgOn = customOn && ts.hasCustomBackground
            const accentOn = customOn && ts.hasCustomAccentColor

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
        screenEra,
        screenEraFade,
        canFade,
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
