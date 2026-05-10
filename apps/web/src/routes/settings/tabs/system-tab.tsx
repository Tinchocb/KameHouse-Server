import React from "react"
import { TabsContent } from "@/components/ui/tabs/tabs"
import { StatusCard } from "../components"
import { LucideCrown, LucideHardDrive, LucideCheckCircle2 } from "lucide-react"

export function SystemTab() {
    return (
        <TabsContent value="system" className="m-0 space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
             <header className="space-y-4">
                <h1 className="text-7xl font-black tracking-tighter text-white font-bebas">NÚCLEO <span className="text-zinc-500">SISTEMA</span></h1>
                <p className="text-zinc-400 text-xl font-medium leading-relaxed max-w-3xl">Información técnica sobre el servidor y estado de los recursos.</p>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <StatusCard label="Versión" value="3.5.0-ALPHA" icon={LucideCrown} />
                <StatusCard label="Database" value="SQLite (WAL)" icon={LucideHardDrive} />
                <StatusCard label="Entorno" value="Producción" icon={LucideCheckCircle2} />
            </div>
        </TabsContent>
    )
}
