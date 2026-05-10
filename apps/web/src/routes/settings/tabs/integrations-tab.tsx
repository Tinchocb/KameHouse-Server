import React from "react"
import { TabsContent } from "@/components/ui/tabs/tabs"
import { IntegrationCard } from "../components"

export function IntegrationsTab() {
    return (
        <TabsContent value="integrations" className="m-0 space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
             <header className="space-y-4">
                <h1 className="text-7xl font-black tracking-tighter text-white font-bebas">ECOSISTEMA <span className="text-zinc-500">EXTERNO</span></h1>
                <p className="text-zinc-400 text-xl font-medium leading-relaxed max-w-3xl">Conecta con servicios de tracking para mantener tu lista sincronizada en la nube.</p>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <IntegrationCard name="AniList" status="Disponible" connected={false} />
                <IntegrationCard name="MyAnimeList" status="Próximamente" connected={false} disabled />
                <IntegrationCard name="TMDB" status="Conectado" connected={true} />
            </div>
        </TabsContent>
    )
}
