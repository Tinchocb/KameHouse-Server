import * as React from "react"
import { motion } from "framer-motion"
import { Sparkles, Zap, ShieldAlert, Trophy, Moon, Film, Tv } from "lucide-react"
import { useNavigate } from "@tanstack/react-router"
import { Swimlane, type SwimlaneItem } from "@/components/ui/swimlane"
import { SectionLabel, ErrorBoundary } from "@/routes/home/home.components"
import { DRAGON_BALL_SAGAS } from "@/lib/config/dragonball.config"
import dbSagaTags from "@/lib/config/saga_synopsis_tags.json"
import type { Anime_LibraryCollectionEntry } from "@/api/generated/types"
import { getTitle } from "@/routes/home/home.helpers"

interface ThematicCarouselsProps {
    allEntries: Anime_LibraryCollectionEntry[]
    onHover?: (url: string | null) => void
}

const THEMATIC_CATEGORIES = [
    {
        id: "saiyajin-pride",
        title: "El Orgullo de la Raza Saiyajin",
        description: "El poder ilimitado de la estirpe de guerreros más temible del universo. Super Saiyajins y ki divino desatado.",
        tag: "Los Saiyajins",
        icon: Zap,
        index: "01"
    },
    {
        id: "fusion-ha",
        title: "¡Fusión HA!: El Poder de la Unión",
        description: "Danza Metamor o pendientes Pothala: el nacimiento de los guerreros definitivos del universo.",
        tag: "Fusión de Guerreros",
        icon: Sparkles,
        index: "02"
    },
    {
        id: "dragon-balls",
        title: "Las Esferas Sagradas: Deseos Prohibidos",
        description: "La mística búsqueda de las esferas que conceden cualquier deseo. Ten cuidado con lo que ambicionas.",
        tag: "Búsqueda de las Esferas",
        icon: Sparkles,
        index: "03"
    },
    {
        id: "martial-arts",
        title: "Grandes Torneos y Honor en la Arena",
        description: "El orgullo de subir a la arena. Desde los nostálgicos campeonatos clásicos hasta el Torneo del Poder.",
        tag: "Artes Marciales",
        icon: Trophy,
        index: "04"
    },
    {
        id: "freezer-empire",
        title: "El Imperio de Freezer: Terror Cósmico",
        description: "La tiranía intergaláctica que marcó el destino de los Saiyajins. Combates desesperados en Namek y el espacio.",
        tag: "El Imperio de Freezer",
        icon: ShieldAlert,
        index: "05"
    },
    {
        id: "red-ribbon",
        title: "La Patrulla Roja: Amenaza Androide",
        description: "Bio-tecnología letal, cyborgs con sed de venganza y la bio-arma perfecta Cell amenazan la paz de la Tierra.",
        tag: "La Patrulla Roja",
        icon: ShieldAlert,
        index: "06"
    },
    {
        id: "demonic-realms",
        title: "Dimensiones Demoniacas y Magia Prohibida",
        description: "Mundos extraños llenos de magia oscura, demonios ancestrales y conjuros interdimensionales.",
        tag: "Mundo de los Demonios",
        icon: Moon,
        index: "07"
    },
    {
        id: "movie-villains",
        title: "Enemigos Implacables: Villanos de Películas",
        description: "Amenazas colosales de realidades alternas: combates brutales contra Garlic Jr, Cooler, Janemba o el temible Broly.",
        tag: "Villanos de Películas",
        icon: ShieldAlert,
        index: "08"
    },
    {
        id: "extreme-training",
        title: "Superación y Entrenamiento Extremo",
        description: "El camino del guerrero: cámaras de gravedad, templos divinos y la legendaria Habitación del Tiempo.",
        tag: "Entrenamiento Extremo",
        icon: Trophy,
        index: "09"
    },
    {
        id: "universal-survival",
        title: "Al Borde del Abismo: Supervivencia Universal",
        description: "Batallas críticas donde la extinción de la Tierra o la aniquilación de múltiples universos es la única alternativa.",
        tag: "Supervivencia Universal",
        icon: Zap,
        index: "10"
    }
]

