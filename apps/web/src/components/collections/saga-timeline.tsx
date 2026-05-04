import * as React from "react"
import { motion } from "framer-motion"
import { Play, Calendar, ChevronRight } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import type { MediaCollectionData, MediaCollectionPart } from "@/api/hooks/collections.hooks"

interface SagaTimelineProps {
    collection: MediaCollectionData
    className?: string
}

// Sort parts chronologically by release date
function sortedParts(parts: MediaCollectionPart[]) {
    return [...parts].sort((a, b) => {
        const da = a.releaseDate ?? ""
        const db = b.releaseDate ?? ""
        return da.localeCompare(db)
    })
}

function formatYear(dateStr?: string) {
    if (!dateStr) return null
    return dateStr.slice(0, 4)
}

export function SagaTimeline({ collection, className }: SagaTimelineProps) {
    const parts = sortedParts(collection.parts)

    return (
        <section aria-label="Orden cronológico de la saga" className={cn("", className)}>
            {/* Section header */}
            <div className="mb-8 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/[0.06]" />
                <h2 className="font-bebas text-xl font-normal uppercase tracking-widest text-zinc-400">
                    Orden de Visionado
                </h2>
                <div className="h-px flex-1 bg-white/[0.06]" />
            </div>

            {/* Timeline */}
            <div className="relative flex flex-col gap-0">
                {/* Vertical connector line */}
                <div className="absolute left-[calc(120px+1.5rem)] top-6 bottom-6 w-px bg-white/[0.07] hidden md:block" />

                {parts.map((part, index) => (
                    <SagaTimelineEntry
                        key={part.id}
                        part={part}
                        index={index}
                        isLast={index === parts.length - 1}
                    />
                ))}
            </div>
        </section>
    )
}

function SagaTimelineEntry({
    part,
    index,
    isLast,
}: {
    part: MediaCollectionPart
    index: number
    isLast: boolean
}) {
    const year = formatYear(part.releaseDate)
    const poster = part.posterPath
        ? `https://image.tmdb.org/t/p/w342${part.posterPath}`
        : null

    return (
        <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4, delay: index * 0.07 }}
            className={cn(
                "group relative flex gap-6 py-5",
                !isLast && "border-b border-white/[0.05]",
            )}
        >
            {/* --- Step number (left column, desktop) --- */}
            <div className="hidden w-[120px] shrink-0 flex-col items-end justify-start gap-1 pt-1 md:flex">
                <span className="font-bebas text-5xl font-normal text-white/[0.06] leading-none group-hover:text-white/10 transition-colors">
                    {String(index + 1).padStart(2, "0")}
                </span>
                {year && (
                    <span className="flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-zinc-600">
                        <Calendar className="h-2.5 w-2.5" />
                        {year}
                    </span>
                )}
            </div>

            {/* --- Connector dot (desktop) --- */}
            <div className="relative hidden items-start justify-center pt-3 md:flex">
                <div className="relative z-10 h-3 w-3 rounded-full border-2 border-zinc-700 bg-[#09090b] group-hover:border-[#ff6b00] group-hover:shadow-[0_0_15px_rgba(255,107,0,0.6)] transition-all duration-300" />
            </div>

            {/* --- Poster --- */}
            <div className="shrink-0">
                {poster ? (
                    <img
                        src={poster}
                        alt={part.title}
                        className="h-28 w-[4.5rem] rounded-xl object-cover shadow-lg transition-transform duration-300 group-hover:scale-105 md:h-36 md:w-24"
                    />
                ) : (
                    <div className="flex h-28 w-[4.5rem] items-center justify-center rounded-xl bg-white/5 text-zinc-700 md:h-36 md:w-24">
                        <Play className="h-6 w-6" />
                    </div>
                )}
            </div>

            {/* --- Meta --- */}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1">
                {/* Mobile: index + year */}
                <div className="flex items-center gap-2 md:hidden">
                    <span className="font-bebas text-3xl font-normal text-white/20 leading-none">
                        {String(index + 1).padStart(2, "0")}
                    </span>
                    {year && (
                        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                            {year}
                        </span>
                    )}
                </div>

                <h3 className="font-bebas text-2xl font-normal uppercase leading-tight text-white/90 group-hover:text-[#ff6b00] transition-colors md:text-3xl">
                    {part.title}
                </h3>

                {part.overview && (
                    <p className="line-clamp-2 text-sm leading-6 text-zinc-500">
                        {part.overview}
                    </p>
                )}

                {/* CTA chip */}
                <div className="mt-auto pt-2">
                    <button
                        type="button"
                        className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5",
                            "px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-widest text-zinc-400",
                            "opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:border-[#ff6b00]/40 group-hover:text-[#ff6b00] group-hover:shadow-[0_0_15px_rgba(255,107,0,0.2)]",
                        )}
                    >
                        <Play className="h-2.5 w-2.5 fill-current" />
                        Ver película
                        <ChevronRight className="h-3 w-3" />
                    </button>
                </div>
            </div>
        </motion.div>
    )
}
