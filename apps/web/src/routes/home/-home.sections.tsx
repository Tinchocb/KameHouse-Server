import * as React from "react"
import { motion } from "framer-motion"
import { Zap, Sword, Swords, Film, ChevronRight } from "lucide-react"
import { Swimlane, type SwimlaneItem } from "@/components/ui/swimlane"
import { SectionLabel, ErrorBoundary } from "./home.components"
import { SmartSwimlane } from "@/components/ui/smart-swimlane"
import type { CuratedSwimlane } from "@/hooks/use-home-intelligence"

// ─── 0. Intelligent Swimlanes ───────────────────────────────────────────────

interface HomeIntelligentSectionsProps {
    swimlanes?: CuratedSwimlane[]
    onNavigate: (mediaId: number) => void
    startIndex?: number
}

export const HomeIntelligentSections = React.memo(function HomeIntelligentSections({
    swimlanes,
    onNavigate,
    startIndex = 2,
}: HomeIntelligentSectionsProps) {
    if (!swimlanes?.length) return null

    return (
        <div className="space-y-32 py-12">
            {swimlanes.map((lane, idx) => (
                <ErrorBoundary
                    key={lane.id}
                >
                    <motion.div 
                        id={`lane-${lane.id}`}
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
                        className="home-section space-y-12"
                    >
                        <SmartSwimlane
                            lane={lane}
                            index={idx + startIndex}
                            onNavigate={(mediaId) => onNavigate(Number(mediaId))}
                        />
                    </motion.div>
                </ErrorBoundary>
            ))}
        </div>
    )
})
HomeIntelligentSections.displayName = "HomeIntelligentSections"

// ─── 1. Seguir Viendo ────────────────────────────────────────────────────────

interface HomeContinueWatchingSectionProps {
    items: SwimlaneItem[]
    onHover?: (url: string | null) => void
}

export const HomeContinueWatchingSection = React.memo(function HomeContinueWatchingSection({
    items,
    onHover,
}: HomeContinueWatchingSectionProps) {
    if (items.length === 0) return null

    return (
        <ErrorBoundary>
            <motion.div 
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1 }}
                className="home-section relative py-16 bg-gradient-to-b from-white/[0.015] to-transparent border-y border-white/[0.03] overflow-hidden"
            >
                {/* Subtle section glow */}
                <div className="absolute top-0 left-1/4 -translate-y-1/2 w-96 h-32 rounded-full bg-brand-orange/5 blur-[80px] pointer-events-none" />
                <div className="absolute bottom-0 right-1/4 translate-y-1/2 w-96 h-32 rounded-full bg-blue-500/5 blur-[80px] pointer-events-none" />

                <div className="space-y-12">
                    <SectionLabel icon={Zap} label="Seguir Viendo" index="01" />
                    <Swimlane
                        title=""
                        items={items}
                        defaultAspect="wide"
                        onHover={onHover}
                    />
                </div>
            </motion.div>
        </ErrorBoundary>
    )
})
HomeContinueWatchingSection.displayName = "HomeContinueWatchingSection"

// ─── 2. Lore-Themed Swimlanes (Mock Data) ─────────────────────────────────

interface LoreItemDef {
    title: string
    description: string
    year: number
    format: "TV" | "MOVIE" | "OVA" | "SPECIAL"
    episodeNumber?: number
    mediaId: number
}

interface LoreCollectionDef {
    id: string
    icon: React.ElementType
    title: string
    items: LoreItemDef[]
}

