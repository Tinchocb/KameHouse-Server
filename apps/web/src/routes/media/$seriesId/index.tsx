import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { Virtuoso } from "react-virtuoso"
import { useGetAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { toast } from "sonner"


import { LoadingOverlayWithLogo } from "@/components/shared/loading-overlay-with-logo"
import { VideoPlayer } from "@/components/video/player"
import {
    ArrowLeft,
    Star,
    Play,
    HardDrive,
    Zap,
    Cpu,
    MonitorPlay,
    Clock,
    Calendar,
    Settings2,
    Users,
    Film,
    CheckCircle2,
    SkipForward
} from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import type { Anime_Entry, Anime_Episode, Models_LibraryMedia, Mediastream_StreamType } from "@/api/generated/types"

export const Route = createFileRoute("/media/$seriesId/")({
    component: MediaDetailPage,
})

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getTitle(media: Models_LibraryMedia): string {
    return media.titleEnglish || media.titleRomaji || media.titleOriginal || "Sin título"
}

function fmtDuration(minutes?: number): string {
    if (!minutes) return "24 min"
    return `${minutes} min`
}

// ─── Extended StreamSource with local metadata ─────────────────────────────
// (Removed static stub: dynamic sources are now handled by useResolveStreams)

// ─── Error Banner ─────────────────────────────────────────────────────────────
function ErrorBanner({ message, onBack }: { message: string; onBack: () => void }) {
    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
            <div className="flex flex-col items-center gap-4 max-w-md text-center">
                <span className="text-5xl animate-bounce select-none">💥</span>
                <h2 className="text-xl font-black text-white uppercase tracking-wider">
                    Error al cargar el contenido
                </h2>
                <p className="text-zinc-400 text-sm leading-relaxed">{message}</p>
                <div className="flex gap-3 mt-2">
                    <button
                        onClick={onBack}
                        className="px-5 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition-all"
                    >
                        ← Volver
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white font-bold text-sm
                                   transition-all active:scale-95 shadow-[0_0_20px_rgba(249,115,22,0.35)]"
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────
export default function MediaDetailPage() {
    const { seriesId } = Route.useParams()
    const navigate = useNavigate()

    const { data: entry, isLoading, error } = useGetAnimeEntry(seriesId)

    const onBack = () => navigate({ to: "/home" })

    // Orchestrator State
    const [marathonSettings, setMarathonSettings] = useState({
        enabled: false,
        skipIntros: true,
        autoPlayNext: true,
        skipFillers: false
    })
    const [isPlayerOpen, setIsPlayerOpen] = useState(false)
    const [playTarget, setPlayTarget] = useState<{
        path: string
        streamType: Mediastream_StreamType
        episodeLabel: string
        episodeNumber: number
        seriesId: number
    } | null>(null)


    // Playback Logic
    const handleEpisodeClick = useCallback((ep: Anime_Episode) => {
        if (!ep.localFile?.path) {
            toast.error("Este episodio no se encuentra localmente.")
            return
        }

        const isMp4 = ep.localFile.path.toLowerCase().includes(".mp4")
        const targetType = isMp4 ? "direct" : "transcode"

        setPlayTarget({
            path: ep.localFile.path,
            streamType: targetType as Mediastream_StreamType,
            episodeLabel: ep.displayTitle || ep.episodeTitle || `Ep. ${ep.episodeNumber}`,
            episodeNumber: ep.episodeNumber,
            seriesId: Number(seriesId)
        })
        setIsPlayerOpen(true)
    }, [seriesId])

    const handleNextEpisode = useCallback(() => {
        if (!entry || !entry.episodes || !playTarget) return
        const nextEp = entry.episodes.find(e => e.episodeNumber === playTarget.episodeNumber + 1)
        if (nextEp) {
            if (marathonSettings.enabled && marathonSettings.autoPlayNext) {
                setIsAutoPlayingNext(true)
            }
            setResolvingEp(nextEp) 
        }
        else setIsPlayerOpen(false) // Series finished
    }, [entry, playTarget, marathonSettings])

    // Heurística de Auto-Play

    if (isLoading) return <LoadingOverlayWithLogo />
    if (error) return <ErrorBanner message={error instanceof Error ? error.message : "Error"} onBack={onBack} />
    if (!entry || !entry.media) return <ErrorBanner message="Contenido no encontrado" onBack={onBack} />

    const episodes = entry.episodes ?? []
    const media = entry.media

    // Compute Smart Status (% Local vs Remote)
    const downloadedCount = episodes.filter(e => e.isDownloaded).length
    const downloadPercent = episodes.length > 0 ? Math.round((downloadedCount / episodes.length) * 100) : 0
    
    const watchProgress = entry.listData?.progress || 0
    const maxEpisodes = media.totalEpisodes || episodes.length || 1
    const watchPercent = Math.min(100, Math.round((watchProgress / maxEpisodes) * 100))
    
    // Find Next Episode to Resume
    const resumeEp = typeof watchProgress === 'number' && watchProgress < maxEpisodes 
        ? episodes.find(e => e.episodeNumber === watchProgress + 1) || episodes[0]
        : episodes[0]

    return (
        <div className="relative min-h-screen bg-zinc-950 text-white selection:bg-orange-500/30 font-sans">
            
            {/* ── 1. Cinematic Hero Header ── */}
            <div className="absolute top-0 inset-x-0 h-[85vh] -z-10 pointer-events-none overflow-hidden">
                <img 
                    src={media.bannerImage || media.posterImage} 
                    alt="" 
                    className="w-full h-full object-cover opacity-60 animate-ken-burns"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-background via-background/40 to-transparent" />
            </div>

            <header className="px-6 md:px-12 py-8 relative z-20">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-xs font-black uppercase tracking-widest drop-shadow-md group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Volver a Inicio
                </button>
            </header>

            <main className="px-6 md:px-12 lg:px-20 pt-10 pb-32 max-w-[1600px] mx-auto">
                <div className="flex flex-col lg:flex-row gap-12 lg:gap-20">
                    
                    {/* Left Meta Column */}
                    <div className="flex-1 max-w-2xl flex flex-col gap-5">
                        <div className="flex flex-col gap-1">
                            <span className="text-orange-500 text-xs font-black uppercase tracking-[0.2em] drop-shadow-md">
                                {media.format}
                            </span>
                            <motion.h1 
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.6, ease: "easeOut" }}
                                className="text-4xl md:text-6xl font-black text-white leading-[1.1] tracking-tight text-pretty drop-shadow-xl"
                            >
                                {getTitle(media)}
                            </motion.h1>
                            
                            {/* Global Progress */}
                            {maxEpisodes > 1 && (
                                <motion.div 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                    className="flex items-center gap-3 mt-4 max-w-md"
                                >
                                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden backdrop-blur-md">
                                        <div className="h-full bg-orange-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${watchPercent}%` }} />
                                    </div>
                                    <span className="text-xs font-bold text-zinc-400 whitespace-nowrap">{watchProgress} / {maxEpisodes} eps vistos</span>
                                </motion.div>
                            )}
                        </div>

                        {/* Badges / Meta row */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold text-zinc-300">
                            {media.score > 0 && (
                                <span className="flex items-center gap-1.5 text-amber-400">
                                    <Star className="w-4 h-4 fill-amber-400" />
                                    {(media.score > 10 ? media.score / 10 : media.score).toFixed(1)}
                                </span>
                            )}
                            {media.year > 0 && <span>{media.year}</span>}
                            <span>{media.totalEpisodes} Eps</span>
                            {/* Smart Status Pill */}
                            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                                {downloadPercent === 100 ? (
                                    <><HardDrive className="w-3.5 h-3.5 text-emerald-400" /> <span className="text-emerald-400 text-xs text-nowrap">100% Local</span></>
                                ) : (
                                    <><Zap className="w-3.5 h-3.5 text-amber-400" /> <span className="text-amber-400 text-xs text-nowrap">{downloadPercent}% Local</span></>
                                )}
                            </span>
                        </div>

                        {/* Genres */}
                        {media.genres && media.genres.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-1">
                                {media.genres.map(g => (
                                    <span key={g} className="px-3 py-1 text-[11px] font-bold uppercase tracking-widest rounded-md bg-zinc-900/60 backdrop-blur-md text-zinc-300 border border-white/5">
                                        {g}
                                    </span>
                                ))}
                            </div>
                        )}

                        <p className="text-zinc-400 text-sm md:text-base leading-relaxed mt-2 max-w-xl">
                            {media.description || "Sin descripción disponible."}
                        </p>

                        {/* CTAs */}
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5, duration: 0.4 }}
                            className="flex flex-wrap items-center gap-4 mt-4"
                        >
                            <motion.button
                                whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(249,115,22,0.4)" }}
                                whileTap={{ scale: 0.96 }}
                                onClick={() => resumeEp && handleEpisodeClick(resumeEp)}
                                className="flex items-center justify-center gap-2 bg-primary hover:bg-orange-400 text-white min-h-[52px] px-8 rounded-xl font-bold text-sm transition-all shadow-[0_4px_20px_rgba(249,115,22,0.3)] active:scale-95"
                            >
                                <Play className="w-5 h-5 fill-current" />
                                {watchProgress > 0 && watchProgress < maxEpisodes ? `Continuar (Ep. ${resumeEp?.episodeNumber})` : "Reproducir"}
                            </motion.button>
                        </motion.div>

                        {/* Marathon Control Center */}
                        <div className="mt-6 p-6 rounded-2xl glass-layer flex flex-col gap-5 max-w-xl">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-200 flex items-center gap-2.5">
                                    <MonitorPlay className="w-4 h-4 text-primary" />
                                    Marathon Center
                                </h3>
                                <button
                                    onClick={() => setMarathonSettings(s => ({ ...s, enabled: !s.enabled }))}
                                    className={cn(
                                        "px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                                        marathonSettings.enabled 
                                            ? "bg-primary text-white shadow-[0_0_15px_rgba(249,115,22,0.3)]" 
                                            : "bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
                                    )}
                                >
                                    {marathonSettings.enabled ? "Active" : "Disabled"}
                                </button>
                            </div>
                            {marathonSettings.enabled && (() => {
                                type MarathonSettingsOptions = "skipIntros" | "autoPlayNext" | "skipFillers";
                                const options: { key: MarathonSettingsOptions; label: string; icon: React.ReactNode }[] = [
                                        { key: 'skipIntros', label: 'Skip Intros', icon: <SkipForward className="w-3.5 h-3.5" /> },
                                        { key: 'autoPlayNext', label: 'Auto-Play', icon: <Play className="w-3.5 h-3.5" /> },
                                        { key: 'skipFillers', label: 'Skip Fillers', icon: <CheckCircle2 className="w-3.5 h-3.5" /> }
                                ];
                                return (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-white/5">
                                    {options.map((opt) => (
                                        <button
                                            key={opt.key}
                                            onClick={() => setMarathonSettings(s => ({ ...s, [opt.key]: !s[opt.key] }))}
                                            className={cn(
                                                "flex flex-col items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold transition-all border",
                                                marathonSettings[opt.key]
                                                    ? "bg-primary/10 border-primary/30 text-primary" 
                                                    : "bg-white/[0.02] border-white/5 text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300"
                                            )}
                                        >
                                            {opt.icon}
                                            <span className="uppercase tracking-widest">{opt.label}</span>
                                        </button>
                                    ))}
                                </div>
                                )
                            })()}
                        </div>
                    </div>

                    {/* Right Tech Specs Panel */}
                    <aside className="w-full lg:w-72 flex flex-col gap-4">
                        <div className="p-6 rounded-2xl glass-layer flex flex-col gap-5">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                                <Settings2 className="w-4 h-4" />
                                Especificaciones
                            </h3>
                            
                            <div className="flex flex-col gap-2.5 border-b border-white/5 pb-4">
                                <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider">
                                    <span className="text-zinc-500">Estado Local</span>
                                    <span className={cn(downloadPercent === 100 ? "text-emerald-400" : downloadPercent > 50 ? "text-primary" : "text-zinc-600")}>
                                        {downloadPercent}%
                                    </span>
                                </div>
                                <div className="w-full h-1 bg-white/[0.05] rounded-full overflow-hidden">
                                    <div className={cn("h-full rounded-full transition-all duration-1000", downloadPercent === 100 ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "bg-primary shadow-[0_0_10px_rgba(249,115,22,0.3)]")} style={{ width: `${downloadPercent}%` }} />
                                </div>
                            </div>
                            
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-[11px] font-medium border-b border-white/5 pb-3">
                                    <span className="text-zinc-500 uppercase tracking-widest">Origen</span>
                                    <span className="font-bold text-zinc-200">{downloadPercent === 100 ? "HDD Local" : downloadPercent > 0 ? "Híbrido" : "Stream"}</span>
                                </div>
                                <div className="flex justify-between items-center text-[11px] font-medium border-b border-white/5 pb-3">
                                    <span className="text-zinc-500 uppercase tracking-widest">Calidad</span>
                                    <span className="font-bold text-zinc-200">{episodes[0]?.localFile?.name?.includes("2160") ? "4K UHD" : "1080p FHD"}</span>
                                </div>
                                <div className="flex justify-between items-center text-[11px] font-medium border-b border-white/5 pb-3">
                                    <span className="text-zinc-500 uppercase tracking-widest">Formato</span>
                                    <span className="font-bold text-zinc-200">{media.format}</span>
                                </div>
                                <div className="flex justify-between items-center text-[11px] font-medium">
                                    <span className="text-zinc-500 uppercase tracking-widest">Status</span>
                                    <span className="font-bold text-zinc-200">{media.status}</span>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>

                {/* ── 2. Unified Episode Grid (Virtualized) ── */}
                <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.8 }}
                    className="mt-20 flex flex-col gap-6"
                >
                    <div className="flex items-center gap-3">
                        <span className="w-1 h-5 rounded-full bg-orange-500" />
                        <h2 className="text-xl font-black text-white tracking-tight">Episodios</h2>
                        <span className="text-xs font-bold text-zinc-500 ml-2 px-2 py-0.5 rounded-md bg-zinc-900">
                            {episodes.length} Totales
                        </span>
                    </div>

                    <div className="w-full h-[600px] border border-white/5 rounded-2xl bg-zinc-900/20 backdrop-blur-md overflow-hidden relative">
                        {/* 
                            Used Virtuoso instead of mapping over 100s of elements directly.
                            ItemContent expects (index, itemData). 
                        */}
                        <Virtuoso
                            style={{ height: '100%', width: '100%' }}
                            className="scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
                            totalCount={episodes.length}
                            itemContent={(index) => {
                                const ep = episodes[index]
                                const epIntel = ep.episodeMetadata && 'Intel' in ep.episodeMetadata ? (ep.episodeMetadata as any).Intel : null;
                                const isEpic = epIntel?.Tag === "EPIC";
                                const isFiller = ep.episodeMetadata?.isFiller
                                return (
                                    <div className="px-5 py-2">
                                        <div 
                                            className={cn(
                                                "group flex flex-col md:flex-row items-stretch md:items-center gap-6 p-4 rounded-2xl transition-all duration-300 cursor-pointer relative overflow-hidden",
                                                "bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 hover:shadow-[0_15px_40px_rgba(0,0,0,0.3)]",
                                                isEpic ? "border-primary/40 bg-primary/[0.03] hover:border-primary/60 hover:shadow-[0_0_25px_rgba(249,115,22,0.15)]" : "",
                                                isFiller ? "grayscale opacity-40 hover:opacity-100 transition-all duration-500" : ""
                                            )}
                                            onClick={() => handleEpisodeClick(ep)}
                                        >
                                            {/* Thumbnail */}
                                            <div className="relative w-full md:w-56 aspect-video shrink-0 rounded-xl overflow-hidden bg-zinc-950 shadow-lg">
                                                {ep.episodeMetadata?.image ? (
                                                    <img src={ep.episodeMetadata.image} alt={ep.displayTitle} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-800">
                                                        <MonitorPlay className="w-8 h-8" />
                                                    </div>
                                                )}
                                                
                                                {isFiller && (
                                                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-[0.2em] bg-black/80 text-zinc-500 border border-white/10 backdrop-blur-md z-10">
                                                        Filler
                                                    </div>
                                                )}
                                                
                                                {/* Play Overlay */}
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-[0_0_25px_rgba(249,115,22,0.5)] scale-90 group-hover:scale-100 transition-all duration-300">
                                                        <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                                                    </div>
                                                </div>

                                                {/* Status Badges */}
                                                <div className="absolute top-2.5 right-2.5 flex gap-1.5">
                                                    {isEpic && (
                                                        <span className="w-6 h-6 rounded-lg bg-primary text-white flex items-center justify-center shadow-[0_0_15px_rgba(249,115,22,0.5)]">
                                                            <Star className="w-3.5 h-3.5 fill-current" />
                                                        </span>
                                                    )}
                                                    <div 
                                                        className={cn(
                                                            "w-6 h-6 rounded-lg backdrop-blur-md flex items-center justify-center transition-colors border border-white/10",
                                                            ep.isDownloaded ? "bg-emerald-500/20 text-emerald-400" : "bg-black/40 text-primary"
                                                        )}
                                                        title={ep.isDownloaded ? "Local File" : "Stream"}
                                                    >
                                                        {ep.isDownloaded ? <HardDrive className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 flex flex-col justify-center gap-2 py-1 min-w-0">
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="space-y-0.5 min-w-0">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary/80">Episode {ep.episodeNumber}</p>
                                                        <h4 className={cn(
                                                            "text-[15px] font-black truncate transition-colors",
                                                            isEpic ? "text-primary" : "text-zinc-100 group-hover:text-primary"
                                                        )}>
                                                            {ep.displayTitle || ep.episodeTitle || `Chapter ${ep.episodeNumber}`}
                                                        </h4>
                                                    </div>
                                                    <span className="text-[10px] font-mono text-zinc-500 shrink-0 tabular-nums bg-white/[0.03] px-2 py-1 rounded-md border border-white/5">
                                                        {fmtDuration(ep.episodeMetadata?.length)}
                                                    </span>
                                                </div>
                                                
                                                <p className="text-[13px] text-zinc-500 line-clamp-2 leading-relaxed max-w-3xl group-hover:text-zinc-400 transition-colors">
                                                    {ep.episodeMetadata?.summary || ep.episodeMetadata?.overview || "No synopsis available for this episode."}
                                                </p>
                                                
                                                {/* Intelligence Tags */}
                                                {epIntel?.ArcName && (
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-600 group-hover:text-zinc-500 transition-colors">
                                                            {epIntel.ArcName}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>                                )
                            }}
                        />
                    </div>
                </motion.div>
            </main>


            {/* ── Video Player Modal ── */}
            {isPlayerOpen && playTarget && (
                <VideoPlayer
                    streamUrl={playTarget.path}
                    streamType={playTarget.streamType === "online" ? "direct" : playTarget.streamType as Mediastream_StreamType}
                    title={getTitle(media)}
                    episodeLabel={playTarget.episodeLabel}
                    mediaId={Number(playTarget.seriesId)}
                    episodeNumber={playTarget.episodeNumber}
                    isExternalStream={false}
                    marathonMode={marathonSettings.enabled && marathonSettings.autoPlayNext}
                    onNextEpisode={handleNextEpisode}
                    onClose={() => setIsPlayerOpen(false)}
                />
            )}
        </div>
    )
}
