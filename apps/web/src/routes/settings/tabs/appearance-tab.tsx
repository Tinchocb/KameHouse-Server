import React from "react"
import { type Control, Controller, useFormContext, useWatch } from "react-hook-form"
import { motion, AnimatePresence } from "framer-motion"
import { type SettingsFormValues } from "../index"
import { useSound } from "@/hooks/use-sound"
import { cn } from "@/components/ui/core/styling"
import { IconStatusMonitor, IconStatusSparkles, IconUiPalette, IconNavigationFilm } from "@/components/ui/icons";
import { resolveThemeMode, type ThemeMode } from "@/lib/theme/theme-hooks"
import { OsSelect, OsToggle } from "../components"
import { SectionBar } from "@/components/ui/sectionbar"
import { useSpringPreset } from "@/components/ui/kinetics/hooks"

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
    { id: "era-universe", themeEra: "era-universe", name: "Universo DB", subtitle: "Modo Adaptativo", desc: "Adapta la paleta a cada saga; nebulosa cósmica en Home", accent: "#7C52D6", bg: "from-purple-950/40 via-pink-950/25 to-teal-950/20" },
    { id: "era-db", themeEra: "era-db", name: "Dragon Ball", subtitle: "1986 Original", desc: "Naranja terracota cálido y verde Shenron", accent: "#E67322", bg: "from-amber-950/40 to-orange-950/20" },
    { id: "era-dbz", themeEra: "era-dbz", name: "Dragon Ball Z", subtitle: "1989 Era Dorada", desc: "Dorado Super Saiyan brillante y azul cobalto", accent: "#F59E0B", bg: "from-amber-950/40 via-yellow-950/25 to-blue-950/20" },
    { id: "era-dbgt", themeEra: "era-dbgt", name: "Dragon Ball GT", subtitle: "1996 Grand Tour", desc: "Rojo escarlata SSJ4 y violeta cósmico", accent: "#E11D48", bg: "from-rose-950/40 to-purple-950/20" },
    { id: "era-dbkai", themeEra: "era-dbkai", name: "Dragon Ball Kai", subtitle: "2009 HD Manga", desc: "Azul eléctrico de alta definición y cyan", accent: "#0284C7", bg: "from-sky-950/40 to-blue-950/20" },
    { id: "era-dbs", themeEra: "era-dbs", name: "Dragon Ball Super", subtitle: "2015 Divino", desc: "Cian divino SSGSS y púrpura destructor", accent: "#0EA5E9", bg: "from-cyan-950/40 to-purple-950/20" },
    { id: "era-daima", themeEra: "era-daima", name: "Dragon Ball Daima", subtitle: "2024 Demoníaco", desc: "Verde esmeralda místico del Reino Demoníaco", accent: "#10B981", bg: "from-emerald-950/40 to-violet-950/20" },
]

export const AppearanceTab = React.memo(function AppearanceTab({ control }: AppearanceTabProps) {
    const { playSound } = useSound()
    const { setValue, getValues } = useFormContext<SettingsFormValues>()

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
    }

    const setMode = (mode: ThemeMode) => {
        playSound("category")
        setValue("theme.themeMode", mode, { shouldDirty: true })
        if (mode === "era") {
            const currentEra = getValues("theme.themeEra")
            if (!currentEra || !currentEra.startsWith("era-")) {
                setValue("theme.themeEra", "era-universe", { shouldDirty: true })
            }
            setValue("theme.enableColorSettings", true, { shouldDirty: true })
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
                    <span className="text-[10px] font-mono font-bold text-brand-accent px-2 py-0.5 rounded-full bg-brand-accent/10 border border-brand-accent/25">
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
                            <motion.button
                                key={mode.id}
                                type="button"
                                whileHover={{ scale: 1.015, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                transition={cardSpring}
                                onClick={() => setMode(mode.id)}
                                className={cn(
                                    "flex items-center gap-3.5 p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer",
                                    isActive
                                        ? "bg-zinc-950/70 border-white/30 border-t-white/50 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.3),0_8px_24px_rgba(0,0,0,0.6)] ring-1 ring-white/30"
                                        : "bg-zinc-950/40 border-white/10 border-t-white/25 hover:border-white/20 hover:bg-white/[0.04] shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.1)]"
                                )}
                            >
                                <div className={cn(
                                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-all",
                                    isActive
                                        ? "bg-white text-zinc-950 border-white shadow-[0_0_12px_rgba(255,255,255,0.6)] font-black"
                                        : "bg-white/5 border-white/10 text-zinc-400"
                                )}>
                                    <ModeIcon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-1">
                                        <p className="text-xs font-bold text-white">{mode.name}</p>
                                        <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/10">
                                            {mode.tag}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-zinc-400 leading-tight mt-0.5 line-clamp-1">{mode.desc}</p>
                                </div>
                            </motion.button>
                        )
                    })}
                </div>

                {/* Paletas por Era (Se muestra al estar en modo Era) */}
                <AnimatePresence initial={false}>
                    {isEraMode && (
                        <motion.div
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
                                    <span className="text-[10px] font-mono text-on-surface-variant/60">Toca para aplicar</span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                                    {THEME_PRESETS.map((preset) => {
                                        const isActive = activePresetObj.id === preset.id
                                        return (
                                            <motion.button
                                                key={preset.id}
                                                type="button"
                                                whileHover={{ scale: 1.03, y: -2 }}
                                                whileTap={{ scale: 0.96 }}
                                                transition={cardSpring}
                                                onClick={() => handlePresetClick(preset)}
                                                className={cn(
                                                    "relative flex flex-col p-3 rounded-xl border text-left transition-colors duration-200 bg-gradient-to-br",
                                                    preset.bg,
                                                    isActive
                                                        ? "border-brand-accent bg-white/[0.08] shadow-[0_0_15px_hsl(var(--brand-accent)/0.35)] ring-1 ring-brand-accent/50"
                                                        : "border-white/10 hover:border-white/20 hover:bg-white/[0.04]"
                                                )}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="w-2.5 h-2.5 rounded-full border border-white/30" style={{ backgroundColor: preset.accent }} />
                                                    {isActive && (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-brand-accent shadow-[0_0_8px_hsl(var(--brand-accent))]" />
                                                    )}
                                                </div>
                                                <p className="text-xs font-bold text-on-surface truncate">{preset.name}</p>
                                                <p className="text-[10px] text-on-surface-variant/70 truncate">{preset.subtitle}</p>
                                            </motion.button>
                                        )
                                    })}
                                </div>
                            </div>
                        </motion.div>
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
                            onChange={field.onChange}
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
                            onChange={field.onChange}
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
                            onChange={field.onChange}
                        />
                    )}
                />
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
                            options={[
                                { value: "TITLE_ASC", label: "Alfabético (A - Z)" },
                                { value: "TITLE_DESC", label: "Alfabético (Z - A)" },
                                { value: "YEAR_DESC", label: "Año de Emisión (Más recientes)" },
                                { value: "YEAR_ASC", label: "Año de Emisión (Más antiguos)" },
                                { value: "RATING_DESC", label: "Mejor Valorados" },
                            ]}
                            value={field.value || "TITLE_ASC"}
                        />
                    )}
                    />
            </SectionBar>

        </div>
    )
})
