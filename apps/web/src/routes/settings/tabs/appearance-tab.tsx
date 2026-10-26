import React from "react"
import { type Control, Controller, useFormContext, useWatch } from "react-hook-form"
import { m, AnimatePresence } from "framer-motion"
import { type SettingsFormValues } from "../index"
import { useSound } from "@/hooks/use-sound"
import { cn } from "@/components/ui/core/styling"
import { Button, ButtonAnatomy } from "@/components/ui/button"
import { IconStatusMonitor, IconStatusSparkles, IconUiPalette, IconNavigationFilm, IconArrowDownUp } from "@/components/ui/icons";
import { resolveThemeMode, type ThemeMode } from "@/lib/theme/theme-hooks"
import { OsSelect, OsToggle } from "../components"
import { SectionBar } from "@/components/ui/sectionbar"
import { useSpringPreset } from "@/components/ui/kinetics/hooks"
import { useUIStore } from "@/lib/stores/ui-store"
import { useShallow } from "zustand/react/shallow"
import { usePerformanceStore } from "@/lib/hardware/performance-store"
import { useTransparencyState, type FlatReason } from "@/lib/theme/apply-custom-theme"
import { NavDensitySetting } from "@/components/ui/app-layout/nav-density-setting"

const FLAT_REASONS: Record<FlatReason, { title: string; desc: string }> = {
    manual: {
        title: "Plano manual",
        desc: "Activaste Reducir transparencia. Apágalo abajo para volver al vidrio.",
    },
    auto: {
        title: "Plano automático por rendimiento",
        desc: "La app fue lenta de forma sostenida y quitó la transparencia. Reintenta para volver al vidrio.",
    },
    eco: {
        title: "Plano por perfil de ahorro",
        desc: "El perfil de rendimiento (Ahorro, o un equipo de bajo consumo) mantiene la transparencia apagada.",
    },
    tv: {
        title: "Plano por modo TV",
        desc: "En pantalla de TV las superficies son siempre sólidas.",
    },
    contrast: {
        title: "Plano por contraste alto del sistema",
        desc: "Tu sistema pide más contraste, así que los paneles son sólidos con bordes marcados.",
    },
}

/** Qué pasa con la transparencia ahora mismo y por qué. */
function TransparencyStatus() {
    const { flat, reason, systemSuggestsReduce } = useTransparencyState()
    const setAutoThrottleActive = usePerformanceStore((s) => s.setAutoThrottleActive)
    const info = reason ? FLAT_REASONS[reason] : null

    return (
        <div role="status" className="flex items-start justify-between gap-3 rounded-xl border border-[var(--neutral-separator)] bg-[var(--neutral-elev-2)] p-3.5">
            <div className="flex min-w-0 items-start gap-3">
                <span
                    aria-hidden="true"
                    className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        flat ? "bg-[var(--label-3)]" : "bg-[var(--selected-bg)]",
                    )}
                />
                <div className="min-w-0">
                    <p className="text-xs font-bold text-label-1">{info ? info.title : "Con transparencia"}</p>
                    <p className="mt-0.5 text-2xs leading-snug text-label-2">
                        {info
                            ? info.desc
                            : systemSuggestsReduce
                                ? "Tu sistema pide menos transparencia. Puedes reducirla aquí."
                                : "Barras y paneles translúcidos sobre el contenido."}
                    </p>
                </div>
            </div>
            {reason === "auto" && (
                <Button intent="secondary" size="sm" onClick={() => setAutoThrottleActive(false)} className="shrink-0">
                    Volver al vidrio
                </Button>
            )}
        </div>
    )
}

/** Escena de la comparación: formas de borde duro para que el desenfoque del vidrio se note. */
function CompareScene({ accent, className }: { accent: string; className?: string }) {
    return (
        <div aria-hidden="true" className={cn("pointer-events-none absolute inset-x-0 overflow-hidden", className)}>
            <div className="absolute -right-4 -top-6 h-24 w-24 rounded-full" style={{ backgroundColor: accent }} />
            <div className="absolute left-[18%] top-[22%] h-10 w-10 rounded-full bg-[var(--selected-bg)] opacity-80" />
            <div className="absolute inset-y-0 left-[48%] w-3 -skew-x-12 bg-[var(--selected-bg)] opacity-50" />
        </div>
    )
}

