import { createFileRoute } from "@tanstack/react-router"
import * as React from "react"
import { useGetMediaCollection } from "@/api/hooks/collections.hooks"
import { CollectionHero } from "@/components/collections/collection-hero"
import { SagaTimeline } from "@/components/collections/saga-timeline"
import { HeroBannerSkeleton } from "@/components/ui/hero-banner"

// @ts-ignore
export const Route = createFileRoute("/collections/$id")({
    component: CollectionPage,
})

function CollectionPage() {
    const { id } = Route.useParams() as { id: string }
    const collectionId = parseInt(id, 10)

    const { data: collection, isLoading } = useGetMediaCollection(collectionId)

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background">
                <HeroBannerSkeleton className="max-h-[520px]" />
                <div className="mx-auto max-w-[1680px] px-6 py-12 md:px-10 lg:px-14 space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-28 w-full rounded-2xl bg-white/5 animate-pulse" />
                    ))}
                </div>
            </div>
        )
    }

    if (!collection) {
        return (
            <div className="flex min-h-screen items-center justify-center text-zinc-500">
                <p>Colección no encontrada.</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background">
            <CollectionHero collection={collection} />
            <div className="mx-auto max-w-[1680px] px-6 pb-20 pt-10 md:px-10 lg:px-14">
                <SagaTimeline collection={collection} />
            </div>
        </div>
    )
}
