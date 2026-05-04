import { useState, useMemo, useCallback } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { cn } from "@/components/ui/core/styling"
import { useGetAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { HardDrive, Star, ArrowLeft, Calendar, Clock, CheckCircle2, Circle, ChevronRight, ChevronDown } from "lucide-react"
import { VideoPlayer } from "@/components/video/player"
import type { Mediastream_StreamType, Anime_Episode } from "@/api/generated/types"
import { toast } from "sonner"

export const Route = createFileRoute("/series/$seriesId/$sagaId")({
    component: DetailPage,
})

import { resolveSeriesSagas } from "@/lib/config/dragonball.config"

interface Episode {
    id: string
    number: number
    title: string
    description: string
    duration: string
}

// ─── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
    return (
        <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
                <Star
                    key={n}
                    className={cn(
                        "w-4 h-4",
                        n <= Math.round(rating / 2)
                            ? "fill-orange-400 text-orange-400"
                            : "fill-neutral-700 text-neutral-700",
                    )}
                />
            ))}
            <span className="text-neutral-400 text-xs ml-1 font-mono">{rating.toFixed(1)}</span>
        </div>
    )
}

// ─── Left Panel ───────────────────────────────────────────────────────────────

interface LeftPanelProps {
    posterUrl: string
    title: string
    synopsis: string
    year: string
    episodesCount: number
    sagaTitle: string
    genres: string[]
    rating: number
    durationPerEp: string
    studios: string[]
    onBack: () => void
}

function LeftPanel({ posterUrl, title, synopsis, year, episodesCount, sagaTitle, genres, rating, durationPerEp, studios, onBack }: LeftPanelProps) {

    return (
        <aside className="w-full lg:w-[30%] lg:min-h-screen lg:sticky lg:top-0 lg:self-start bg-neutral-950 border-r border-white/5 flex flex-col">
            {/* Back button */}
            <button
                onClick={onBack}
                className="flex items-center gap-2 px-6 pt-6 pb-4 text-neutral-500 hover:text-white transition-colors text-sm font-bold uppercase tracking-widest group"
            >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Volver
            </button>

            {/* Poster */}
            <div className="px-6">
                <div className="relative w-full aspect-[2/3] rounded-2xl overflow-hidden bg-neutral-900 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
                    <img
                        src={posterUrl}
                        alt={title}
                        className="w-full h-full object-cover"
                    />
                    {/* Subtle gradient overlay at bottom of poster */}
                    <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
                </div>
            </div>

            {/* Metadata */}
            <div className="flex-1 px-6 pt-5 pb-8 flex flex-col gap-4">
                {/* Saga label */}
                <span className="text-orange-500 text-xs font-black uppercase tracking-[0.2em]">
                    {sagaTitle}
                </span>

                {/* Title */}
                <h1 className="text-white text-2xl md:text-3xl font-black leading-tight tracking-tight">
                    {title}
                </h1>

                {/* Rating */}
                <StarRating rating={rating} />

                {/* Quick stats row */}
                <div className="flex flex-wrap items-center gap-3 text-neutral-400 text-xs font-medium">
                    <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-neutral-600" />
                        {year}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-neutral-700" />
                    <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-neutral-600" />
                        {durationPerEp}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-neutral-700" />
                    <span>{episodesCount} episodios</span>
                </div>

                {/* Genre tags */}
                <div className="flex flex-wrap gap-2">
                    {genres.slice(0, 4).map((g) => (
                        <span
                            key={g}
                            className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full bg-white/5 text-neutral-400 border border-white/5"
                        >
                            {g}
                        </span>
                    ))}
                </div>

                {/* Synopsis */}
                <p className="text-neutral-400 text-sm leading-relaxed">
                    {synopsis}
                </p>

                {/* Divider */}
                <div className="h-px bg-white/5 mt-auto" />

                {/* Studio info */}
                <div className="text-[11px] text-neutral-600 font-medium">
                    {studios.length > 0 && (
                        <>
                            <span className="text-neutral-500">Estudio: </span>{studios.join(", ")}
                        </>
                    )}
                </div>
            </div>
        </aside>
    )
}

// ─── Episode Row ──────────────────────────────────────────────────────────────