function CompareCardContent() {
    return (
        <div className="relative z-10 flex items-center justify-between gap-2 px-3 py-2.5">
            <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-1.5 w-3/4 rounded-full bg-[var(--label-1)] opacity-90" />
                <div className="h-1.5 w-1/2 rounded-full bg-[var(--label-3)]" />
            </div>
            <div className="h-5 w-10 shrink-0 rounded-full bg-[var(--selected-bg)]" />
        </div>
    )
}

/** Vidrio y plano lado a lado con las superficies reales del modo actual. No usa
 *  backdrop-filter (con el plano activo se anula en toda la app): el desenfoque del
 *  vidrio se simula con una copia de la escena desenfocada dentro de la tarjeta. */
function TransparencyCompare({ accent }: { accent: string }) {
    const { flat } = useTransparencyState()
    const tiles = [
        { id: "glass", name: "Vidrio", desc: "Translúcido: deja ver el contenido, desenfocado.", active: !flat },
        { id: "flat", name: "Plano", desc: "Sólido: más legible y con menos carga de GPU.", active: flat },
    ] as const

    return (
        <div role="group" aria-label="Comparación entre vidrio y plano" className="grid grid-cols-2 gap-3">
            {tiles.map((t) => (
                <figure key={t.id} className="m-0 min-w-0 space-y-2">
                    <div
                        className="relative h-28 overflow-hidden rounded-xl border border-[var(--neutral-separator)] bg-[var(--flat-0)]"
                        aria-hidden="true"
                    >
                        <CompareScene accent={accent} className="inset-y-0" />
                        {/* Tarjeta en la mitad inferior: la copia desenfocada se alinea con
                            porcentajes (top -100 %, alto 200 %) porque la tarjeta mide la mitad. */}
                        {t.id === "glass" ? (
                            <div className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden rounded-t-lg border-t border-white/25 bg-gradient-to-b from-white/15 to-white/5">
                                <CompareScene accent={accent} className="-top-full h-[200%] blur-[7px]" />
                                <CompareCardContent />
                            </div>
                        ) : (
                            <div
                                className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden rounded-t-lg border-t"
                                style={{
                                    backgroundColor: "var(--flat-1)",
                                    borderColor: "var(--flat-edge-top)",
                                    boxShadow: "var(--flat-shadow-raised)",
                                }}
                            >
                                <CompareCardContent />
                            </div>
                        )}
                    </div>
                    <figcaption className="px-0.5">
                        <p className="flex items-center gap-1.5 text-xs font-bold text-label-1">
                            {t.name}
                            {t.active && (
                                <span className="rounded-full border border-[var(--neutral-separator)] px-1.5 py-px text-3xs font-semibold text-label-2">
                                    En uso
                                </span>
                            )}
                        </p>
                        <p className="text-2xs leading-snug text-label-2">{t.desc}</p>
                    </figcaption>
                </figure>
            ))}
        </div>
    )
}