const LORE_COLLECTIONS: LoreCollectionDef[] = [
    {
        id: "vegeta-pride",
        icon: Sword,
        title: "Maratón de Personaje: El Orgullo de Vegeta",
        items: [
            {
                title: "El debut del Príncipe",
                description: "Vegeta y Nappa llegan a la Tierra listos para hacerse con las Esferas del Dragón. El guerrero más poderoso del universo se enfrenta a Goku en una batalla que cambiará el destino del planeta.",
                year: 1989,
                format: "TV",
                episodeNumber: 5,
                mediaId: 813,
            },
            {
                title: "Despertar Super Saiyan",
                description: "Tras la devastadora derrota frente a Freezer, Vegeta experimenta por primera vez la furia de un Saiyan puro de sangre real. Un momento crucial que redefine su orgullo y su sed de poder.",
                year: 1991,
                format: "TV",
                episodeNumber: 95,
                mediaId: 813,
            },
            {
                title: "La Promesa del guerrero",
                description: "Vegeta se despide de Trunks antes del Torneo de Fuerza, revelando por primera vez la profundidad de su amor paternal. Un episodio íntimo que humaniza al príncipe Saiyan.",
                year: 2017,
                format: "TV",
                episodeNumber: 88,
                mediaId: 30694,
            },
            {
                title: "Vegeta contra Broly",
                description: "El príncipe Saiyan se enfrenta al legendario Super Saiyan Broly en un combate que desafía los límites del poder conocido. Técnica, orgullo y furia pura chocan en la nieve antártica.",
                year: 2018,
                format: "MOVIE",
                mediaId: 1000001,
            },
            {
                title: "El Último Combate de Vegeta",
                description: "Vegeta se enfrenta a Goku en una batalla final que trasciende el orgullo y la rivalidad. Un enfrentamiento épico que decide el destino del multiverso.",
                year: 2017,
                format: "TV",
                episodeNumber: 128,
                mediaId: 30694,
            },
            {
                title: "La Resurrección de Freezer",
                description: "Vegeta se enfrenta a su archienemigo resucitado en una batalla que pone a prueba su nueva forma Saiyan Blue. Una venganza largamente esperada que define su evolución como guerrero.",
                year: 2015,
                format: "MOVIE",
                mediaId: 1000002,
            },
            {
                title: "El orgullo de un Rey",
                description: "Vegeta, poseído por la influencia de Babidi, demuestra todo su poder oscuro contra Goku. La lucha entre hermanos Saiyan alcanza cotas emocionales y destructivas nunca antes vistas.",
                year: 1992,
                format: "TV",
                episodeNumber: 220,
                mediaId: 813,
            },
        ],
    },
    {
        id: "historic-battles",
        icon: Swords,
        title: "Batallas Históricas (Wiki Curation)",
        items: [
            {
                title: "Goku vs Freezer",
                description: "La batalla definitiva en el planeta Namek. Goku se convierte en el Super Saiyan legendario por primera vez, cambiando para siempre el equilibrio de poder del universo.",
                year: 1991,
                format: "TV",
                episodeNumber: 95,
                mediaId: 813,
            },
            {
                title: "Gohan vs Cell",
                description: "El momento en que Gohan Super Saiyan 2 desata todo su poder contra Cell. La protección de sus seres queridos impulsa al hijo de Goku más allá de todos los límites conocidos.",
                year: 1992,
                format: "TV",
                episodeNumber: 190,
                mediaId: 813,
            },
            {
                title: "Goku vs Majin Vegeta",
                description: "La rivalidad más legendaria del anime alcanza su clímax. Goku y Vegeta se enfrentan en una batalla a muerte que trasciende el orgullo y desata su poder más primitivo.",
                year: 1993,
                format: "TV",
                episodeNumber: 220,
                mediaId: 813,
            },
            {
                title: "Goku vs Piccolo (Torneo Mundial)",
                description: "La final del 23° Torneo Mundial de Artes Marciales. Goku se enfrenta a Piccolo Jr. en una batalla que decide el destino de la Tierra y revela los orígenes del Rey Demonio.",
                year: 1988,
                format: "TV",
                episodeNumber: 143,
                mediaId: 529,
            },
            {
                title: "Goku vs Jiren",
                description: "El clímax del Torneo de Fuerza. Goku despierta el Ultra Instinct, una habilidad divina que supera la velocidad del pensamiento, para enfrentarse al guerrero más fuerte del multiverso.",
                year: 2018,
                format: "TV",
                episodeNumber: 130,
                mediaId: 30694,
            },
            {
                title: "Goku vs Broly (DBS)",
                description: "La batalla más visualmente impactante de Dragon Ball Super. Goku, Vegeta y Broly chocan en un torbellino de poder que redefine la animación de combate moderna.",
                year: 2018,
                format: "MOVIE",
                mediaId: 1000001,
            },
            {
                title: "La Batalla de los Dioses",
                description: "Goku se enfrenta a Beerus, el Dios de la Destrucción, en un combate que introduce el poder de los Super Saiyan Dios y expande el universo de Dragon Ball a escalas divinas.",
                year: 2013,
                format: "MOVIE",
                mediaId: 1000003,
            },
        ],
    },
    {
        id: "cult-classics",
        icon: Film,
        title: "Especiales y Películas de Culto",
        items: [
            {
                title: "La Batalla de los Dioses",
                description: "La película que marcó el renacimiento de Dragon Ball. Beerus, el Dios de la Destrucción, despierta de su sueño milenario y busca al Super Saiyan Dios profetizado.",
                year: 2013,
                format: "MOVIE",
                mediaId: 1000003,
            },
            {
                title: "La Resurrección de Freezer",
                description: "Freezer regresa gracias a las Esferas del Dragón y busca venganza contra los Saiyans. Una batalla que introduce el Super Saiyan Blue y redefine el poder máximo.",
                year: 2015,
                format: "MOVIE",
                mediaId: 1000002,
            },
            {
                title: "Broly (DBS)",
                description: "La historia de origen definitiva de Broly. Una épica visual que expande el lore Saiyan y presenta la forma más bestial de poder jamás vista en el canon.",
                year: 2018,
                format: "MOVIE",
                mediaId: 1000001,
            },
            {
                title: "El Ataque del Dragón",
                description: "Tapion, un guerrero misterioso, es perseguido por un monstruo que amenaza con destruir el universo. Una de las películas más queridas por su tono oscuro y su banda sonora.",
                year: 1995,
                format: "MOVIE",
                mediaId: 1000004,
            },
            {
                title: "La Historia de Trunks",
                description: "El especial que muestra el futuro apocalíptico de Trunks: los androides 17 y 18 asesinan a todos los guerreros Z, y solo Trunks sobrevive para luchar contra el desesperanzador destino.",
                year: 1993,
                format: "SPECIAL",
                mediaId: 813,
            },
            {
                title: "El Origen de Goku",
                description: "El especial que narra la llegada de Goku a la Tierra y su infancia con Son Gohan. Un viaje nostálgico a los orígenes del héroe más querido del anime.",
                year: 1989,
                format: "SPECIAL",
                mediaId: 529,
            },
            {
                title: "Goku y sus amigos vuelven",
                description: "Un OVA ligero y divertido que reúne a todos los personajes de Dragon Ball Z en una aventura corta que celebra el espíritu de la serie original.",
                year: 2008,
                format: "OVA",
                mediaId: 1000005,
            },
            {
                title: "Dragon Ball Z: La Galaxia al Borde",
                description: "El plan para exterminar a los Saiyans se pone en marcha. Una película que expande el lore de los Saiyans y su trágica historia antes de la destrucción de su planeta.",
                year: 1993,
                format: "OVA",
                mediaId: 1000006,
            },
        ],
    },
]

