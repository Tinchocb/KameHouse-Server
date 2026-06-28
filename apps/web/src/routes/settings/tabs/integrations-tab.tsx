import React from "react"
import { GlassCard } from "@/components/ui"
import { Section, Card, OsToggle } from "../components"
import { type Control, Controller, useWatch } from "react-hook-form"
import { type SettingsFormValues } from "../index"

interface IntegrationsTabProps {
    control: Control<SettingsFormValues>
}

export function IntegrationsTab({ control }: IntegrationsTabProps) {
    const tmdbApiKey = useWatch({ control, name: "library.tmdbApiKey" })
    const fanartApiKey = useWatch({ control, name: "library.fanartApiKey" })
    const omdbApiKey = useWatch({ control, name: "library.omdbApiKey" })

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
            {/* Bento grids for integrations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* TMDB API Key */}
                <GlassCard variant="elevated" padding="lg" radius="2xl" className="space-y-4">
                    <div className="flex items-center justify-between border-b border-[var(--glass-border)] pb-2">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-2">
                            The Movie Database (TMDB)
                        </h4>
                        {tmdbApiKey ? (
                            <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-0.5 rounded-full">
                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest font-mono">Conectado</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 bg-[var(--bg-quaternary)]/60 border border-[var(--glass-border)] px-2.5 py-0.5 rounded-full">
                                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest font-mono">Sin configurar</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                            </div>
                        )}
                    </div>
                    <Controller
                        control={control}
                        name="library.tmdbApiKey"
                        render={({ field }) => (
                            <div className="flex flex-col gap-2">
                                <label htmlFor="tmdb-api-key" className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Clave de la API (V4 Auth Token)</label>
                                <input
                                    id="tmdb-api-key"
                                    type="password"
                                    value={field.value || ""}
                                    onChange={field.onChange}
                                    placeholder="Ingresa tu TMDB Auth Token"
                                    className="w-full bg-[var(--bg-quaternary)]/60 border border-[var(--glass-strong)] rounded-xl px-4 py-2.5 text-xs text-zinc-300 font-mono focus:outline-none focus:border-[#ff6e3a]/50 focus:shadow-[0_0_20px_rgba(255,110,58,0.12)] transition-all"
                                />
                            </div>
                        )}
                    />
                </GlassCard>

                {/* Fanart.tv API Key */}
                <GlassCard variant="elevated" padding="lg" radius="2xl" className="space-y-4">
                    <div className="flex items-center justify-between border-b border-[var(--glass-border)] pb-2">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-2">
                            Fanart.tv
                        </h4>
                        {fanartApiKey ? (
                            <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-0.5 rounded-full">
                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest font-mono">Conectado</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 bg-[var(--bg-quaternary)]/60 border border-[var(--glass-border)] px-2.5 py-0.5 rounded-full">
                                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest font-mono">Sin configurar</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                            </div>
                        )}
                    </div>
                    <Controller
                        control={control}
                        name="library.fanartApiKey"
                        render={({ field }) => (
                            <div className="flex flex-col gap-2">
                                <label htmlFor="fanart-api-key" className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Clave de la API (API Key)</label>
                                <input
                                    id="fanart-api-key"
                                    type="password"
                                    value={field.value || ""}
                                    onChange={field.onChange}
                                    placeholder="Ingresa tu Fanart.tv API Key"
                                    className="w-full bg-[var(--bg-quaternary)]/60 border border-[var(--glass-strong)] rounded-xl px-4 py-2.5 text-xs text-zinc-300 font-mono focus:outline-none focus:border-[#ff6e3a]/50 focus:shadow-[0_0_20px_rgba(255,110,58,0.12)] transition-all"
                                />
                            </div>
                        )}
                    />
                </GlassCard>

                {/* OMDb API Key */}
                <GlassCard variant="elevated" padding="lg" radius="2xl" className="space-y-4">
                    <div className="flex items-center justify-between border-b border-[var(--glass-border)] pb-2">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-2">
                            OMDb Service
                        </h4>
                        {omdbApiKey ? (
                            <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-0.5 rounded-full">
                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest font-mono">Conectado</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 bg-[var(--bg-quaternary)]/60 border border-[var(--glass-border)] px-2.5 py-0.5 rounded-full">
                                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest font-mono">Sin configurar</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                            </div>
                        )}
                    </div>
                    <Controller
                        control={control}
                        name="library.omdbApiKey"
                        render={({ field }) => (
                            <div className="flex flex-col gap-2">
                                <label htmlFor="omdb-api-key" className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Clave de la API (API Key)</label>
                                <input
                                    id="omdb-api-key"
                                    type="password"
                                    value={field.value || ""}
                                    onChange={field.onChange}
                                    placeholder="Ingresa tu OMDb API Key"
                                    className="w-full bg-[var(--bg-quaternary)]/60 border border-[var(--glass-strong)] rounded-xl px-4 py-2.5 text-xs text-zinc-300 font-mono focus:outline-none focus:border-[#ff6e3a]/50 focus:shadow-[0_0_20px_rgba(255,110,58,0.12)] transition-all"
                                />
                            </div>
                        )}
                    />
                </GlassCard>
            </div>

            {/* Habilitar Proveedores */}
            <Section label="Habilitar Proveedores de Servicios">
                <Card className="divide-y divide-white/[0.04]">
                    <Controller
                        control={control}
                        name="library.useFallbackMetadataProvider"
                        render={({ field }) => (
                            <OsToggle
                                label="OMDb Service"
                                description="Habilita la consulta de valoraciones adicionales y datos de producción."
                                checked={!!field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="library.primaryMetadataProvider"
                        render={({ field }) => (
                            <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-5 hover:bg-white/[0.01] transition-all duration-200 gap-5">
                                <div className="space-y-1 flex-1 max-w-xl">
                                    <p className="text-sm font-semibold text-zinc-300 tracking-tight">Proveedor de Metadatos Principal</p>
                                    <p className="text-[11px] text-zinc-500 leading-relaxed font-medium">Fuente primaria para descarga de metadatos y sinopsis.</p>
                                </div>
                                <select
                                    value={field.value || "tmdb"}
                                    onChange={field.onChange}
                                    className="bg-[var(--bg-quaternary)]/60 border border-[var(--glass-strong)] rounded-xl px-4 py-2.5 text-xs text-zinc-300 focus:outline-none focus:border-[#ff6e3a]/50 focus:shadow-[0_0_20px_rgba(255,110,58,0.12)] transition-all cursor-pointer w-full md:w-72 font-medium [&>option]:bg-[#141418] [&>option]:text-white"
                                >
                                    <option value="tmdb">TMDB (Recomendado)</option>
                                    <option value="mal">MyAnimeList</option>
                                    <option value="anidb">AniDB</option>
                                </select>
                            </div>
                        )}
                    />
                </Card>
            </Section>
        </div>
    )
}
