/**
 * Lightweight i18n layer for KameHouse.
 *
 * Usage:
 *   const { t } = useTranslation()
 *   t("home.empty.title")          // → string
 *   t("toolbar.playlists")         // → string
 *
 * Adding a new locale:
 *   1. Create src/locales/<code>.ts implementing LocaleDict (see es.ts).
 *   2. Add it to the `locales` map below.
 *   3. Set DEFAULT_LOCALE or persist the user preference.
 */

import { es } from "./es"
import { en } from "./en"
import type { LocaleDict } from "./types"

export type Locale = "es" | "en"
export type { LocaleDict }

const locales: Record<Locale, LocaleDict> = { es, en }

/** Active locale. Defaulting to Spanish per project conventions. */
export const DEFAULT_LOCALE: Locale = "es"

/**
 * Resolves a dot-separated key inside the locale dictionary.
 * Returns the key itself as fallback so missing translations are visible in dev.
 */
function resolve(dict: LocaleDict, path: string): string {
    const parts = path.split(".")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let node: any = dict
    for (const part of parts) {
        if (node == null || typeof node !== "object") return path
        node = node[part]
    }
    return typeof node === "string" ? node : path
}

/**
 * `useTranslation` — returns a `t(key)` function bound to the active locale.
 *
 * Currently always returns the default locale (Spanish).
 * Extend this hook with a Jotai/context atom if you need runtime switching.
 */
export function useTranslation(locale: Locale = DEFAULT_LOCALE) {
    const dict = locales[locale] ?? locales[DEFAULT_LOCALE]
    const t = (key: string): string => resolve(dict, key)
    return { t, locale }
}
