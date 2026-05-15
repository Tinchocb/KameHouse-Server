import { HorizontalDraggableScroll } from "@/components/ui/horizontal-draggable-scroll"
import { MediaCard } from "./media-card"
import { MediaStack } from "./media-stack"
import { motion } from "framer-motion"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/components/ui/core/styling"
import type { CardAspect } from "@/api/types/intelligence.types"
import * as React from "react"

export interface SwimlaneItem {
    id: string
    title: string
    image: string
    subtitle?: string
    badge?: string
    availabilityType?: "FULL_LOCAL" | "HYBRID" | "ONLY_ONLINE"
    description?: string
    progress?: number
    aspect?: CardAspect
    /** ContentTag from IntelligenceService — rendered as a bottom label on the card */
    intelligenceTag?: string
    year?: string | number
    rating?: number
    onClick: () => void
    /** URL to use as the dynamic home backdrop when this card is hovered */
    backdropUrl?: string
}

export interface SwimlaneProps {
    title: string
    items: SwimlaneItem[]
    defaultAspect?: CardAspect
    /**
     * Called with the hovered item's backdropUrl (or null on mouse leave).
     * Used by the home page to drive the Seanime-style dynamic backdrop.
     */
    onHover?: (url: string | null) => void
    className?: string
}

const SwimlaneInner = React.memo(function SwimlaneInner({
    title,
    items,
    defaultAspect = "poster",
    onHover,
    className,
}: SwimlaneProps) {
    const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null)

    if (items.length === 0) {
        return null
    }

    return (
        <section className={cn("relative py-8", className)}>
            {title && (
                <div className="mb-8 flex items-center gap-4 px-6 md:px-12 lg:px-20">
                    <h2 className="text-3xl font-bebas font-normal uppercase tracking-[0.15em] text-white/90">
                        {title}
                    </h2>
                </div>
            )}

            <div className="relative group/swimlane">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-30 hidden w-48 bg-gradient-to-r from-zinc-950 via-zinc-950/20 to-transparent md:block" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-30 hidden w-48 bg-gradient-to-l from-zinc-950 via-zinc-950/20 to-transparent md:block" />

                <HorizontalDraggableScroll
                    className="px-0"
                    containerClass="gap-6 px-6 pb-12 md:px-12 lg:px-20 xl:px-24 2xl:px-28"
                    chevronOverlayClass="from-zinc-950/95 to-transparent"
                    scrollAmount={420}
                    safeDisplacement={18}
                    applyRubberBandEffect
                >
                    {items.map((item, index) => {
                        const isHovered = hoveredIndex === index
                        const isNeighbor = hoveredIndex !== null && Math.abs(hoveredIndex - index) === 1
                        const isOther = hoveredIndex !== null && !isHovered && !isNeighbor

                        return (
                            <motion.div
                                key={item.id}
                                className="snap-start"
                                onMouseEnter={() => {
                                    setHoveredIndex(index)
                                    onHover?.(item.backdropUrl ?? null)
                                }}
                                onMouseLeave={() => {
                                    setHoveredIndex(null)
                                    onHover?.(null)
                                }}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                animate={{ 
                                    scale: isHovered ? 1.05 : hoveredIndex !== null ? 0.96 : 1,
                                    opacity: isOther ? 0.6 : 1,
                                    zIndex: isHovered ? 40 : 10,
                                }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ 
                                    type: "spring",
                                    stiffness: 260,
                                    damping: 20,
                                    delay: hoveredIndex === null ? index * 0.03 : 0,
                                }}
                            >
                                {item.badge === "TV" ? (
                                    <MediaStack
                                        artwork={item.image}
                                        title={item.title}
                                        subtitle={item.subtitle}
                                        badge={item.badge}
                                        availabilityType={item.availabilityType}
                                        description={item.description}
                                        progress={item.progress}
                                        aspect={item.aspect ?? defaultAspect}
                                        intelligenceTag={item.intelligenceTag}
                                        year={item.year}
                                        rating={item.rating}
                                        onClick={item.onClick}
                                        layoutId={`poster-${item.id}`}
                                        className="motion-reduce:transition-none shadow-2xl transition-shadow duration-500 hover:shadow-primary/10"
                                    />
                                ) : (
                                    <MediaCard
                                        artwork={item.image}
                                        title={item.title}
                                        subtitle={item.subtitle}
                                        badge={item.badge}
                                        availabilityType={item.availabilityType}
                                        description={item.description}
                                        progress={item.progress}
                                        aspect={item.aspect ?? defaultAspect}
                                        intelligenceTag={item.intelligenceTag}
                                        year={item.year}
                                        rating={item.rating}
                                        onClick={item.onClick}
                                        layoutId={`poster-${item.id}`}
                                        className="motion-reduce:transition-none shadow-2xl transition-shadow duration-500 hover:shadow-primary/10"
                                    />
                                )}
                            </motion.div>
                        )
                    })}
                </HorizontalDraggableScroll>
            </div>
        </section>
    )
})
SwimlaneInner.displayName = "Swimlane"

export function SwimlaneSkeleton({
    title,
    aspect = "poster",
    itemCount = 6,
    className,
}: {
    title?: string
    aspect?: CardAspect
    itemCount?: number
    className?: string
}) {
    const cardWidths = {
        poster: "w-[160px] md:w-[200px] lg:w-[240px]",
        wide: "w-[280px] md:w-[360px] lg:w-[440px]",
        square: "w-[180px] md:w-[240px] lg:w-[300px]",
    }

    const cardAspects = {
        poster: "aspect-[2/3]",
        wide: "aspect-[16/9]",
        square: "aspect-square",
    }

    return (
        <section className={cn("relative py-8", className)}>
            <div className="mb-10 flex items-center gap-6 px-6 md:px-12 lg:px-20">
                <Skeleton className="h-10 w-48 bg-white/5 rounded-lg" />
            </div>

            <div className="flex gap-6 overflow-hidden px-6 pb-3 md:px-12 lg:px-20">
                {Array.from({ length: itemCount }).map((_, i) => (
                    <div key={i} className={cn("flex-shrink-0", cardWidths[aspect])}>
                        <Skeleton className={cn("mb-6 bg-white/[0.03] border border-white/5 rounded-2xl shadow-2xl", cardAspects[aspect])} />
                        <Skeleton className="mb-3 h-5 w-3/4 bg-white/[0.02] rounded-md" />
                        <Skeleton className="h-4 w-1/2 bg-white/[0.015] rounded-md" />
                    </div>
                ))}
            </div>
        </section>
    )
}


/** Public API — Swimlane with React.memo for backdrop-change isolation. */
export const Swimlane = SwimlaneInner
/** Alias provided for consumers that prefer the Carousel naming convention. */
export const MediaCarousel = SwimlaneInner
