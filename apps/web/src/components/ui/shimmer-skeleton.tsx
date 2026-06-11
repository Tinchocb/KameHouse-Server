import * as React from "react"
import { Skeleton } from "@/components/ui/skeleton/skeleton"
import { cn } from "@/components/ui/core/styling"

// Renders a grid of poster cards mimicking PremiumPosterCard
export function PosterGridSkeleton({ count = 8, className }: { count?: number; className?: string }) {
    return (
        <div className={cn("grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6", className)}>
            {Array.from({ length: count }).map((_, idx) => (
                <div key={idx} className="flex flex-col gap-2">
                    <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
                    <Skeleton className="h-5 w-3/4 rounded-md mt-1" />
                    <Skeleton className="h-4 w-1/2 rounded-md" />
                </div>
            ))}
        </div>
    )
}

// Renders a premium Bento layout skeleton for series/movies detail pages
export function BentoDetailsSkeleton({ className }: { className?: string }) {
    return (
        <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-6 p-6", className)}>
            {/* Main Hero Banner / Backdrop Skeleton */}
            <div className="md:col-span-3">
                <Skeleton className="h-[40vh] sm:h-[50vh] w-full rounded-3xl" />
            </div>

            {/* Left Column: Poster + Metadata */}
            <div className="flex flex-col gap-4">
                <Skeleton className="aspect-[2/3] w-full max-w-[300px] mx-auto md:mx-0 rounded-2xl" />
                <Skeleton className="h-6 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-xl" />
            </div>

            {/* Right Column: Title, Details, Interactive Actions */}
            <div className="md:col-span-2 flex flex-col gap-6">
                <div className="space-y-3">
                    <Skeleton className="h-10 w-2/3 rounded-lg" />
                    <Skeleton className="h-6 w-1/3 rounded-md" />
                </div>
                <div className="flex gap-3">
                    <Skeleton className="h-12 w-32 rounded-full" />
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <Skeleton className="h-12 w-12 rounded-full" />
                </div>
                <Skeleton className="h-32 w-full rounded-2xl" />
                <div className="space-y-2">
                    <Skeleton className="h-8 w-1/4 rounded-md" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <Skeleton className="h-10 rounded-lg" />
                        <Skeleton className="h-10 rounded-lg" />
                        <Skeleton className="h-10 rounded-lg" />
                    </div>
                </div>
            </div>
        </div>
    )
}

// Renders a list layout skeleton for episodes list
export function EpisodeListSkeleton({ count = 5, className }: { count?: number; className?: string }) {
    return (
        <div className={cn("space-y-3", className)}>
            {Array.from({ length: count }).map((_, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-4 p-4 rounded-2xl border border-white/5 bg-zinc-950/20 backdrop-blur-sm">
                    {/* Episode Thumbnail */}
                    <Skeleton className="aspect-video w-full sm:w-48 rounded-xl shrink-0" />
                    
                    {/* Episode Meta */}
                    <div className="flex-1 flex flex-col justify-between py-1 gap-2">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-5 w-20 rounded-md" />
                                <Skeleton className="h-5 w-40 rounded-md" />
                            </div>
                            <Skeleton className="h-4 w-5/6 rounded-md" />
                        </div>
                        <div className="flex justify-between items-center mt-2 sm:mt-0">
                            <Skeleton className="h-6 w-24 rounded-full" />
                            <Skeleton className="h-8 w-8 rounded-full" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}
