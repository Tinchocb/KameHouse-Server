"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { IconMediaPlay } from "@/components/ui/icons";
import { cn } from "@/components/ui/core/styling"
import { getMediumResImage } from "@/lib/helpers/images"
import { DeferredImage } from "@/components/shared/deferred-image"
import type { SwimlaneItem } from "@/components/ui/swimlane"
import type { SagaDefinition } from "@/lib/config/dragonball_sagas"
import type { ERA_COLOR_MAP, EraId } from "@/lib/config/eras"
import { spotlightCardItemVariants } from "@/components/ui/spotlight/spotlight-movie-card"

interface CatalogGridProps {
    items: SwimlaneItem[]
    onNavigate: (item: SwimlaneItem) => void
    onHover?: () => void
    emptyMessage?: string
    emptyAction?: React.ReactNode
    className?: string
}

export function MoviesGrid({
    items,
    onNavigate,
    onHover,
    emptyMessage = "No hay películas en tu biblioteca.",
    emptyAction,
    className,
}: CatalogGridProps) {
    if (items.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-12 text-center"
            >
                <p className="text-on-surface-variant text-sm mb-4">{emptyMessage}</p>
                {emptyAction}
            </motion.div>
        )
    }

    return (
        <motion.div
            variants={spotlightCardItemVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5"
        >
            {items.map((movie, idx) => (
                <MovieGridCard
                    key={movie.id}
                    movie={movie}
                    index={idx + 1}
                    onNavigate={onNavigate}
                    onHover={onHover}
                />
            ))}
        </motion.div>
    )
}

interface MovieGridCardProps {
    movie: SwimlaneItem
    index: number
    onNavigate: (item: SwimlaneItem) => void
    onHover?: () => void
}

function MovieGridCard({ movie, index, onNavigate, onHover }: MovieGridCardProps) {
    const posterSrc = movie.image
        ? (movie.image.startsWith("/") ? movie.image : getMediumResImage(movie.image))
        : (movie.backdropUrl || "")

    const isSpecial = movie.badge === "SPECIAL" || movie.badge === "OVA" || movie.title.toLowerCase().includes("especial") || movie.title.toLowerCase().includes("ova")
    const indexLabel = isSpecial ? "OVA" : `#${String(index).padStart(2, '0')}`

    return (
        <motion.div
            variants={spotlightCardItemVariants}
            custom={index}
            onClick={() => onNavigate(movie)}
            onMouseEnter={onHover}
            className={cn(
                "group relative w-full aspect-[2/3] rounded-2xl overflow-hidden cursor-pointer border border-[var(--glass-border-side)] select-none shrink-0 bg-[var(--md-sys-color-surface-container)] transform-gpu",
                "transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.97]",
                "hover:z-10 hover:shadow-[0_15px_35px_rgba(0,0,0,0.9)]"
            )}
            style={{
                borderColor: "var(--glass-border-side)",
            }}
        >
            <DeferredImage
                src={posterSrc}
                alt={movie.title}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />

            <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-20 pointer-events-none">
                {indexLabel && (
                    <span className={cn(
                        "text-[9px] font-mono font-black tracking-wider px-2 py-0.5 rounded-md border shadow-elevation-1 uppercase",
                        isSpecial
                            ? "bg-[var(--glass-bg-strong)] text-[var(--brand-secondary-hex)] border-[var(--glass-border-top)]"
                            : "bg-[var(--glass-bg-strong)] text-on-surface border-[var(--glass-border-side)]"
                    )}>
                        {indexLabel}
                    </span>
                )}
                {movie.year && (
                    <span className="text-[9px] font-mono font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-[var(--glass-bg-strong)] border border-[var(--glass-border-side)] text-on-surface-variant uppercase ml-auto">
                        {movie.year}
                    </span>
                )}
            </div>

            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent z-10" />

            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 pointer-events-none">
                <div
                    onClick={(e) => {
                        e.stopPropagation()
                        onNavigate(movie)
                    }}
                    className="w-12 h-12 rounded-full flex items-center justify-center text-on-primary bg-brand-accent shadow-xl shadow-brand-accent/50 pointer-events-auto cursor-pointer transition-transform duration-150 hover:scale-110 active:scale-90"
                >
                    <IconMediaPlay size={18} fill="currentColor" className="ml-0.5" />
                </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 z-20 p-3 flex flex-col justify-end">
                <p className="text-white font-bold text-xs sm:text-sm uppercase tracking-wide leading-tight line-clamp-2 text-edge-glow group-hover:text-brand-accent transition-colors font-display">
                    {movie.title}
                </p>
            </div>
        </motion.div>
    )
}

interface SagasGridProps {
    items: Array<{ saga: SagaDefinition; thumbnailUrl?: string | null; seriesId: number }>
    onNavigate: (seriesId: number, sagaId: string) => void
    onHover?: () => void
    colors?: typeof ERA_COLOR_MAP[EraId]
    emptyMessage?: string
    className?: string
}

