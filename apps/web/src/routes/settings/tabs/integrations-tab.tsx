import React from "react"
import { TabsContent } from "@/components/ui/tabs/tabs"
import { Section, Card, OsToggle } from "../components"
import { type Control, Controller, useWatch } from "react-hook-form"
import { type SettingsFormValues } from "../index"
import { toast } from "sonner"

interface IntegrationsTabProps {
    control: Control<SettingsFormValues>
}

export function IntegrationsTab({ control }: IntegrationsTabProps) {
    const tmdbApiKey = useWatch({ control, name: "library.tmdbApiKey" })
    const fanartApiKey = useWatch({ control, name: "library.fanartApiKey" })
    const omdbApiKey = useWatch({ control, name: "library.omdbApiKey" })

    return (
        <TabsContent value="integrations" className="m-0 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
             {/* Header */}
             <header className="space-y-3 pt-2">
                 <div className="flex items-center gap-3 mb-1">
                     <div className="flex items-center justify-center p-1 rounded bg-[#ff6e3a]/10 border border-[#ff6e3a]/15">
                         <svg className="h-3.5 w-3.5 text-[#ff6e3a]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                             <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
                             <path d="M12 2a10 10 0 0 1 10 10h-10V2z" />
                         </svg>
                     </div>
                     <span className="text-[9px] font-black uppercase tracking-[0.35em] text-zinc-600 font-mono">ECOSISTEMA · SERVICIOS EN LA NUBE</span>
                 </div>
                 <h1 className="text-5xl font-bebas tracking-wider text-white leading-none">
                     EXTERNAL <span className="text-zinc-600">INTEGRATIONS</span>
                 </h1>
                 <div className="h-[2px] w-12 bg-gradient-to-r from-[#ff6e3a]/50 to-transparent rounded-full" />
                 <p className="text-zinc-500 text-sm font-medium leading-relaxed max-w-2xl">
                     Conecta el núcleo de tu servidor KameHouse con los proveedores de APIs de metadatos más importantes del ecosistema.
                 </p>
             </header>

            {/* Bento grids for integrations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* TMDB API Key */}
                <div className="liquid-glass-frosted rounded-3xl p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-2">
                            The Movie Database (TMDB)
                        </h4>
                        {tmdbApiKey ? (
                            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest font-mono">Conectado</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]"></span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 bg-zinc-800/20 border border-zinc-700/30 px-2.5 py-0.5 rounded-full">
                                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest font-mono">Sin configurar</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-650 shadow-[0_0_6px_#52525b]"></span>
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
                                    className="w-full bg-black/40 ring-1 ring-white/10 rounded-xl px-4 py-2.5 text-xs text-zinc-300 font-mono focus:outline-none focus:ring-[#ff6e3a]/40 focus:border-transparent transition-all"
                                />
                            </div>
                        )}
                    />
                </div>

                {/* Fanart.tv API Key */}
                <div className="liquid-glass-frosted rounded-3xl p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-2">
                            Fanart.tv
                        </h4>
                        {fanartApiKey ? (
                            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest font-mono">Conectado</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]"></span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 bg-zinc-800/20 border border-zinc-700/30 px-2.5 py-0.5 rounded-full">
                                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest font-mono">Sin configurar</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-650 shadow-[0_0_6px_#52525b]"></span>
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
                                    className="w-full bg-black/40 ring-1 ring-white/10 rounded-xl px-4 py-2.5 text-xs text-zinc-300 font-mono focus:outline-none focus:ring-[#ff6e3a]/40 focus:border-transparent transition-all"
                                />
                            </div>
                        )}
                    />
                </div>

                {/* OMDb API Key */}
                <div className="liquid-glass-frosted rounded-3xl p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-2">
                            OMDb Service
                        </h4>
                        {omdbApiKey ? (
                            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest font-mono">Conectado</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]"></span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 bg-zinc-800/20 border border-zinc-700/30 px-2.5 py-0.5 rounded-full">
                                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest font-mono">Sin configurar</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-650 shadow-[0_0_6px_#52525b]"></span>
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
                                    className="w-full bg-black/40 ring-1 ring-white/10 rounded-xl px-4 py-2.5 text-xs text-zinc-300 font-mono focus:outline-none focus:ring-[#ff6e3a]/40 focus:border-transparent transition-all"
                                />
                            </div>
                        )}
                    />
                </div>
            </div>

            {/* Habilitar Proveedores */}
            <Section label="Habilitar Proveedores de Servicios">
                <Card className="divide-y divide-white/[0.03]">
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
                </Card>
            </Section>
        </TabsContent>
    )
}
