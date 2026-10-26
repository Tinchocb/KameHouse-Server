import { errorText } from "@/api/client/error-messages"
import React, { useState } from "react"
import { type Control, Controller, useFormContext, useWatch } from "react-hook-form"
import { type SettingsFormValues } from "../index"
import { PathList, OsToggle, OsSelect } from "../components"
import { SectionBar } from "@/components/ui/sectionbar"
import { IconStatusFolder, IconNavigationTv, IconNavigationFilm, IconStatusRadar, IconStatusZap, IconUiSpinner, IconStatusDatabase, IconUiTag, IconNavigationLayers } from "@/components/ui/icons";
import { toast } from "sonner"
import { buildApiQuery } from "@/api/client/requests"
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
            await buildApiQuery({
                endpoint: API_ENDPOINTS.SETTINGS.SaveSettings.endpoint,
                method: API_ENDPOINTS.SETTINGS.SaveSettings.methods[0] as "PATCH",
                data: { library: patch },
            })
            await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.SETTINGS.GetSettings.key] })
        } catch (err) {
            revert()
            toast.error(errorText(err, "No se pudo aplicar el cambio"))
            throw err
        }
    }

    type LibraryBoolField =
        | "library.autoScan"
        | "library.unifiedScan"
        | "library.refreshLibraryOnStart"
        | "library.scannerStrictStructure"
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
                variant="content"
                id="library-scanner"
                label="Escáner de la biblioteca"
                description="Escanea el disco local y Google Drive, sigue el progreso en vivo y revisa qué falta del catálogo."
                icon={IconStatusZap}
                collapsible
                defaultOpen={true}
            >
                <React.Suspense
                    fallback={
                        <div className="p-4 rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] flex items-center justify-center gap-2">
                            <IconUiSpinner className="w-4 h-4 animate-spin text-brand-accent" />
                            <span className="text-xs text-on-surface-variant">Cargando el escáner…</span>
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
                variant="content"
                id="library-sources"
                label="Orígenes"
                description="Elige de dónde se reproduce tu biblioteca. Cada serie puede fijar su propio origen desde su ficha."
                icon={IconNavigationLayers}
                collapsible
                defaultOpen={true}
                badge={localDisconnected && cloudPaused ? (
                    <span className="text-3xs px-2 py-0.5 rounded-full bg-status-warning/10 text-status-warning border border-status-warning/25">
                        Sin orígenes
                    </span>
                ) : undefined}
            >
                <Controller
                    control={control}
                    name="library.disableLocalScanning"
                    render={({ field }) => (
                        <OsToggle
                            label="Usar el disco local"
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
                variant="content"
                id="media-directories"
                label="Disco local"
                description="Carpetas de tu PC donde están tus series, anime y películas."
                icon={IconStatusFolder}
                collapsible
                defaultOpen={true}
                badge={localDisconnected ? (
                    <span className="text-3xs px-2 py-0.5 rounded-full bg-status-warning/10 text-status-warning border border-status-warning/25">
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
                                label="Series y anime"
                                icon={IconNavigationTv}
                                directories={field.value || []}
                                showFullPath={showFullPath}
                                onAdd={(newPath) => {
                                    const trimmed = newPath.trim()
                                    if (!trimmed || trimmed === ".") return
                                    if (trimmed.includes(",")) {
                                        toast.error("No se admiten rutas con comas")
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
                                label="Películas y OVAs"
                                icon={IconNavigationFilm}
                                directories={field.value || []}
                                showFullPath={showFullPath}
                                onAdd={(newPath) => {
                                    const trimmed = newPath.trim()
                                    if (!trimmed || trimmed === ".") return
                                    if (trimmed.includes(",")) {
                                        toast.error("No se admiten rutas con comas")
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

                <div className="pt-2 border-t border-[var(--neutral-separator)]">
                    <div className="flex items-center gap-2 px-1 pb-1">
                        <span className="text-3xs px-2 py-0.5 rounded bg-[var(--neutral-elev-3)] text-on-surface-variant border border-[var(--neutral-separator)]">
                            Local
                        </span>
                        <span className="text-3xs text-label-2">Preferencia de vista, no se sincroniza</span>
                    </div>
                    <OsToggle
                        label="Mostrar ruta completa en la lista"
                        description="Muestra la ruta entera de cada carpeta en vez de solo su nombre."
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
                    <div className="p-4 rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] flex items-center justify-center gap-2">
                        <IconUiSpinner className="w-4 h-4 animate-spin text-brand-accent" />
                        <span className="text-xs text-on-surface-variant">Cargando Google Drive…</span>
                    </div>
                }
            >
                <GoogleDriveCard />
            </React.Suspense>

            {/* ═══════════════════════════════════════════════════════════════════
                5. ESCANEO AUTOMÁTICO (cuándo se actualiza la biblioteca)
               ═══════════════════════════════════════════════════════════════════ */}
            <SectionBar
                variant="content"
                id="scanner-automation"
                label="Escaneo automático"
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
                            label="Escanear al detectar cambios"
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
                                <span className="text-3xs px-2 py-0.5 rounded bg-[var(--neutral-elev-3)] text-on-surface-variant border border-[var(--neutral-separator)]">
                                    Próximo inicio
                                </span>
                            </div>
                            <OsToggle
                                label="Escanear al iniciar KameHouse"
                                description="Hace una revisión rápida al iniciar KameHouse. Se aplica desde el próximo inicio."
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
                            label="Escaneo unificado"
                            description="Escanea series y películas juntas, siempre de forma completa. No hace escaneos parciales por carpeta cuando cambia el disco."
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
                variant="content"
                id="scanner-identification"
                label="Identificación y metadatos"
                description="Cómo se reconocen los archivos y de dónde salen títulos, sinopsis y pósters."
                icon={IconStatusDatabase}
                collapsible
                defaultOpen={true}
            >
                <Controller
                    control={control}
                    name="library.scannerProvider"
                    render={({ field }) => (
                        <OsSelect
                            label="Proveedor de metadatos"
                            description="Fuente principal para identificar series, películas y episodios."
                            icon={IconStatusDatabase}
                            options={[
                                { value: "anilist", label: "AniList", desc: "Banners HD y arte oficial", badge: "Recomendado" },
                                { value: "jikan", label: "Jikan · MyAnimeList", desc: "Sagas canónicas y ranking", badge: "MAL" },
                                { value: "tmdb", label: "TMDB", desc: "The Movie Database", badge: "TMDB" },
                            ]}
                            value={field.value || "anilist"}
                            onChange={(val) => {
                                const prev = field.value
                                setValue("library.scannerProvider", val, { shouldDirty: false, shouldValidate: true })
                                void patchLibraryNow({ scannerProvider: val }, () =>
                                    setValue("library.scannerProvider", prev, { shouldDirty: false })
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
                            label="Idioma de los metadatos"
                            description="Idioma de sinopsis, títulos de episodios y pósters. Al cambiarlo se borra la caché de metadatos y se vuelve a descargar en el próximo escaneo."
                            icon={IconUiTag}
                            options={[
                                { value: "es-MX", label: "Español latino", desc: "Sinopsis y títulos doblados", badge: "ES-MX" },
                                { value: "es-ES", label: "Español de España", desc: "Castellano peninsular", badge: "ES-ES" },
                                { value: "en-US", label: "Inglés", desc: "Títulos originales", badge: "EN-US" },
                                { value: "ja-JP", label: "Japonés", desc: "Kanji y romaji oficiales", badge: "JA-JP" },
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
                                            await buildApiQuery({
                                                endpoint: API_ENDPOINTS.METADATA.ClearMetadataCache.endpoint,
                                                method: API_ENDPOINTS.METADATA.ClearMetadataCache.methods[0] as "DELETE",
                                            })
                                            toast.success("Se borró la caché de metadatos para el nuevo idioma")
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
                            label="Estructura estricta de carpetas"
                            description="Solo reconoce archivos que estén en carpetas Serie, Temporada y Episodio."
                            checked={Boolean(field.value)}
                            onChange={(v) => applyLibraryToggle("library.scannerStrictStructure", v)}
                        />
                    )}
                />
            </SectionBar>

            {/* ═══════════════════════════════════════════════════════════════════
                7. MATCH MANUAL (archivos sin vincular)
               ═══════════════════════════════════════════════════════════════════ */}
            <React.Suspense
                fallback={
                    <div className="p-4 rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] flex items-center justify-center gap-2">
                        <IconUiSpinner className="w-4 h-4 animate-spin text-brand-accent" />
                        <span className="text-xs text-on-surface-variant">Cargando la coincidencia manual…</span>
                    </div>
                }
            >
                <TmdbMatchManual />
            </React.Suspense>

        </div>
    )
})
