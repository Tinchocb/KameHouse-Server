import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { LANE_ICONS } from "@/components/ui/smart-swimlane"
import { Compass, Sparkles } from "lucide-react"
import type { CuratedSwimlane } from "@/hooks/use-home-intelligence"

const COLOR_PALETTES = [
    { color: "text-amber-400", bg: "bg-amber-400/10" },
    { color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { color: "text-blue-400", bg: "bg-blue-400/10" },
    { color: "text-orange-400", bg: "bg-orange-400/10" },
    { color: "text-rose-400", bg: "bg-rose-400/10" },
    { color: "text-purple-400", bg: "bg-purple-400/10" },
    { color: "text-pink-400", bg: "bg-pink-400/10" },
    { color: "text-cyan-400", bg: "bg-cyan-400/10" },
    { color: "text-yellow-400", bg: "bg-yellow-400/10" },
    { color: "text-teal-400", bg: "bg-teal-400/10" },
    { color: "text-indigo-400", bg: "bg-indigo-400/10" },
]

function getShortTitle(title: string): string {
    if (title.startsWith("Colección: ")) {
        return title.replace("Colección: ", "")
    }
    const overrides: Record<string, string> = {
        "El Poder del Súper Saiyajin": "Súper Saiyajin",
        "Duelos y Combates Legendarios": "Batallas Épicas",
        "¡Fusión HA!: Guerreros Fusionados": "Fusiones",
        "La Búsqueda de las Esferas del Dragón": "Esferas",
        "Torneos y Artes Marciales Clásicas": "Artes Marciales",
        "La Tiranía del Imperio de Freezer": "Imperio Freezer",
        "La Amenaza de la Patrulla Roja": "Patrulla Roja",
        "Combates en el Reino de los Demonios": "Demonios",
        "Líneas Temporales y Viajes en el Tiempo": "Viajes Temporales",
        "Aventura y Viajes por el Espacio": "Viajes Espaciales",
        "Entidades Divinas y Dioses de la Destrucción": "Dioses",
        "El Futuro Z: Nuevas Generaciones": "Generación Z",
        "El Camino del Guerrero Z: Entrenamiento": "Entrenamiento",
        "Momentos de Vida Cotidiana": "Vida Cotidiana",
        "Comedia y Momentos Divertidos": "Comedia",
        "Técnicas de Ki Especiales": "Técnicas Ki",
        "Técnicas Letales y Peligrosas": "Técnicas Letales",
        "Uniones Más Poderosas": "Fusiones",
        "Forma Final": "Formas Finales",
        "Último Recurso": "Último Recurso",
        "Sin Vuelta Atrás": "Batallas Límite",
        "Grandes Torneos": "Torneos",
        "Más Allá: Combates": "El Más Allá",
        "Imperio de Freezer": "Freezer",
        "Poder Berserker": "Poder Berserker",
        "Raza Guerrera Más Poderosa": "Guerreros Z",
        "Venganza de Baby": "Baby GT",
        "Amenaza Final de GT": "Dragones GT",
        "Entidades Supremas del Universo": "Deidades",
        "Policías del Cosmos": "Patrulla Galáctica",
        "Guerreras Indomables": "Guerreras",
        "Nuevas Generaciones de Guerreros": "Nuevas Eras",
        "Guardianes del Tiempo": "Líneas de Tiempo",
        "Futuro en Llamas": "Futuro Alternativo",
        "Cruce de Universos": "Multiverso",
        "Tierra Bajo Ataque": "Invasiones",
    }
    return overrides[title] || title
}

interface SmartNavigatorProps {
    swimlanes?: CuratedSwimlane[]
    className?: string
}

export function SmartNavigator({ swimlanes = [], className }: SmartNavigatorProps) {
    const scrollToSection = (id: string) => {
        const element = document.getElementById(`lane-${id}`)
        if (element) {
            const yOffset = -100 // Spacing for header
            const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset
            window.scrollTo({ top: y, behavior: "smooth" })
        }
    }

    if (!swimlanes || swimlanes.length === 0) return null

    return (
        <div className={cn(
            "relative z-40 px-6 md:px-12 lg:px-20 py-8",
            className
        )}>
            <div className="flex flex-col gap-6">
                <div className="flex items-center gap-3">
                    <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
                    <span className="text-[0.65rem] font-bold tracking-[0.3em] text-zinc-500 uppercase">
                        Navegación Rápida
                    </span>
                </div>

                <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-4">
                    {swimlanes.map((lane, idx) => {
                        const IconComponent = LANE_ICONS[lane.id] || LANE_ICONS[lane.type] || Compass
                        const palette = COLOR_PALETTES[idx % COLOR_PALETTES.length]
                        const shortLabel = getShortTitle(lane.title)

                        return (
                            <motion.button
                                key={lane.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ 
                                    delay: idx * 0.02,
                                    duration: 0.5,
                                    ease: [0.23, 1, 0.32, 1]
                                }}
                                whileHover={{ scale: 1.05, y: -4 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => scrollToSection(lane.id)}
                                className={cn(
                                    "group relative flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-500 flex-shrink-0",
                                    "bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] hover:border-white/[0.1]",
                                    "backdrop-blur-xl shadow-2xl"
                                )}
                            >
                                <div className={cn(
                                    "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-500",
                                    palette.bg, palette.color,
                                    "group-hover:scale-110 group-hover:rotate-3"
                                )}>
                                    <IconComponent className="w-5 h-5" />
                                </div>

                                <div className="flex flex-col items-start">
                                    <span className="text-sm font-bold tracking-tight text-zinc-200 group-hover:text-white transition-colors whitespace-nowrap">
                                        {shortLabel}
                                    </span>
                                </div>

                                {/* Magnetic Glow Effect */}
                                <div className="absolute inset-0 rounded-2xl bg-primary/0 group-hover:bg-primary/5 transition-colors duration-500 -z-10" />
                                <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
                            </motion.button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
