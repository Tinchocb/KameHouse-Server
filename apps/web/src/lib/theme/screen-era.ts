/**
 * Era en pantalla — lo que sigue Universo DB («sigue lo que ves», docs/TEMA-POR-ERA.md, fase 2).
 *
 * Cada pantalla con una saga propia la publica mientras está montada: la ficha de serie y la de
 * película, el hero de Inicio (también su rotación automática) y la sección visible de la
 * Cronología. Con Universo DB elegido, `useApplyCustomTheme` pone esa era en `data-theme` de
 * `<html>`, así la paleta llega a toda la app (barra, reproductor, modales en portal). Sin
 * ninguna publicada (Ajustes, búsqueda, listados) queda el violeta multicolor de Universo.
 *
 * `fade` distingue un cambio dentro de la misma pantalla (el hero rota, el scroll pasa a otra
 * sección), que se funde, de una pantalla que entra o sale, que cambia al instante porque la
 * ruta ya tiene su propio fundido de entrada.
 */
import * as React from "react"
import { create } from "zustand"
import { ERA_THEME, type EraThemeId } from "./era.theme"

interface ScreenEraEntry {
    id: number
    era: EraThemeId
}

interface ScreenEraState {
    /** Publicadores montados, en orden de llegada: manda el último. */
    entries: readonly ScreenEraEntry[]
    /** El último cambio vino de una pantalla que ya estaba (fundir) y no de una que entró o salió. */
    fade: boolean
}

export const useScreenEraStore = create<ScreenEraState>(() => ({ entries: [], fade: false }))

/** Publica `era` (o la retira con null). Un publicador que ya estaba cambia en su lugar y funde. */
export function publishScreenEra(state: ScreenEraState, id: number, era: EraThemeId | null): ScreenEraState {
    const index = state.entries.findIndex((e) => e.id === id)
    if (!era) {
        return index === -1 ? state : { entries: state.entries.filter((e) => e.id !== id), fade: false }
    }
    if (index === -1) return { entries: [...state.entries, { id, era }], fade: false }
    if (state.entries[index].era === era) return state
    const entries = state.entries.slice()
    entries[index] = { id, era }
    return { entries, fade: true }
}

export const selectScreenEra = (s: ScreenEraState): EraThemeId | null => s.entries.at(-1)?.era ?? null

/**
 * Tema que va en `data-theme` de `<html>`: la era en pantalla solo cuando el usuario eligió
 * Universo DB en modo Por era; en cualquier otro caso, el tema guardado tal cual.
 */
export function resolveFollowedTheme(effectiveMode: string, themeEra: string | undefined, screenEra: EraThemeId | null): string | undefined {
    const followsScreen = effectiveMode === "era" && themeEra === ERA_THEME.defaultEra
    return followsScreen && screenEra ? screenEra : themeEra
}

let nextPublisherId = 1

/** Publica la era de la pantalla mientras el componente está montado. */
export function useScreenEra(era: EraThemeId | null | undefined): void {
    const [id] = React.useState(() => nextPublisherId++)

    React.useLayoutEffect(() => {
        useScreenEraStore.setState((s) => publishScreenEra(s, id, era ?? null))
    }, [id, era])

    React.useLayoutEffect(() => () => {
        useScreenEraStore.setState((s) => publishScreenEra(s, id, null))
    }, [id])
}

const ERA_THEME_IDS = new Set<string>(ERA_THEME.presets.map((p) => p.themeEra))

/** Valida un tema de era que viene como string suelto (p. ej. de `getSeriesEraTheme`). */
export function asEraThemeId(value: string | null | undefined): EraThemeId | null {
    return value && ERA_THEME_IDS.has(value) ? (value as EraThemeId) : null
}
