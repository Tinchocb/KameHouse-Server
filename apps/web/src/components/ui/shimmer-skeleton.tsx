import * as React from "react"
import { HERO_STAGE_CLASS } from "@/lib/config/hero-stage"
import { Skeleton } from "@/components/ui/skeleton/skeleton"
import { cn } from "@/components/ui/core/styling"

// Renders a grid of poster cards mimicking MoviePosterCard (clean
// aspect-[2/3] rounded-2xl poster + title/meta block below)
export function PosterGridSkeleton({ count = 8, className }: { count?: number; className?: string }) {
    return (
        <div role="status" aria-label="Cargando contenido" className={cn("grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6", className)}>
            {Array.from({ length: count }).map((_, idx) => (
                <div key={idx} className="flex flex-col gap-2.5">
                    <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
                    <Skeleton className="h-4 w-3/4 rounded-md" />
                    <Skeleton className="h-3 w-1/3 rounded-md" />
                </div>
            ))}
        </div>
    )
}

// Renders a cinematic detail skeleton that mirrors MediaHero (series/movies):
// black surface + white-tone border, same heights so there's no layout shift.
export function BentoDetailsSkeleton({ className }: { className?: string }) {
    return (
        <div role="status" aria-label="Cargando contenido" className={cn("relative min-h-screen text-on-surface overflow-x-hidden", className)}>
            <div className="relative z-10 flex flex-col page-container pt-4 md:pt-20 pb-8 space-y-4">
                {/* Hero cinematográfico — espeja MediaHero min-h-[70svh] */}
                <div className="relative w-full min-h-[70svh] lg:min-h-[80svh] rounded-3xl overflow-hidden border border-white/[0.13] bg-bg-primary shadow-glass-highlight-sm flex flex-col justify-end p-6 sm:p-8 md:p-10">
                    <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6 md:gap-10">
                        {/* Póster */}
                        <Skeleton className="w-24 sm:w-32 md:w-36 lg:w-44 shrink-0 aspect-[2/3] h-auto rounded-2xl" />
                        <div className="flex-1 flex flex-col gap-4 w-full">
                            <Skeleton className="h-6 w-28 rounded-full" />
                            <Skeleton className="h-10 sm:h-12 w-3/4 max-w-lg rounded-xl" />
                            <Skeleton className="h-6 w-64 max-w-full rounded-lg" />
                            <Skeleton className="h-14 w-full max-w-xl rounded-xl" />
                            <div className="flex flex-wrap items-center gap-3 pt-1">
                                <Skeleton className="h-10 w-36 rounded-full" />
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <Skeleton className="h-10 w-10 rounded-full" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lower hub — espeja SeriesEpisodesTab: segmented + grid */}
                <Skeleton className="h-12 w-full rounded-full" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
                    {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={idx} className="flex flex-col gap-2.5">
                    <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
                    <Skeleton className="h-4 w-3/4 rounded-md" />
                    <Skeleton className="h-3 w-1/3 rounded-md" />
                </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
/**
 * HomeSkeleton — espeja el layout de MediaSpotlight + SectionBar:
 *   - Hero: usa HERO_STAGE_CLASS directamente (sin copia que se desincronice)
 *   - Barra de eras: h-9 rounded-2xl (pill horizontal de eras)
 *   - Hub inferior: segmented control h-11 + grid de posters
 *
 * Usar durante la carga inicial de la ruta Home para evitar layout shift.
 */
export function HomeSkeleton({ className }: { className?: string }) {
    return (
        <div role="status" aria-label="Cargando contenido" className={cn("relative min-h-screen text-on-surface overflow-x-hidden", className)}>
            <div className="relative z-10 flex flex-col page-container pt-4 md:pt-20 pb-8 space-y-4">
                {/* Hero cinematográfico — espeja HERO_STAGE_CLASS */}
                <Skeleton className={cn("w-full rounded-3xl", HERO_STAGE_CLASS)} />

                {/* Barra de navegación de eras — espeja pill horizontal */}
                <Skeleton className="h-9 w-full rounded-2xl" />

                {/* Hub inferior: segmented control + grid */}
                <Skeleton className="h-11 w-64 rounded-full mx-auto" />

                {/* Grid de posters — espeja catálogo */}
                <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={idx} className="flex flex-col gap-2.5">
                    <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
                    <Skeleton className="h-4 w-3/4 rounded-md" />
                    <Skeleton className="h-3 w-1/3 rounded-md" />
                </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