export const ThematicCarousels: React.FC<ThematicCarouselsProps> = React.memo(({ allEntries, onHover }) => {
    const navigate = useNavigate()

    // Map each category to its matching available items
    const rows = React.useMemo(() => {
        return THEMATIC_CATEGORIES.map(category => {
            const laneItems: SwimlaneItem[] = []

            // Group all entries from saga_synopsis_tags that match this category's primary tag
            Object.values(dbSagaTags).forEach((item: any) => {
                const hasTag = item.tags.some(
                    (t: string) => t.toLowerCase() === category.tag.toLowerCase()
                )
                if (!hasTag) return

                if (item.isMovie) {
                    // Movie handling: check if user has this movie in library collection
                    const match = allEntries.find(e => e.mediaId === item.tmdbId)
                    if (match?.media) {
                        laneItems.push({
                            id: `thematic-movie-${item.tmdbId}-${category.id}`,
                            title: item.title,
                            image: match.media.posterImage || match.media.bannerImage || "",
                            subtitle: "Película Clásica",
                            badge: "MOVIE",
                            description: item.description,
                            aspect: "poster", // Poster look for movies
                            year: match.media.year || undefined,
                            rating: match.media.score ? (match.media.score > 10 ? match.media.score / 10 : match.media.score) : undefined,
                            backdropUrl: match.media.bannerImage || match.media.posterImage || undefined,
                            onClick: () => navigate({ to: "/movies/$movieId", params: { movieId: String(item.tmdbId) } })
                        })
                    }
                } else {
                    // TV Saga handling: check if series is in user library
                    const match = allEntries.find(e => e.mediaId === item.seriesId)
                    if (match?.media) {
                        // Find the saga definition for high-res banner image
                        const seriesSagas = DRAGON_BALL_SAGAS[item.seriesId] || []
                        const sagaDef = seriesSagas.find(s => s.id === item.id)
                        const image = sagaDef?.image || match.media.bannerImage || match.media.posterImage || ""

                        laneItems.push({
                            id: `thematic-saga-${item.seriesId}-${item.id}-${category.id}`,
                            title: item.title,
                            image,
                            subtitle: getTitle(match.media),
                            badge: "Saga",
                            description: item.description,
                            aspect: "wide", // Cinematic wide ratio for television sagas
                            year: match.media.year || undefined,
                            rating: match.media.score ? (match.media.score > 10 ? match.media.score / 10 : match.media.score) : undefined,
                            backdropUrl: image,
                            onClick: () => navigate({ to: "/series/$seriesId/$sagaId", params: { seriesId: String(item.seriesId), sagaId: item.id } })
                        })
                    }
                }
            })

            return {
                ...category,
                items: laneItems
            }
        }).filter(row => row.items.length > 0) // Only show swimlanes that have matching available media
    }, [allEntries, navigate])

    if (rows.length === 0) return null

    return (
        <div className="space-y-40">
            {rows.map((row, index) => (
                <ErrorBoundary key={row.id}>
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 1.1, ease: [0.23, 1, 0.32, 1] }}
                        className="home-section space-y-8"
                    >
                        {/* Netflix-style Premium Category Header */}
                        <div className="px-6 md:px-12 lg:px-20 flex flex-col gap-4">
                            <div className="flex items-center gap-4">
                                <SectionLabel icon={row.icon} label={row.title} index={row.index} />
                            </div>
                            <p className="max-w-4xl text-zinc-400 text-sm md:text-base font-light leading-relaxed -mt-4 pl-4 border-l-2 border-primary/20">
                                {row.description}
                            </p>
                        </div>

                        {/* Interactive Swimlane Carousel */}
                        <Swimlane
                            title=""
                            items={row.items}
                            onHover={onHover}
                            className="!py-0"
                        />
                    </motion.div>
                </ErrorBoundary>
            ))}
        </div>
    )
})

ThematicCarousels.displayName = "ThematicCarousels"
