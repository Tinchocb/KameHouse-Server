import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { FaPlay } from "react-icons/fa"
import { BsClock } from "react-icons/bs"
import { Star, Zap, Layers, Folder } from "lucide-react"

export interface EpisodeListItemProps {
    number: number
    title: string
    synopsis?: string
    thumbnailUrl?: string
    durationMin?: number
    airDate?: string
    isFiller?: boolean
    isEpic?: boolean
    watched?: boolean
    hasLocal?: boolean
    hasStream?: boolean
    onClick?: () => void
}

export const EpisodeListItem = React.memo(function EpisodeListItem({
    number,
    title,
    synopsis,
    thumbnailUrl,
    durationMin,
    airDate,
    isFiller,
    isEpic,
    watched,
    hasLocal,
    hasStream,
    onClick
}: EpisodeListItemProps) {
    return (
        <div 
            onClick={onClick}
            className={cn(
                "group flex flex-col md:flex-row gap-6 p-4 border border-white/5 bg-black/20 hover:bg-white/[0.03] transition-all duration-500 cursor-pointer relative overflow-hidden",
                isFiller && "opacity-60 grayscale-[0.5] hover:grayscale-0 hover:opacity-100"
            )}
        >
            {/* VHS Thumbnail Container */}
            <div className="relative aspect-video w-full md:w-[320px] shrink-0 border border-white/10 overflow-hidden">
                {/* Scanlines Overlay */}
                <div className="absolute inset-0 z-10 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] opacity-40 group-hover:opacity-20 transition-opacity" />
                
                {thumbnailUrl ? (
                    <img 
                        src={thumbnailUrl} 
                        alt={title} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                ) : (
                    <div className="w-full h-full bg-zinc-900 flex items-center justify-center font-bebas text-4xl text-zinc-700">
                        NO SIGNAL
                    </div>
                )}

                {/* VHS Sticker - Episode Number */}
                <div className="absolute top-3 left-3 z-20 bg-orange-500 text-black px-3 py-1 font-black text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] transform -rotate-2 group-hover:rotate-0 transition-transform">
                    EP {number}
                </div>

                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                    <div className="w-12 h-12 rounded-none bg-white text-black flex items-center justify-center shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-500">
                        <FaPlay size={18} className="ml-1" />
                    </div>
                </div>

                {watched && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary z-40" />
                )}
            </div>

            {/* Content Container */}
            <div className="flex-1 flex flex-col justify-center space-y-3">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <h3 className="text-2xl font-bebas tracking-wider text-white group-hover:text-primary transition-colors line-clamp-1">
                            {title}
                        </h3>
                        {isEpic && <Star className="text-yellow-500 fill-current" size={16} />}
                        {isFiller && <span className="text-[10px] bg-zinc-800 text-zinc-500 px-2 py-0.5 font-black uppercase tracking-widest border border-white/5">Relleno</span>}
                    </div>
                    <div className="flex items-center gap-4 text-xs font-black uppercase tracking-widest text-zinc-500">
                        {durationMin && <span className="flex items-center gap-1.5"><BsClock size={12} /> {durationMin} MIN</span>}
                        {airDate && <span>{airDate}</span>}
                    </div>
                </div>

                {synopsis && (
                    <p className="text-zinc-400 text-sm leading-relaxed line-clamp-3 font-medium">
                        {synopsis}
                    </p>
                )}

                <div className="flex items-center gap-4 pt-2">
                    {hasLocal && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 text-green-500 text-[9px] font-black uppercase tracking-widest border border-green-500/20">
                            <Folder size={10} /> Local
                        </div>
                    )}
                    {hasStream && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 text-blue-400 text-[9px] font-black uppercase tracking-widest border border-blue-500/20">
                            <Zap size={10} /> Stream
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
})
