import React from "react"
import { Section, Card, OsToggle, OsSelect, OsInput } from "../components"
import { type Control, Controller, useFormContext } from "react-hook-form"
import { type SettingsFormValues } from "../index"
import { useSound } from "@/hooks/use-sound"
import { cn } from "@/components/ui/core/styling"
import { useMutation } from "@tanstack/react-query"
import { useServerMutation } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { toast } from "sonner"
import type { UpdateTheme_Variables } from "@/api/generated/endpoint.types"

interface AppearanceTabProps {
    control: Control<SettingsFormValues>
}

const THEME_PRESETS = [
    {
        id: "kamehouse",
        name: "KameHouse Original",
        desc: "Naranja ceniza, fondo azul noche, acentos cálidos",
        background: "#070707",
        accent: "#ff6e3a",
        sidebar: "#0b0f19",
        css: "",
    },
    {
        id: "netflix",
        name: "Netflix",
        desc: "Rojo Netflix, negro puro, minimalista",
        background: "#000000",
        accent: "#e50914",
        sidebar: "#141414",
        css: "",
    },
    {
        id: "disney",
        name: "Disney+",
        desc: "Azul Disney, fondo oscuro, mágico",
        background: "#0a0e2a",
        accent: "#0063e5",
        sidebar: "#0d1230",
        css: "",
    },
    {
        id: "hbo",
        name: "Max / HBO",
        desc: "Púrpura Max, carbón, premium",
        background: "#0a0a0a",
        accent: "#7c3aed",
        sidebar: "#111111",
        css: "",
    },
    {
        id: "prime",
        name: "Prime Video",
        desc: "Azul Prime, gris oscuro, elegante",
        background: "#0b1426",
        accent: "#00a8e1",
        sidebar: "#0f1c36",
        css: "",
    },
    {
        id: "apple",
        name: "Apple TV+",
        desc: "Negro absoluto, gris cálido, limpio",
        background: "#000000",
        accent: "#999999",
        sidebar: "#1a1a1a",
        css: "",
    },
    {
        id: "crunchyroll",
        name: "Crunchyroll",
        desc: "Naranja anime, oscuro, vibrante",
        background: "#0d0d0d",
        accent: "#f47521",
        sidebar: "#141414",
        css: "",
    },
    {
        id: "custom",
        name: "Personalizado",
        desc: "Tus colores, tu estilo",
        background: "",
        accent: "",
        sidebar: "",
        css: "",
    },
]

