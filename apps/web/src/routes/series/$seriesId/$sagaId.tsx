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
                            ? "fill-white text-white"
                            : "fill-neutral-800 text-neutral-800",
                    )}
                />
            ))}
            <span className="text-neutral-500 text-xs ml-1 font-black">{rating.toFixed(1)}</span>
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
        <aside className="w-full lg:w-[30%] lg:min-h-screen lg:sticky lg:top-0 lg:self-start bg-black border-r border-white/10 flex flex-col">
            {/* Back button */}
            <button
                onClick={onBack}
                className="flex items-center gap-2 px-8 pt-8 pb-4 text-zinc-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-[0.3em] group"
            >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                VOLVER
            </button>

            {/* Poster */}
            <div className="px-8 mt-4">
                <div className="relative w-full aspect-[2/3] bg-black border border-white/20">
                    <img
                        src={posterUrl}
                        alt={title}
                        className="w-full h-full object-cover grayscale"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                </div>
            </div>

            {/* Metadata */}
            <div className="flex-1 px-8 pt-8 pb-12 flex flex-col gap-6">
                {/* Saga label */}
                <span className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">
                    SAGA: {sagaTitle}
                </span>

                {/* Title */}
                <h1 className="text-white text-4xl font-bebas leading-[0.9] tracking-widest uppercase">
                    {title}
                </h1>

                {/* Rating */}
                <StarRating rating={rating} />

                {/* Quick stats row */}
                <div className="flex flex-wrap items-center gap-4 text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                    <span className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" />
                        {year}
                    </span>
                    <span className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" />
                        {durationPerEp}
                    </span>
                    <span>{episodesCount} EPISODIOS</span>
                </div>

                {/* Genre tags */}
                <div className="flex flex-wrap gap-2">
                    {genres.slice(0, 4).map((g) => (
                        <span
                            key={g}
                            className="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest bg-zinc-900 text-zinc-400 border border-white/5"
                        >
                            {g}
                        </span>
                    ))}
                </div>

                {/* Synopsis */}
                <p className="text-zinc-400 text-[13px] leading-relaxed font-bold uppercase tracking-wide">
                    {synopsis}
                </p>

                {/* Divider */}
                <div className="h-px bg-white/10 mt-auto mb-6" />

                {/* Studio info */}
                <div className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.2em]">
                    {studios.length > 0 && (
                        <>
                            <span className="text-zinc-700">ESTUDIO: </span>{studios.join(", ")}
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
                "w-full flex items-center gap-6 px-6 py-4 text-left group",
                "transition-all duration-200 border-l-2",
                isActive
                    ? "bg-white text-black border-white"
                    : "bg-transparent border-transparent hover:bg-zinc-900 text-zinc-500 hover:text-white",
            )}
        >
            {/* Episode number */}
            <div className="flex flex-col items-center w-8 shrink-0">
                <span
                    className={cn(
                        "text-xs font-black tracking-widest",
                        isActive ? "text-black" : "text-zinc-700 group-hover:text-zinc-400",
                    )}
                >
                    {episode.number.toString().padStart(2, '0')}
                </span>
                {isDownloaded && <HardDrive className={cn("w-3 h-3 mt-1", isActive ? "text-black/40" : "text-zinc-700")} />}
            </div>

            {/* Title */}
            <span className="flex-1 text-[11px] font-black uppercase tracking-widest truncate">
                {episode.title}
            </span>

            {/* Duration */}
            <span className={cn("text-[10px] font-black tracking-widest shrink-0", isActive ? "text-black/50" : "text-zinc-700")}>
                {episode.duration.toUpperCase()}
            </span>

            {/* Watched indicator */}
            {isWatched
                ? <CheckCircle2 className={cn("w-4 h-4 shrink-0", isActive ? "text-black" : "text-zinc-500")} />
                : <Circle className="w-4 h-4 text-zinc-800 shrink-0 opacity-0 group-hover:opacity-100" />
            }
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
        <main className="flex-1 flex flex-col bg-black overflow-y-auto">
            {/* ── Current episode info ────────────────────────── */}
            <div className="px-10 pt-12 pb-10 border-b border-white/10">
                <div className="flex items-start justify-between gap-12">
                    <div className="flex-1">
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">
                            EPISODIO {current.number}
                        </p>
                        <h2 className="text-white text-4xl font-black leading-none uppercase tracking-tight mb-6">
                            {current.title}
                        </h2>
                        <p className="text-zinc-400 text-[14px] leading-relaxed font-bold uppercase tracking-wide max-w-3xl">
                            {current.description}
                        </p>
                    </div>

                    {/* Mark watched toggle */}
                    <button
                        onClick={onMarkWatched}
                        className={cn(
                            "shrink-0 flex items-center gap-3 px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] border transition-all duration-200",
                            currentWatched
                                ? "bg-white border-white text-black"
                                : "bg-black border-white/20 text-zinc-500 hover:text-white hover:border-white",
                        )}
                    >
                        {currentWatched
                            ? <CheckCircle2 className="w-4 h-4" />
                            : <Circle className="w-4 h-4" />
                        }
                        {currentWatched ? "VISTO" : "MARCAR"}
                    </button>
                </div>
            </div>

            {/* ── Play Button ───────────────────────────────── */}
            <section className="px-10 pt-10 pb-6">
                <button
                    onClick={() => onPlayEpisode(current)}
                    className={cn(
                        "w-full flex items-center justify-center gap-4 py-6 font-black text-[13px] uppercase tracking-[0.3em] transition-all duration-300",
                        "bg-white text-black hover:bg-zinc-200",
                        !isCurrentDownloaded && "opacity-20 cursor-not-allowed grayscale"
                    )}
                    disabled={!isCurrentDownloaded}
                >
                    <HardDrive className="w-5 h-5" />
                    REPRODUCIR EPISODIO {current.number}
                </button>
            </section>

            {/* ── Episode selector ─────────────────────────────── */}
            <section className="px-10 pt-6 pb-20">
                {/* Collapsible header */}
                <button
                    onClick={() => setEpisodesOpen((v) => !v)}
                    className="w-full flex items-center gap-4 mb-6 group"
                >
                    <div className="h-px bg-white/10 flex-1" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 group-hover:text-white transition-colors">
                        EPISODIOS DE LA SAGA
                    </h3>
                    <ChevronDown
                        className={cn(
                            "w-4 h-4 text-zinc-700 group-hover:text-white transition-all duration-300",
                            episodesOpen ? "rotate-180" : "",
                        )}
                    />
                    <div className="h-px bg-white/10 flex-1" />
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

