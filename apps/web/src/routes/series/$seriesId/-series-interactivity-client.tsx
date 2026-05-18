import React, { useMemo } from "react"
import { FaPlay, FaStar } from "react-icons/fa"
import { Anime_Episode, Anime_LocalFile, Continuity_WatchHistoryItem } from "@/api/generated/types"
import { DeferredImage } from "@/components/shared/deferred-image"
import { cn } from "@/components/ui/core/styling"
import { sanitizeHtml } from "@/lib/helpers/sanitizer"
import { motion } from "framer-motion"
import { getDragonBallSpanishTitle } from "@/lib/config/dragonball.config"

// ─── MediaActionButtons ───────────────────────────────────────────────────────

interface MediaActionButtonsProps {
    seriesId?: string
    directoryPath?: string
    onPlay?: () => void
    continuityItem?: Continuity_WatchHistoryItem | null
}

const MediaActionButtons = React.memo(function MediaActionButtons({
    onPlay,
    continuityItem,
}: MediaActionButtonsProps) {
    return (
        <div className="flex flex-wrap items-center gap-4 mt-8">
            {/* Play Button - Cinematic Glass */}
            <button
                className={cn(
                    "group/play relative flex items-center gap-4 px-10 py-4 bg-brand-orange text-white transition-all duration-300",
                    "font-black text-[11px] uppercase tracking-[0.3em] rounded-xl overflow-hidden shadow-2xl shadow-brand-orange/20",
                    "hover:bg-brand-orange/90 hover:scale-105 active:scale-95"
                )}
                onClick={onPlay}
            >
                <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover/play:opacity-100 transition-opacity" />
                <FaPlay className="w-3.5 h-3.5 relative z-10" />
                <span className="relative z-10 font-bold">
                    {continuityItem && continuityItem.currentTime && continuityItem.duration ? (
                        `Reanudar Ep. ${continuityItem.episodeNumber} (${Math.round((continuityItem.currentTime / continuityItem.duration) * 100)}%)`
                    ) : (
                        "Reproducir"
                    )}
                </span>
            </button>
        </div>
    )
})
MediaActionButtons.displayName = "MediaActionButtons"

// ─── EpisodeCard (Grid Version) ──────────────────────────────────────────────

interface EpisodeCardProps {
    episode: Anime_Episode
    fallbackThumb: string
    localFile?: Anime_LocalFile
    onPlay?: (localFile: Anime_LocalFile, episode: Anime_Episode) => void
    onToggleWatched?: (episode: Anime_Episode) => void
    onUpdateProgress?: (progress: number) => void
    continuityItem?: Continuity_WatchHistoryItem | null
    isCurrentlyPlaying?: boolean
    variant?: "grid" | "horizontal"
    seriesTmdbId?: number | null
    priority?: boolean
}

