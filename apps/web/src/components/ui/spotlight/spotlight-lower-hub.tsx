import * as React from "react"
import { motion } from "framer-motion"
import { IconNavigationLayers } from "@/components/ui/icons";
import type { SagaDefinition } from "@/lib/config/dragonball_sagas"
import type { ERA_COLOR_MAP, EraId } from "@/lib/config/eras"
import { SpotlightSagaCard } from "./spotlight-saga-card"
import { resolveSagaDynamicThumbnail } from "../media-spotlight-helpers"
import type { SwimlaneItem } from "@/components/ui/swimlane"

export interface SpotlightLowerHubProps {
    activeEraId: EraId
    colors: typeof ERA_COLOR_MAP[EraId]
    activeEraSagas: SagaDefinition[]
    activeSeries: SwimlaneItem | null
    activeEraSeriesId: number
    activeAnimeEntry?: import("@/api/generated/types").Anime_Entry
    serverBase: string
    onNavigateSaga: (seriesId: number, sagaId: string) => void
    onHoverSound: () => void
}

export const SpotlightLowerHub = React.memo(function SpotlightLowerHub({
    activeEraId,
    colors,
    activeEraSagas,
    activeSeries,
    activeEraSeriesId,
    activeAnimeEntry,
    serverBase,
    onNavigateSaga,
    onHoverSound,
}: SpotlightLowerHubProps) {
    // Precomputar miniaturas dinámicas para evitar filtrar cientos de episodios
    // en cada render individual dentro del bucle de activeEraSagas.map
    const sagaThumbnails = React.useMemo(() => {
        if (!activeEraSagas || activeEraSagas.length === 0) return {} as Record<string, string | null>
        const fallbackUrl = activeSeries?.backdropUrl || activeSeries?.image
        const episodes = activeAnimeEntry?.episodes
        const map: Record<string, string | null> = {}
        for (const saga of activeEraSagas) {
            map[saga.id] = resolveSagaDynamicThumbnail({
                saga,
                episodes,
                serverBase,
                fallbackUrl,
            })
        }
        return map
    }, [activeEraSagas, activeAnimeEntry?.episodes, serverBase, activeSeries?.backdropUrl, activeSeries?.image])

    // Sin sagas (serie incompleta) no se muestra nada: se eliminó el aviso
    // de "Serie en progreso" y el tab de Películas & Especiales.
    if (activeEraSagas.length === 0) return null

    return (
        <div
            className="relative z-10 text-left space-y-4 pt-1 w-full"
            // Acento de la era activa para iconos de pestaña.
            style={{
                "--spotlight-title-hover": colors.ambientGlow1,
            } as React.CSSProperties}
        >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--glass-border-side)] pb-2.5">
                {/* Hub: solo Sagas & Arcos */}
                <div className="flex items-center gap-1.5 bg-zinc-950/45 p-1 rounded-full border border-white/20 border-t-white/40 border-b-white/10 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.25)] backdrop-blur-overlay-xl">
                    <div className="relative flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider select-none text-zinc-950 font-black">
                        <div className="absolute inset-0 bg-white/95 rounded-full shadow-[0_2px_10px_rgba(255,255,255,0.3),inset_0_1px_1px_rgba(255,255,255,1)]" />
                        <span className="relative z-10 flex items-center gap-2">
                            <IconNavigationLayers size={14} />
                            <span>Sagas & Arcos ({activeEraSagas.length})</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* Grid de Sagas */}
            <motion.div
                key={`sagas-${activeEraId}`}
                initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ type: "spring", stiffness: 280, damping: 28, staggerChildren: 0.045 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-1 pb-4 w-full"
            >
                {activeEraSagas.map((saga, idx) => (
                    <SpotlightSagaCard
                        key={saga.id}
                        saga={saga}
                        index={idx}
                        thumbnailUrl={sagaThumbnails[saga.id] ?? null}
                        seriesId={activeEraSeriesId}
                        colors={colors}
                        onNavigateSaga={onNavigateSaga}
                        onHover={onHoverSound}
                    />
                ))}
            </motion.div>
        </div>
    )
})
