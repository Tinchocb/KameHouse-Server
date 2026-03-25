"use client"

import React from "react"
import { FaPlay } from "react-icons/fa"
import { ManualMatchModal } from "@/components/shared/manual-match-modal"
import { Anime_Entry, Anime_Episode } from "@/api/generated/types"
import { DeferredImage } from "@/components/shared/deferred-image"
import { cn } from "@/components/ui/core/styling"
import { sanitizeHtml } from "@/lib/helpers/sanitizer"

export const MediaActionButtons = React.memo(({ 
    seriesId, 
    directoryPath 
}: { 
    seriesId: string
    directoryPath: string 
}) => {
    const [isMatchModalOpen, setIsMatchModalOpen] = React.useState(false)

    return (
        <>
            <div className="flex flex-wrap items-center gap-3 pt-2">
                <button className={cn(
                    "inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3 text-sm font-black uppercase tracking-[0.22em] text-white transition-all duration-300",
                    "shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_40px_rgba(249,115,22,0.5)] hover:scale-105 active:scale-95"
                )}>
                    <FaPlay className="h-4 w-4" /> Reproducir
                </button>
                <button className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-bold uppercase tracking-[0.2em] text-zinc-400 transition-all hover:bg-white/5 hover:text-zinc-200">
                    Agregar a lista
                </button>
                <button 
                    onClick={() => setIsMatchModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-white/[0.02] px-5 py-3 text-sm font-bold uppercase tracking-[0.2em] text-zinc-500 transition-all hover:text-zinc-300 hover:border-white/10"
                >
                    Corregir Metadatos
                </button>
            </div>

            <ManualMatchModal
                isOpen={isMatchModalOpen}
                onClose={() => setIsMatchModalOpen(false)}
                currentMediaId={parseInt(seriesId)}
                directoryPath={directoryPath}
            />
        </>
    )
})

export const EpisodeClientCard = React.memo(({
    episode,
    seriesTitle,
    fallbackThumb,
}: {
    episode: Anime_Episode
    seriesTitle: string
    fallbackThumb: string
}) => {
    const thumb = episode.episodeMetadata?.image || fallbackThumb
    const length = episode.episodeMetadata?.length || 24

    return (
        <article
            className="group overflow-hidden rounded-2xl glass-panel bg-white/[0.02] border-white/5 shadow-[0_15px_40px_rgba(0,0,0,0.35)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_25px_60px_rgba(0,0,0,0.55)] cursor-pointer"
            title={episode.localFile?.path}
        >
            <div className="relative aspect-video overflow-hidden">
                <DeferredImage
                    src={thumb}
                    alt={`${seriesTitle} episodio ${episode.episodeNumber}`}
                    className="h-full w-full object-cover group-hover:scale-[1.08] transition-all duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent opacity-90 transition-opacity duration-300 group-hover:opacity-70" />
                
                <div className="absolute top-2.5 left-2.5 rounded-lg border border-white/10 bg-black/60 px-2 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-200 backdrop-blur-md">
                    EP {episode.episodeNumber}
                </div>
                
                <div className="absolute bottom-3 left-3 flex gap-2">
                    <span className={cn(
                        "rounded-md border px-2 py-0.5 text-[8px] font-black uppercase tracking-widest backdrop-blur-sm",
                        episode.isDownloaded ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "bg-blue-500/20 border-blue-500/30 text-blue-400"
                    )}>
                        {episode.isDownloaded ? "Local" : "Online"}
                    </span>
                </div>

                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-400 group-hover:opacity-100">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-primary/40 bg-primary/80 backdrop-blur-xl shadow-[0_0_30px_rgba(249,115,22,0.4)] scale-75 group-hover:scale-100 transition-all duration-300">
                        <FaPlay className="h-5 w-5 text-white ml-1 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" />
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-1.5 p-5">
                <div className="flex items-center justify-between gap-4">
                    <h3 className="text-[15px] font-black leading-tight line-clamp-1 text-zinc-100 group-hover:text-primary transition-colors">
                        {episode.episodeTitle || `Episodio ${episode.episodeNumber}`}
                    </h3>
                    <span className="text-[10px] font-mono text-zinc-500 shrink-0 tabular-nums">
                        {length}m
                    </span>
                </div>

                {episode.episodeMetadata?.summary && (
                    <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(episode.episodeMetadata.summary) }}></p>
                )}
            </div>
        </article>
    )
})
