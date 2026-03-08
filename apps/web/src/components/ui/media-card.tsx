import { cn } from "@/components/ui/core/styling"
import type { CardAspect } from "@/lib/home-catalog"
import * as React from "react"
import { FaPlay } from "react-icons/fa"

export interface MediaCardProps {
    artwork: string
    title: string
    subtitle?: string
    badge?: string
    description?: string
    /** Enforce strict aspect ratio (e.g., poster=2/3, backdrop=16/9) */
    aspect?: CardAspect
    progress?: number
    progressColor?: "white" | "orange"
    onClick?: () => void
    className?: string
}

export function MediaCard({
    artwork,
    title,
    subtitle,
    badge,
    description,
    aspect = "poster",
    progress,
    progressColor = "white",
    onClick,
    className,
}: MediaCardProps) {
    const isPoster = aspect === "poster"

    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={title}
            onClick={onClick}
            onKeyDown={(event) => event.key === "Enter" && onClick?.()}
            className={cn(
                "group relative block cursor-pointer shrink-0 rounded-xl bg-zinc-900 border border-white/5",
                "overflow-hidden transform transition-all duration-300 ease-out",
                // Hardware Accelerated Hover effect (scales up & puts on top context via z-10)
                "hover:scale-105 hover:shadow-2xl hover:shadow-black/70 hover:z-10 hover:border-white/20",
                // Base dimensions enforced internally, but we assign a strict aspect class
                isPoster ? "aspect-[2/3] w-[150px] md:w-[190px] lg:w-[210px]" : "aspect-[16/9] w-[260px] md:w-[320px] lg:w-[360px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
                className,
            )}
        >
            {/* Base Image Layer */}
            <img
                src={artwork}
                alt={title}
                loading="lazy"
                draggable={false}
                className="absolute inset-0 h-full w-full select-none object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                onError={(event) => {
                    ; (event.target as HTMLImageElement).src =
                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300'%3E%3Crect width='200' height='300' fill='%2327272a'/%3E%3C/svg%3E"
                }}
            />

            {/* Top Badge (Always visible structurally but obscured on hover) */}
            {badge && (
                <span className="absolute left-2.5 top-2.5 z-30 rounded bg-black/60 backdrop-blur-md px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm border border-white/10 transition-opacity duration-300 group-hover:opacity-0">
                    {badge}
                </span>
            )}

            {/* Dark Gradient Overlay (Appears strictly on hover) */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors duration-300 z-10" />

            {/* Interactive Information Layer (Opacity 0 by default) */}
            <div className="absolute inset-0 flex flex-col justify-end p-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <p className="line-clamp-2 text-sm md:text-base font-black leading-snug text-white drop-shadow-lg mb-1">
                    {title}
                </p>
                {subtitle && <p className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-zinc-300 drop-shadow-md mb-2">{subtitle}</p>}
                
                {!isPoster && description && (
                    <p className="line-clamp-2 text-[11px] leading-relaxed text-zinc-400 drop-shadow-md mt-1">
                        {description}
                    </p>
                )}
            </div>

            {/* Centered Play Icon */}
            <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 scale-75 group-hover:scale-100">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-md shadow-2xl border border-white/20 group-hover:bg-white/30 transition-colors">
                    <FaPlay className="ml-1 h-5 w-5 text-white drop-shadow-lg" />
                </div>
            </div>

            {/* Progress Bar Layer */}
            {progress !== undefined && (
                <div className="absolute bottom-0 left-0 right-0 z-30 h-1 bg-white/10 group-hover:bg-white/20 transition-colors duration-300">
                    <div
                        className={cn(
                            "h-full transition-all duration-300 ease-linear rounded-r-full relative",
                            progressColor === "orange"
                                ? "bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.8)]"
                                : "bg-white",
                        )}
                        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                    />
                </div>
            )}
        </div>
    )
}
