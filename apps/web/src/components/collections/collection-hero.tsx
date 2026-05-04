import * as React from "react"
import { motion } from "framer-motion"
import { Film, Play } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import type { MediaCollectionData } from "@/api/hooks/collections.hooks"

interface CollectionHeroProps {
    collection: MediaCollectionData
    className?: string
}

export function CollectionHero({ collection, className }: CollectionHeroProps) {
    const backdrop = collection.backdropPath
        ? `https://image.tmdb.org/t/p/original${collection.backdropPath}`
        : collection.parts[0]?.backdropPath

    const movieCount = collection.parts.length

    return (
        <section
            aria-label={`Colección: ${collection.name}`}
            className={cn(
                "relative flex min-h-[420px] max-h-[600px] w-full items-end overflow-hidden bg-[#09090b]",
                className,
            )}
        >
            {/* Backdrop */}
            {backdrop && (
                <div className="absolute inset-0">
                    <img
                        src={backdrop}
                        alt=""
                        aria-hidden
                        className="h-full w-full object-cover object-top"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#09090b]/90 via-[#09090b]/60 to-[#09090b]/30" />
                    <div className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-transparent" />
                </div>
            )}

            {/* Content */}
            <div className="relative z-10 mx-auto flex w-full max-w-[1680px] flex-col gap-4 px-6 pb-10 pt-32 md:px-10 lg:px-14">
                {/* Badge */}
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ff6b00]/40 bg-[#ff6b00]/10 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.22em] text-[#ff6b00] shadow-[0_0_10px_rgba(255,107,0,0.3)]">
                        <Film className="h-3 w-3" />
                        Saga · {movieCount} Película{movieCount !== 1 ? "s" : ""}
                    </span>
                </div>

                {/* Title */}
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="max-w-3xl font-bebas text-6xl font-normal uppercase leading-[0.85] tracking-tight text-white drop-shadow-2xl md:text-[6.5rem]"
                >
                    {collection.name}
                </motion.h1>

                {/* Overview */}
                {collection.overview && (
                    <motion.p
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="line-clamp-2 max-w-2xl text-base leading-7 text-zinc-300"
                    >
                        {collection.overview}
                    </motion.p>
                )}
            </div>
        </section>
    )
}
