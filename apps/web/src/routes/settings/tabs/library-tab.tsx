import React from "react"
import { type Control, Controller } from "react-hook-form"
import { type SettingsFormValues } from "../index"
import { PathList, OsToggle, OsSelect } from "../components"
import { SectionBar } from "@/components/ui/sectionbar"
import { IconStatusFolder, IconNavigationTv, IconNavigationFilm, IconStatusRadar, IconStatusZap, IconUiSpinner, IconStatusDatabase, IconUiTag } from "@/components/ui/icons";

const DragonBallScannerLive = React.lazy(() =>
    import("../components/-dragonball-scanner-live").then(m => ({ default: m.DragonBallScannerLive }))
)

interface LibraryTabProps {
    control: Control<SettingsFormValues>
}

export const LibraryTab = React.memo(function LibraryTab({ control }: LibraryTabProps) {
    return (
        <div className="w-full space-y-7 animate-in fade-in duration-base pb-8">

            {/* ═══════════════════════════════════════════════════════════════════
                1. DIRECTORIOS DE MEDIOS
               ═══════════════════════════════════════════════════════════════════ */}
            <SectionBar
                id="media-directories"
                label="Directorios de Medios y Carpetas"
                description="Rutas del sistema de archivos donde se alojan tus series, anime y películas."
                icon={IconStatusFolder}
                collapsible
                defaultOpen={true}
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Controller
                        control={control}
                        name="library.seriesPaths"
                        render={({ field }) => (
                            <PathList
                                label="Series & Anime"
                                icon={IconNavigationTv}
                                directories={field.value || []}
                                onAdd={(newPath) => {
                                    const current = field.value || []
                                    if (!current.includes(newPath)) {
                                        field.onChange([...current, newPath])
                                    }
                                }}
                                onRemove={(removedPath) => {
                                    const current = field.value || []
                                    field.onChange(current.filter((p) => p !== removedPath))
                                }}
                                placeholder="Ej. D:\Media\Anime"
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="library.moviePaths"
                        render={({ field }) => (
                            <PathList
                                label="Películas & OVAs"
                                icon={IconNavigationFilm}
                                directories={field.value || []}
                                onAdd={(newPath) => {
                                    const current = field.value || []
                                    if (!current.includes(newPath)) {
                                        field.onChange([...current, newPath])
                                    }
                                }}
                                onRemove={(removedPath) => {
                                    const current = field.value || []
                                    field.onChange(current.filter((p) => p !== removedPath))
                                }}
                                placeholder="Ej. D:\Media\Movies"
                            />
                        )}
                    />
                </div>

                <div className="pt-2 border-t border-white/[0.05]">
                    <OsToggle
                        label="Mostrar ruta completa en la lista"
                        description="Muestra la ruta completa de cada directorio en lugar del nombre solo."
                        checked={true}
                        onChange={() => {}}
                    />
                </div>
            </SectionBar>

            {/* ═══════════════════════════════════════════════════════════════════
                2. AUTOMATIZACIÓN DEL ESCÁNER
               ═══════════════════════════════════════════════════════════════════ */}
            <SectionBar
                id="scanner-automation"
                label="Automatización del Escáner y Metadatos"
                description="Detección de cambios de archivos, sincronización al arrancar y proveedores de datos."
                icon={IconStatusRadar}
                collapsible
                defaultOpen={true}
            >
                <OsToggle
                    label="Escaneo Automático por Cambios"
                    description="Detecta archivos añadidos o borrados en tiempo real y actualiza la biblioteca."
                    checked={true}
                    onChange={() => {}}
                />
                <OsToggle
                    label="Escanear al Arrancar el Servidor"
                    description="Realiza una pasada de verificación rápida al encender KameHouse."
                    checked={true}
                    onChange={() => {}}
                />
                <OsSelect
                    label="Proveedor de Metadatos y Escaneo"
                    description="Base de datos prioritaria para indexar series, películas y episodios."
                    icon={IconStatusDatabase}
                    options={[
                        { value: "anilist", label: "AniList", desc: "Banners HD y arte oficial", badge: "RECOMENDADO" },
                        { value: "jikan", label: "Jikan · MyAnimeList", desc: "Sagas canónicas y ranking", badge: "MAL" },
                        { value: "tmdb", label: "TMDB", desc: "The Movie Database", badge: "TMDB" },
                    ]}
                    value="anilist"
                    onChange={() => {}}
                />
                <OsSelect
                    label="Idioma Predeterminado de Metadatos"
                    description="Idioma para sinopsis, títulos de episodios y afiches oficiales."
                    icon={IconUiTag}
                    options={[
                        { value: "es-MX", label: "Español Latino", desc: "Sinopsis y títulos doblados", badge: "ES-MX" },
                        { value: "es-ES", label: "Español España", desc: "Castellano peninsular", badge: "ES-ES" },
                        { value: "en-US", label: "Inglés", desc: "Títulos originales", badge: "EN-US" },
                        { value: "ja-JP", label: "Japonés", desc: "Kanji + romaji oficial", badge: "JA-JP" },
                    ]}
                    value="es-MX"
                    onChange={() => {}}
                />
            </SectionBar>

            {/* ═══════════════════════════════════════════════════════════════════
                3. INSPECTOR EN VIVO
               ═══════════════════════════════════════════════════════════════════ */}
            <SectionBar
                id="live-scanner-inspector"
                label="Inspector de Escaneo en Vivo"
                description="Diagnóstico y métricas en tiempo real de la indexación de sagas Dragon Ball."
                icon={IconStatusZap}
                badge={
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-brand-accent/10 text-brand-accent border border-brand-accent/25">
                        Radar Activo
                    </span>
                }
                collapsible
                defaultOpen={false}
            >
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-center">
                    <IconUiSpinner className="w-4 h-4 animate-spin text-brand-accent" />
                    <span className="text-xs text-on-surface-variant">Cargando escaneo en vivo...</span>
                </div>
            </SectionBar>

        </div>
    )
})
