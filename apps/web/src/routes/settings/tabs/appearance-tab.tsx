import React from "react"
import { type Control, Controller, useFormContext, useWatch } from "react-hook-form"
import { m, AnimatePresence } from "framer-motion"
import { type SettingsFormValues } from "../index"
import { useSound } from "@/hooks/use-sound"
import { cn } from "@/components/ui/core/styling"
import { IconStatusMonitor, IconStatusSparkles, IconUiPalette, IconNavigationFilm, IconArrowDownUp } from "@/components/ui/icons";
import { resolveThemeMode, type ThemeMode } from "@/lib/theme/theme-hooks"
import { OsSelect, OsToggle } from "../components"
import { SectionBar } from "@/components/ui/sectionbar"
import { useSpringPreset } from "@/components/ui/kinetics/hooks"
import { useUIStore } from "@/lib/stores/ui-store"

function DynamicBackdropLocalToggles() {
    const dynamicBackdropEnabled = useUIStore((s) => s.dynamicBackdropEnabled)
    const setDynamicBackdropEnabled = useUIStore((s) => s.setDynamicBackdropEnabled)
    const motionEnabled = useUIStore((s) => s.dynamicBackdropMotionEnabled)
    const setDynamicBackdropMotionEnabled = useUIStore((s) => s.setDynamicBackdropMotionEnabled)
    return (
        <div className="pt-2 border-t border-white/[0.05]">
            <div className="flex items-center gap-2 px-1 pb-1">
                <span className="text-3xs font-mono px-2 py-0.5 rounded bg-brand-accent/10 text-brand-accent border border-brand-accent/20">
                    Local
                </span>
                <span className="text-3xs text-on-surface-variant/70">Solo este dispositivo, sin Guardar</span>
            </div>
            <OsToggle
                label="Fondo Dinámico"
                description="Fondos ambientales animados según la sección que exploras."
                checked={dynamicBackdropEnabled}
                onChange={setDynamicBackdropEnabled}
            />
            <OsToggle
                label="Movimiento en Fondo Dinámico"
                description="Anima el fondo ambiental. Desactívalo para ahorrar batería."
                checked={motionEnabled}
                onChange={setDynamicBackdropMotionEnabled}
            />
        </div>
    )
}

interface AppearanceTabProps {
    control: Control<SettingsFormValues>
}

// ── Modos Principales ─────────────────────────────────────────────────────────
const UI_MODES = [
    {
        id: "classic" as const,
        name: "Modo Clásico",
        tag: "AMOLED / Pro",
        desc: "Negros profundos (#000000), escalas de grises neutras y blanco nítido sin tintes de color.",
        icon: IconStatusMonitor,
    },
    {
        id: "era" as const,
        name: "Modo por Era",
        tag: "Dragon Ball",
        desc: "Paletas inmersivas basadas en las sagas de la franquicia Dragon Ball.",
        icon: IconStatusSparkles,
    },
]

// ── Presets por Era ────────────────────────────────────────────────────────────
const THEME_PRESETS = [
    { id: "era-universe", themeEra: "era-universe", name: "Universo DB", subtitle: "Modo Adaptativo", desc: "Adapta la paleta a cada saga; nebulosa cósmica en Home", accent: "#805AC2", bg: "from-violet-950/40 via-purple-950/25 to-teal-950/20" },
    { id: "era-db", themeEra: "era-db", name: "Dragon Ball", subtitle: "1986 Original", desc: "Naranja terracota cálido y verde Shenron", accent: "#E87A2D", bg: "from-amber-950/40 to-orange-950/20" },
    { id: "era-dbz", themeEra: "era-dbz", name: "Dragon Ball Z", subtitle: "1989 Era Dorada", desc: "Oro Super Saiyan brillante y azul cobalto", accent: "#E6B43C", bg: "from-amber-950/40 via-yellow-950/25 to-blue-950/20" },
    { id: "era-dbgt", themeEra: "era-dbgt", name: "Dragon Ball GT", subtitle: "1996 Grand Tour", desc: "Rojo escarlata SSJ4 y violeta cósmico", accent: "#D23859", bg: "from-rose-950/40 to-purple-950/20" },
    { id: "era-dbkai", themeEra: "era-dbkai", name: "Dragon Ball Kai", subtitle: "2009 HD Manga", desc: "Azul eléctrico de alta definición y cyan", accent: "#278DC5", bg: "from-sky-950/40 to-blue-950/20" },
    { id: "era-dbs", themeEra: "era-dbs", name: "Dragon Ball Super", subtitle: "2015 Divino", desc: "Cian divino SSGSS y púrpura destructor", accent: "#2C9FC7", bg: "from-cyan-950/40 to-purple-950/20" },
    { id: "era-daima", themeEra: "era-daima", name: "Dragon Ball Daima", subtitle: "2024 Demoníaco", desc: "Púrpura Demon Realm con verde detalle", accent: "#9564C8", bg: "from-violet-950/40 to-violet-950/20" },
]

