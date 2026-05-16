import * as React from "react"
import { Swimlane, type SwimlaneItem } from "@/components/ui/swimlane"
import type { CuratedSwimlane, ContentTag } from "@/api/types/intelligence.types"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"


// ─── Intelligence badge helpers ───────────────────────────────────────────────

/** Returns the visible label + Tailwind colour classes for a ContentTag. */
function tagBadge(tag: ContentTag): { label: string; className: string } | null {
    switch (tag) {
        case "EPIC":
            return {
                label: "ÉPICO",
                className: "bg-amber-500/10 border-amber-500/30 text-amber-500 backdrop-blur-md",
            }
        case "FILLER":
            return {
                label: "RELLENO",
                className: "bg-zinc-800/50 border-zinc-700/50 text-zinc-400 backdrop-blur-md",
            }
        case "SPECIAL":
            return {
                label: "ESPECIAL",
                className: "bg-blue-500/10 border-blue-500/30 text-blue-400 backdrop-blur-md",
            }
        default:
            return null
    }
}

/** Derived badge from lane type when the entry has no explicit intelligence tag. */
function laneBadge(laneType: string): string {
    switch (laneType) {
        case "epic_moments":
            return "Épico 🔥"
        case "essential_cinema":
            return "Esencial 🏆"
        case "local_library":
            return "Local"
        default:
            return ""
    }
}


// ─── SmartSwimlane ────────────────────────────────────────────────────────────

export interface SmartSwimlaneProps {
    lane: CuratedSwimlane
    onNavigate: (mediaId: string) => void
    /** Show posters instead of wide backdrops for "local_library" type lanes */
    aspect?: "poster" | "wide"
}

import { 
    Sparkles, 
    Play, 
    Award, 
    Library, 
    Zap, 
    Sword, 
    History, 
    Users, 
    Heart, 
    Flame, 
    Shield 
} from "lucide-react"
import { SectionLabel } from "@/routes/home/home.components"

const LANE_ICONS: Record<string, any> = {
    epic_moments: Play,
    essential_cinema: Award,
    local_library: Library,
    eleva_tu_ki: Zap,
    camino_guerrero: Sword,
    cronicas_trunks: History,
    fusion_ha: Users,
    redencion: Heart,
    deseos_prohibidos: Flame,
    fuera_ring: Shield,
}

export const SmartSwimlane = React.memo(function SmartSwimlane({ lane, onNavigate, aspect }: SmartSwimlaneProps) {
    const { setBackdropUrl } = useIntelligenceStore()

    const resolvedAspect = aspect ?? (lane.type === "local_library" ? "poster" : "wide")

    const items: SwimlaneItem[] = React.useMemo(() => {
        return lane.entries.map((entry) => {
            const media = entry.media
            const intel = entry.intelligence

            // Backend-derived badge wins; fall back to lane-level label
            const badge =
                intel?.tag && intel.tag !== "CANON"
                    ? (tagBadge(intel.tag)?.label ?? laneBadge(lane.type))
                    : laneBadge(lane.type)

            const isEpisode = !!entry.episode
            const fallbackBackdrop = media?.bannerImage || media?.posterImage
            
            // Subtitle construction
            const parts: string[] = []
            if (isEpisode) {
                // Si es episodio, mostrar la serie como subtítulo
                parts.push(media?.titleEnglish || media?.titleRomaji || media?.titleOriginal || "—")
                if (intel?.arcName) parts.push(intel.arcName)
            } else {
                if (media?.year) parts.push(String(media.year))
                if (media?.format) parts.push(media.format)
                if (intel?.arcName) parts.push(intel.arcName)
                if (intel?.vibes?.length) {
                    parts.push(intel.vibes.join(" · "))
                }
            }

            const title = isEpisode
                ? entry.episode!.titleSpanish || entry.episode!.episodeTitle || `Episodio ${entry.episode!.episodeNumber}`
                : media?.titleEnglish || media?.titleRomaji || media?.titleOriginal || "—"
            
            const image = isEpisode
                ? (entry.episode!.episodeMetadata?.image || fallbackBackdrop || "")
                : (resolvedAspect === "poster" ? (media?.posterImage ?? "") : (fallbackBackdrop ?? ""))

            return {
                id: isEpisode ? `ep-${entry.mediaId}-${entry.episode!.episodeNumber}` : String(entry.mediaId),
                title,
                subtitle: parts.join(" · "),
                badge,
                image,
                availabilityType: entry.availabilityType as SwimlaneItem["availabilityType"],
                backdropUrl: fallbackBackdrop ?? undefined,
                description: isEpisode ? entry.episode!.episodeMetadata?.summary : media?.description,
                intelligenceTag: intel?.tag,
                year: media?.year,
                rating: intel?.rating,
                episodeNumber: isEpisode ? entry.episode!.episodeNumber : undefined,
                onClick: () => {
                    if (isEpisode) {
                        // Idealmente iríamos al player directo, pero onNavigate(mediaId) está bien
                        // para que vaya a la página de la serie y el usuario elija.
                        onNavigate(String(entry.mediaId))
                    } else {
                        onNavigate(String(entry.mediaId))
                    }
                },
            }
        })
    }, [lane, onNavigate, resolvedAspect])

    if (items.length === 0) return null

    const Icon = LANE_ICONS[lane.type] ?? Sparkles

    return (
        <div className="space-y-4">
            <SectionLabel icon={Icon} label={lane.title} />
            <Swimlane
                title=""
                items={items}
                defaultAspect={resolvedAspect}
                onHover={setBackdropUrl}
            />
        </div>
    )
})
SmartSwimlane.displayName = "SmartSwimlane"
