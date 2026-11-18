/**
 * KameHouse — Definición Centralizada de Tema: Por Era (Paletas Dinámicas Dragon Ball)
 *
 * Estructura, controles, escala de superficies y bisel doble (Double-Bezel) de Neutro
 * sobre base grafito, combinados con las 7 paletas OKLCH de Dragon Ball para acciones
 * principales, selección e indicadores, tinte ambiental suave y Liquid Glass dinámico.
 * Estilos declarados en: `apps/web/src/styles/themes/era.css`
 */

export const ERA_THEME_PRESETS = [
    { id: "era-universe", themeEra: "era-universe", name: "Universo DB", subtitle: "Adaptativo", desc: "Cambia de paleta según la saga que estés viendo.", accent: "#9872DD" },
    { id: "era-db", themeEra: "era-db", name: "Dragon Ball", subtitle: "1986", desc: "Naranja gi y azul sobre un marrón de atardecer.", accent: "var(--era-db-hex)" },
    { id: "era-dbz", themeEra: "era-dbz", name: "Dragon Ball Z", subtitle: "1989", desc: "Dorado Super Saiyajin sobre azul cobalto.", accent: "var(--era-dbz-hex)" },
    { id: "era-dbgt", themeEra: "era-dbgt", name: "Dragon Ball GT", subtitle: "1996", desc: "Rojo escarlata y violeta sobre vino.", accent: "var(--era-dbgt-hex)" },
    { id: "era-dbkai", themeEra: "era-dbkai", name: "Dragon Ball Kai", subtitle: "2009", desc: "Verde esmeralda y naranja gi.", accent: "var(--era-dbkai-hex)" },
    { id: "era-dbs", themeEra: "era-dbs", name: "Dragon Ball Super", subtitle: "2015", desc: "Azul divino y púrpura sobre índigo.", accent: "var(--era-dbs-hex)" },
    { id: "era-daima", themeEra: "era-daima", name: "Dragon Ball Daima", subtitle: "2024", desc: "Púrpura y dorado sobre un magenta oscuro.", accent: "var(--era-daima-hex)" },
    { id: "era-black", themeEra: "era-black", name: "Negro", subtitle: "Sin tintes", desc: "Negro y grafito con acentos blancos. Mantiene el vidrio sin cambiar de color entre series.", accent: "var(--era-black-accent)" },
] as const

export type EraPreset = typeof ERA_THEME_PRESETS[number]
export type EraThemeId = EraPreset["themeEra"]

export const ERA_THEME = {
    id: "era" as const,
    name: "Por era",
    subtitle: "Colores por serie y vidrio",
    description: "Una base oscura con los colores de cada serie y reflejos de vidrio.",
    stylesheet: "apps/web/src/styles/themes/era.css",
    defaultEra: "era-universe" as const,

    /* Contrato de atributos declarativos montados en <html> */
    domContract: {
        mode: "era" as const,
        themePrefix: "era-" as const,
        uiStyle: undefined,
    },

    presets: ERA_THEME_PRESETS,
} as const
