import { useMediaQuery } from "@/hooks/use-media-query"
import React from "react"
import { CLASSIC_MINIMALIST_THEME, ERA_THEME, ERA_THEME_PRESETS } from "@/lib/theme/themes-registry"
import { type Control, Controller, useFormContext, useWatch } from "react-hook-form"
import { m, AnimatePresence } from "framer-motion"
import { type SettingsFormValues } from "../index"
import { useSound } from "@/hooks/use-sound"
import { cn } from "@/components/ui/core/styling"
import { Button } from "@/components/ui/button"
import {
    IconStatusMonitor,
    IconStatusSparkles,
    IconUiPalette,
    IconNavigationFilm,
    IconArrowDownUp,
    IconNavigationRocket,
    IconUiCheck,
    IconUiAlertTriangle,
} from "@/components/ui/icons"
import { resolveThemeMode, type ThemeMode } from "@/lib/theme/theme-hooks"
import { OsSelect, OsToggle } from "../components"
import { SectionBar } from "@/components/ui/sectionbar"
import { useReducedMotion, useSpringPreset } from "@/components/ui/kinetics/hooks"
import { useUIStore } from "@/lib/stores/ui-store"
import { useShallow } from "zustand/react/shallow"
import { usePerformanceStore } from "@/lib/hardware/performance-store"
import { useTransparencyState } from "@/lib/theme/apply-custom-theme"
import { NavDensitySetting } from "@/components/ui/app-layout/nav-density-setting"
import { SagaCarousel } from "./-saga-carousel"

const RADIO_FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"

interface AppearanceTabProps {
    control: Control<SettingsFormValues>
}

// ─── Modos Principales (Temas) ────────────────────────────────────────────────
const UI_MODES = [
    {
        id: CLASSIC_MINIMALIST_THEME.id,
        name: CLASSIC_MINIMALIST_THEME.name,
        desc: CLASSIC_MINIMALIST_THEME.description,
        icon: IconNavigationRocket,
        badge: "Plano",
    },
    {
        id: ERA_THEME.id,
        name: ERA_THEME.name,
        desc: ERA_THEME.description,
        icon: IconUiPalette,
        badge: "Liquid Glass",
    },
]

// â”€â”€ Presets por Era â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const THEME_PRESETS = ERA_THEME_PRESETS

