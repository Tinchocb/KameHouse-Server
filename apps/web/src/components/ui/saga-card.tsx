import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { ProgressBar } from "./progress-bar"
import { FaPlay } from "react-icons/fa"

export interface SagaCardProps {
    artwork: string
    title: string
    description?: string
    episodeCount?: number
    progress?: number // 0 to 100, if strictly > 0 it shows the bar
    onClick?: () => void
    className?: string
}

export function SagaCard(props: SagaCardProps) {
    const { artwork, title, description, episodeCount, progress, onClick, className } = props

    return (
        <div
            className={cn(
                "group relative flex flex-col w-[200px] md:w-[250px] shrink-0 cursor-pointer overflow-hidden rounded-xl bg-neutral-900 border border-white/5",
                "hover:scale-[1.03] -hover:translate-y-1 hover:shadow-[0_8px_30px_rgba(255,122,0,0.15)] transition-all duration-300 ease-out",
                className
            )}
            onClick={onClick}
        >
            {/* Image Container */}
            <div className="relative aspect-[2/3] w-full overflow-hidden bg-neutral-800">
                <img
                    src={artwork}
                    alt={title}
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />

                {/* Hover Play Button Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center shadow-[0_0_20px_rgba(255,122,0,0.6)] transform scale-75 group-hover:scale-100 transition-transform duration-300 delay-75">
                        <FaPlay className="text-white ml-1 size-5" />
                    </div>
                </div>

                {/* Progress Bar (Bottom of image) */}
                {progress !== undefined && progress > 0 && (
                    <div className="absolute bottom-0 w-full px-2 pb-2">
                        <ProgressBar progress={progress} />
                    </div>
                )}
            </div>

            {/* Metadata Footer */}
            <div className="p-3 md:p-4 flex flex-col gap-1">
                <h3 className="text-white font-bold text-sm md:text-base line-clamp-1 group-hover:text-orange-400 transition-colors">
                    {title}
                </h3>
                {description && (
                    <p className="text-neutral-400 text-xs md:text-sm line-clamp-2">
                        {description}
                    </p>
                )}
                {episodeCount !== undefined && (
                    <span className="text-orange-500 font-semibold text-xs mt-1">
                        {episodeCount} Episodios
                    </span>
                )}
            </div>
        </div>
    )
}