export const AppearanceTab = React.memo(function AppearanceTab({ control }: AppearanceTabProps) {
    const { playSound } = useSound()
    const { setValue, getValues } = useFormContext<SettingsFormValues>()
    // Dual-write: el form marca dirty (para Guardar) y el store aplica al instante.
    const setThemeVisual = useUIStore((s) => s.setThemeVisual)

    const setHideAudienceScore = useUIStore((s) => s.setHideAudienceScore)
    // Watchers consolidados en una única suscripción
    const [themeEraValue, themeModeValue, blurEffectsValue] = useWatch({
        control,
        name: ["theme.themeEra", "theme.themeMode", "theme.themeEnableBlurringEffects"],
    })

    const uiMode: ThemeMode = resolveThemeMode({
        themeMode: themeModeValue,
        themeEra: themeEraValue,
        themeEnableBlurringEffects: !!blurEffectsValue,
    })
    const isEraMode = uiMode === "era"
    const activePresetObj = THEME_PRESETS.find(p => p.themeEra === themeEraValue) || THEME_PRESETS[0]

    const handlePresetClick = (preset: typeof THEME_PRESETS[number]) => {
        playSound("category")
        setValue("theme.themeEra", preset.themeEra, { shouldValidate: true, shouldDirty: true })
        setValue("theme.enableColorSettings", true, { shouldDirty: true })
        setThemeVisual({ themeEra: preset.themeEra, enableColorSettings: true })
    }

    const setMode = (mode: ThemeMode) => {
        playSound("category")
        setValue("theme.themeMode", mode, { shouldDirty: true })
        if (mode === "classic") {
            setValue("theme.themeEra", "classic", { shouldDirty: true })
            setValue("theme.enableColorSettings", false, { shouldDirty: true })
            setThemeVisual({ themeMode: "classic", themeEra: "classic", enableColorSettings: false })
        } else if (mode === "era") {
            const currentEra = getValues("theme.themeEra")
            const nextEra = currentEra && currentEra.startsWith("era-") ? currentEra : "era-universe"
            if (nextEra !== currentEra) {
                setValue("theme.themeEra", nextEra, { shouldDirty: true })
            }
            setValue("theme.enableColorSettings", true, { shouldDirty: true })
            setThemeVisual({ themeMode: "era", themeEra: nextEra, enableColorSettings: true })
        }
    }

    const cardSpring = useSpringPreset("entrance");
    const contentSpring = useSpringPreset("tabContent");

return (
        <div className="w-full space-y-7 animate-in fade-in duration-base pb-8">

            {/* ═════════════════════════════════════════════════════════════════
                1. PERSONALIZACIÓN Y SELECCIÓN DE TEMA
               ════════════════════════════════════════════════════════════════ */}
            <SectionBar
                id="theme-selection"
                label="Tema y Filosofía Visual"
                description="Selecciona la estética visual general del sistema."
                icon={IconUiPalette}
                badge={
                    <span className="text-3xs font-mono font-bold text-brand-accent px-2 py-0.5 rounded-full bg-brand-accent/10 border border-brand-accent/25">
                        {isEraMode ? activePresetObj.name : "Clásico AMOLED"}
                    </span>
                }
                collapsible
                defaultOpen={true}
            >
                {/* Selector de Modos Principales */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {UI_MODES.map((mode) => {
                        const isActive = uiMode === mode.id
                        const ModeIcon = mode.icon
                        return (
                            <m.button
                                key={mode.id}
                                type="button"
                                whileHover={{ scale: 1.015, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                transition={cardSpring}
                                onClick={() => setMode(mode.id)}
                                className={cn(
                                    "flex items-center gap-3.5 p-4 rounded-2xl border text-left transition-[background-color,border-color,box-shadow] duration-fast ease-smooth-out cursor-pointer",
                                    isActive
                                        ? "bg-surface-container-high/80 border-white/30 border-t-white/50 shadow-[shadow:var(--glass-highlight-lg),0_8px_24px_rgba(0,0,0,0.6)] ring-1 ring-white/30"
                                        : "bg-surface-container-lowest/60 border-white/10 border-t-white/25 hover:border-white/20 hover:bg-white/[0.04] shadow-glass-highlight-sm"
                                )}
                            >
                                <div className={cn(
                                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-[background-color,border-color,color,box-shadow,transform] duration-fast ease-smooth-out",
                                    isActive
                                        ? "bg-white text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.6)] font-black"
                                        : "bg-white/5 border-white/10 text-on-surface-variant group-hover:scale-105"
                                )}>
                                    <ModeIcon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-1">
                                        <p className="text-xs font-bold text-white">{mode.name}</p>
                                        <span className="text-4xs font-mono uppercase px-2 py-0.5 rounded-full bg-white/5 text-on-surface-variant border border-white/10">
                                            {mode.tag}
                                        </span>
                                    </div>
                                    <p className="text-2xs text-on-surface-variant leading-tight mt-0.5 line-clamp-1">{mode.desc}</p>
                                </div>
                            </m.button>
                        )
                    })}
                </div>

                {/* Paletas por Era (Se muestra al estar en modo Era) */}
                <AnimatePresence initial={false}>
                    {isEraMode && (
                        <m.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={contentSpring}
                            className="overflow-hidden pt-2 border-t border-white/[0.06]"
                        >
                            <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-brand-accent animate-pulse" />
                                        Paletas de la Franquicia Dragon Ball
                                    </span>
                                    <span className="text-3xs font-mono text-on-surface-variant/60">Toca para aplicar</span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                                    {THEME_PRESETS.map((preset) => {
                                        const isActive = activePresetObj.id === preset.id
                                        return (
                                            <m.button
                                                key={preset.id}
                                                type="button"
                                                whileHover={{ scale: 1.03, y: -2 }}
                                                whileTap={{ scale: 0.96 }}
                                                transition={cardSpring}
                                                onClick={() => handlePresetClick(preset)}
                                                className={cn(
                                                    "relative flex flex-col p-3 rounded-xl border text-left transition-[background-color,border-color,box-shadow] duration-fast ease-smooth-out bg-gradient-to-br",
                                                    preset.bg,
                                                    isActive
                                                        ? "border-brand-accent bg-white/[0.08] shadow-[0_0_15px_hsl(var(--brand-accent)/0.35)] ring-1 ring-brand-accent/50"
                                                        : "border-white/10 hover:border-white/20 hover:bg-white/[0.04]"
                                                )}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="w-2.5 h-2.5 rounded-full border border-white/30" style={{ backgroundColor: preset.accent }} />
                                                    {isActive && (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-brand-accent shadow-[0_0_8px_hsl(var(--brand-accent))] animate-success-pop" />
                                                    )}
                                                </div>
                                                <p className="text-xs font-bold text-on-surface truncate">{preset.name}</p>
                                                <p className="text-3xs text-on-surface-variant/70 truncate">{preset.subtitle}</p>
                                            </m.button>
                                        )
                                    })}
                                </div>
                            </div>
                        </m.div>
                    )}
                </AnimatePresence>
</SectionBar>

            {/* ══════════════════════════════════════════════════════════════════
                2. EFECTOS Y AMBIENTACIÓN
               ════════════════════════════════════════════════════════════════ */}
            <SectionBar
                id="effects-ambience"
                label="Efectos y Ambientación"
                description="Control de efectos de cristal, auras y fondos ambientales dinámicos."
                icon={IconStatusSparkles}
                collapsible
                defaultOpen={true}
            >
                <Controller
                    control={control}
                    name="theme.themeEnableBlurringEffects"
                    render={({ field }) => (
                        <OsToggle
                            label="Desenfoque y Vidrio Esmerilado (Glassmorphism)"
                            description="Translucidez dinámica sobre tarjetas, paneles y barras de navegación."
                            checked={!!field.value}
                            onChange={(v) => {
                                field.onChange(v)
                                setThemeVisual({ themeEnableBlurringEffects: v })
                            }}
                        />
                    )}
                />
                <Controller
                    control={control}
                    name="theme.themeEnableLiquidGlass"
                    render={({ field }) => (
                        <OsToggle
                            label="Cristal Líquido (Liquid Glass)"
                            description="Refracción y reflejos orgánicos con aceleración por GPU."
                            checked={!!field.value}
                            onChange={(v) => {
                                field.onChange(v)
                                setThemeVisual({ themeEnableLiquidGlass: v })
                            }}
                        />
                    )}
                />
                <Controller
                    control={control}
                    name="theme.themeEnableMediaPageBlurredBackground"
                    render={({ field }) => (
                        <OsToggle
                            label="Fondo Ambiental en Ficha de Medios"
                            description="Ilumina el fondo de series y películas con el afiche oficial de fondo."
                            checked={!!field.value}
                            onChange={(v) => {
                                field.onChange(v)
                                setThemeVisual({ themeEnableMediaPageBlurredBackground: v })
                            }}
                        />
                    )}
                />
                <Controller
                    control={control}
                    name="theme.themeEnableSidebarGradient"
                    render={({ field }) => (
                        <OsToggle
                            label="Degradado en Barra Lateral"
                            description="Aplica un degradado sutil al fondo de la navegación lateral."
                            checked={!!field.value}
                            onChange={(v) => {
                                field.onChange(v)
                                setThemeVisual({ themeEnableSidebarGradient: v })
                            }}
                        />
                    )}
                />
                <Controller
                    control={control}
                    name="theme.themeEnableCinematicGrain"
                    render={({ field }) => (
                        <OsToggle
                            label="Grano Cinematográfico"
                            description="Textura de grano de película sobre los fondos para un acabado cine."
                            checked={!!field.value}
                            onChange={(v) => {
                                field.onChange(v)
                                setThemeVisual({ themeEnableCinematicGrain: v })
                            }}
                        />
                    )}
                />
                <DynamicBackdropLocalToggles />
</SectionBar>

            {/* ══════════════════════════════════════════════════════════════════
                3. ORGANIZACIÓN DEL CATÁLOGO
               ═════════════════════════════════════════════════════════════════ */}
            <SectionBar
                id="catalog-organization"
                label="Organización del Catálogo"
                description="Criterio predeterminado para ordenar la colección de series y películas."
                icon={IconNavigationFilm}
                collapsible
                defaultOpen={true}
            >
                <Controller
                    control={control}
                    name="theme.themeAnimeLibraryCollectionDefaultSorting"
                    render={({ field }) => (
                        <OsSelect
                            label="Criterio de Ordenación Inicial"
                            description="Cómo se ordenan los títulos al ingresar a la colección."
                            icon={IconArrowDownUp}
                            options={[
                                { value: "TITLE_ASC", label: "Alfabético A – Z", desc: "De Dragon Ball a Z", badge: "A-Z" },
                                { value: "TITLE_DESC", label: "Alfabético Z – A", desc: "Orden inverso", badge: "Z-A" },
                                { value: "YEAR_DESC", label: "Más recientes", desc: "Por año de emisión", badge: "AÑO ↓" },
                                { value: "YEAR_ASC", label: "Más antiguos", desc: "Clásicos primero", badge: "AÑO ↑" },
                                { value: "RATING_DESC", label: "Mejor valorados", desc: "Por puntuación", badge: "TOP" },
                            ]}
                            value={field.value || "TITLE_ASC"}
                            onChange={(v) => {
                                field.onChange(v)
                                setThemeVisual({ themeAnimeLibraryCollectionDefaultSorting: v })
                            }}
                        />
                    )}
                    />
                <Controller
                    control={control}
                    name="platform.hideAudienceScore"
                    render={({ field }) => (
                        <OsToggle
                            label="Ocultar Puntuación de Audiencia"
                            description="Oculta las puntuaciones en las tarjetas para evitar spoilers de popularidad."
                            checked={!!field.value}
                            onChange={(v) => {
                                field.onChange(v)
                                setHideAudienceScore(!!v)
                            }}
                        />
                    )}
                />
            </SectionBar>

        </div>
    )
})
