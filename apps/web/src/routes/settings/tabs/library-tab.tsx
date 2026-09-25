import React, { useState } from "react"
import { type Control, Controller, useFormContext, useWatch } from "react-hook-form"
import { type SettingsFormValues } from "../index"
import { PathList, OsToggle, OsSelect } from "../components"
import { SectionBar } from "@/components/ui/sectionbar"
import { IconStatusFolder, IconNavigationTv, IconNavigationFilm, IconStatusRadar, IconStatusZap, IconUiSpinner, IconStatusDatabase, IconUiTag, IconNavigationLayers } from "@/components/ui/icons";
import { toast } from "sonner"
import { buildSeaQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { useQueryClient } from "@tanstack/react-query"
import { useScanLocalFiles } from "@/api/hooks/scan.hooks"


const DragonBallScannerLive = React.lazy(() =>
    import("../components/-dragonball-scanner-live").then(m => ({ default: m.DragonBallScannerLive }))
)

const TmdbMatchManual = React.lazy(() =>
    import("../components/-tmdb-match-manual").then(m => ({ default: m.TmdbMatchManual }))
)

const GoogleDriveCard = React.lazy(() =>
    import("../components/-google-drive-card").then(m => ({ default: m.GoogleDriveCard }))
)

interface LibraryTabProps {
    control: Control<SettingsFormValues>
}

export const LibraryTab = React.memo(function LibraryTab({ control }: LibraryTabProps) {
    const { setValue, getValues } = useFormContext<SettingsFormValues>()
    const queryClient = useQueryClient()
    const { mutate: scanLibrary } = useScanLocalFiles()
    const [showFullPath, setShowFullPath] = useState<boolean>(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("kamehouse-library-show-full-path") !== "false"
        }
        return true
    })

    const handleToggleFullPath = (checked: boolean) => {
        setShowFullPath(checked)
        if (typeof window !== "undefined") {
            localStorage.setItem("kamehouse-library-show-full-path", String(checked))
        }
    }

    /**
     * Aplica un cambio de Biblioteca al instante: PATCH parcial (el backend
     * hace merge y recarga watcher/scanner/TMDB en vivo) sin marcar dirty,
     * así no requiere Guardar global. Revierte el form si el PATCH falla.
     */
    const patchLibraryNow = async (patch: Record<string, unknown>, revert: () => void) => {
        try {
            await buildSeaQuery({
                endpoint: API_ENDPOINTS.SETTINGS.SaveSettings.endpoint,
                method: API_ENDPOINTS.SETTINGS.SaveSettings.methods[0] as "PATCH",
                data: { library: patch },
            })
            await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.SETTINGS.GetSettings.key] })
        } catch (err) {
            revert()
            toast.error(err instanceof Error ? err.message : "No se pudo aplicar el cambio")
            throw err
        }
    }

    type LibraryBoolField =
        | "library.autoScan"
        | "library.unifiedScan"
        | "library.refreshLibraryOnStart"
        | "library.scannerStrictStructure"
        | "library.scannerUseLegacyMatching"
        | "library.disableLocalScanning"
        | "library.disableCloudSource"

    const applyLibraryToggle = (name: LibraryBoolField, value: boolean) => {
        const prev = getValues(name)
        setValue(name, value, { shouldDirty: false, shouldValidate: true })
        void patchLibraryNow({ [name.replace("library.", "")]: value }, () =>
            setValue(name, prev, { shouldDirty: false })
        ).then(() => {
            // Apagar un origen cambia qué archivos devuelve la biblioteca.
            if (name !== "library.disableLocalScanning" && name !== "library.disableCloudSource") return
            void queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key] })
            void queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key] })
            void queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.MEDIA_SOURCE.GetAnimeEntrySource.key] })
        }, () => {})
    }

    const localDisconnected = Boolean(useWatch({ control, name: "library.disableLocalScanning" }))
    const cloudPaused = Boolean(useWatch({ control, name: "library.disableCloudSource" }))

    const triggerLibraryScan = () => {
        scanLibrary({ mode: "fast", skipLockedFiles: false, skipIgnoredFiles: false })
    }

    return (
        <div className="w-full space-y-7 animate-in fade-in duration-base pb-8">

            {/* ═══════════════════════════════════════════════════════════════════
                1. ESCÁNER DE BIBLIOTECA (estado, archivos escaneados y colección)
               ═══════════════════════════════════════════════════════════════════ */}
            <SectionBar
                id="library-scanner"
                label="Escáner de Biblioteca"
                description="Escanea el disco local y Google Drive, sigue el progreso en vivo y revisa qué falta del catálogo."
                icon={IconStatusZap}
                collapsible
                defaultOpen={true}
            >
                <React.Suspense
                    fallback={
                        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-center gap-2">
                            <IconUiSpinner className="w-4 h-4 animate-spin text-brand-accent" />
                            <span className="text-xs text-on-surface-variant">Cargando escáner...</span>
                        </div>
                    }
                >
                    <DragonBallScannerLive />
                </React.Suspense>
            </SectionBar>

            {/* ═══════════════════════════════════════════════════════════════════
                2. ORÍGENES (de dónde se reproduce: disco local y/o Google Drive)
               ═══════════════════════════════════════════════════════════════════ */}
            <SectionBar
                id="library-sources"
                label="Orígenes"
                description="Elegí de dónde se reproduce tu biblioteca. Cada serie puede fijar su propio origen desde su página."
                icon={IconNavigationLayers}
                collapsible
                defaultOpen={true}
                badge={localDisconnected && cloudPaused ? (
                    <span className="text-3xs font-mono px-2 py-0.5 rounded-full bg-status-warning/10 text-status-warning border border-status-warning/25">
                        Sin orígenes
                    </span>
                ) : undefined}
            >
                <Controller
                    control={control}
                    name="library.disableLocalScanning"
                    render={({ field }) => (
                        <OsToggle
                            label="Usar Disco Local"
                            description="Al apagarlo no se escanea ni se vigila el disco y los archivos locales se ocultan de la biblioteca. No se borran: vuelven al encenderlo."
                            checked={!field.value}
                            onChange={(v) => applyLibraryToggle("library.disableLocalScanning", !v)}
                        />
                    )}
                />
                <Controller
                    control={control}
                    name="library.disableCloudSource"
                    render={({ field }) => (
                        <OsToggle
                            label="Usar Google Drive"
                            description="Al apagarlo los archivos de Drive se ocultan de la biblioteca sin desconectar la cuenta. Vuelven al encenderlo."
                            checked={!field.value}
                            onChange={(v) => applyLibraryToggle("library.disableCloudSource", !v)}
                        />
                    )}
                />
                {localDisconnected && cloudPaused && (
                    <p className="px-1 text-xs text-status-warning">
                        Con los dos orígenes apagados la biblioteca queda vacía.
                    </p>
                )}
            </SectionBar>

            {/* ═══════════════════════════════════════════════════════════════════
                3. DISCO LOCAL (carpetas)
               ═══════════════════════════════════════════════════════════════════ */}
            <SectionBar
                id="media-directories"
                label="Disco Local"
                description="Carpetas de tu PC donde están tus series, anime y películas."
                icon={IconStatusFolder}
                collapsible
                defaultOpen={true}
                badge={localDisconnected ? (
                    <span className="text-3xs font-mono px-2 py-0.5 rounded-full bg-status-warning/10 text-status-warning border border-status-warning/25">
                        Desconectado
                    </span>
                ) : undefined}
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
                                showFullPath={showFullPath}
                                onAdd={(newPath) => {
                                    const trimmed = newPath.trim()
                                    if (!trimmed || trimmed === ".") return
                                    if (trimmed.includes(",")) {
                                        toast.error("Las rutas con comas no están soportadas")
                                        return
                                    }
                                    const current = field.value || []
                                    const other = getValues("library.moviePaths") || []
                                    const norm = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase()
                                    if ([...current, ...other].some((p) => norm(p) === norm(trimmed))) {
                                        toast.error("Esa ruta ya está en la biblioteca")
                                        return
                                    }
                                    if (!current.includes(trimmed)) {
                                        const next = [...current, trimmed]
                                        setValue("library.seriesPaths", next, { shouldDirty: false, shouldValidate: true })
                                        void patchLibraryNow({ seriesPaths: next }, () =>
                                            setValue("library.seriesPaths", current, { shouldDirty: false })
                                        ).then(() => triggerLibraryScan()).catch(() => {})
                                    }
                                }}
                                onRemove={(removedPath) => {
                                    const current = field.value || []
                                    const next = current.filter((p) => p !== removedPath)
                                    setValue("library.seriesPaths", next, { shouldDirty: false, shouldValidate: true })
                                    void patchLibraryNow({ seriesPaths: next }, () =>
                                        setValue("library.seriesPaths", current, { shouldDirty: false })
                                    ).then(() => triggerLibraryScan()).catch(() => {})
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
                                showFullPath={showFullPath}
                                onAdd={(newPath) => {
                                    const trimmed = newPath.trim()
                                    if (!trimmed || trimmed === ".") return
                                    if (trimmed.includes(",")) {
                                        toast.error("Las rutas con comas no están soportadas")
                                        return
                                    }
                                    const current = field.value || []
                                    const other = getValues("library.seriesPaths") || []
                                    const norm = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase()
                                    if ([...current, ...other].some((p) => norm(p) === norm(trimmed))) {
                                        toast.error("Esa ruta ya está en la biblioteca")
                                        return
                                    }
                                    if (!current.includes(trimmed)) {
                                        const next = [...current, trimmed]
                                        setValue("library.moviePaths", next, { shouldDirty: false, shouldValidate: true })
                                        void patchLibraryNow({ moviePaths: next }, () =>
                                            setValue("library.moviePaths", current, { shouldDirty: false })
                                        ).then(() => triggerLibraryScan()).catch(() => {})
                                    }
                                }}
                                onRemove={(removedPath) => {
                                    const current = field.value || []
                                    const next = current.filter((p) => p !== removedPath)
                                    setValue("library.moviePaths", next, { shouldDirty: false, shouldValidate: true })
                                    void patchLibraryNow({ moviePaths: next }, () =>
                                        setValue("library.moviePaths", current, { shouldDirty: false })
                                    ).then(() => triggerLibraryScan()).catch(() => {})
                                }}
                                placeholder="Ej. D:\Media\Movies"
                            />
                        )}
                    />
                </div>

                <div className="pt-2 border-t border-white/[0.05]">
                    <div className="flex items-center gap-2 px-1 pb-1">
                        <span className="text-3xs font-mono px-2 py-0.5 rounded bg-white/5 text-on-surface-variant border border-white/10">
                            Local
                        </span>
                        <span className="text-3xs text-on-surface-variant/70">Preferencia de vista, no se sincroniza</span>
                    </div>
                    <OsToggle
                        label="Mostrar ruta completa en la lista"
                        description="Muestra la ruta completa de cada directorio en lugar del nombre solo."
                        checked={showFullPath}
                        onChange={handleToggleFullPath}
                    />
                </div>
            </SectionBar>

            {/* ═══════════════════════════════════════════════════════════════════
                4. GOOGLE DRIVE
               ═══════════════════════════════════════════════════════════════════ */}
            <React.Suspense
                fallback={
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-center gap-2">
                        <IconUiSpinner className="w-4 h-4 animate-spin text-brand-accent" />
                        <span className="text-xs text-on-surface-variant">Cargando Google Drive...</span>
                    </div>
                }
            >
                <GoogleDriveCard />
            </React.Suspense>

            {/* ═══════════════════════════════════════════════════════════════════
                5. ESCANEO AUTOMÁTICO (cuándo se actualiza la biblioteca)
               ═══════════════════════════════════════════════════════════════════ */}
            <SectionBar
                id="scanner-automation"
                label="Escaneo Automático"
                description="Cuándo se actualiza la biblioteca sin que toques Escanear."
                icon={IconStatusRadar}
                collapsible
                defaultOpen={true}
            >
                <Controller
                    control={control}
                    name="library.autoScan"
                    render={({ field }) => (
                        <OsToggle
                            label="Escaneo Automático por Cambios"
                            description="Detecta archivos añadidos o borrados en tiempo real y actualiza la biblioteca."
                            checked={!!field.value}
                            onChange={(v) => applyLibraryToggle("library.autoScan", v)}
                        />
                    )}
                />
                <Controller
                    control={control}
                    name="library.refreshLibraryOnStart"
                    render={({ field }) => (
                        <div>
                            <div className="flex items-center gap-2 px-1 pb-1">
                                <span className="text-3xs font-mono px-2 py-0.5 rounded bg-white/5 text-on-surface-variant border border-white/10">
                                    Próximo arranque
                                </span>
                            </div>
                            <OsToggle
                                label="Escanear al Arrancar el Servidor"
                                description="Realiza una pasada de verificación rápida al encender KameHouse. Se aplica al próximo arranque."
                                checked={!!field.value}
                                onChange={(v) => applyLibraryToggle("library.refreshLibraryOnStart", v)}
                            />
                        </div>
                    )}
                />
                <Controller
                    control={control}
                    name="library.unifiedScan"
                    render={({ field }) => (
                        <OsToggle
                            label="Modo de Escaneo Unificado"
                            description="Junta Series y Películas en una sola pasada completa. Ignora escaneos parciales por carpeta ante cambios en disco."
                            checked={!!field.value}
                            onChange={(v) => applyLibraryToggle("library.unifiedScan", v)}
                        />
                    )}
                />
            </SectionBar>

            {/* ═══════════════════════════════════════════════════════════════════
                6. IDENTIFICACIÓN Y METADATOS (cómo se reconocen los archivos)
               ═══════════════════════════════════════════════════════════════════ */}
            <SectionBar
                id="scanner-identification"
                label="Identificación y Metadatos"
                description="Cómo se reconocen los archivos y de dónde salen títulos, sinopsis y afiches."
                icon={IconStatusDatabase}
                collapsible
                defaultOpen={true}
            >
                <Controller
                    control={control}
                    name="library.primaryMetadataProvider"
                    render={({ field }) => (
                        <OsSelect
                            label="Proveedor de Metadatos y Escaneo"
                            description="Base de datos prioritaria para indexar series, películas y episodios."
                            icon={IconStatusDatabase}
                            options={[
                                { value: "anilist", label: "AniList", desc: "Banners HD y arte oficial", badge: "RECOMENDADO" },
                                { value: "jikan", label: "Jikan · MyAnimeList", desc: "Sagas canónicas y ranking", badge: "MAL" },
                                { value: "tmdb", label: "TMDB", desc: "The Movie Database", badge: "TMDB" },
                            ]}
                            value={field.value || "anilist"}
                            onChange={(val) => {
                                const prevPrimary = field.value
                                const prevScanner = getValues("library.scannerProvider")
                                setValue("library.primaryMetadataProvider", val, { shouldDirty: false, shouldValidate: true })
                                setValue("library.scannerProvider", val, { shouldDirty: false, shouldValidate: true })
                                void patchLibraryNow(
                                    { primaryMetadataProvider: val, scannerProvider: val },
                                    () => {
                                        setValue("library.primaryMetadataProvider", prevPrimary, { shouldDirty: false })
                                        setValue("library.scannerProvider", prevScanner, { shouldDirty: false })
                                    }
                                ).then(() => toast.success("Proveedor aplicado")).catch(() => {})
                            }}
                        />
                    )}
                />
                <Controller
                    control={control}
                    name="library.tmdbLanguage"
                    render={({ field }) => (
                        <OsSelect
                            label="Idioma Predeterminado de Metadatos"
                            description="Idioma para sinopsis, títulos de episodios y afiches oficiales. Cambiarlo purga la caché para re-fetch en el próximo escaneo."
                            icon={IconUiTag}
                            options={[
                                { value: "es-MX", label: "Español Latino", desc: "Sinopsis y títulos doblados", badge: "ES-MX" },
                                { value: "es-ES", label: "Español España", desc: "Castellano peninsular", badge: "ES-ES" },
                                { value: "en-US", label: "Inglés", desc: "Títulos originales", badge: "EN-US" },
                                { value: "ja-JP", label: "Japonés", desc: "Kanji + romaji oficial", badge: "JA-JP" },
                            ]}
                            value={field.value || "es-MX"}
                            onChange={(val) => {
                                const prev = field.value
                                setValue("library.tmdbLanguage", val, { shouldDirty: false, shouldValidate: true })
                                void (async () => {
                                    // Purga ANTES del patch: si el PATCH ganara la
                                    // carrera, el escáner re-fetchearía con caché vieja.
                                    if (prev && prev !== val) {
                                        try {
                                            await buildSeaQuery({
                                                endpoint: API_ENDPOINTS.METADATA.ClearMetadataCache.endpoint,
                                                method: API_ENDPOINTS.METADATA.ClearMetadataCache.methods[0] as "DELETE",
                                            })
                                            toast.success("Caché de metadatos purgada para el nuevo idioma")
                                        } catch {}
                                    }
                                    await patchLibraryNow({ tmdbLanguage: val }, () =>
                                        setValue("library.tmdbLanguage", prev, { shouldDirty: false })
                                    ).catch(() => {})
                                })()
                            }}
                        />
                    )}
                />
                <Controller
                    control={control}
                    name="library.scannerStrictStructure"
                    render={({ field }) => (
                        <OsToggle
                            label="Estructura Estricta de Carpetas"
                            description="Exige que las carpetas sigan estrictamente la jerarquía Serie/Temporada/Episodio para indexar."
                            checked={Boolean(field.value)}
                            onChange={(v) => applyLibraryToggle("library.scannerStrictStructure", v)}
                        />
                    )}
                />
                <Controller
                    control={control}
                    name="library.scannerUseLegacyMatching"
                    render={({ field }) => (
                        <OsToggle
                            label="Coincidencia Clásica (Legacy)"
                            description="Utiliza el algoritmo de coincidencia por similitud de texto histórico en lugar del parser moderno."
                            checked={Boolean(field.value)}
                            onChange={(v) => applyLibraryToggle("library.scannerUseLegacyMatching", v)}
                        />
                    )}
                />
            </SectionBar>

            {/* ═══════════════════════════════════════════════════════════════════
                7. MATCH MANUAL (archivos sin vincular)
               ═══════════════════════════════════════════════════════════════════ */}
            <React.Suspense
                fallback={
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-center gap-2">
                        <IconUiSpinner className="w-4 h-4 animate-spin text-brand-accent" />
                        <span className="text-xs text-on-surface-variant">Cargando match manual...</span>
                    </div>
                }
            >
                <TmdbMatchManual />
            </React.Suspense>

        </div>
    )
})