export const AppearanceTab = React.memo(function AppearanceTab({ control }: AppearanceTabProps) {
    const { playSound } = useSound()
    const reduceMotion = useReducedMotion()
    const canHover = useMediaQuery("(hover: hover) and (pointer: fine)")
    const { setValue, getValues } = useFormContext<SettingsFormValues>()
    // Dual-write: el form marca dirty (para Guardar) y el store aplica al instante.
    const setThemeVisual = useUIStore((s) => s.setThemeVisual)
    const setHideAudienceScore = useUIStore((s) => s.setHideAudienceScore)

    // Watchers consolidados en una Ãºnica suscripciÃ³n
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

    // Store local para toggles de este dispositivo
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

    const lastEraRef = React.useRef<string>(
        themeEraValue && themeEraValue.startsWith(ERA_THEME.domContract.themePrefix)
            ? themeEraValue
            : ERA_THEME.defaultEra
    )
    React.useEffect(() => {
        if (themeEraValue && themeEraValue.startsWith(ERA_THEME.domContract.themePrefix)) {
            lastEraRef.current = themeEraValue
        }
    }, [themeEraValue])

    const handlePresetClick = (preset: typeof THEME_PRESETS[number]) => {
        playSound("category")
        lastEraRef.current = preset.themeEra
        setValue("theme.themeEra", preset.themeEra, { shouldValidate: true, shouldDirty: true })
        setValue("theme.enableColorSettings", true, { shouldDirty: true })
        setThemeVisual({ themeEra: preset.themeEra, enableColorSettings: true })
    }

    const selectEraMode = () => {
        playSound("category")
        setValue("theme.themeMode", "era", { shouldDirty: true })
        const currentEra = getValues("theme.themeEra")
        const nextEra = currentEra && currentEra.startsWith(ERA_THEME.domContract.themePrefix)
            ? currentEra
            : (lastEraRef.current || ERA_THEME.defaultEra)
        setValue("theme.themeEra", nextEra, { shouldDirty: true })
        setValue("theme.enableColorSettings", true, { shouldDirty: true })
        setThemeVisual({
            themeMode: "era",
            themeEra: nextEra,
            enableColorSettings: true,
        })
    }

    const selectMinimalistMode = () => {
        playSound("category")
        setValue("theme.themeMode", CLASSIC_MINIMALIST_THEME.id, { shouldDirty: true })
        setValue("theme.themeEra", CLASSIC_MINIMALIST_THEME.domContract.theme, { shouldDirty: true })
        setValue("theme.enableColorSettings", false, { shouldDirty: true })
        setThemeVisual({
            themeMode: CLASSIC_MINIMALIST_THEME.id,
            themeEra: CLASSIC_MINIMALIST_THEME.domContract.theme,
            enableColorSettings: false,
        })
    }

    const { reason } = useTransparencyState()
    const setAutoThrottleActive = usePerformanceStore((s) => s.setAutoThrottleActive)
    const hasSpecialReason = isEraMode && (reason === "auto" || reason === "eco" || reason === "contrast")

    const contentSpring = useSpringPreset("tabContent")
    const cardHoverSpring = useSpringPreset("cardHover")
    const tabIndicatorSpring = useSpringPreset("tabIndicator")

    return (
        <div className="w-full space-y-4 sm:space-y-5 animate-in fade-in duration-base pb-4 sm:pb-8">
            {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                1. TEMA Y PALETA
               â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            <SectionBar
                variant="content"
                id="theme-selection"
                label="Tema y paleta"
                description="Elige el estilo visual general y la saga activa de Dragon Ball."
                icon={IconUiPalette}
                collapsible
                defaultOpen={true}
            >
                <div>
                    {/* Selector de Modos Principales (Temas) */}
                    <div role="radiogroup" aria-label="Tema" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {UI_MODES.map((mode) => {
                            const isActive = uiMode === mode.id
                            const ModeIcon = mode.icon
                            return (
                                <m.button
                                    key={mode.id}
                                    type="button"
                                    whileHover={canHover && !reduceMotion ? { y: -3 } : undefined}
                                    whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                                    transition={cardHoverSpring}
                                    onClick={mode.id === CLASSIC_MINIMALIST_THEME.id ? selectMinimalistMode : selectEraMode}
                                    role="radio"
                                    data-settings-theme-choice=""
                                    aria-checked={isActive}
                                    tabIndex={isActive ? 0 : -1}
                                    className={cn(
                                        RADIO_FOCUS,
                                        "flex flex-col justify-between p-4 rounded-2xl border text-left cursor-pointer relative overflow-hidden group min-h-[168px] transform-gpu",
                                        "transition-[background-color,border-color,box-shadow] duration-fast ease-smooth-out",
                                        isActive
                                            ? "bg-white/[0.08] border-white/80 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.8)]"
                                            : "bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.05]"
                                    )}
                                >
                                    {/* Active Morphing Ring & Glow */}
                                    {isActive && (
                                        <m.div
                                            layoutId="activeThemeCardGlow"
                                            data-settings-choice-ring=""
                                            className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-white ring-1 ring-white/30 shadow-[0_0_24px_rgba(255,255,255,0.08)] z-20"
                                            transition={tabIndicatorSpring}
                                        />
                                    )}

                                    {/* Specular Top Sheen Highlight */}
                                    <div
                                        aria-hidden="true"
                                        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-60 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-hover:via-white/60 transition-opacity duration-300 z-10"
                                    />

                                    <div className="space-y-3 w-full relative z-10">
                                        {/* Fila superior: Icono B&W y badge de estado */}
                                        <div className="flex items-center justify-between w-full">
                                            <div className={cn(
                                                "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-[transform,background-color,border-color] duration-fast ease-smooth-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105",
                                                isActive
                                                    ? "bg-[var(--selected-bg)] text-[var(--selected-fg)] border-white shadow-[shadow:var(--double-bezel-ring)]"
                                                    : "bg-white/10 border-white/15 text-white [@media(hover:hover)_and_(pointer:fine)]:group-hover:border-white/30"
                                            )}>
                                                <ModeIcon className={cn("w-4 h-4 transition-transform duration-fast ease-smooth-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-110", isActive ? "text-[var(--selected-fg)]" : "text-white")} />
                                            </div>

                                            <AnimatePresence initial={false}>
                                                {isActive ? (
                                                    <m.span
                                                        key="active"
                                                        initial={{ scale: reduceMotion ? 1 : 0.85, opacity: 0 }}
                                                        animate={{ scale: 1, opacity: 1 }}
                                                        exit={{ scale: reduceMotion ? 1 : 0.85, opacity: 0 }}
                                                        transition={reduceMotion ? { duration: 0.15 } : tabIndicatorSpring}
                                                        className="flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--selected-bg)] text-[var(--selected-fg)] shadow-[shadow:var(--double-bezel-ring)]"
                                                    >
                                                        <IconUiCheck className="w-3 h-3 text-[var(--selected-fg)] stroke-[3]" />
                                                        En uso
                                                    </m.span>
                                                ) : (
                                                    <span className="text-xs font-mono text-on-surface-variant font-semibold uppercase [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-label-1 transition-colors">
                                                        {mode.badge}
                                                    </span>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        {/* Silueta visual de interfaz en miniatura */}
                                        <div
                                            aria-hidden="true"
                                            className={cn(
                                                "h-14 rounded-xl border p-2 flex flex-col justify-between transition-[transform,border-color,background-color] duration-fast ease-smooth-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.015]",
                                                mode.id === CLASSIC_MINIMALIST_THEME.id
                                                    ? "bg-black border-white/15 shadow-inner [@media(hover:hover)_and_(pointer:fine)]:group-hover:border-white/25"
                                                    : "bg-[#08080A] border-white/[0.08] border-t-white/[0.16] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.10),0_0_0_1px_rgba(0,0,0,0.85)] relative overflow-hidden [@media(hover:hover)_and_(pointer:fine)]:bg-[#101014] [@media(hover:hover)_and_(pointer:fine)]:group-hover:border-white/20"
                                            )}
                                        >
                                            {mode.id === ERA_THEME.id && (
                                                <span className="absolute right-1.5 -bottom-2 text-2xl font-black text-white/10 select-none font-display [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-white/20 motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105 transition-[color,transform] duration-300">
                                                    悟
                                                </span>
                                            )}
                                            <div className="flex gap-1.5 relative z-10">
                                                <div className={cn(
                                                    "h-1.5 rounded-full transition-[width,background-color] duration-300",
                                                    mode.id === CLASSIC_MINIMALIST_THEME.id
                                                        ? "w-1/3 bg-white/70 [@media(hover:hover)_and_(pointer:fine)]:group-hover:w-2/5 [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-white"
                                                        : "w-2/3 bg-brand-accent [@media(hover:hover)_and_(pointer:fine)]:group-hover:w-3/4"
                                                )} />
                                                <div className="w-1/4 h-1.5 rounded-full bg-white/25" />
                                            </div>
                                            <div className="flex justify-between items-end relative z-10">
                                                <div className={cn(
                                                    "h-3.5 rounded px-1.5 flex items-center text-xs font-mono font-bold transition-transform duration-200 motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5",
                                                    mode.id === CLASSIC_MINIMALIST_THEME.id
                                                        ? "bg-zinc-800 border border-white/20 text-white"
                                                        : "bg-brand-accent text-primary-foreground font-bold"
                                                )}>
                                                    {mode.badge.toUpperCase()}
                                                </div>
                                                <div className={cn(
                                                    "w-2.5 h-2.5 rounded-full transition-[background-color,box-shadow] duration-300",
                                                    isActive
                                                        ? mode.id === ERA_THEME.id
                                                            ? "bg-brand-accent shadow-[0_0_8px_hsl(var(--brand-accent))]"
                                                            : "bg-white shadow-[0_0_8px_rgba(255,255,255,0.85)]"
                                                        : "bg-white/40 [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-white/70"
                                                )} />
                                            </div>
                                        </div>

                                        {/* Título y descripción */}
                                        <div>
                                            <p className="text-xs font-bold text-white tracking-tight [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-zinc-100 transition-colors">{mode.name}</p>
                                            <p className="text-xs text-label-2 font-sans leading-relaxed mt-1 line-clamp-2">{mode.desc}</p>
                                        </div>
                                    </div>

                                    {/* Pie técnico de la tarjeta */}
                                    <div className="w-full pt-2.5 mt-2 border-t border-[var(--neutral-separator)] flex items-center justify-between text-xs font-mono text-on-surface-variant uppercase relative z-10">
                                        <span>{mode.badge}</span>
                                        <span>{mode.id === CLASSIC_MINIMALIST_THEME.id ? "Superficies sólidas" : "8 paletas"}</span>
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
                                            <span className="w-2 h-2 rounded-full bg-brand-accent animate-pulse motion-reduce:animate-none" />
                                            Paleta activa
                                        </span>
                                    </div>

                                    <SagaCarousel
                                        presets={THEME_PRESETS}
                                        activeId={activePresetObj.id}
                                        onSelect={handlePresetClick}
                                    />
                                </div>
                            </m.div>
                        )}
                    </AnimatePresence>
                </div>
            </SectionBar>

            {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                2. SUPERFICIES Y TRANSPARENCIA
               â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            <SectionBar
                variant="content"
                id="surfaces-transparency"
                label="Vidrio líquido y superficies"
                description="Materiales de las ventanas, desenfoque de fondo y refracción óptica."
                icon={IconStatusMonitor}
                collapsible
                defaultOpen={true}
            >
                <div>
                    {/* Aviso cuando el sistema o hardware pausó la transparencia */}
                    {hasSpecialReason && (
                        <div className="px-4 sm:px-5 pt-3 pb-2">
                            <div
                                role="status"
                                data-transparency-status=""
                                className="flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl bg-[var(--neutral-elev-1)] border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-shadow)] text-xs text-label-2"
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <IconUiAlertTriangle className="w-4 h-4 text-status-warning shrink-0" />
                                    <span className="leading-snug">
                                        {reason === "auto" && "La transparencia se pausó automáticamente para mantener los 60 FPS tras detectar carga en el equipo."}
                                        {reason === "eco" && "La transparencia está en pausa por perfil de ahorro de batería o hardware modesto."}
                                        {reason === "contrast" && "Superficies sólidas activas por la preferencia de contraste alto del sistema operativo."}
                                    </span>
                                </div>
                                {reason === "auto" && (
                                    <Button
                                        intent="secondary"
                                        size="sm"
                                        onClick={() => setAutoThrottleActive(false)}
                                        className="shrink-0 text-xs font-mono font-bold"
                                    >
                                        Reactivar vidrio
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    <Controller
                        control={control}
                        name="theme.themeEnableBlurringEffects"
                        render={({ field }) => (
                            <OsToggle
                                label="Efectos de vidrio y desenfoque"
                                description={
                                    uiMode === CLASSIC_MINIMALIST_THEME.id
                                        ? "Fijo en Minimalista: superficies sólidas sin desenfoque de fondo."
                                        : "Paneles, menús y barras translúcidos con desenfoque de fondo. Desactívalo para usar superficies sólidas."
                                }
                                checked={uiMode !== CLASSIC_MINIMALIST_THEME.id && field.value !== false}
                                disabled={uiMode === CLASSIC_MINIMALIST_THEME.id}
                                onChange={(enabled) => {
                                    field.onChange(enabled)
                                    setThemeVisual({ themeEnableBlurringEffects: enabled })
                                }}
                            />
                        )}
                    />

                    <Controller
                        control={control}
                        name="theme.themeEnableLiquidGlass"
                        render={({ field }) => (
                            <OsToggle
                                label="Refracción Liquid Glass"
                                description={
                                    uiMode === CLASSIC_MINIMALIST_THEME.id
                                        ? "No disponible en Minimalista (diseño plano sin lente óptica)."
                                        : !blurEffectsValue
                                        ? "Requiere activar primero los efectos de vidrio y desenfoque."
                                        : "Cristal translúcido con bordes luminosos y refracción del fondo en barras, menús y paneles flotantes."
                                }
                                checked={uiMode === ERA_THEME.id && !!blurEffectsValue && field.value !== false}
                                disabled={uiMode !== ERA_THEME.id || !blurEffectsValue}
                                onChange={(enabled) => {
                                    field.onChange(enabled)
                                    setThemeVisual({ themeEnableLiquidGlass: enabled })
                                }}
                            />
                        )}
                    />
                </div>
            </SectionBar>

            {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                3. FONDOS Y AMBIENTACIÃ“N
               â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            <SectionBar
                variant="content"
                id="effects-ambience"
                label="Fondos y ambientación"
                description="Luces ambientales dinámicas y desenfoques cinematográficos detrás del contenido."
                icon={IconStatusSparkles}
                collapsible
                defaultOpen={true}
            >
                <div>
                    <div className="flex items-center gap-2 px-1 pb-1">
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[var(--neutral-elev-2)] text-label-1 border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-ring)] font-bold">
                            LOCAL
                        </span>
                        <span className="text-xs text-label-2 font-medium">Solo este dispositivo; no necesita Guardar</span>
                    </div>

                    <OsToggle
                        label="Fondo dinámico"
                        description="Fondos ambientales animados según la sección o portada que exploras."
                        checked={dynamicBackdropEnabled}
                        onChange={setDynamicBackdropEnabled}
                    />
                    <OsToggle
                        label="Movimiento del fondo dinámico"
                        description="Anima el fondo ambiental. Desactívalo para ahorrar batería o GPU."
                        checked={motionEnabled}
                        onChange={setDynamicBackdropMotionEnabled}
                        disabled={!dynamicBackdropEnabled}
                    />

                    <div className="pt-2 border-t border-[var(--neutral-separator)]">
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
                        <OsToggle
                            label="Desenfoque superior al desplazar"
                            description={uiMode === CLASSIC_MINIMALIST_THEME.id
                                ? "Desactivado en Modo Minimalista (diseño plano sin desenfoque superior)."
                                : "Desenfoca el borde superior cuando el contenido pasa por debajo de la barra."}
                            checked={uiMode !== CLASSIC_MINIMALIST_THEME.id && scrollBlurEnabled}
                            disabled={uiMode === CLASSIC_MINIMALIST_THEME.id}
                            onChange={setScrollBlurEnabled}
                        />
                    </div>
                </div>
            </SectionBar>

            {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                4. NAVEGACIÃ“N Y CATÃLOGO
               â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            <SectionBar
                variant="content"
                id="interface-navigation"
                label="Navegación y catálogo"
                description="Disposición de barras, comportamiento de tarjetas y orden de la colección."
                icon={IconNavigationFilm}
                collapsible
                defaultOpen={true}
            >
                <div>
                    <NavDensitySetting />
                    <OsToggle
                        label="Tarjeta al desplazar la ficha de series"
                        description="Al bajar, el hero de la serie se contrae en una tarjeta chica con el episodio y el botón de reproducir. Apágalo para que el hero se desplace normal."
                        checked={seriesHeroCardEnabled}
                        onChange={setSeriesHeroCardEnabled}
                    />

                    <div className="pt-2 border-t border-[var(--neutral-separator)]">
                        <Controller
                            control={control}
                            name="theme.themeAnimeLibraryCollectionDefaultSorting"
                            render={({ field }) => (
                                <OsSelect
                                    label="Orden inicial"
                                    description="Cómo se ordenan los títulos al abrir la colección de películas y series."
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
                    </div>
                </div>
            </SectionBar>

        </div>
    )
})
