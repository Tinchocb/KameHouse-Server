import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { HydrationBoundary, dehydrate, useQueryClient } from "@tanstack/react-query"
import React, { useMemo, useState } from "react"
import { toast } from "sonner"
import { useAppStore } from "@/lib/store"
import { ListPlus, Play } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { getHighResImage, getLowResImage } from "@/lib/helpers/images"
import { fetchAnimeEntry, useGetAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { useGetContinuityWatchHistoryItem } from "@/api/hooks/continuity.hooks"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { Anime_LocalFile, Mediastream_StreamType } from "@/api/generated/types"
import { EmptyState } from "@/components/shared/empty-state"
import { VideoPlayer } from "@/components/video/player"
import { sanitizeHtml } from "@/lib/helpers/sanitizer"
import { startViewTransition } from "@/lib/helpers/transitions"
import { MovieHeroWidescreen } from "./-components/movie-hero-widescreen"
import { MovieBentoSpecs } from "./-components/movie-bento-specs"
import { ChronologyWidget } from "./-components/chronology-widget"
import { MovieAudioSubs } from "./-components/movie-audio-subs"
import { CollectionSwimlane } from "./-components/collection-swimlane"
import { PremiumPosterCard } from "@/components/shared/premium-poster-card"
import { DeferredImage } from "@/components/shared/deferred-image"
import { useSound } from "@/hooks/use-sound"

export const Route = createFileRoute("/movies/$movieId")({
    loader: ({ params: { movieId }, context }) => {
        const qc = context.queryClient
        qc.prefetchQuery({
            queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, movieId],
            queryFn: () => fetchAnimeEntry(movieId),
        })
        return { dehydrateState: dehydrate(qc) }
    },
    component: MovieDetailPage,
})

function MovieDetailPage() {
    const { movieId } = Route.useParams()
    const { dehydrateState } = Route.useLoaderData()

    return (
        <HydrationBoundary state={dehydrateState}>
            <MovieDetailClient key={movieId} movieId={movieId} />
        </HydrationBoundary>
    )
}

const formatFileSize = (bytes: number) => {
    if (!bytes) return "0 MB"
    const mb = bytes / (1024 * 1024)
    if (mb >= 1024) {
        return `${(mb / 1024).toFixed(2)} GB`
    }
    return `${mb.toFixed(0)} MB`
}

const parseFrameRate = (fps: string | undefined | null): number => {
    if (!fps) return 24
    if (fps.includes("/")) {
        const [num, den] = fps.split("/").map(Number)
        if (num && den) return Math.round(num / den)
    }
    const val = Number(fps)
    return isNaN(val) ? 24 : Math.round(val)
}