export function SagasGrid({
    items,
    onNavigate,
    onHover,
    colors,
    emptyMessage = "No hay sagas disponibles para esta serie.",
    className,
}: SagasGridProps) {
    if (items.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-12 text-center"
            >
                <p className="text-on-surface-variant text-sm">{emptyMessage}</p>
            </motion.div>
        )
    }

    return (
        <motion.div
            variants={spotlightCardItemVariants}
            initial="hidden"
            animate="visible"
            className={cn("grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4", className)}
        >
            {items.map(({ saga, thumbnailUrl, seriesId }, idx) => (
                <SagaGridCard
                    key={saga.id}
                    saga={saga}
                    thumbnailUrl={thumbnailUrl}
                    seriesId={seriesId}
                    index={idx}
                    colors={colors}
                    onNavigate={onNavigate}
                    onHover={onHover}
                />
            ))}
        </motion.div>
    )
}

interface SagaGridCardProps {
    saga: SagaDefinition
    thumbnailUrl?: string | null
    seriesId: number
    index: number
    colors?: typeof ERA_COLOR_MAP[EraId]
    onNavigate: (seriesId: number, sagaId: string) => void
    onHover?: () => void
}

function SagaGridCard({ saga, thumbnailUrl, seriesId, index, colors, onNavigate, onHover }: SagaGridCardProps) {
    const sagaImage = thumbnailUrl || ""
    const epRange = `Ep. ${saga.startEp} — ${saga.endEp}`
    const epCount = saga.endEp - saga.startEp + 1

    const isFiller = saga.title.toLowerCase().includes("relleno")
    const cleanTitle = saga.title.replace(/\s*\([Rr]elleno\)\s*/g, "").trim()

    const accentColor = colors?.ambientGlow1 || "var(--brand-accent)"
    const glowStrong = colors?.glowStrong || "var(--brand-glow)"

    const cardStyle: React.CSSProperties & Record<string, string | number> = {
        borderColor: `color-mix(in srgb, ${glowStrong} 20%, rgba(255,255,255,0.1))`,
        "--spotlight-title-hover": accentColor,
    }

    return (
        <motion.div
            variants={spotlightCardItemVariants}
            custom={index}
            onClick={() => onNavigate(seriesId, saga.id)}
            onMouseEnter={onHover}
            className={cn(
                "group relative w-full aspect-[16/9] rounded-2xl overflow-hidden cursor-pointer border select-none shrink-0 bg-[var(--md-sys-color-surface-container)] transform-gpu",
                "transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.97]",
                "hover:z-10 hover:shadow-[0_15px_35px_rgba(0,0,0,0.9)]"
            )}
            style={cardStyle}
        >
            <DeferredImage
                src={sagaImage}
                alt={cleanTitle}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />

            <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-20 pointer-events-none">
                <span className="text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-md bg-[var(--glass-bg-strong)] border border-[var(--glass-border-top)] text-[var(--status-warning)] uppercase shadow-elevation-1">
                    {epRange}
                </span>
                {isFiller ? (
                    <span className="text-[9px] font-mono font-black tracking-wider px-2 py-0.5 rounded-md bg-[var(--glass-bg-strong)] border border-[var(--glass-border-top)] text-[var(--brand-secondary-hex)] uppercase shadow-elevation-1">
                        Relleno
                    </span>
                ) : saga.subSagas && saga.subSagas.length > 0 ? (
                    <span className="text-[9px] font-mono font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-[var(--glass-bg-strong)] border border-[var(--glass-border-side)] text-on-surface-variant uppercase shadow-elevation-1">
                        {saga.subSagas.length} {saga.subSagas.length === 1 ? "arco" : "arcos"}
                    </span>
                ) : null}
            </div>

            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent z-10 pointer-events-none" />

            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 pointer-events-none">
                <div
                    onClick={(e) => {
                        e.stopPropagation()
                        onNavigate(seriesId, saga.id)
                    }}
                    className="w-12 h-12 rounded-full flex items-center justify-center text-on-primary bg-brand-accent shadow-xl shadow-brand-accent/50 pointer-events-auto cursor-pointer transition-transform duration-150 hover:scale-110 active:scale-90"
                >
                    <IconMediaPlay size={18} fill="currentColor" className="ml-0.5" />
                </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 z-20 p-3 sm:p-3.5 flex flex-col justify-end pointer-events-none">
                <p className="text-white font-bold text-xs sm:text-sm uppercase tracking-wide leading-tight line-clamp-1 text-edge-glow group-hover:text-[var(--spotlight-title-hover)] transition-colors font-display">
                    {cleanTitle}
                </p>
                <div className="flex items-center gap-2 text-on-surface-variant text-[10px] sm:text-[11px] font-mono mt-0.5">
                    <span>{epCount} {epCount === 1 ? "episodio" : "episodios"}</span>
                    {saga.subSagas && saga.subSagas.length > 0 && (
                        <>
                            <span className="w-1 h-1 rounded-full bg-on-surface-variant/40" />
                            <span>{saga.subSagas.length} {saga.subSagas.length === 1 ? "arco" : "arcos"}</span>
                        </>
                    )}
                </div>
            </div>
        </motion.div>
    )
}