function DynamicBackdropLocalToggles() {
    const {
        dynamicBackdropEnabled,
        setDynamicBackdropEnabled,
        dynamicBackdropMotionEnabled: motionEnabled,
        setDynamicBackdropMotionEnabled,
        scrollBlurEnabled,
        setScrollBlurEnabled,
        seriesHeroCardEnabled,
        setSeriesHeroCardEnabled,
    } = useUIStore(
        useShallow((s) => ({
            dynamicBackdropEnabled: s.dynamicBackdropEnabled,
            setDynamicBackdropEnabled: s.setDynamicBackdropEnabled,
            dynamicBackdropMotionEnabled: s.dynamicBackdropMotionEnabled,
            setDynamicBackdropMotionEnabled: s.setDynamicBackdropMotionEnabled,
            scrollBlurEnabled: s.scrollBlurEnabled,
            setScrollBlurEnabled: s.setScrollBlurEnabled,
            seriesHeroCardEnabled: s.seriesHeroCardEnabled,
            setSeriesHeroCardEnabled: s.setSeriesHeroCardEnabled,
        }))
    )

    return (
        <div className="pt-2 border-t border-[var(--neutral-separator)]">
            <div className="flex items-center gap-2 px-1 pb-1">
                <span className="text-3xs px-2 py-0.5 rounded bg-brand-accent/10 text-brand-accent-readable border border-brand-accent/20">
                    Local
                </span>
                <span className="text-3xs text-label-2">Solo este dispositivo; no necesita Guardar</span>
            </div>
            <OsToggle
                label="Fondo dinámico"
                description="Fondos ambientales animados según la sección que exploras."
                checked={dynamicBackdropEnabled}
                onChange={setDynamicBackdropEnabled}
            />
            <OsToggle
                label="Movimiento del fondo dinámico"
                description="Anima el fondo ambiental. Desactívalo para ahorrar batería."
                checked={motionEnabled}
                onChange={setDynamicBackdropMotionEnabled}
            />
            <OsToggle
                label="Desenfoque superior al desplazar"
                description="Desenfoca el borde superior cuando el contenido pasa por debajo de la barra."
                checked={scrollBlurEnabled}
                onChange={setScrollBlurEnabled}
            />
            <OsToggle
                label="Tarjeta al desplazar la ficha de series"
                description="Al bajar, el hero de la serie se contrae en una tarjeta chica con el episodio y el botón de reproducir. Apágalo para que el hero se desplace normal."
                checked={seriesHeroCardEnabled}
                onChange={setSeriesHeroCardEnabled}
            />
            <NavDensitySetting />
        </div>
    )
}

function AppearanceThemeLivePreview({
    isEraMode,
    activePreset,
    blurEnabled,
}: {
    isEraMode: boolean
    activePreset: typeof THEME_PRESETS[number]
    blurEnabled: boolean
}) {
    const accentColor = isEraMode ? activePreset.accent : "#FFFFFF"

    return (
        <div className="surface-content rounded-2xl p-4 sm:p-5 relative overflow-hidden group">
            {/* Fondo ambiental sutil simulando el DynamicBackdrop */}
            <div
                className="absolute inset-0 opacity-20 pointer-events-none -z-10"
                style={{
                    background: `radial-gradient(circle at 80% 20%, ${accentColor} 0%, transparent 60%)`,
                }}
            />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span
                            className="w-2 h-2 rounded-full animate-pulse"
                            style={{ backgroundColor: accentColor, boxShadow: `0 0 8px color-mix(in srgb, ${accentColor} 80%, transparent)` }}
                        />
                        <h3 className="text-xs font-bold text-on-surface">
                            Vista previa
                        </h3>
                    </div>
                    <p className="text-2xs text-on-surface-variant font-medium">
                        {isEraMode ? `Por era · ${activePreset.name}` : "Neutro"} · {blurEnabled ? "con transparencia" : "transparencia reducida"}
                    </p>
                </div>

                {/* Miniaturas de componentes representativos */}
                <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
                    <span
                        className="px-2.5 py-1 rounded-full text-2xs font-semibold border transition-[color,background-color,border-color] duration-base ease-smooth-out"
                        style={{
                            color: accentColor,
                            borderColor: `color-mix(in srgb, ${accentColor} 40%, transparent)`,
                            backgroundColor: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
                        }}
                    >
                        {isEraMode ? activePreset.name : "Neutro"}
                    </span>

                    <div className="w-20 h-1.5 rounded-full bg-[var(--neutral-elev-3)] overflow-hidden shrink-0">
                        <div
                            className="h-full rounded-full transition-[background-color,box-shadow] duration-base ease-smooth-out"
                            style={{
                                width: "65%",
                                backgroundColor: accentColor,
                                boxShadow: `0 0 6px color-mix(in srgb, ${accentColor} 80%, transparent)`,
                            }}
                        />
                    </div>

                    {/* Muestra del `Button` primary con el acento de la vista previa (no interactiva). */}
                    <span
                        aria-hidden="true"
                        className={cn(ButtonAnatomy.root({ intent: "primary", size: "sm" }), "pointer-events-none shrink-0")}
                        style={{
                            backgroundColor: accentColor,
                            color: "var(--selected-fg)",
                        }}
                    >
                        Botón
                    </span>
                </div>
            </div>
        </div>
    )
}