function getMediaTypeBadge(format: LoreItemDef["format"]): string {
    switch (format) {
        case "TV":
            return "EPISODIO"
        case "MOVIE":
            return "PELÍCULA"
        case "SPECIAL":
            return "ESPECIAL"
        case "OVA":
            return "OVA"
    }
}

interface HomeLoreSectionsProps {
    onNavigate: (mediaId: number, format: string) => void
}

export const HomeLoreSections = React.memo(function HomeLoreSections({
    onNavigate,
}: HomeLoreSectionsProps) {
    if (LORE_COLLECTIONS.length === 0) return null

    return (
        <div className="space-y-20 py-12">
            {LORE_COLLECTIONS.map((collection) => {
                const swimlaneItems: SwimlaneItem[] = collection.items.map((item, idx) => {
                    const isEpisode = item.format === "TV"
                    return {
                        id: `lore-${collection.id}-${idx}`,
                        title: item.title,
                        image: "",
                        subtitle: `${item.year}`,
                        badge: item.format,
                        mediaTypeBadge: getMediaTypeBadge(item.format),
                        description: item.description,
                        year: item.year,
                        episodeNumber: item.episodeNumber,
                        aspect: isEpisode ? "wide" : "poster",
                        onClick: () => onNavigate(item.mediaId, item.format),
                    }
                })

                return (
                    <ErrorBoundary key={collection.id}>
                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-100px" }}
                            transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
                            className="home-section"
                        >
                            <div className="flex items-end justify-between px-6 md:px-12 lg:px-20 mb-2">
                                <SectionLabel icon={collection.icon} label={collection.title} />
                                <button
                                    type="button"
                                    onClick={() => {/* future: navigate to curated collection page */}}
                                    className="hidden md:flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500 hover:text-brand-orange transition-colors duration-300 pb-6 group/cta"
                                >
                                    <span>Ver todo</span>
                                    <ChevronRight
                                        size={12}
                                        className="transition-transform duration-300 group-hover/cta:translate-x-0.5"
                                        strokeWidth={2.5}
                                    />
                                </button>
                            </div>
                            <Swimlane
                                title=""
                                items={swimlaneItems}
                                defaultAspect={swimlaneItems[0]?.aspect ?? "poster"}
                            />
                        </motion.div>
                    </ErrorBoundary>
                )
            })}
        </div>
    )
})
HomeLoreSections.displayName = "HomeLoreSections"