export function AppearanceTab({ control }: AppearanceTabProps) {
    const { playSound } = useSound()
    const { setValue, getValues } = useFormContext()
    const [activePreset, setActivePreset] = React.useState<string>("kamehouse")

    const updateThemeMutation = useServerMutation<unknown, UpdateTheme_Variables>({
        endpoint: API_ENDPOINTS.THEME.UpdateTheme.endpoint,
        method: API_ENDPOINTS.THEME.UpdateTheme.methods[0],
        mutationKey: [API_ENDPOINTS.THEME.UpdateTheme.key],
    })

    const applyPresetMutation = useMutation({
        mutationFn: async (preset: typeof THEME_PRESETS[number]) => {
            return updateThemeMutation.mutateAsync({
                theme: {
                    id: 0,
                    enableColorSettings: true,
                    backgroundColor: preset.background,
                    accentColor: preset.accent,
                    sidebarBackgroundColor: preset.sidebar,
                }
            })
        },
        onSuccess: () => {
            toast.success("Tema aplicado correctamente")
        },
        onError: () => {
            toast.error("Error al aplicar el tema")
        }
    })

    const handlePresetClick = (preset: typeof THEME_PRESETS[number]) => {
        setActivePreset(preset.id)
        playSound("category")

        setValue("theme.enableColorSettings", true, { shouldValidate: true, shouldDirty: true })
        if (preset.background) setValue("theme.backgroundColor", preset.background, { shouldValidate: true, shouldDirty: true })
        if (preset.accent) setValue("theme.accentColor", preset.accent, { shouldValidate: true, shouldDirty: true })
        if (preset.sidebar) setValue("theme.sidebarBackgroundColor", preset.sidebar, { shouldValidate: true, shouldDirty: true })

        if (preset.id !== "custom") {
            // Let the global form submission handle saving the values to DB
            // rather than calling a redundant/failing immediate mutation
        }
    }

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
            {/* Theme Presets Grid */}
            <Section label="Presets de Tema">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {THEME_PRESETS.map((preset) => {
                        const isActive = activePreset === preset.id
                        const isCustom = preset.id === "custom"
                        return (
                            <button
                                key={preset.id}
                                type="button"
                                onClick={() => handlePresetClick(preset)}
                                className={cn(
                                    "relative flex flex-col p-5 rounded-container border transition-all duration-300 group active:scale-95 overflow-hidden min-h-[160px]",
                                    isActive
                                        ? "border-[#ff6e3a] bg-surface-variant/30 shadow-[0_8px_30px_rgba(255,110,58,0.1)]"
                                        : "bg-surface-container border border-outline-variant rounded-container hover:bg-surface-variant/40 hover:border-outline-variant/12"
                                )}
                                style={
                                    !isCustom && preset.background
                                        ? { background: `linear-gradient(135deg, ${preset.background} 0%, ${preset.sidebar || preset.background} 100%)` }
                                        : undefined
                                }
                            >
                                {isCustom ? (
                                    <div className="flex items-center justify-center h-full min-h-[120px] border-2 border-dashed border-outline-variant/10 rounded-xl">
                                        <div className="text-center">
                                            <svg className="w-10 h-10 mx-auto text-on-surface-variant/60 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                                            </svg>
                                            <p className="text-xs font-bold text-on-surface uppercase tracking-wider">Crear Tema</p>
                                            <p className="text-[10px] text-on-surface-variant mt-1">Diseña tu propia paleta</p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none bg-gradient-to-b from-transparent to-black/60" />
                                        <div className="relative z-10 flex flex-col h-full">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-xs font-bold text-on-surface uppercase tracking-wider">{preset.name}</span>
                                                <div className="flex gap-1">
                                                    <div className="w-3 h-3 rounded-full border border-outline-variant/10" style={{ background: preset.background }} />
                                                    <div className="w-3 h-3 rounded-full" style={{ background: preset.accent }} />
                                                </div>
                                            </div>
                                            <p className="text-[11px] text-on-surface-variant leading-relaxed font-medium flex-1">{preset.desc}</p>
                                            {isActive && (
                                                <div className="absolute inset-0 border-2 border-[#ff6e3a] rounded-container pointer-events-none" />
                                            )}
                                        </div>
                                    </>
                                )}
                            </button>
                        )
                    })}
                </div>
            </Section>

            {/* Color Customization */}
            <Section label="Paleta de Colores">
                <Card className="divide-y divide-outline-variant/3">
                    <Controller
                        control={control}
                        name="theme.enableColorSettings"
                        render={({ field }) => (
                            <OsToggle
                                label="Habilitar Personalización de Colores"
                                description="Activa la paleta de colores personalizada. Desactiva para usar el tema por defecto del sistema."
                                checked={!!field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="theme.backgroundColor"
                        render={({ field }) => (
                            <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-5 border-b border-outline-variant/2 hover:bg-surface-variant/[0.005] transition-all duration-200 gap-5 group/input">
                                <div className="space-y-0.5 flex-1 max-w-xl">
                                    <label htmlFor="bg-color" className="text-sm font-semibold text-on-surface group-hover/input:text-on-surface transition-colors tracking-tight cursor-pointer">Color de Fondo Principal</label>
                                    <p className="text-[11px] text-on-surface-variant leading-relaxed font-medium">Color base de toda la aplicación</p>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <input
                                        id="bg-color"
                                        type="color"
                                        value={field.value || "#070707"}
                                        onChange={(e) => field.onChange(e.target.value)}
                                        className="w-10 h-10 rounded-lg border border-outline-variant/10 cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={field.value || "#070707"}
                                        onChange={(e) => field.onChange(e.target.value)}
                                        className="bg-surface-container border border-outline-variant/5 rounded-xl px-4 py-2.5 w-36 text-on-surface placeholder:text-on-surface-variant/70 text-xs font-mono focus:outline-none focus:border-[#ff6e3a]/40"
                                        placeholder="#000000"
                                    />
                                </div>
                            </div>
                        )}
                    />
                    <Controller
                        control={control}
                        name="theme.accentColor"
                        render={({ field }) => (
                            <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-5 border-b border-outline-variant/2 hover:bg-surface-variant/[0.005] transition-all duration-200 gap-5 group/input">
                                <div className="space-y-0.5 flex-1 max-w-xl">
                                    <label htmlFor="accent-color" className="text-sm font-semibold text-on-surface group-hover/input:text-on-surface transition-colors tracking-tight cursor-pointer">Color de Acento</label>
                                    <p className="text-[11px] text-on-surface-variant leading-relaxed font-medium">Color principal para botones, enlaces, estados activos</p>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <input
                                        id="accent-color"
                                        type="color"
                                        value={field.value || "#ff6e3a"}
                                        onChange={(e) => field.onChange(e.target.value)}
                                        className="w-10 h-10 rounded-lg border border-outline-variant/10 cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={field.value || "#ff6e3a"}
                                        onChange={(e) => field.onChange(e.target.value)}
                                        className="bg-surface-container border border-outline-variant/5 rounded-xl px-4 py-2.5 w-36 text-on-surface placeholder:text-on-surface-variant/70 text-xs font-mono focus:outline-none focus:border-[#ff6e3a]/40"
                                        placeholder="#ff6e3a"
                                    />
                                </div>
                            </div>
                        )}
                    />
                    <Controller
                        control={control}
                        name="theme.sidebarBackgroundColor"
                        render={({ field }) => (
                            <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-5 border-b border-outline-variant/2 hover:bg-surface-variant/[0.005] transition-all duration-200 gap-5 group/input">
                                <div className="space-y-0.5 flex-1 max-w-xl">
                                    <label htmlFor="sidebar-color" className="text-sm font-semibold text-on-surface group-hover/input:text-on-surface transition-colors tracking-tight cursor-pointer">Color Sidebar</label>
                                    <p className="text-[11px] text-on-surface-variant leading-relaxed font-medium">Fondo del panel lateral (vacío = usa fondo principal)</p>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <input
                                        id="sidebar-color"
                                        type="color"
                                        value={field.value || "#0b0f19"}
                                        onChange={(e) => field.onChange(e.target.value)}
                                        className="w-10 h-10 rounded-lg border border-outline-variant/10 cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={field.value || "#0b0f19"}
                                        onChange={(e) => field.onChange(e.target.value)}
                                        className="bg-surface-container border border-outline-variant/5 rounded-xl px-4 py-2.5 w-36 text-on-surface placeholder:text-on-surface-variant/70 text-xs font-mono focus:outline-none focus:border-[#ff6e3a]/40"
                                        placeholder="#0b0f19"
                                    />
                                </div>
                            </div>
                        )}
                    />
                </Card>
            </Section>

            {/* Layout & Behavior */}
            <Section label="Diseño y Comportamiento">
                <Card className="divide-y divide-outline-variant/3">
                    <Controller
                        control={control}
                        name="theme.themeSmallerEpisodeCarouselSize"
                        render={({ field }) => (
                            <OsToggle
                                label="Carruseles Compactos"
                                description="Reduce el tamaño de las tarjetas en carruseles para mostrar más contenido."
                                checked={!!field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="theme.themeExpandSidebarOnHover"
                        render={({ field }) => (
                            <OsToggle
                                label="Expandir Sidebar al Pasar Ratón"
                                description="La barra lateral se expande automáticamente al pasar el cursor."
                                checked={!!field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="theme.themeDisableSidebarTransparency"
                        render={({ field }) => (
                            <OsToggle
                                label="Desactivar Transparencia Sidebar"
                                description="Elimina el efecto glassmorphism/blur de la barra lateral."
                                checked={!!field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="theme.themeEnableBlurringEffects"
                        render={({ field }) => (
                            <OsToggle
                                label="Efectos de Desenfoque (Blur)"
                                description="Habilita backdrop-filter y blur en tarjetas, modales y overlays."
                                checked={!!field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="theme.themeDisableCarouselAutoScroll"
                        render={({ field }) => (
                            <OsToggle
                                label="Desactivar Auto-Scroll en Carruseles"
                                description="Evita que los carruseles se desplacen automáticamente."
                                checked={!!field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="theme.themeUseLegacyEpisodeCard"
                        render={({ field }) => (
                            <OsToggle
                                label="Tarjeta de Episodio Legacy"
                                description="Usa el diseño clásico de tarjetas de episodios (menos info visual)."
                                checked={!!field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                </Card>
            </Section>

            {/* Library Screen Customization */}
            <Section label="Pantalla de Biblioteca">
                <Card className="divide-y divide-outline-variant/3">
                    <Controller
                        control={control}
                        name="theme.themeLibraryScreenBannerType"
                        render={({ field }) => (
                            <OsSelect
                                label="Tipo de Banner"
                                description="Estilo del banner superior en la pantalla de biblioteca."
                                options={[
                                    { value: "dynamic", label: "Dinámico (Arte del anime actual)" },
                                    { value: "custom", label: "Imagen Personalizada" },
                                    { value: "solid", label: "Color Sólido" },
                                    { value: "gradient", label: "Gradiente" },
                                    { value: "none", label: "Sin Banner" },
                                ]}
                                value={field.value || "dynamic"}
                                onChange={field.onChange}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="theme.themeLibraryScreenCustomBannerImage"
                        render={({ field }) => (
                            <OsInput
                                label="Imagen de Banner Personalizada"
                                description="URL o ruta local de la imagen para el banner (si tipo = custom)."
                                placeholder="https://ejemplo.com/banner.jpg"
                                value={field.value || ""}
                                onChange={field.onChange}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="theme.themeLibraryScreenCustomBannerOpacity"
                        render={({ field }) => (
                            <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-5 border-b border-outline-variant/2 hover:bg-surface-variant/[0.005] transition-all duration-200 gap-5 group/input">
                                <div className="space-y-0.5 flex-1 max-w-xl">
                                    <label htmlFor="banner-opacity" className="text-sm font-semibold text-on-surface group-hover/input:text-on-surface transition-colors tracking-tight cursor-pointer">Opacidad del Banner</label>
                                    <p className="text-[11px] text-on-surface-variant leading-relaxed font-medium">0 = Transparente, 100 = Opaco</p>
                                </div>
                                <div className="flex items-center gap-3 w-full md:w-72">
                                    <input
                                        id="banner-opacity"
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={field.value || 10}
                                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                                        className="w-full accent-[#ff6e3a] bg-surface-variant h-1 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <span className="text-xs font-mono text-on-surface-variant w-8 text-right shrink-0">{field.value || 10}%</span>
                                </div>
                            </div>
                        )}
                    />
                    <Controller
                        control={control}
                        name="theme.themeDisableLibraryScreenGenreSelector"
                        render={({ field }) => (
                            <OsToggle
                                label="Ocultar Selector de Géneros"
                                description="Elimina el filtro de géneros en la pantalla de biblioteca."
                                checked={!!field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                </Card>
            </Section>

            {/* Media Page Customization */}
            <Section label="Página de Detalle">
                <Card className="divide-y divide-outline-variant/3">
                    <Controller
                        control={control}
                        name="theme.themeMediaPageBannerType"
                        render={({ field }) => (
                            <OsSelect
                                label="Tipo de Banner"
                                description="Estilo del banner en la página de detalle."
                                options={[
                                    { value: "default", label: "Por Defecto (Fanart + Info)" },
                                    { value: "cinematic", label: "Cinemático (Full Width)" },
                                    { value: "minimal", label: "Minimalista" },
                                ]}
                                value={field.value || "default"}
                                onChange={field.onChange}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="theme.themeEnableMediaPageBlurredBackground"
                        render={({ field }) => (
                            <OsToggle
                                label="Fondo Difuminado en Media Page"
                                description="Aplica blur al fondo detrás del banner para mejor legibilidad."
                                checked={!!field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="theme.themeShowEpisodeCardAnimeInfo"
                        render={({ field }) => (
                            <OsToggle
                                label="Mostrar Info de Anime en Tarjetas"
                                description="Muestra puntuación, año, estado en las tarjetas de episodios."
                                checked={!!field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                </Card>
            </Section>

            {/* Sorting & Lists */}
            <Section label="Ordenación y Listas">
                <Card className="divide-y divide-outline-variant/3">
                    <Controller
                        control={control}
                        name="theme.themeContinueWatchingDefaultSorting"
                        render={({ field }) => (
                            <OsSelect
                                label="Orden 'Continuar Viendo'"
                                description="Orden por defecto en la sección Continuar Viendo."
                                options={[
                                    { value: "LAST_WATCHED_DESC", label: "Más Reciente Primero" },
                                    { value: "LAST_WATCHED_ASC", label: "Más Antiguo Primero" },
                                    { value: "TITLE_ASC", label: "Título A-Z" },
                                ]}
                                value={field.value || "LAST_WATCHED_DESC"}
                                onChange={field.onChange}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="theme.themeAnimeLibraryCollectionDefaultSorting"
                        render={({ field }) => (
                            <OsSelect
                                label="Orden Biblioteca de Anime"
                                description="Orden por defecto en la vista de colección."
                                options={[
                                    { value: "TITLE_ASC", label: "Título A-Z" },
                                    { value: "TITLE_DESC", label: "Título Z-A" },
                                    { value: "SCORE_DESC", label: "Puntuación Alta-Baja" },
                                    { value: "YEAR_DESC", label: "Año Nuevo-Viejo" },
                                ]}
                                value={field.value || "TITLE_ASC"}
                                onChange={field.onChange}
                            />
                        )}
                    />
                </Card>
            </Section>

            {/* Advanced: Custom CSS */}
            <Section label="CSS Personalizado (Avanzado)">
                <Card className="p-6 space-y-4">
                    <Controller
                        control={control}
                        name="theme.themeCustomCSS"
                        render={({ field }) => (
                            <div className="relative">
                                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wide block mb-2">CSS Global</label>
                                <textarea
                                    value={field.value || ""}
                                    onChange={(e) => field.onChange(e.target.value)}
                                    placeholder="/* Tu CSS personalizado aqui */"
                                    className="w-full h-48 bg-surface-container border border-outline-variant/5 rounded-xl px-4 py-3 text-on-surface placeholder:text-on-surface-variant/70 text-[11px] font-mono focus:outline-none focus:border-[#ff6e3a]/40 resize-y"
                                />
                                <div className="absolute bottom-2 right-2 text-[9px] font-mono text-on-surface-variant/60">
                                    {(field.value || "").length} chars
                                </div>
                            </div>
                        )}
                    />
                    <Controller
                        control={control}
                        name="theme.themeMobileCustomCSS"
                        render={({ field }) => (
                            <div className="relative pt-4 border-t border-outline-variant/5">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider font-mono mb-2 block">CSS Solo Móvil</label>
                                <textarea
                                    value={field.value || ""}
                                    onChange={(e) => field.onChange(e.target.value)}
                                    placeholder="@media (max-width: 768px) { ... }"
                                    className="w-full h-32 bg-surface-container border border-outline-variant/5 rounded-xl px-4 py-3 text-on-surface placeholder:text-on-surface-variant/70 text-[11px] font-mono focus:outline-none focus:border-[#ff6e3a]/40 resize-y"
                                />
                            </div>
                        )}
                    />
                </Card>
            </Section>

            {/* Reset */}
            <Section label="Acciones">
                <button
                    type="button"
                    onClick={() => {
                        if (confirm("¿Restablecer toda la configuración de apariencia a valores por defecto?")) {
                            setValue("theme.backgroundColor", "#070707")
                            setValue("theme.accentColor", "#ff6e3a")
                            setValue("theme.sidebarBackgroundColor", "#0b0f19")
                            setValue("theme.themeCustomCSS", "")
                            setActivePreset("kamehouse")
                            toast.success("Apariencia restablecida")
                        }
                    }}
                    className="p-5 rounded-container bg-surface-container border border-outline-variant/5 hover:border-red-500/20 hover:bg-red-500/5 transition-all text-left group w-full"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </div>
                        <div>
                            <p className="font-bold text-on-surface text-sm">Restablecer a Defecto</p>
                            <p className="text-[11px] text-on-surface-variant">Vuelve al tema KameHouse Original</p>
                        </div>
                    </div>
                </button>
            </Section>
        </div>
    )
}
