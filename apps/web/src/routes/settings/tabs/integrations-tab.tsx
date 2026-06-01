import React from "react"
import { TabsContent } from "@/components/ui/tabs/tabs"
import { IntegrationCard, Section, Card, OsInput, OsSelect } from "../components"
import { type Control } from "react-hook-form"
import { type SettingsFormValues } from "../index"
import { LucideGlobe } from "lucide-react"

export function IntegrationsTab({ control }: { control: Control<SettingsFormValues> }) {
    return (
        <TabsContent value="integrations" className="m-0 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
             {/* ── Header ── */}
             <header className="space-y-3 pt-2">
                 <div className="flex items-center gap-3 mb-1">
                     <div className="flex items-center justify-center p-1 rounded bg-brand-orange/10 border border-brand-orange/15">
                         <LucideGlobe className="h-3.5 w-3.5 text-brand-orange" strokeWidth={2.5} />
                     </div>
                     <span className="text-[9px] font-black uppercase tracking-[0.35em] text-zinc-600 font-mono">ECOSISTEMA · SERVICIOS EN LA NUBE</span>
                     <span className="relative flex h-1.5 w-1.5">
                         <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-orange/60 opacity-75"></span>
                         <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-orange"></span>
                     </span>
                 </div>
                 <h1 className="text-5xl font-bebas tracking-wider text-white leading-none">
                     ECOSISTEMA <span className="text-zinc-600">EXTERNO</span>
                 </h1>
                 <div className="h-[2px] w-12 bg-gradient-to-r from-brand-orange/50 to-transparent rounded-full" />
                 <p className="text-zinc-500 text-sm font-medium leading-relaxed max-w-2xl">
                     Conecta con servicios externos de metadatos, subtítulos y tracking de series en la nube.
                 </p>
             </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <IntegrationCard name="AniList" status="Disponible" connected={false} />
                <IntegrationCard name="MyAnimeList" status="Próximamente" connected={false} disabled />
                <IntegrationCard name="TMDB" status="Conectado" connected={true} />
            </div>

            <Section label="Credenciales de Metadatos & Subtítulos">
                <Card>
                    <OsSelect
                        control={control}
                        name="library.primaryMetadataProvider"
                        label="Proveedor Primario"
                        desc="El motor principal para buscar y descargar información de tu biblioteca multimedia."
                        options={[
                            { value: "tmdb", label: "The Movie Database (TMDB)" },
                        ]}
                    />
                    <OsInput
                        control={control}
                        name="library.tmdbApiKey"
                        label="TMDB API Key"
                        desc="Llave personal de la API para consultas de metadatos e imágenes de TMDB."
                        placeholder="Ingresa tu TMDB API Key"
                        isSecure
                        isMono
                    />
                    <OsSelect
                        control={control}
                        name="library.tmdbLanguage"
                        label="TMDB Idioma"
                        desc="Idioma por defecto en el que se descargarán los títulos, sinopsis y descripciones."
                        options={[
                            { value: "es-MX", label: "Español (Latinoamérica)" },
                            { value: "es-ES", label: "Español (España)" },
                            { value: "en-US", label: "Inglés (Estados Unidos)" },
                        ]}
                    />
                    <OsInput
                        control={control}
                        name="library.openSubsApiKey"
                        label="OpenSubtitles API Key"
                        desc="Llave de la API de OpenSubtitles para buscar y descargar subtítulos automáticamente."
                        placeholder="Ingresa tu OpenSubtitles API Key"
                        isSecure
                        isMono
                    />
                    <OsInput
                        control={control}
                        name="library.omdbApiKey"
                        label="OMDB API Key"
                        desc="Llave de API opcional para complementar información de portadas y calificaciones."
                        placeholder="Ingresa tu OMDB API Key"
                        isSecure
                        isMono
                    />
                    <OsInput
                        control={control}
                        name="library.fanartApiKey"
                        label="Fanart API Key"
                        desc="Llave de API opcional para descargar imágenes de fondo y banners de alta resolución."
                        placeholder="Ingresa tu Fanart API Key"
                        isSecure
                        isMono
                    />
                </Card>
            </Section>
        </TabsContent>
    )
}