/** Flechas / Inicio / Fin dentro de un radiogroup: selecciona y mueve el foco (roving tabindex). */
function handleRadioKeys<T>(e: React.KeyboardEvent<HTMLElement>, items: readonly T[], index: number, select: (item: T) => void) {
    let next = -1
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % items.length
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (index - 1 + items.length) % items.length
    else if (e.key === "Home") next = 0
    else if (e.key === "End") next = items.length - 1
    if (next < 0) return
    e.preventDefault()
    const item = items[next]
    if (item === undefined) return
    select(item)
    const radios = e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]')
    radios?.[next]?.focus()
}

const RADIO_FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"

interface AppearanceTabProps {
    control: Control<SettingsFormValues>
}

// ── Modos Principales ─────────────────────────────────────────────────────────
const UI_MODES = [
    {
        id: "classic" as const,
        name: "Neutro",
        desc: "Interfaz negra con acentos blancos. El color de las sagas solo aparece en el contenido.",
        icon: IconStatusMonitor,
    },
    {
        id: "era" as const,
        name: "Por era",
        desc: "Los colores siguen la saga que elijas: naranja en Dragon Ball, dorado en Z, rojo en GT…",
        icon: IconStatusSparkles,
    },
]

// ── Presets por Era ────────────────────────────────────────────────────────────
// Swatches con los tokens de era (única excepción de hex de la guía). "Universo"
// no tiene token global propio: su violeta solo existe dentro de su tema.
const THEME_PRESETS = [
    { id: "era-universe", themeEra: "era-universe", name: "Universo DB", subtitle: "Adaptativo", desc: "Cambia de paleta según la saga que estés viendo.", accent: "#805AC2" },
    { id: "era-db", themeEra: "era-db", name: "Dragon Ball", subtitle: "1986", desc: "Naranja cálido y verde Shenron.", accent: "var(--era-db-hex)" },
    { id: "era-dbz", themeEra: "era-dbz", name: "Dragon Ball Z", subtitle: "1989", desc: "Dorado Super Saiyan y azul cobalto.", accent: "var(--era-dbz-hex)" },
    { id: "era-dbgt", themeEra: "era-dbgt", name: "Dragon Ball GT", subtitle: "1996", desc: "Rojo escarlata y violeta.", accent: "var(--era-dbgt-hex)" },
    { id: "era-dbkai", themeEra: "era-dbkai", name: "Dragon Ball Kai", subtitle: "2009", desc: "Verde esmeralda y naranja gi.", accent: "var(--era-dbkai-hex)" },
    { id: "era-dbs", themeEra: "era-dbs", name: "Dragon Ball Super", subtitle: "2015", desc: "Azul divino SSJ Blue y púrpura.", accent: "var(--era-dbs-hex)" },
    { id: "era-daima", themeEra: "era-daima", name: "Dragon Ball Daima", subtitle: "2024", desc: "Púrpura y dorado demoníaco.", accent: "var(--era-daima-hex)" },
]

