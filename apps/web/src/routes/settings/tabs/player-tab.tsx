import React from "react"
import { TabsContent } from "@/components/ui/tabs/tabs"
import { Section, Card, OsToggle, OsInput, OsSelect } from "../components"
import { type Control, Controller, type UseFormRegister } from "react-hook-form"
import { type SettingsFormValues } from "../index"

interface PlayerTabProps {
    control: Control<SettingsFormValues>
    register: UseFormRegister<SettingsFormValues>
}

export function PlayerTab({ control, register }: PlayerTabProps) {
    return (
        <TabsContent value="player" className="m-0 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
            {/* Header */}
            <header className="space-y-3 pt-2">
                <div className="flex items-center gap-3 mb-1">
                    <div className="flex items-center justify-center p-1 rounded bg-cyan-500/10 border border-cyan-500/15">
                        <svg className="h-3.5 w-3.5 text-cyan-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="6 3 20 12 6 21 6 3" />
                        </svg>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.35em] text-zinc-600 font-mono">REPRODUCCIÓN · MULTIMEDIA</span>
                </div>
                <h1 className="text-5xl font-bebas tracking-wider text-white leading-none">
                    CONFIGURACIÓN DE <span className="text-zinc-600">REPRODUCCIÓN</span>
                </h1>
                <div className="h-[2px] w-12 bg-gradient-to-r from-cyan-500/50 to-transparent rounded-full" />
                <p className="text-zinc-500 text-sm font-medium leading-relaxed max-w-2xl">
                    Administra los reproductores locales externos y configura los parámetros de integración automática e inteligencia artificial.
                </p>
            </header>

            {/* 1. Selector de Reproductor */}
            <Section label="Reproductor por Defecto">
                <Card>
                    <OsSelect
                        label="Reproductor Predeterminado"
                        description="Selecciona el reproductor de video externo que se abrirá al iniciar un streaming."
                        options={[
                            { value: "MPV", label: "MPV Media Player" },
                            { value: "VLC", label: "VLC Media Player" },
                            { value: "IINA", label: "IINA (macOS)" },
                            { value: "MPC-HC", label: "Media Player Classic (MPC-HC)" }
                        ]}
                        {...register("mediaPlayer.defaultPlayer")}
                    />
                </Card>
            </Section>

            {/* 2. Control IPC y Puertos */}
            <Section label="Control IPC & Puertos">
                <Card className="divide-y divide-white/[0.03]">
                    <OsInput
                        label="Puerto de Control VLC"
                        description="Puerto de control HTTP para comunicarse con VLC Player."
                        type="number"
                        placeholder="Ej. 8080"
                        {...register("mediaPlayer.vlcPort", { valueAsNumber: true })}
                    />
                    <OsInput
                        label="Puerto de Control MPC-HC"
                        description="Puerto de la API Web interna para controlar MPC-HC."
                        type="number"
                        placeholder="Ej. 13579"
                        {...register("mediaPlayer.mpcPort", { valueAsNumber: true })}
                    />
                    <OsInput
                        label="Socket IPC MPV"
                        description="Ruta del socket IPC UNIX o pipe de Windows para interactuar con MPV."
                        placeholder="Ej. mpv-ipc"
                        isMono
                        {...register("mediaPlayer.mpvSocket")}
                    />
                    <OsInput
                        label="Socket IPC IINA"
                        description="Socket local para el envío de comandos al reproductor IINA."
                        placeholder="Ej. iina-ipc"
                        isMono
                        {...register("mediaPlayer.iinaSocket")}
                    />
                </Card>
            </Section>

            {/* 3. Traducción IA & Red */}
            <Section label="Traducción IA & Conectividad">
                <Card className="divide-y divide-white/[0.03]">
                    <Controller
                        control={control}
                        name="mediaPlayer.vcTranslate"
                        render={({ field }) => (
                            <OsToggle
                                label="Traducción por IA"
                                description="Habilita la traducción automatizada mediante servicios cognitivos de inteligencia artificial."
                                checked={!!field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="library.openWebURLOnStart" // Reutilizamos un campo existente como socket de red asíncrono para mantener consistencia de tipos
                        render={({ field }) => (
                            <OsToggle
                                label="Sockets de Red Asíncronos"
                                description="Mejora el rendimiento de la comunicación IPC utilizando sockets no bloqueantes."
                                checked={!!field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                </Card>
            </Section>
        </TabsContent>
    )
}