function MovieDetailClient({ movieId }: { movieId: string }) {
    const { playSound } = useSound()
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const { data: entry, isLoading } = useGetAnimeEntry(movieId)
    const { data: continuityData, refetch: refetchContinuity } = useGetContinuityWatchHistoryItem(Number(movieId))

    React.useEffect(() => {
        if (entry) playSound("detail", 0.4)
    }, [entry?.media?.id, playSound])

    const [playTarget, setPlayTarget] = useState<{
        path: string
        streamType: Mediastream_StreamType
        episodeLabel: string
        episodeNumber: number
        malId?: number | null
    } | null>(null)

    const synopsis = entry?.media?.description || "Sin descripción disponible."
    const cleanSynopsis = useMemo(() => sanitizeHtml(synopsis), [synopsis])
    
    const title = entry?.media?.titleSpanish || entry?.media?.titleEnglish || entry?.media?.titleRomaji || "Título Desconocido"
    const score = entry?.media?.score ? (entry.media.score / 10).toFixed(1) : null

    // Mock technical data based on local file for now (until Go backend sends exact format)
    const techInfo = entry?.localFiles?.[0]?.technicalInfo as any
    const technicalData = useMemo(() => {
        if (!techInfo) return null
        return {
            fileSize: formatFileSize(techInfo.size || 0),
            resolutionTag: techInfo.videoStream?.width >= 1920 ? "1080P FHD" : "720P HD",
            videoCodec: techInfo.videoStream?.codec || "H264",
            bitrate: techInfo.bitrate ? `${(techInfo.bitrate / 1000000).toFixed(1)} Mb/s` : "Unknown",
            audioTracks: techInfo.audioStreams?.map((a: any) => a.language?.toUpperCase() || "AUDIO").filter(Boolean) || ["ESPAÑOL LATINO", "JAPONÉS"],
            subtitles: techInfo.subtitleStreams?.map((s: any) => s.language?.toUpperCase() || "SUB").filter(Boolean) || ["ESPAÑOL"],
            collectionId: "dbz_movies"
        }
    }, [techInfo])

    const chronologyData = useMemo(() => {
        // Mock chronology logic. For production, the Go backend will send this.
        return {
            startEpisodeContext: 120,
            endEpisodeContext: 125,
            chronologyNotes: "Transcurre durante la época en que Goku entrenaba en la Tierra."
        }
    }, [])

    const handlePlayLocalFile = (localFile: Anime_LocalFile) => {
        if (!localFile.path) return toast.error("Archivo no disponible.")
        const epNum = localFile.parsedInfo?.episode || localFile.metadata?.episode || 1
        const isMp4 = localFile.path.toLowerCase().endsWith(".mp4")
        const targetType = isMp4 ? "direct" : "transcode"
        startViewTransition(() => {
            setPlayTarget({
                path: localFile.path,
                streamType: targetType as Mediastream_StreamType,
                episodeLabel: localFile.name,
                episodeNumber: Number(epNum),
                malId: entry?.media?.idMal ?? null,
            })
        })
    }

    const handlePlayDefault = () => {
        if (entry?.localFiles && entry.localFiles.length > 0) {
            handlePlayLocalFile(entry.localFiles[0])
        } else {
            toast.info("No hay archivos locales disponibles para reproducir.")
        }
    }

    if (isLoading && !entry) {
        return <div className="h-full w-full bg-[#050506] animate-pulse pb-16" />
    }

    if (!entry || !entry.media) {
        return (
            <div className="min-h-screen bg-[#050506] text-white flex items-center justify-center">
                <EmptyState title="Película no encontrada" message="No pudimos cargar este contenido." />
            </div>
        )
    }

    return (
        <div className="h-full w-full flex flex-col overflow-y-auto bg-[#050506] text-white pb-16 relative">
            
            <MovieHeroWidescreen 
                title={title}
                romajiTitle={entry.media.titleRomaji || ""}
                backdropUrl={getHighResImage(entry.media.bannerImage || entry.media.posterImage)}
                rating={Number(score)}
            />

            {/* Immersive 2-Column Layout */}
            <div className="w-full max-w-[1800px] mx-auto px-6 sm:px-12 mt-8 pb-12 animate-fade-in z-10 relative">
                <div className="flex flex-col lg:flex-row gap-12 items-start">
                    
                    {/* Left Column (Poster & Specs) */}
                    <div className="hidden lg:flex flex-col w-80 flex-shrink-0 gap-6">
                        <div className="w-full aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border border-white/5 bg-zinc-900">
                            <img src={getHighResImage(entry.media.posterImage || "")} alt="Poster" className="w-full h-full object-cover" />
                        </div>
                        <MovieBentoSpecs technical={technicalData} />
                    </div>

                    {/* Right Column (Actions, Chronology, Content) */}
                    <div className="flex-grow flex flex-col min-w-0">
                        
                        {/* Action Bar */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-8 border-b border-white/5">
                            <div className="flex items-center gap-4 text-sm font-bold text-gray-400 uppercase tracking-widest">
                                <span>{entry.media.year}</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                                <span>{entry.media.isNsfw ? "18+" : "PG-13"}</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                                <span>PELÍCULA</span>
                            </div>

                            <button 
                                onClick={handlePlayDefault}
                                className="w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-black text-lg uppercase tracking-widest rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:shadow-[0_0_30px_rgba(245,158,11,0.6)] hover:scale-105 transition-all duration-300 flex items-center justify-center gap-3"
                            >
                                <Play className="w-6 h-6 fill-current" />
                                VER PELÍCULA NOW
                            </button>
                        </div>

                        {/* Synopsis */}
                        <div className="mt-8">
                            <h3 className="text-xl font-bebas tracking-[0.15em] text-white uppercase mb-4">Sinopsis</h3>
                            <p className="text-[17px] text-zinc-300 leading-relaxed font-normal tracking-wide antialiased" dangerouslySetInnerHTML={{ __html: cleanSynopsis }} />
                        </div>

                        {/* Chronology Widget */}
                        <ChronologyWidget chronology={chronologyData} />

                        {/* Audio & Subs Blocks */}
                        {technicalData && (
                            <MovieAudioSubs audioTracks={technicalData.audioTracks} subtitles={technicalData.subtitles} />
                        )}

                    </div>
                </div>
            </div>

            {/* Collection Swimlane */}
            {entry.media.relations && entry.media.relations.length > 0 && (
                <div className="w-full max-w-[1800px] mx-auto px-6 sm:px-12">
                    <CollectionSwimlane 
                        collectionId="related"
                        collectionName="Universo Expandido"
                        movies={entry.media.relations
                            .filter(r => r.media && (r.media.format === "MOVIE" || r.media.format === "SPECIAL" || r.media.format === "OVA"))
                            .map(r => ({
                                id: String(r.media!.id),
                                title: r.media!.title?.spanish || r.media!.title?.romaji || "Desconocida",
                                posterUrl: r.media!.coverImage?.large || "",
                                year: r.media!.startDate?.year
                            }))
                        }
                        onMovieSelect={(id) => navigate({ to: "/movies/$movieId", params: { movieId: id } })}
                    />
                </div>
            )}

            {/* Video Player */}
            {playTarget && (
                <VideoPlayer
                    streamUrl={playTarget.path}
                    streamType={playTarget.streamType as "local" | "online" | "direct"}
                    title={title}
                    episodeLabel={playTarget.episodeLabel}
                    episodeNumber={playTarget.episodeNumber}
                    mediaId={Number(movieId)}
                    malId={playTarget.malId}
                    mediaFormat={entry.media?.format ?? null}
                    marathonMode={false}
                    onNextEpisode={() => {}}
                    hasNextEpisode={false}
                    onClose={() => {
                        startViewTransition(() => setPlayTarget(null))
                        refetchContinuity()
                        queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, String(movieId)] })
                    }}
                />
            )}
        </div>
    )
}