/** Tinte de cada muestra con el acento de su era (tokens, sin paletas de Tailwind). */
const presetTint = (accent: string) => ({
    backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${accent} 16%, transparent), transparent 70%)`,
})

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
        <div className="w-full space-y-4 sm:space-y-5 animate-in fade-in duration-base pb-4 sm:pb-8">

            {/* Muestra interactiva en vivo del tema, acentos y contraste */}
            <AppearanceThemeLivePreview
                isEraMode={isEraMode}
                activePreset={activePresetObj}
                blurEnabled={!!blurEffectsValue}
            />

            {/* ═════════════════════════════════════════════════════════════════
                1. PERSONALIZACIÓN Y SELECCIÓN DE TEMA
               ════════════════════════════════════════════════════════════════ */}
            <SectionBar
                variant="content"
                id="theme-selection"
                label="Tema"
                description="Elige cómo se ve la app."
                icon={IconUiPalette}
                collapsible
                defaultOpen={true}
            >
                {/* Un solo hijo de SectionBar: si el colapso de paletas fuera hijo directo de
                    `.space-y-3.5.sectionbar-divide`, su margin-top y su border-top saltarían
                    sin animarse. El espaciado y el separador van en el div interior. */}
                <div>
                {/* Selector de Modos Principales */}
                <div role="radiogroup" aria-label="Tema" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {UI_MODES.map((mode, modeIndex) => {
                        const isActive = uiMode === mode.id
                        const ModeIcon = mode.icon
                        return (
                            <m.button
                                key={mode.id}
                                type="button"
                                whileTap={{ scale: 0.96 }}
                                transition={cardSpring}
                                onClick={() => setMode(mode.id)}
                                onKeyDown={(e) => handleRadioKeys(e, UI_MODES, modeIndex, (m) => setMode(m.id))}
                                role="radio"
                                aria-checked={isActive}
                                tabIndex={isActive ? 0 : -1}
                                className={cn(
                                    RADIO_FOCUS,
                                    "flex items-center gap-3.5 min-h-11 p-4 rounded-2xl border text-left transition-[background-color,border-color,box-shadow] duration-fast ease-smooth-out cursor-pointer",
                                    isActive
                                        ? "bg-[var(--neutral-elev-3)] border-[var(--selected-bg)] ring-1 ring-[color-mix(in_srgb,var(--selected-bg)_40%,transparent)]"
                                        : "bg-[var(--neutral-elev-2)] border-[var(--neutral-separator)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)]"
                                )}
                            >
                                <div className={cn(
                                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-[background-color,border-color,color,box-shadow,transform] duration-fast ease-smooth-out",
                                    isActive
                                        ? "bg-[var(--selected-bg)] text-[var(--selected-fg)] border-[var(--selected-bg)] font-bold"
                                        : "bg-[var(--neutral-elev-3)] border-[var(--neutral-separator)] text-on-surface-variant"
                                )}>
                                    <ModeIcon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-label-1">{mode.name}</p>
                                    <p className="text-2xs text-on-surface-variant leading-snug mt-0.5 line-clamp-2">{mode.desc}</p>
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
                            className="overflow-hidden"
                        >
                            <div className="space-y-3 mt-3.5 pt-4 border-t border-[var(--neutral-separator)]">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-on-surface-variant flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-brand-accent animate-pulse" />
                                        Saga
                                    </span>
                                </div>

                                <div role="radiogroup" aria-label="Saga" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5">
                                    {THEME_PRESETS.map((preset, presetIndex) => {
                                        const isActive = activePresetObj.id === preset.id
                                        return (
                                            <m.button
                                                key={preset.id}
                                                type="button"
                                                whileTap={{ scale: 0.96 }}
                                                transition={cardSpring}
                                                onClick={() => handlePresetClick(preset)}
                                                onKeyDown={(e) => handleRadioKeys(e, THEME_PRESETS, presetIndex, handlePresetClick)}
                                                role="radio"
                                                aria-checked={isActive}
                                                tabIndex={isActive ? 0 : -1}
                                                title={preset.desc}
                                                style={presetTint(preset.accent)}
                                                className={cn(
                                                    RADIO_FOCUS,
                                                    "relative flex flex-col min-h-11 p-3 rounded-xl border text-left transition-[background-color,border-color,box-shadow] duration-fast ease-smooth-out",
                                                    isActive
                                                        ? "border-brand-accent bg-[var(--neutral-elev-3)] ring-1 ring-brand-accent/50"
                                                        : "border-[var(--neutral-separator)] [@media(hover:hover)_and_(pointer:fine)]:hover:border-[var(--neutral-separator)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)]"
                                                )}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="w-2.5 h-2.5 rounded-full border border-[var(--neutral-separator)]" style={{ backgroundColor: preset.accent }} />
                                                    {isActive && (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-success-pop" />
                                                    )}
                                                </div>
                                                <p className="text-xs font-bold text-on-surface truncate">{preset.name}</p>
                                                <p className="text-3xs text-label-2 truncate">{preset.subtitle}</p>
                                            </m.button>
                                        )
                                    })}
                                </div>
                            </div>
                        </m.div>
                    )}
                </AnimatePresence>
                </div>
</SectionBar>

            {/* ══════════════════════════════════════════════════════════════════
                2. EFECTOS Y AMBIENTACIÓN
               ════════════════════════════════════════════════════════════════ */}
            <SectionBar
                variant="content"
                id="effects-ambience"
                label="Efectos y ambientación"
                description="Fondos y luces detrás del contenido."
                icon={IconStatusSparkles}
                collapsible
                defaultOpen={true}
            >
                <Controller
                    control={control}
                    name="theme.themeEnableMediaPageBlurredBackground"
                    render={({ field }) => (
                        <OsToggle
                            label="Fondo ambiental en la ficha"
                            description="Ilumina el fondo de series y películas con el póster difuminado detrás del banner."
                            checked={!!field.value}
                            onChange={(v) => {
                                field.onChange(v)
                                setThemeVisual({ themeEnableMediaPageBlurredBackground: v })
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
                variant="content"
                id="catalog-organization"
                label="Organización del catálogo"
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
                            label="Orden inicial"
                            description="Cómo se ordenan los títulos al abrir la colección."
                            icon={IconArrowDownUp}
                            options={[
                                { value: "TITLE_ASC", label: "Alfabético A – Z", desc: "Empieza por la A", badge: "A-Z" },
                                { value: "TITLE_DESC", label: "Alfabético Z – A", desc: "Empieza por la Z", badge: "Z-A" },
                                { value: "YEAR_DESC", label: "Más recientes", desc: "Por año de emisión", badge: "Año ↓" },
                                { value: "YEAR_ASC", label: "Más antiguos", desc: "Clásicos primero", badge: "Año ↑" },
                                { value: "RATING_DESC", label: "Mejor valorados", desc: "Por puntuación", badge: "Top" },
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
                            label="Ocultar la puntuación de la audiencia"
                            description="Oculta las puntuaciones en las tarjetas para que no condicionen lo que eliges ver."
                            checked={!!field.value}
                            onChange={(v) => {
                                field.onChange(v)
                                setHideAudienceScore(!!v)
                            }}
                        />
                    )}
                />
            </SectionBar>

            {/* ══════════════════════════════════════════════════════════════════
                4. TRANSPARENCIA
               ═════════════════════════════════════════════════════════════════ */}
            <SectionBar
                variant="content"
                id="transparency"
                label="Transparencia"
                description="Vidrio translúcido o paneles sólidos."
                icon={IconStatusMonitor}
                collapsible
                defaultOpen={true}
            >
                <TransparencyCompare accent={isEraMode ? activePresetObj.accent : "rgba(255, 255, 255, 0.35)"} />
                <Controller
                    control={control}
                    name="theme.themeEnableBlurringEffects"
                    render={({ field }) => {
                        const setReduce = (reduce: boolean) => {
                            const v = !reduce
                            field.onChange(v)
                            setThemeVisual({ themeEnableBlurringEffects: v })
                        }
                        return (
                            <>
                                <TransparencyStatus />
                                <OsToggle
                                    label="Reducir transparencia"
                                    description="Paneles y barras sólidos en vez de translúcidos. Mejora la lectura y rinde mejor en equipos lentos."
                                    checked={!field.value}
                                    onChange={setReduce}
                                />
                            </>
                        )
                    }}
                />
            </SectionBar>

        </div>
    )
})