interface EpisodeRowProps {
    episode: Episode
    isActive: boolean
    isWatched: boolean
    isDownloaded: boolean
    onSelect: () => void
}

function EpisodeRow({ episode, isActive, isWatched, isDownloaded, onSelect }: EpisodeRowProps) {
    return (
        <button
            onClick={onSelect}
            className={cn(
                "w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left group",
                "transition-all duration-150 border",
                isActive
                    ? "bg-orange-500/10 border-orange-500/20 text-white"
                    : "bg-transparent border-transparent hover:bg-white/4 hover:border-white/5 text-neutral-400 hover:text-white",
            )}
        >
            {/* Episode number */}
            <div className="flex flex-col items-center w-8 shrink-0">
                <span
                    className={cn(
                        "text-xs font-black font-mono",
                        isActive ? "text-orange-400" : "text-neutral-600",
                    )}
                >
                    {episode.number}
                </span>
                {isDownloaded && <HardDrive className="w-2.5 h-2.5 text-emerald-500 mt-0.5" />}
            </div>

            {/* Title */}
            <span className="flex-1 text-sm font-medium truncate">
                {episode.title}
            </span>

            {/* Duration */}
            <span className="text-xs font-mono text-neutral-600 shrink-0">
                {episode.duration}
            </span>

            {/* Watched indicator */}
            {isWatched
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500/60 shrink-0" />
                : <Circle className="w-4 h-4 text-neutral-700 shrink-0 opacity-0 group-hover:opacity-100" />
            }

            {/* Active chevron */}
            {isActive && (
                <ChevronRight className="w-4 h-4 text-orange-400 shrink-0" />
            )}
        </button>
    )
}

// ─── Right Panel ──────────────────────────────────────────────────────────────

interface RightPanelProps {
    episodes: Episode[]
    currentIndex: number
    onSelectEpisode: (idx: number) => void
    isWatched: (id: string) => boolean
    onMarkWatched: () => void
    currentWatched: boolean
    onPlayEpisode: (ep: Episode) => void
    downloadedEpisodes: Set<number>
}

function RightPanel({
    episodes,
    currentIndex,
    onSelectEpisode,
    isWatched,
    onMarkWatched,
    currentWatched,
    onPlayEpisode,
    downloadedEpisodes
}: RightPanelProps) {
    const current = episodes[currentIndex]!
    const [episodesOpen, setEpisodesOpen] = useState(true)
    const isCurrentDownloaded = downloadedEpisodes.has(current.number)

    return (
        <main className="flex-1 flex flex-col bg-neutral-950 overflow-y-auto">
            {/* ── Current episode info ────────────────────────── */}
            <div className="px-6 md:px-10 pt-8 pb-6 border-b border-white/5">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-orange-500 text-xs font-black uppercase tracking-[0.2em] mb-2">
                            Episodio {current.number}
                        </p>
                        <h2 className="text-white text-xl md:text-2xl font-black leading-snug">
                            {current.title}
                        </h2>
                        <p className="text-neutral-400 text-sm mt-2 leading-relaxed max-w-2xl">
                            {current.description}
                        </p>
                    </div>

                    {/* Mark watched toggle */}
                    <button
                        onClick={onMarkWatched}
                        className={cn(
                            "shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all duration-200",
                            currentWatched
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                                : "bg-white/5 border-white/5 text-neutral-400 hover:text-white hover:border-white/10",
                        )}
                    >
                        {currentWatched
                            ? <CheckCircle2 className="w-3.5 h-3.5" />
                            : <Circle className="w-3.5 h-3.5" />
                        }
                        {currentWatched ? "Visto" : "Marcar"}
                    </button>
                </div>
            </div>

            {/* ── Play Button ───────────────────────────────── */}
            <section className="px-6 md:px-10 pt-6 pb-4">
                <button
                    Reproducir Episodio {current.number}
                </button>
                    onClick={() => onPlayEpisode(current)}
                    className={cn(
                        "w-full flex items-center justify-center gap-3 py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all duration-200",
                        "bg-orange-500 hover:bg-orange-400 text-white",
                        "shadow-[0_4px_20px_rgba(249,115,22,0.3)] hover:shadow-[0_6px_30px_rgba(249,115,22,0.5)]",
                        "active:scale-[0.98]",
                        !isCurrentDownloaded && "opacity-50 cursor-not-allowed grayscale"
                    )}
                    disabled={!isCurrentDownloaded}
                >
                    <HardDrive className="w-5 h-5" />
                    Reproducir Episodio {current.number}
                </button>
            </section>

            {/* ── Episode selector ─────────────────────────────── */}
            <section className="px-6 md:px-10 pt-4 pb-10">
                {/* Collapsible header */}
                <button
                    onClick={() => setEpisodesOpen((v) => !v)}
                    className="w-full flex items-center gap-3 mb-3 group"
                >
                    <span className="w-1 h-4 rounded-full bg-white/10 group-hover:bg-orange-500 transition-colors" />
                    <h3 className="text-xs font-black uppercase tracking-[0.18em] text-neutral-500 group-hover:text-neutral-300 transition-colors flex-1 text-left">
                        Episodios de la Saga
                    </h3>
                    <ChevronDown
                        className={cn(
                            "w-4 h-4 text-neutral-600 group-hover:text-neutral-400 transition-all duration-200",
                            episodesOpen ? "rotate-180" : "",
                        )}
                    />
                </button>

                {/* Episode list */}
                <div
                    className={cn(
                        "flex flex-col gap-1 overflow-hidden transition-all duration-300",
                        episodesOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0",
                    )}
                >
                    {episodes.map((ep, idx) => (
                        <EpisodeRow
                            key={ep.id}
                            episode={ep}
                            isActive={idx === currentIndex}
                            isWatched={isWatched(ep.id)}
                            isDownloaded={downloadedEpisodes.has(ep.number)}
                            onSelect={() => onSelectEpisode(idx)}
                        />
                    ))}
                </div>
            </section>
        </main>
    )
}


