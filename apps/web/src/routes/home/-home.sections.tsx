import * as React from "react"
import { Sparkles, Zap, Globe2, Tv, Film } from "lucide-react"
import { motion } from "framer-motion"
import { ErrorBoundary } from "@/components/shared/app-error-boundary"
import { Swimlane, type SwimlaneItem } from "@/components/ui/swimlane"
import { SmartSwimlane } from "@/components/ui/smart-swimlane"
import { BentoRecentlyAdded, type BentoItem } from "@/components/ui/bento-recently-added"
import { SectionLabel } from "./home.components"
import type { CuratedSwimlane } from "@/api/types/intelligence.types"

// ─── 0. Intelligent Swimlanes ───────────────────────────────────────────────

interface HomeIntelligentSectionsProps {
    swimlanes?: CuratedSwimlane[]
    onNavigate: (mediaId: number) => void
}

export const HomeIntelligentSections = React.memo(function HomeIntelligentSections({
    swimlanes,
    onNavigate,
}: HomeIntelligentSectionsProps) {
    if (!swimlanes?.length) return null

    return (
        <div className="space-y-20">
            {swimlanes.map((lane, idx) => (
                <ErrorBoundary
                    key={lane.id}
                >
                    <motion.div 
                        initial={{ opacity: 0, x: idx % 2 === 0 ? -20 : 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                        className="home-section"
                    >
                        <SmartSwimlane
                            lane={lane}
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
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="home-section space-y-8"
            >
                <SectionLabel icon={Zap} label="Seguir Viendo" />
                <Swimlane
                    title="Continuar Viendo"
                    items={items}
                    defaultAspect="wide"
                    onHover={onHover}
                />
            </motion.div>
        </ErrorBoundary>
    )
})
HomeContinueWatchingSection.displayName = "HomeContinueWatchingSection"

// ─── 2. Series ──────────────────────────────────────────────────────────────

interface HomeSeriesSectionProps {
    items: SwimlaneItem[]
    onHover?: (url: string | null) => void
}

export const HomeSeriesSection = React.memo(function HomeSeriesSection({
    items,
    onHover,
}: HomeSeriesSectionProps) {
    if (items.length === 0) return null

    return (
        <ErrorBoundary>
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="home-section space-y-8"
            >
                <SectionLabel icon={Tv} label="Series" />
                <Swimlane
                    title="Series"
                    items={items}
                    defaultAspect="poster"
                    onHover={onHover}
                />
            </motion.div>
        </ErrorBoundary>
    )
})
HomeSeriesSection.displayName = "HomeSeriesSection"

// ─── 3. Películas y Especiales ──────────────────────────────────────────────

interface HomeMoviesSectionProps {
    items: SwimlaneItem[]
    onHover?: (url: string | null) => void
}

export const HomeMoviesSection = React.memo(function HomeMoviesSection({
    items,
    onHover,
}: HomeMoviesSectionProps) {
    if (items.length === 0) return null

    return (
        <ErrorBoundary>
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="home-section space-y-8"
            >
                <SectionLabel icon={Film} label="Películas y Especiales" />
                <Swimlane
                    title="Películas y OVAs"
                    items={items}
                    defaultAspect="poster"
                    onHover={onHover}
                />
            </motion.div>
        </ErrorBoundary>
    )
})
HomeMoviesSection.displayName = "HomeMoviesSection"

// ─── 4. Añadido Recientemente (Bento Grid) ───────────────────────────────────

interface HomeRecentBentoSectionProps {
    items: BentoItem[]
}

export const HomeRecentBentoSection = React.memo(function HomeRecentBentoSection({
    items,
}: HomeRecentBentoSectionProps) {
    if (items.length === 0) return null

    return (
        <ErrorBoundary className="px-0">
            <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
                className="home-section space-y-12"
            >
                <SectionLabel icon={Sparkles} label="Nuevas Adiciones" />
                <BentoRecentlyAdded items={items} />
            </motion.div>
        </ErrorBoundary>
    )
})
HomeRecentBentoSection.displayName = "HomeRecentBentoSection"

// ─── 5. Biblioteca Completa (Fallback) ──────────────────────────────────────

interface HomeFullLibrarySectionProps {
    items: SwimlaneItem[]
    isLoading: boolean
}

export const HomeFullLibrarySection = React.memo(function HomeFullLibrarySection({
    items,
    isLoading,
}: HomeFullLibrarySectionProps) {
    if (isLoading || items.length === 0) return null

    return (
        <ErrorBoundary>
            <motion.div 
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 0.8 }}
                whileHover={{ opacity: 1 }}
                viewport={{ once: true }}
                className="home-section space-y-8 transition-opacity pb-20"
            >
                <SectionLabel icon={Globe2} label="Tu Videoteca" />
                <Swimlane
                    title="Tu colección"
                    items={items}
                    defaultAspect="poster"
                />
            </motion.div>
        </ErrorBoundary>
    )
})
// ─── 6. Filtrado por Vibe (Dinámico) ──────────────────────────────────────────

interface HomeVibeFilteredSectionProps {
    vibe: string
    items: SwimlaneItem[]
    onHover?: (url: string | null) => void
}

const VIBE_METADATA: Record<string, { label: string, description: string }> = {
    EPIC: { label: "Épico", description: "Historias legendarias, batallas memorables y momentos que definen épocas." },
    CHILL: { label: "Chill", description: "Contenido para relajar el alma. Slice of life, música y comedia ligera." },
    EMOTIONAL: { label: "Emocional", description: "Historias profundas que exploran la condición humana y el sentimiento." },
    HYPED: { label: "Hype", description: "Acción desenfrenada, aventuras épicas y adrenalina pura en cada episodio." },
    INTENSE: { label: "Intenso", description: "Suspenso psicológico, terror y thrillers que desafiarán tus sentidos." },
}

export const HomeVibeFilteredSection = React.memo(function HomeVibeFilteredSection({
    vibe,
    items,
    onHover,
}: HomeVibeFilteredSectionProps) {
    if (items.length === 0) return null

    const meta = VIBE_METADATA[vibe] || { label: vibe, description: "Colección curada por vibe." }

    return (
        <ErrorBoundary>
            <motion.div 
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -40 }}
                transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                className="home-section space-y-4 py-16 bg-gradient-to-b from-primary/5 via-transparent to-transparent border-t border-white/5"
            >
                <div className="px-6 md:px-10 lg:px-16 xl:px-24 2xl:px-32 flex flex-col gap-3">
                    <div className="flex items-center gap-4">
                        <div className="h-[1px] w-12 bg-primary/50" />
                        <span className="text-primary font-black tracking-[0.4em] text-[0.65rem] uppercase">EXPLORA EL MOOD</span>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                        <div className="space-y-1">
                            <h2 className="text-6xl md:text-8xl font-bebas tracking-widest text-white leading-none uppercase">
                                {meta.label}
                            </h2>
                            <p className="max-w-2xl text-zinc-400 text-lg md:text-xl font-light leading-relaxed">
                                {meta.description}
                            </p>
                        </div>
                        <div className="flex items-center gap-4 text-[0.6rem] font-bold tracking-[0.2em] text-white/20 uppercase pb-2">
                            <span>{items.length} Títulos</span>
                            <div className="h-1 w-1 rounded-full bg-white/20" />
                            <span>Curación Manual</span>
                        </div>
                    </div>
                </div>
                <Swimlane
                    title=""
                    items={items}
                    defaultAspect="poster"
                    onHover={onHover}
                    className="!py-0"
                />
            </motion.div>
        </ErrorBoundary>
    )
})
HomeVibeFilteredSection.displayName = "HomeVibeFilteredSection"
