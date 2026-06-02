import React from "react"
import { TabsContent } from "@/components/ui/tabs/tabs"
import { Section, Card, PathList, OsToggle } from "../components"
import { type Control, Controller } from "react-hook-form"
import { type SettingsFormValues } from "../index"

interface LibraryTabProps {
    control: Control<SettingsFormValues>
}

export function LibraryTab({ control }: LibraryTabProps) {
    return (
        <TabsContent value="library" className="m-0 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
            {/* Header */}
            <header className="space-y-3 pt-2">
                <div className="flex items-center gap-3 mb-1">
                    <div className="flex items-center justify-center p-1 rounded bg-cyan-500/10 border border-cyan-500/15">
                        <svg className="h-3.5 w-3.5 text-cyan-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.35em] text-zinc-600 font-mono">ALMACENAMIENTO · INDEXACIÓN</span>
                </div>
                <h1 className="text-5xl font-bebas tracking-wider text-white leading-none">
                    AJUSTES DE <span className="text-zinc-600">BIBLIOTECA</span>
                </h1>
                <div className="h-[2px] w-12 bg-gradient-to-r from-cyan-500/50 to-transparent rounded-full" />
                <p className="text-zinc-500 text-sm font-medium leading-relaxed max-w-2xl">
                    Define los directorios de almacenamiento para tu colección multimedia y administra las preferencias de sincronización offline.
                </p>
            </header>

            {/* 1. Directorios de Almacenamiento */}
            <Section label="Directorios locales">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <Card>
                        <Controller
                            control={control}
                            name="library.seriesPaths"
                            render={({ field }) => (
                                <PathList
                                    label="Directorio de Series / Anime"
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
                                    placeholder="Ej. D:\Media\Anime o /media/anime"
                                />
                            )}
                        />
                    </Card>

                    <Card>
                        <Controller
                            control={control}
                            name="library.moviePaths"
                            render={({ field }) => (
                                <PathList
                                    label="Directorio de Películas"
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
                                    placeholder="Ej. D:\Media\Peliculas o /media/movies"
                                />
                            )}
                        />
                    </Card>
                </div>
            </Section>

            {/* 2. Sincronización & Trailers */}
            <Section label="Preferencia & Sincronización">
                <Card className="divide-y divide-white/[0.03]">
                    <Controller
                        control={control}
                        name="library.autoSyncOfflineLocalData"
                        render={({ field }) => (
                            <OsToggle
                                label="Sincronización Offline"
                                description="Sincroniza y guarda localmente tus datos de visualización y progreso para su uso sin conexión."
                                checked={!!field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="library.disableAnimeCardTrailers"
                        render={({ field }) => {
                            // Invertimos el comportamiento para que sea "Activar descarga automatizada" o dejamos la opción nativa de desactivación
                            return (
                                <OsToggle
                                    label="Descarga Automatizada de Trailers"
                                    description="Descarga y reproduce automáticamente vistas previas de anime en las portadas."
                                    checked={!field.value}
                                    onChange={(v) => field.onChange(!v)}
                                />
                            )
                        }}
                    />
                </Card>
            </Section>
        </TabsContent>
    )
}
