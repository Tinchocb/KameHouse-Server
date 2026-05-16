import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { 
    Tv, 
    Zap, 
    Film, 
    Sparkles, 
    Globe2,
    Play
} from "lucide-react"
import { Swimlane, type SwimlaneItem } from "@/components/ui/swimlane"
import { BentoRecentlyAdded, type BentoItem } from "@/components/ui/bento-recently-added"
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
                        id={`lane-${lane.type}`}
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
                        className="home-section space-y-12"
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
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1 }}
                className="home-section relative py-20 bg-white/[0.015] border-y border-white/[0.03]"
            >
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
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
                className="home-section space-y-12 pt-20"
            >
                <SectionLabel icon={Tv} label="Series" index="COLL" />
                <Swimlane
                    title=""
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
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
                className="home-section space-y-12 pt-20"
            >
                <SectionLabel icon={Film} label="Películas y Especiales" index="MOV" />
                <Swimlane
                    title=""
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
                transition={{ duration: 1.2, ease: [0.23, 1, 0.32, 1] }}
                className="home-section space-y-16 py-24 bg-gradient-to-b from-primary/5 via-transparent to-transparent"
            >
                <SectionLabel icon={Sparkles} label="Nuevas Adiciones" index="NEW" />
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
                className="home-section space-y-12 py-20 transition-opacity pb-32"
            >
                <SectionLabel icon={Globe2} label="Tu Videoteca" index="LIB" />
                <Swimlane
                    title=""
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
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="home-section relative overflow-hidden"
            >
                {/* Reveal Mask Animation */}
                <motion.div 
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute inset-0 bg-primary z-50 pointer-events-none"
                />

                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3, duration: 1, ease: [0.23, 1, 0.32, 1] }}
                    className="space-y-12 py-24 bg-gradient-to-b from-primary/10 via-transparent to-transparent border-t border-white/5"
                >
                    <div className="px-6 md:px-12 lg:px-20 flex flex-col gap-6">
                        <div className="flex items-center gap-4">
                            <div className="h-[2px] w-16 bg-primary" />
                            <span className="text-primary font-bold tracking-[0.4em] text-[0.7rem] uppercase">EXPLORA EL MOOD</span>
                        </div>
                        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
                            <div className="space-y-4">
                                <h2 className="text-7xl md:text-9xl font-bebas tracking-tighter text-white leading-none uppercase">
                                    {meta.label}
                                <span className="text-primary">.</span>
                                </h2>
                                <p className="max-w-3xl text-zinc-400 text-xl md:text-2xl font-light leading-relaxed">
                                    {meta.description}
                                </p>
                            </div>
                            <div className="flex items-center gap-6 text-[0.7rem] font-bold tracking-[0.2em] text-white/10 uppercase pb-4">
                                <span>{items.length} TÍTULOS</span>
                                <div className="h-1 w-1 rounded-full bg-white/10" />
                                <span>CURACIÓN IA</span>
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
            </motion.div>
        </ErrorBoundary>
    )
})
HomeVibeFilteredSection.displayName = "HomeVibeFilteredSection"
