import React, { ReactNode } from "react"

export interface MediaItem {
    id: string | number
    title: string
    coverImage: string
    type: "anime" | "manga" | "series" | "movie" | "local"
    // Optional slot for client-side interactive wrapper injection
    interactiveElement?: ReactNode
}

interface MediaGridProps {
    items: MediaItem[]
}

/**
 * Server Component for rendering large media libraries with minimal client-side hydration.
 * Delegates hover states and advanced interaction to slotted interactiveElement components.
 */
export function MediaGridServer({ items }: MediaGridProps) {
    if (!items || items.length === 0) {
        return (
            <div className="flex h-64 items-center justify-center text-gray-500">
                <p>No media found.</p>
            </div>
        )
    }

    return (
        <section
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 w-full"
            aria-label="Media Library Grid"
        >
            {items.map((item) => (
                <article
                    key={item.id}
                    className="relative flex flex-col overflow-hidden rounded-md bg-neutral-900 shadow-sm transition-transform hover:scale-105 group"
                >
                    {/* Core visual structure (Server Rendered) */}
                    <div className="relative aspect-[2/3] w-full overflow-hidden bg-neutral-800">
                        <img
                            src={item.coverImage}
                            alt={`Cover for ${item.title}`}
                            loading="lazy"
                            className="h-full w-full object-cover object-center transition-opacity duration-300 group-hover:opacity-80"
                        />
                        {/* Type Badge */}
                        <div className="absolute top-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs font-semibold uppercase text-white backdrop-blur-sm">
                            {item.type}
                        </div>
                    </div>

                    <div className="p-2">
                        <h3 className="truncate text-sm font-medium text-neutral-100" title={item.title}>
                            {item.title}
                        </h3>
                    </div>

                    {/* Interactive Injection Point (Client Rendered wrapper/overlay) */}
                    {item.interactiveElement && (
                        <div className="absolute inset-0 z-10">
                            {item.interactiveElement}
                        </div>
                    )}
                </article>
            ))}
        </section>
    )
}
