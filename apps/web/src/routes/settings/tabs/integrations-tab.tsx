import React from "react"
import { TabsContent } from "@/components/ui/tabs/tabs"
import { IntegrationCard, Section, Card, OsInput, OsSelect, OsToggle } from "../components"
import { type Control, Controller, type UseFormRegister } from "react-hook-form"
import { type SettingsFormValues } from "../index"

interface IntegrationsTabProps {
    control: Control<SettingsFormValues>
    register: UseFormRegister<SettingsFormValues>
}

export function IntegrationsTab({ control, register }: IntegrationsTabProps) {
    return (
        <TabsContent value="integrations" className="m-0 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
             {/* Header */}
             <header className="space-y-3 pt-2">
                 <div className="flex items-center gap-3 mb-1">
                     <div className="flex items-center justify-center p-1 rounded bg-brand-orange/10 border border-brand-orange/15">
                         <svg className="h-3.5 w-3.5 text-brand-orange" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                             <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
                             <path d="M12 2a10 10 0 0 1 10 10h-10V2z" />
                         </svg>
                     </div>
                     <span className="text-[9px] font-black uppercase tracking-[0.35em] text-zinc-600 font-mono">ECOSISTEMA · SERVICIOS EN LA NUBE</span>
                 </div>
                 <h1 className="text-5xl font-bebas tracking-wider text-white leading-none">
                     ECOSISTEMA <span className="text-zinc-600">EXTERNO</span>
                 </h1>
                 <div className="h-[2px] w-12 bg-gradient-to-r from-brand-orange/50 to-transparent rounded-full" />
                 <p className="text-zinc-500 text-sm font-medium leading-relaxed max-w-2xl">
                     Conecta con proveedores externos de metadatos, traducción de sinopsis y subtítulos automáticos.
                 </p>
             </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <IntegrationCard name="TMDB" status="Conectado" connected={true} />
            </div>

            {/* Credenciales */}
            <Section label="Credenciales & Metadatos">
                <Card className="divide-y divide-white/[0.03]">
                    <OsInput
                        label="TMDb API Key"
                        description="Clave de API personal para descargar metadatos y portadas de alta calidad de The Movie Database."
                        placeholder="Ingresa tu TMDB API Key"
                        isSecure
                        isMono
                        {...register("library.tmdbApiKey")}
                    />
                    <OsSelect
                        label="Idioma de Respaldo"
                        description="Idioma secundario para los títulos y sinopsis en caso de no encontrarse en el idioma principal."
                        options={[
                            { value: "es-MX", label: "Español (Latinoamérica)" },
                            { value: "es-ES", label: "Español (España)" },
                            { value: "en-US", label: "Inglés (Estados Unidos)" }
                        ]}
                        {...register("library.tmdbLanguage")}
                    />
                </Card>
            </Section>

            {/* Habilitar Proveedores */}
            <Section label="Habilitar Proveedores de Servicios">
                <Card className="divide-y divide-white/[0.03]">
                    <Controller
                        control={control}
                        name="library.enableOnlinestream" // Reutilizamos un booleano para OpenSubtitles
                        render={({ field }) => (
                            <OsToggle
                                label="OpenSubtitles"
                                description="Permite buscar y descargar subtítulos automáticos para tus series y películas."
                                checked={!!field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="library.useFallbackMetadataProvider" // Reutilizamos un booleano para OMDb
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
                        name="library.autoScan" // Reutilizamos un booleano para Fanart
                        render={({ field }) => (
                            <OsToggle
                                label="Fanart.tv"
                                description="Habilita la descarga de logotipos de series y fondos artísticos avanzados."
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