// ─── Detail Page ──────────────────────────────────────────────────────────────

function DetailPage() {
    const { seriesId, sagaId } = Route.useParams()
    const navigate = useNavigate()
    const { isWatched, markWatched, unmarkWatched } = {
        isWatched: (_id: string) => false,
        markWatched: (_id: string) => {},
        unmarkWatched: (_id: string) => {},
    }

    const { data: libraryEntry } = useGetAnimeEntry(seriesId)

    // Match saga from our local mapping using the shared resolver
    const seriesSagas = resolveSeriesSagas(libraryEntry?.media)
    
    const rawSaga = seriesSagas.find((s) => s.id === sagaId)

    // Build the frontend standard format 
    const series = useMemo(() => {
        if (!libraryEntry?.media) return null
        const media = libraryEntry.media
        return {
            id: seriesId,
            title: media.titleRomaji || media.titleEnglish || "Serie",
            year: media.year?.toString() || "",
            episodesCount: media.totalEpisodes || 0,
            genres: (media.genres as unknown as string[]) || ["Anime"],
            rating: media.score || media.rating || 0,
            durationPerEp: "24 min / ep",
            studios: [] as string[],
        }
    }, [libraryEntry, seriesId])

    const saga = useMemo(() => {
        if (!rawSaga) return null
        
        // Find episodes physically available from standard GET
        const allEpisodes = libraryEntry?.episodes || []
        
        // Filter those belonging inside saga boundaries
        const arcEpisodes = allEpisodes
            .filter(ep => ep.episodeNumber >= rawSaga.startEp && ep.episodeNumber <= rawSaga.endEp)
            .sort((a, b) => a.episodeNumber - b.episodeNumber)

        // Map to expected UI layout
        const mappedEpisodes: Episode[] = arcEpisodes.map(ep => ({
            id: ep.absoluteEpisodeNumber?.toString() ?? ep.episodeNumber.toString(),
            number: ep.episodeNumber,
            title: ep.episodeTitle || ep.displayTitle || `Episodio ${ep.episodeNumber}`,
            description: ep.episodeMetadata?.overview || ep.episodeMetadata?.summary || "Sin descripción disponible.",
            duration: ep.episodeMetadata?.length ? `${ep.episodeMetadata.length} min` : "24 min"
        }))

        // If the library returns fewer episodes than the saga needs, we generate mock ones so the user 
        // can still see Torrentio streams for them!
        const guaranteedLength = rawSaga.endEp - rawSaga.startEp + 1
        let finalEpisodes = mappedEpisodes
        if (mappedEpisodes.length < guaranteedLength) {
            const filler: Episode[] = []
            for (let i = rawSaga.startEp; i <= rawSaga.endEp; i++) {
                const exists = mappedEpisodes.find(m => m.number === i)
                if (exists) filler.push(exists)
                else filler.push({
                    id: `mock-${i}`,
                    number: i,
                    title: `Episodio ${i}`,
                    description: "Detalles no sincronizados localmente",
                    duration: "24 min"
                })
            }
            finalEpisodes = filler
        }

        return {
            ...rawSaga,
            episodes: finalEpisodes
        }
    }, [rawSaga, libraryEntry])

    const [currentIdx, setCurrentIdx] = useState(0)
    const [isPlayerOpen, setIsPlayerOpen] = useState(false)
    const [playTarget, setPlayTarget] = useState<{
        path: string
        streamType: Mediastream_StreamType
        episodeLabel: string
        episodeNumber: number
        seriesId: number
    } | null>(null)

    const downloadedEpisodes = useMemo(() => {
        const set = new Set<number>()
        libraryEntry?.episodes?.forEach(ep => {
            if (ep.isDownloaded) set.add(ep.episodeNumber)
        })
        return set
    }, [libraryEntry])

    const currentEpisode = saga?.episodes[currentIdx]

    // When user clicks an episode → play if local
    const handleEpisodePlay = useCallback((ep: Episode) => {
        const fullEp = libraryEntry?.episodes?.find(e => e.episodeNumber === ep.number)
        if (!fullEp?.localFile?.path) {
            toast.error("Archivo local no disponible.")
            return
        }

        const isMp4 = fullEp.localFile.path.toLowerCase().endsWith(".mp4")
        const targetType = isMp4 ? "direct" : "transcode"

        setPlayTarget({
            path: fullEp.localFile.path,
            streamType: targetType as Mediastream_StreamType,
            episodeLabel: ep.title,
            episodeNumber: ep.number,
            seriesId: Number(seriesId)
        })
        setIsPlayerOpen(true)
    }, [libraryEntry, seriesId])

    if (!series || !saga || saga.episodes.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center text-white bg-neutral-950">
                Contenido no encontrado
            </div>
        )
    }

    const handleMarkWatched = () => {
        if (!currentEpisode) return
        if (isWatched(currentEpisode.id)) unmarkWatched(currentEpisode.id)
        else markWatched(currentEpisode.id)
    }

    return (
        <div className="flex flex-col lg:flex-row min-h-screen bg-neutral-950">
            {/* ── Left: Poster + Metadata (30%) ── */}
            <LeftPanel
                posterUrl={saga.image}
                title={series.title}
                synopsis={saga.description}
                year={series.year}
                episodesCount={series.episodesCount}
                sagaTitle={saga.title}
                genres={series.genres}
                rating={series.rating}
                durationPerEp={series.durationPerEp}
                studios={series.studios}
                onBack={() => navigate({ to: "/series/$seriesId", params: { seriesId: series.id } })}
            />

            {/* ── Right: Episodes (70%) ── */}
            <RightPanel
                episodes={saga.episodes}
                currentIndex={currentIdx}
                onSelectEpisode={setCurrentIdx}
                isWatched={isWatched}
                onMarkWatched={handleMarkWatched}
                currentWatched={currentEpisode ? isWatched(currentEpisode.id) : false}
                onPlayEpisode={handleEpisodePlay}
                downloadedEpisodes={downloadedEpisodes}
            />


            {/* ── Video Player Modal ── */}
            {isPlayerOpen && playTarget && (
                <VideoPlayer
                    streamUrl={playTarget.path}
                    streamType={playTarget.streamType === "online" ? "direct" : playTarget.streamType as Mediastream_StreamType}
                    title={series.title}
                    episodeLabel={playTarget.episodeLabel}
                    mediaId={playTarget.seriesId}
                    episodeNumber={playTarget.episodeNumber}
                    isExternalStream={false}
                    marathonMode={false}
                    onClose={() => setIsPlayerOpen(false)}
                />
            )}
        </div>
    )
}

