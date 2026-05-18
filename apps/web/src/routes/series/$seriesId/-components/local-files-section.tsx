import * as React from "react"
import { FaPlay } from "react-icons/fa"
import { FolderOpen } from "lucide-react"
import { Anime_LocalFile } from "@/api/generated/types"
import { DeferredImage } from "@/components/shared/deferred-image"
import { getDragonBallSpanishTitle } from "@/lib/config/dragonball.config"

interface LocalFilesSectionProps {
    localFiles: Anime_LocalFile[]
    title: string
    thumbnail?: string
    onPlay?: (localFile: Anime_LocalFile) => void
    tmdbId?: number | null
    format?: string
}

export const LocalFilesSection = React.memo(function LocalFilesSection({
    localFiles,
    title,
    thumbnail,
    onPlay,
    tmdbId,
    format,
}: LocalFilesSectionProps) {
    const handleClick = (lf: Anime_LocalFile) => {
        if (onPlay) onPlay(lf)
    }

    return (
        <section className="relative z-[1] px-6 sm:px-12 pb-20 max-w-[1800px] mx-auto">
            <div className="flex flex-col gap-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-8">
                    <div className="flex flex-col gap-2">
                        <h2 className="text-5xl font-bebas tracking-[0.2em] text-white uppercase leading-none">
                            ARCHIVOS LOCALES
                        </h2>
                        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
                            <span>{localFiles.length} TOTAL</span>
                            <span className="w-1 h-1 rounded-full bg-zinc-800" />
                            <span className="text-emerald-500 font-bold">DISPONIBLE</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    {localFiles.map((lf, idx) => {
                        const epNum = lf.parsedInfo?.episode || lf.metadata?.episode
                        const technical = lf.technicalInfo
                        const resolution = technical?.videoStream ? `${technical.videoStream.width}x${technical.videoStream.height}` : null
                        const fileSize = technical?.size ? `${(technical.size / (1024 * 1024 * 1024)).toFixed(2)} GB` : null
                        
                        const isMovie = format === "MOVIE" || format === "SPECIAL" || format === "OVA"
                        const localizedTitle = (epNum != null && tmdbId != null && !isMovie) 
                            ? getDragonBallSpanishTitle(Number(tmdbId), Number(epNum)) 
                            : null
                        const epTitle = localizedTitle 
                            ? `E${epNum} - ${localizedTitle}` 
                            : (isMovie ? title : (epNum ? `Episodio ${epNum}` : lf.name))

                        return (
                            <div
                                key={lf.path || idx}
                                className="group relative flex flex-row gap-6 bg-zinc-950/80 transition-all duration-300 overflow-hidden p-4 rounded-md hover:bg-zinc-900/60"
                            >
                                {/* Thumbnail Area (Left) */}
                                <div 
                                    onClick={() => handleClick(lf)}
                                    className="relative aspect-video w-72 shrink-0 overflow-hidden rounded bg-zinc-950 cursor-pointer"
                                >
                                    {thumbnail ? (
                                        <DeferredImage
                                            src={thumbnail}
                                            alt={title}
                                            className="w-full h-full object-cover transition-all duration-500 opacity-70 group-hover:opacity-100"
                                            showSkeleton={false}
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-10 h-10 text-zinc-800 group-hover:text-brand-orange transition-colors" strokeWidth="1.5">
                                                <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                                                <line x1="7" y1="2" x2="7" y2="22"></line>
                                                <line x1="17" y1="2" x2="17" y2="22"></line>
                                                <line x1="2" y1="12" x2="22" y2="12"></line>
                                                <line x1="2" y1="7" x2="7" y2="7"></line>
                                                <line x1="2" y1="17" x2="7" y2="17"></line>
                                                <line x1="17" y1="17" x2="22" y2="17"></line>
                                                <line x1="17" y1="7" x2="22" y2="7"></line>
                                            </svg>
                                        </div>
                                    )}
                                    
                                    {/* Hover Play Button Overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/40">
                                        <div className="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center bg-black/40 backdrop-blur-sm scale-90 group-hover:scale-100 transition-all duration-300 hover:border-brand-orange hover:bg-brand-orange/20 hover:text-brand-orange">
                                            <FaPlay className="w-4 h-4 ml-1" />
                                        </div>
                                    </div>

                                    {epNum && (
                                        <div className="absolute top-2 right-2 z-20">
                                            <span className="px-1.5 py-0.5 bg-black/80 text-[11px] font-medium text-white rounded">
                                                E{epNum}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Info Area (Right) */}
                                <div className="flex flex-col justify-center flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-bold text-white truncate group-hover:text-brand-orange transition-colors">
                                            {epTitle}
                                        </h3>
                                    </div>

                                    <div className="flex items-center gap-6 text-[10px] font-black tracking-widest uppercase text-zinc-500">
                                        {resolution && (
                                            <div className="flex items-center gap-2">
                                                <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                                {resolution}
                                            </div>
                                        )}
                                        {fileSize && (
                                            <div className="flex items-center gap-2">
                                                <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                                {fileSize}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                            MKV
                                        </div>
                                    </div>
                                    
                                    <div className="mt-4 flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                                        <button 
                                            onClick={() => handleClick(lf)}
                                            className="px-4 py-2 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded hover:bg-brand-orange hover:text-white transition-all"
                                        >
                                            Reproducir
                                        </button>
                                        <button className="p-2 text-zinc-500 hover:text-white transition-colors">
                                            <FolderOpen className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </section>
    )
})
LocalFilesSection.displayName = "LocalFilesSection"