const EpisodeCard = React.memo(function EpisodeCard({
    episode,
    fallbackThumb,
    localFile,
    onPlay,
    onToggleWatched,
    onUpdateProgress,
    continuityItem,
    isCurrentlyPlaying,
    variant = "grid",
    seriesTmdbId,
    priority = false,
}: EpisodeCardProps) {
    const thumb = episode?.episodeMetadata?.image || fallbackThumb
    
    const epNum = episode?.absoluteEpisodeNumber || episode?.episodeNumber || 0
    const localizedTitle = getDragonBallSpanishTitle(seriesTmdbId, epNum)
    const rawTitle = localizedTitle || episode?.titleSpanish || episode?.episodeMetadata?.title || episode?.episodeTitle || episode?.displayTitle || `Episodio ${epNum}`
    const baseTitle = rawTitle.replace(/[«»]/g, "").trim()
    
    const epTitle = `E${epNum} - ${baseTitle}`
    
    const synopsis = episode?.episodeMetadata?.summary || episode?.episodeMetadata?.overview || ""
    const cleanSynopsis = useMemo(() => synopsis ? sanitizeHtml(synopsis) : "", [synopsis])
    const hasLocalFile = !!localFile
    const isWatched = episode?.watched || false
    
    // Technical Info
    const technical = localFile?.technicalInfo
    const resolution = technical?.videoStream ? `${technical.videoStream.width}x${technical.videoStream.height}` : null
    const codec = technical?.videoStream?.codec?.toUpperCase()
    const duration = episode?.episodeMetadata?.length ? `${episode.episodeMetadata.length}m` : null

    // Intelligence
    const vibes = episode?.intelligence?.vibes || []
    const rating = episode?.intelligence?.rating

    // Parse Audio Languages
    const audioLangs = useMemo(() => {
        if (!technical?.audioStreams || technical.audioStreams.length === 0) return [];
        const langs = new Set<string>();
        technical.audioStreams.forEach(stream => {
            if (stream.language) {
                const cleanLang = stream.language.toLowerCase().trim();
                if (cleanLang === "spa" || cleanLang === "es" || cleanLang === "spanish" || cleanLang === "lts" || cleanLang === "lat") {
                    langs.add("ESP");
                } else if (cleanLang === "jpn" || cleanLang === "ja" || cleanLang === "japanese") {
                    langs.add("JPN");
                } else if (cleanLang === "eng" || cleanLang === "en" || cleanLang === "english") {
                    langs.add("ENG");
                } else {
                    langs.add(cleanLang.toUpperCase());
                }
            }
        });
        return Array.from(langs);
    }, [technical]);

    const progressPercent = useMemo(() => {
        const epNum = episode?.absoluteEpisodeNumber || episode?.episodeNumber || 0
        if (!continuityItem || continuityItem.episodeNumber !== epNum) return 0
        if (!continuityItem.duration) return 0
        return (continuityItem.currentTime / continuityItem.duration) * 100
    }, [continuityItem, episode?.absoluteEpisodeNumber, episode?.episodeNumber])

    const handlePlay = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (hasLocalFile && localFile && onPlay && episode) {
            onPlay(localFile, episode)
        }
    }

    const handleToggleWatched = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (onToggleWatched && episode) onToggleWatched(episode)
    }

    // Dynamic gradient fallback for thumb
    const baseColor = `hsl(${((episode?.absoluteEpisodeNumber || episode?.episodeNumber || 0) * 137.5) % 360}, 50%, 20%)`

    if (!episode) return null

    if (variant === "horizontal") {
        return (
            <div
                onClick={hasLocalFile ? handlePlay : undefined}
                className={cn(
                    "group relative flex flex-col md:flex-row gap-8 transition-all duration-500 py-6 border-b border-white/[0.03] last:border-0",
                    isCurrentlyPlaying ? "bg-white/[0.03] -mx-4 px-4 rounded-xl shadow-2xl" : "hover:bg-white/[0.01]",
                    !hasLocalFile && "opacity-50",
                    hasLocalFile ? "cursor-pointer" : "cursor-default"
                )}
            >
                {/* Thumbnail Area (Left) */}
                <div 
                    className={cn(
                        "relative aspect-video w-full md:w-80 shrink-0 overflow-hidden rounded-lg bg-zinc-950 group/thumb"
                    )}
                >
                    <DeferredImage
                        src={thumb}
                        alt={epTitle}
                        className={cn(
                            "w-full h-full object-cover transition-transform duration-1000 group-hover/thumb:scale-110",
                            isWatched && "opacity-40 grayscale-[0.5]"
                        )}
                        showSkeleton={false}
                        priority={priority}
                    />
                    
                    {/* Hover Play Button Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-all duration-500 bg-black/60 backdrop-blur-[2px]">
                        {hasLocalFile && (
                            <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-2xl transform scale-75 group-hover/thumb:scale-100 transition-transform duration-500">
                                <FaPlay className="w-4 h-4 ml-1" />
                            </div>
                        )}
                    </div>

                    {/* Progress Bar (if in progress) - Minimalist Elegant Laser line */}
                    {(isCurrentlyPlaying || progressPercent > 0) && (
                        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/40 backdrop-blur-sm z-40 overflow-hidden">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${isCurrentlyPlaying ? 100 : progressPercent}%` }} 
                                className="h-full bg-gradient-to-r from-brand-orange to-white shadow-[0_0_10px_rgba(255,110,58,0.9)]" 
                            />
                        </div>
                    )}

                    {/* Watched Badge */}
                    {isWatched && (
                        <div className="absolute top-3 right-3 z-20 w-6 h-6 rounded-full bg-[#10b981] text-white flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.5)]">
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                <path d="M9 16.17L4.83 12l-1.41 1.41L9 19 21 7l-1.41-1.41z" />
                            </svg>
                        </div>
                    )}
                </div>

                {/* Info Area (Right) */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-black text-brand-orange tracking-[0.25em] uppercase">
                                    Episodio {episode.absoluteEpisodeNumber || episode.episodeNumber}
                                </span>
                                {episode.episodeMetadata?.isFiller && (
                                    <span className="text-[8px] font-black tracking-[0.15em] uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.15)] backdrop-blur-md">
                                        FILLER
                                    </span>
                                )}
                                {episode.type === "special" && (
                                    <span className="text-[8px] font-black tracking-[0.15em] uppercase px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30 shadow-[0_0_8px_rgba(168,85,247,0.15)] backdrop-blur-md">
                                        ESPECIAL
                                    </span>
                                )}
                                {duration && (
                                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest bg-zinc-900/40 px-2 py-0.5 rounded border border-white/5">
                                        {duration}
                                    </span>
                                )}
                                {rating && rating > 8 && (
                                    <span className="flex items-center gap-1 text-[8px] font-black text-brand-orange bg-brand-orange/10 px-2 py-0.5 rounded border border-brand-orange/20 shadow-[0_0_8px_rgba(249,115,22,0.15)]">
                                        <FaStar className="w-2 h-2" />
                                        {rating.toFixed(1)}
                                    </span>
                                )}
                                {vibes.map(vibe => (
                                    <span 
                                        key={vibe}
                                        className={cn(
                                            "text-[8px] font-black tracking-[0.15em] uppercase px-2 py-0.5 rounded border backdrop-blur-md",
                                            vibe === "EPIC" ? "bg-purple-500/15 text-purple-400 border-purple-500/30 shadow-[0_0_8px_rgba(168,85,247,0.15)]" :
                                            vibe === "HYPED" ? "bg-red-500/15 text-red-400 border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.15)]" :
                                            vibe === "EMOTIONAL" ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.15)]" :
                                            vibe === "CHILL" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)]" :
                                            "bg-orange-500/15 text-orange-400 border-orange-500/30 shadow-[0_0_8px_rgba(249,115,22,0.15)]"
                                        )}
                                    >
                                        {vibe}
                                    </span>
                                ))}
                            </div>
                            
                            <h4 className={cn(
                                "text-2xl font-bold tracking-tight leading-tight",
                                isCurrentlyPlaying ? "text-brand-orange" : "text-white group-hover:text-brand-orange/80 transition-colors"
                            )}>
                                {baseTitle}
                            </h4>
                        </div>

                        {hasLocalFile && (
                            <div className="flex items-center gap-1.5 shrink-0">
                                {isWatched ? (
                                    <button 
                                        onClick={handleToggleWatched}
                                        className="p-2 text-brand-orange hover:text-red-400 transition-colors"
                                        title="Marcar como no visto"
                                    >
                                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                            <circle cx="12" cy="12" r="10" />
                                        </svg>
                                    </button>
                                ) : (
                                    <>
                                        {/* Mark as watched (single) */}
                                        <button 
                                            onClick={handleToggleWatched}
                                            className="p-2 text-zinc-600 hover:text-white transition-colors"
                                            title="Marcar como visto"
                                        >
                                            <svg className="w-5 h-5 fill-none stroke-current" strokeWidth="2" viewBox="0 0 24 24">
                                                <circle cx="12" cy="12" r="10" />
                                            </svg>
                                        </button>
                                        
                                        {/* Mark up to here (bulk) */}
                                        {onUpdateProgress && (
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onUpdateProgress(episode.absoluteEpisodeNumber || episode.episodeNumber)
                                                }}
                                                className="p-2 text-zinc-600 hover:text-brand-orange transition-colors"
                                                title="Marcar anteriores como vistos"
                                            >
                                                <svg className="w-5 h-5 fill-none stroke-current" strokeWidth="2" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5M19.5 5.25l-7.5 7.5-3-3" />
                                                </svg>
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="mt-4 flex-1">
                        {cleanSynopsis ? (
                            <p 
                                className="text-[14px] text-white/70 leading-relaxed line-clamp-3 font-medium antialiased tracking-wide"
                                dangerouslySetInnerHTML={{ __html: cleanSynopsis }}
                            />
                        ) : (
                            <p className="text-[14px] text-white/30 italic">
                                Sinopsis no disponible para este episodio.
                            </p>
                        )}
                    </div>

                    {/* Technical Badges */}
                    <div className="mt-6 flex flex-wrap items-center gap-4">
                        {hasLocalFile ? (
                            <div className="flex flex-wrap items-center gap-3">
                                <button 
                                    onClick={handlePlay}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-brand-orange text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-brand-orange/80 transition-colors rounded-md font-bold"
                                >
                                    Reproducir
                                </button>
                                {resolution && (
                                    <span className="text-[9px] font-black text-zinc-400 border border-white/10 px-2 py-1 uppercase tracking-widest rounded bg-zinc-900/20">
                                        {resolution}
                                    </span>
                                )}
                                {codec && (
                                    <span className="text-[9px] font-black text-zinc-400 border border-white/5 px-2 py-1 uppercase tracking-widest rounded bg-zinc-900/20">
                                        {codec}
                                    </span>
                                )}
                                {audioLangs.length > 1 ? (
                                    <span className="px-2.5 py-0.5 bg-gradient-to-r from-brand-orange/20 to-amber-500/20 text-[8px] font-black text-brand-orange tracking-wider rounded border border-brand-orange/30 shadow-[0_0_8px_rgba(249,115,22,0.1)]">
                                        DUAL AUDIO
                                    </span>
                                ) : (
                                    audioLangs.map(lang => (
                                        <span 
                                            key={lang}
                                            className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-zinc-900/80 border border-white/10 text-[8px] font-black text-zinc-300 rounded"
                                        >
                                            <span 
                                                className={cn(
                                                    "w-1.5 h-1.5 rounded-full shrink-0",
                                                    lang === "JPN" ? "bg-red-500" :
                                                    lang === "ESP" ? "bg-yellow-500" :
                                                    lang === "ENG" ? "bg-blue-500" :
                                                    "bg-zinc-500"
                                                )}
                                            />
                                            {lang}
                                        </span>
                                    ))
                                )}
                            </div>
                        ) : (
                            <span className="text-[10px] font-black text-red-500/50 uppercase tracking-[0.3em]">
                                Archivo no disponible
                            </span>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div
            onClick={handlePlay}
            className={cn(
                "group relative flex flex-col transition-all duration-500 overflow-hidden rounded-xl border border-white/[0.03]",
                isCurrentlyPlaying 
                    ? "border-brand-orange/50 bg-brand-orange/[0.03] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)]" 
                    : "bg-zinc-950/40 hover:border-brand-orange/40 hover:shadow-2xl hover:-translate-y-1",
                !hasLocalFile && "opacity-60",
                hasLocalFile ? "cursor-pointer" : "cursor-default"
            )}
        >
            {/* Thumbnail Area (16:9) */}
            <div className="relative aspect-video w-full overflow-hidden bg-zinc-950">
                <DeferredImage
                    src={thumb}
                    alt={epTitle}
                    className={cn(
                        "w-full h-full object-cover transition-all duration-700 group-hover:scale-110",
                        isWatched && "opacity-40 grayscale-[0.5]"
                    )}
                    showSkeleton={false}
                    priority={priority}
                    fallback={
                        <div 
                            className="w-full h-full opacity-20 blur-3xl scale-150"
                            style={{ background: `radial-gradient(circle at 50% 30%, ${baseColor}, transparent 80%)` }}
                        />
                    }
                />

                {/* Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />
                
                {/* Watched Checkmark Overlay */}
                {isWatched && (
                    <div className="absolute inset-0 flex items-center justify-center bg-brand-orange/10 backdrop-blur-[2px] transition-all duration-500">
                        <div className="w-10 h-10 rounded-full bg-brand-orange text-white flex items-center justify-center shadow-[0_0_20px_rgba(255,110,58,0.5)] transform scale-100 group-hover:scale-110 transition-transform">
                            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                            </svg>
                        </div>
                    </div>
                )}

                {/* Status Badges */}
                <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-20">
                    {hasLocalFile ? (
                        <span className="px-2 py-0.5 bg-[#10b981]/15 backdrop-blur-md text-[8px] font-black text-[#10b981] tracking-widest uppercase border border-[#10b981]/30 rounded shadow-[0_0_8px_rgba(16,185,129,0.15)]">
                            LOCAL
                        </span>
                    ) : (
                        <span className="px-2 py-0.5 bg-red-500/15 backdrop-blur-md text-[8px] font-black text-red-400 tracking-widest uppercase border border-red-500/30 rounded shadow-[0_0_8px_rgba(239,68,68,0.15)]">
                            FALTA
                        </span>
                    )}
                    {episode.episodeMetadata?.isFiller && (
                        <span className="px-2 py-0.5 bg-amber-500/15 backdrop-blur-md text-[8px] font-black text-amber-400 tracking-widest uppercase border border-amber-500/30 rounded shadow-[0_0_8px_rgba(245,158,11,0.15)]">
                            FILLER
                        </span>
                    )}
                    {episode.type === "special" && (
                        <span className="px-2 py-0.5 bg-purple-500/15 backdrop-blur-md text-[8px] font-black text-purple-400 tracking-widest uppercase border border-purple-500/30 rounded shadow-[0_0_8px_rgba(168,85,247,0.15)]">
                            ESPECIAL
                        </span>
                    )}
                    {vibes.slice(0, 2).map(vibe => (
                        <span 
                            key={vibe}
                            className={cn(
                                "px-2 py-0.5 backdrop-blur-md text-[8px] font-black tracking-widest uppercase border rounded",
                                vibe === "EPIC" ? "bg-purple-500/15 text-purple-400 border-purple-500/30 shadow-[0_0_8px_rgba(168,85,247,0.15)]" :
                                vibe === "HYPED" ? "bg-red-500/15 text-red-400 border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.15)]" :
                                vibe === "EMOTIONAL" ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.15)]" :
                                vibe === "CHILL" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)]" :
                                "bg-orange-500/15 text-orange-400 border-orange-500/30 shadow-[0_0_8px_rgba(249,115,22,0.15)]"
                            )}
                        >
                            {vibe}
                        </span>
                    ))}
                </div>

                <div className="absolute top-3 right-3 z-20">
                    <span className="px-2 py-0.5 bg-black/60 backdrop-blur-md text-[10px] font-bebas text-white/90 tracking-widest border border-white/10 rounded">
                        EP {episode.absoluteEpisodeNumber || episode.episodeNumber}
                    </span>
                </div>

                {/* Hover Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 z-30 bg-black/40 backdrop-blur-[2px]">
                    {hasLocalFile && (
                        <div className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center shadow-2xl scale-75 group-hover:scale-100 transition-all duration-500">
                            <FaPlay className="w-4 h-4 ml-1" />
                        </div>
                    )}
                </div>

                {/* Progress Bar (if in progress) - Thinner, glowing laser line */}
                {(isCurrentlyPlaying || progressPercent > 0) && (
                    <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/40 backdrop-blur-sm z-40 overflow-hidden">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${isCurrentlyPlaying ? 100 : progressPercent}%` }} 
                            className="h-full bg-gradient-to-r from-brand-orange to-white shadow-[0_0_10px_rgba(255,110,58,0.9)]" 
                        />
                    </div>
                )}
            </div>

            {/* Info Area */}
            <div className="p-4 flex flex-col h-full min-w-0">
                <div className="flex flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                        <h4 className={cn(
                            "text-base font-bebas leading-tight tracking-widest uppercase line-clamp-1 transition-colors duration-300",
                            isCurrentlyPlaying ? "text-brand-orange" : "text-white group-hover:text-brand-orange"
                        )}>
                            {epTitle}
                        </h4>
                        
                        {hasLocalFile && (
                            <div className="flex items-center gap-2 shrink-0">
                                {isWatched ? (
                                    <button 
                                        onClick={handleToggleWatched}
                                        className="w-5 h-5 rounded-md bg-brand-orange/20 border border-brand-orange/40 hover:bg-red-500/20 hover:border-red-500/40 flex items-center justify-center transition-all text-brand-orange hover:text-red-400"
                                        title="Marcar como no visto"
                                    >
                                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                        </svg>
                                    </button>
                                ) : (
                                    <>
                                        {/* Mark as watched (single) */}
                                        <button 
                                            onClick={handleToggleWatched}
                                            className="w-5 h-5 rounded-md border border-white/10 hover:border-brand-orange hover:bg-brand-orange/10 flex items-center justify-center transition-all text-white/40 hover:text-brand-orange"
                                            title="Marcar como visto"
                                        >
                                            <div className="w-1.5 h-1.5 rounded-full bg-white/40 group-hover:bg-brand-orange" />
                                        </button>
                                        
                                        {/* Mark up to here (bulk) */}
                                        {onUpdateProgress && (
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onUpdateProgress(episode.absoluteEpisodeNumber || episode.episodeNumber)
                                                }}
                                                className="w-5 h-5 rounded-md border border-white/10 hover:border-brand-orange hover:bg-brand-orange/10 flex items-center justify-center transition-all text-white/40 hover:text-brand-orange"
                                                title="Marcar anteriores como vistos"
                                            >
                                                <svg className="w-3.5 h-3.5 fill-none stroke-current" strokeWidth="2" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5M19.5 5.25l-7.5 7.5-3-3" />
                                                </svg>
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {cleanSynopsis && (
                        <p 
                            className="text-[10px] text-zinc-500 leading-normal line-clamp-2 font-medium tracking-wide"
                            dangerouslySetInnerHTML={{ __html: cleanSynopsis }}
                        />
                    )}
                </div>
                
                <div className="mt-auto pt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[8px] font-black uppercase tracking-[0.15em] text-zinc-600">
                    {duration && <span className="text-zinc-500">{duration}</span>}
                    {resolution && <span className="text-zinc-500 border-l border-white/10 pl-2.5">{resolution}</span>}
                    {codec && <span className="text-zinc-500 border-l border-white/10 pl-2.5">{codec}</span>}
                    {audioLangs.length > 0 && (
                        <span className="inline-flex items-center gap-1 bg-zinc-900 px-1.5 py-0.5 rounded border border-white/5 text-zinc-400">
                            {audioLangs.join(" / ")}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
})
EpisodeCard.displayName = "EpisodeCard"

export { MediaActionButtons, EpisodeCard }
