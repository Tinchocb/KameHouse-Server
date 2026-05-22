import React from "react"
import { TabsContent } from "@/components/ui/tabs/tabs"
import { IntegrationCard, Section, Card, OsInput, OsSelect } from "../components"
import { type Control } from "react-hook-form"
import { type SettingsFormValues } from "../index"

export function IntegrationsTab({ control }: { control: Control<SettingsFormValues> }) {
    return (
        <TabsContent value="integrations" className="m-0 space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 outline-none">
             <header className="space-y-2">
                <h1 className="text-5xl font-black tracking-wider text-white font-bebas leading-none">
                    ECOSISTEMA <span className="text-zinc-500">EXTERNO</span>
                </h1>
                <p className="text-zinc-400 text-base font-medium leading-relaxed max-w-3xl">
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
