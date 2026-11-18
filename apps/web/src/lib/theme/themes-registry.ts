/**
 * KameHouse — Registro Canónico de los 2 Diseños de Interfaz
 *
 * Opciones visibles del selector de Apariencia:
 * 1. Minimalista (`classic-minimalist`) → `styles/themes/classic-minimalist.css`
 * 2. Por Era (`era`)                    → `styles/themes/era.css`
 *
 * Compatibilidad:
 * El valor de entrada legacy `classic` (antiguo Neutro independiente) se mantiene
 * como entrada compatible y se convierte automáticamente a Por era con Universo DB.
 */

import { CLASSIC_MINIMALIST_THEME } from "./classic-minimalist.theme"
import { ERA_THEME, ERA_THEME_PRESETS, type EraPreset } from "./era.theme"

export {
    CLASSIC_MINIMALIST_THEME,
    ERA_THEME,
    ERA_THEME_PRESETS,
    type EraPreset,
}

export const KAMEHOUSE_THEMES = {
    "classic-minimalist": CLASSIC_MINIMALIST_THEME,
    era: ERA_THEME,
} as const

export type ThemeMode = keyof typeof KAMEHOUSE_THEMES

/** Normalize persisted preferences without changing transparency, effects or custom values. */
export function normalizeThemePreference<T extends { themeMode?: string; themeEra?: string }>(theme: T) {
    const legacyNeutral = theme.themeMode === "classic" || theme.themeMode === "advanced"
    const themeMode: ThemeMode = theme.themeMode === CLASSIC_MINIMALIST_THEME.id
        ? CLASSIC_MINIMALIST_THEME.id
        : "era"
    if (themeMode === CLASSIC_MINIMALIST_THEME.id) {
        return {
            ...theme,
            themeMode,
            themeEra: CLASSIC_MINIMALIST_THEME.domContract.theme,
        }
    }
    const validEra = ERA_THEME_PRESETS.some(preset => preset.themeEra === theme.themeEra)
    return {
        ...theme,
        themeMode,
        themeEra: !legacyNeutral && validEra ? theme.themeEra ?? ERA_THEME.defaultEra : ERA_THEME.defaultEra,
    }
}

export interface DomThemeContract {
    /** Valor para `data-mode` en `<html>` */
    mode: "classic" | "era"
    /** Valor para `data-theme` en `<html>` */
    theme: string | undefined
    /** Valor para `data-ui-style` en `<html>` */
    uiStyle: "classic-minimalist" | undefined
}

/**
 * Resuelve de forma determinista el contrato de atributos DOM (`data-mode`, `data-theme`, `data-ui-style`)
 * para cualquiera de los diseños activos, evitando estados híbridos.
 * Las preferencias antiguas de Neutro ("classic") se convierten a Por era con Universo DB.
 */
export function resolveDomThemeContract(
    mode: ThemeMode | "classic",
    themeEra: string | undefined,
    hasEraTheme: boolean,
): DomThemeContract {
    if (mode === CLASSIC_MINIMALIST_THEME.id) {
        return CLASSIC_MINIMALIST_THEME.domContract
    }
    const effectiveEra = normalizeThemePreference({ themeMode: mode, themeEra: hasEraTheme ? themeEra : undefined }).themeEra

    return {
        mode: ERA_THEME.domContract.mode,
        theme: effectiveEra,
        uiStyle: ERA_THEME.domContract.uiStyle,
    }
}
