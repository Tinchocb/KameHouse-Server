import React from "react"
import { Play, Info } from "lucide-react"

export interface HeroSectionProps {
    /** Title of the featured media */
    title: string
    /** Short synopsis, clamped to 3 lines */
    description: string
    /** Full-bleed background image URL */
    backdropUrl: string
    /** Optional logo image to render instead of text title */
    logoUrl?: string
    /** Called when the primary play button is clicked */
    onPlay?: () => void
    /** Called when the secondary info button is clicked */
    onMoreInfo?: () => void
}

export function HeroSection({
    title,
    description,
    backdropUrl,
    logoUrl,
    onPlay,
    onMoreInfo,
}: HeroSectionProps) {
    return (
        <section className="relative w-full h-[80vh] min-h-[600px] flex flex-col justify-end pb-12 sm:pb-24 px-4 sm:px-8 md:px-12 lg:px-20 overflow-hidden">
            {/* Background Image: fetchPriority="high" avoids LCP delays */}
            <img
                src={backdropUrl}
                alt={title}
                fetchPriority="high"
                className="absolute inset-0 w-full h-full object-cover z-0"
            />

            {/* Gradient Overlays: vertical for base blending into dark mode, horizontal for text contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent z-10" />
            <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent z-10 hidden sm:block" />

            {/* Content Container (Mobile-first padding & sizing) */}
            <div className="relative z-20 w-full max-w-3xl space-y-4 sm:space-y-6">
                
                {/* Logo or Text Title */}
                {logoUrl ? (
                    <img 
                        src={logoUrl} 
                        alt={title} 
                        className="w-48 sm:w-64 md:w-full md:max-w-[400px] object-contain drop-shadow-2xl" 
                    />
                ) : (
                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white drop-shadow-lg tracking-tight">
                        {title}
                    </h1>
                )}

                {/* Description - line clamped to 3 lines */}
                <p className="text-base sm:text-lg md:text-xl text-gray-200 line-clamp-3 drop-shadow-md text-pretty max-w-2xl">
                    {description}
                </p>

                {/* Call to Actions - min-h-[48px] for mobile touch targets */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-2 sm:pt-4">
                    {/* Primary CTA: Orange, representing vibrant Dragon Ball aesthetic */}
                    <button
                        onClick={onPlay}
                        className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white min-h-[48px] px-6 py-3 rounded-md font-bold text-base sm:text-lg transition-colors shadow-lg shadow-orange-500/20"
                    >
                        <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
                        Play
                    </button>
                    
                    {/* Secondary CTA: Glassmorphism */}
                    <button
                        onClick={onMoreInfo}
                        className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 active:scale-95 text-white backdrop-blur-md min-h-[48px] px-6 py-3 rounded-md font-semibold text-base sm:text-lg transition-colors border border-white/10"
                    >
                        <Info className="w-5 h-5 sm:w-6 sm:h-6" />
                        More Info
                    </button>
                </div>
            </div>
        </section>
    )
}
