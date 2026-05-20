import * as React from "react"
import { motion } from "framer-motion"
import { Zap } from "lucide-react"
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



