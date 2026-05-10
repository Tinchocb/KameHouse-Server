import React from "react"
import { TabsContent } from "@/components/ui/tabs/tabs"
import { Section, Card, OsToggle } from "../components"
import { type Control } from "react-hook-form"

export function PlayerTab({ control }: { control: Control<any> }) {
    return (
        <TabsContent value="player" className="m-0 space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <header className="space-y-4">
                <h1 className="text-7xl font-black tracking-tighter text-white font-bebas">MOTOR <span className="text-zinc-500">REPRODUCCIÓN</span></h1>
                <p className="text-zinc-400 text-xl font-medium leading-relaxed max-w-3xl">Optimiza la fluidez y la automatización de tu experiencia visual.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <Section label="Automatización">
                    <Card>
                        <OsToggle control={control} name="library.autoPlayNextEpisode"
                            label="Reproducción Automática"
                            desc="Reproducir el siguiente episodio automáticamente al terminar." />
                        <OsToggle control={control} name="library.enableWatchContinuity"
                            label="Saltar Intros (AniSkip)"
                            desc="Sincronizar con AniSkip para saltar openings/endings automáticamente." />
                    </Card>
                </Section>

                <Section label="Transmisión & HW">
                    <Card>
                        <OsToggle control={control} name="mediastream.transcodeEnabled"
                            label="Transcodificación HW"
                            desc="Usar aceleración por hardware para el streaming de video." />
                         <OsToggle control={control} name="mediastream.preTranscodeEnabled"
                            label="Pre-Transcodificado"
                            desc="Preparar el buffer antes de iniciar la reproducción." />
                    </Card>
                </Section>
            </div>
        </TabsContent>
    )
}
