import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { HydrationBoundary, dehydrate, useQueryClient } from "@tanstack/react-query"
import React, { useMemo, useState } from "react"
import { toast } from "sonner"
import { useAppStore } from "@/lib/store"
import { cn } from "@/components/ui/core/styling"
import { getHighResImage } from "@/lib/helpers/images"
import { fetchAnimeEntry, useGetAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { useGetContinuityWatchHistoryItem } from "@/api/hooks/continuity.hooks"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { Anime_LocalFile, Mediastream_StreamType } from "@/api/generated/types"
import { EmptyState } from "@/components/shared/empty-state"
import { VideoPlayer } from "@/components/video/player"
import { sanitizeHtml } from "@/lib/helpers/sanitizer"
import { MovieHeroSection } from "../series/$seriesId/-components/movie-hero"
import { PremiumPosterCard } from "@/components/shared/premium-poster-card"

export const Route = createFileRoute("/movies/$movieId")({
    loader: async ({ params: { movieId }, context }) => {
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

function MovieDetailClient({ movieId }: { movieId: string }) {
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const { data: entry, isLoading } = useGetAnimeEntry(movieId)
    const { data: continuityData, refetch: refetchContinuity } = useGetContinuityWatchHistoryItem(Number(movieId))

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

    const parseGenres = (g: string | string[] | undefined | null): string[] => {
        if (!g) return []
        if (Array.isArray(g)) return g as string[]
        if (typeof g === "string") {
            try {
                if (g.startsWith("[")) return JSON.parse(g) as string[]
                const decoded = atob(g)
                if (decoded.startsWith("[")) return JSON.parse(decoded) as string[]
            } catch {
                return []
            }
        }
        return []
    }
    
    const genres = useMemo(() => entry?.media ? parseGenres(entry.media.genres) : [], [entry])

    const handlePlayLocalFile = (localFile: Anime_LocalFile) => {
        if (!localFile.path) {
            toast.error("Archivo no disponible.")
            return
        }
        const epNum = localFile.parsedInfo?.episode || localFile.metadata?.episode || 1
        const isMp4 = localFile.path.toLowerCase().endsWith(".mp4")
        const targetType = isMp4 ? "direct" : "transcode"
        setPlayTarget({
            path: localFile.path,
            streamType: targetType as Mediastream_StreamType,
            episodeLabel: localFile.name,
            episodeNumber: Number(epNum),
            malId: entry?.media?.idMal ?? null,
        })
    }

    const handlePlayDefault = () => {
        if (entry?.localFiles && entry.localFiles.length > 0) {
            let targetFile = entry.localFiles[0]
            if (continuityData?.item?.episodeNumber) {
                const matchedFile = entry.localFiles.find(f => {
                    const ep = f.metadata?.episode || f.parsedInfo?.episode
                    return ep != null && Number(ep) === continuityData.item?.episodeNumber
                })
                if (matchedFile) targetFile = matchedFile
            }
            handlePlayLocalFile(targetFile)
        } else {
            toast.info("No hay archivos locales disponibles para reproducir.")
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-5">
                    <div className="w-10 h-10 border-2 border-brand-orange border-t-transparent rounded-full animate-spin" />
                    <span className="text-[9px] font-black uppercase tracking-[0.5em] text-zinc-500 animate-pulse">Cargando Película...</span>
                </div>
            </div>
        )
    }

    if (!entry || !entry.media) {
        return (
            <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center px-6">
                <EmptyState
                    title="Película no encontrada"
                    message="No pudimos cargar este contenido. Vuelve al inicio o intenta con otro."
                />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#09090b] text-white pb-16">
            <MovieHeroSection
                seriesId={movieId}
                directoryPath={entry.libraryData?.sharedPath || ""}
                backdropUrl={getHighResImage(entry.media.bannerImage || entry.media.posterImage)}
                entry={entry}
                onPlay={handlePlayDefault}
                continuityItem={continuityData?.item}
                className="cursor-pointer group/hero animate-fade-in"
            />

            {/* Custom 2-Column Layout */}
            <div className="w-full max-w-[1800px] mx-auto px-6 sm:px-12 md:px-24 mt-16 pb-12 animate-fade-in">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                    
                    {/* Left Column: Synopsis, Tech specs capsules, Cast */}
                    <div className="lg:col-span-8 flex flex-col gap-12">
                        {/* Synopsis section */}
                        <div className="flex flex-col gap-4">
                            <h3 className="text-2xl font-bebas tracking-[0.15em] text-white uppercase border-b border-white/5 pb-3">Sinopsis</h3>
                            <p 
                                className="text-[17px] text-zinc-300 leading-relaxed font-normal tracking-wide antialiased"
                                dangerouslySetInnerHTML={{ __html: cleanSynopsis }}
                            />
                        </div>

                        {/* Technical Metadata Section */}
                        {entry.localFiles && entry.localFiles.length > 0 && (
                            <div className="flex flex-col gap-5 pt-4">
                                <h3 className="text-2xl font-bebas tracking-[0.15em] text-white uppercase border-b border-white/5 pb-3">Especificaciones Técnicas</h3>
                                {(() => {
                                    const tech = entry.localFiles[0]?.technicalInfo;
                                    const isMp4 = entry.localFiles[0]?.path?.toLowerCase().endsWith(".mp4");
                                    return (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 font-mono text-xs">
                                            <div className="flex flex-col gap-1 p-4 bg-zinc-950/20 border border-white/5 rounded-2xl hover:border-white/10 hover:bg-zinc-900/10 transition-all duration-300">
                                                <span className="font-sans font-black text-[9px] text-zinc-500 tracking-wider uppercase">Contenedor</span>
                                                <span className="font-bold text-white text-sm uppercase tracking-widest mt-0.5">{isMp4 ? "MP4" : "MKV"}</span>
                                            </div>
                                            {tech?.videoStream && (
                                                <>
                                                    <div className="flex flex-col gap-1 p-4 bg-zinc-950/20 border border-white/5 rounded-2xl hover:border-white/10 hover:bg-zinc-900/10 transition-all duration-300">
                                                        <span className="font-sans font-black text-[9px] text-zinc-500 tracking-wider uppercase">Resolución</span>
                                                        <span className="font-bold text-white text-sm tracking-widest mt-0.5">{tech.videoStream.width}x{tech.videoStream.height}</span>
                                                    </div>
                                                    <div className="flex flex-col gap-1 p-4 bg-zinc-950/20 border border-white/5 rounded-2xl hover:border-white/10 hover:bg-zinc-900/10 transition-all duration-300">
                                                        <span className="font-sans font-black text-[9px] text-zinc-500 tracking-wider uppercase">Video Códec</span>
                                                        <span className="font-bold text-brand-orange text-sm tracking-widest uppercase mt-0.5">{tech.videoStream.codec || "AVC"}</span>
                                                    </div>
                                                    {tech.videoStream.frameRate && (
                                                        <div className="flex flex-col gap-1 p-4 bg-zinc-950/20 border border-white/5 rounded-2xl hover:border-white/10 hover:bg-zinc-900/10 transition-all duration-300">
                                                            <span className="font-sans font-black text-[9px] text-zinc-500 tracking-wider uppercase">Frames</span>
                                                            <span className="font-bold text-white text-sm tracking-widest mt-0.5">{tech.videoStream.frameRate} FPS</span>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                            {tech?.size && (
                                                <div className="flex flex-col gap-1 p-4 bg-zinc-950/20 border border-white/5 rounded-2xl hover:border-white/10 hover:bg-zinc-900/10 transition-all duration-300">
                                                    <span className="font-sans font-black text-[9px] text-zinc-500 tracking-wider uppercase">Tamaño</span>
                                                    <span className="font-bold text-white text-sm tracking-widest mt-0.5">{formatFileSize(tech.size)}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* Cast Grid (Reparto Principal) */}
                        {entry.media?.characters?.edges && entry.media.characters.edges.length > 0 && (
                            <div className="flex flex-col gap-5 pt-4">
                                <h3 className="text-2xl font-bebas tracking-[0.15em] text-white uppercase border-b border-white/5 pb-3">Reparto Principal</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {entry.media.characters.edges.slice(0, 8).map((edge, idx) => (
                                        <div 
                                            key={idx} 
                                            className="flex items-center gap-3.5 p-3.5 bg-zinc-950/20 border border-white/5 rounded-2xl hover:border-brand-orange/30 hover:bg-zinc-900/10 transition-all duration-300 group cursor-pointer"
                                        >
                                            <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-900 border border-white/10 shrink-0 shadow-lg group-hover:border-brand-orange/50 transition-colors">
                                                {edge.node?.image ? (
                                                    <img src={edge.node.image} alt={edge.node.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                                ) : (
                                                    <div className="w-full h-full bg-zinc-950 flex items-center justify-center text-[10px] text-zinc-600 font-bold uppercase">
                                                        {edge.node?.name ? edge.node.name.slice(0, 2) : "C"}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col truncate">
                                                <span className="text-[13px] font-bold text-white group-hover:text-brand-orange transition-colors truncate">{edge.node?.name}</span>
                                                <span className="text-[9px] font-black text-zinc-500 tracking-wider uppercase truncate mt-0.5">{edge.role === "MAIN" ? "Principal" : "Secundario"}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Alternate Versions & Local Files */}
                        {entry.localFiles && entry.localFiles.length > 1 && (
                            <div className="flex flex-col gap-4 pt-4">
                                <h3 className="text-2xl font-bebas tracking-[0.15em] text-white uppercase border-b border-white/5 pb-3">Versiones Alternativas</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {entry.localFiles.map((lf, idx) => (
                                        <div 
                                            key={idx} 
                                            className="flex items-center justify-between p-4 bg-zinc-950/20 border border-white/5 rounded-2xl hover:border-brand-orange/30 hover:bg-zinc-900/10 transition-all duration-300 group"
                                        >
                                            <span className="text-xs text-zinc-400 font-bold truncate max-w-[65%] group-hover:text-white transition-colors">{lf.name}</span>
                                            <button 
                                                onClick={() => handlePlayLocalFile(lf)}
                                                className="px-4 py-2 bg-white/5 hover:bg-brand-orange hover:text-white hover:border-brand-orange border border-white/10 rounded-xl text-[10px] font-black text-brand-orange uppercase tracking-wider transition-all duration-300"
                                            >
                                                REPRODUCIR
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Metadata Panel */}
                    <div className="lg:col-span-4 flex flex-col gap-8">
                        {/* Info & Metadata Panel */}
                        <div className="bg-zinc-950/25 backdrop-blur-md border border-white/5 rounded-3xl p-6 sm:p-8 flex flex-col gap-6 hover:border-white/10 transition-all duration-500 shadow-xl relative overflow-hidden">
                            {/* Ambient accent inside card */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-orange/5 blur-3xl rounded-full pointer-events-none" />

                            <h4 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">Información General</h4>

                            {/* Genres */}
                            {genres.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    <span className="text-[9px] font-black text-zinc-500 tracking-[0.2em] uppercase">Géneros</span>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {genres.map((gen: string) => (
                                            <span key={gen} className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider bg-white/5 border border-white/10 text-white/70 rounded-md">
                                                {gen}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Ratings, Date, Status */}
                            <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-zinc-500 tracking-wider uppercase">Calificación</span>
                                    <span className="text-sm font-bold text-white mt-0.5">{score ? `${score} Ki` : "N/A"}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-zinc-500 tracking-wider uppercase">Año</span>
                                    <span className="text-sm font-bold text-white mt-0.5">{entry.media?.year || "Desconocido"}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-zinc-500 tracking-wider uppercase">Estado</span>
                                    <span className="text-sm font-bold text-emerald-500 mt-0.5 uppercase tracking-wide">{entry.media?.status || "LISTO"}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-zinc-500 tracking-wider uppercase">Formato</span>
                                    <span className="text-sm font-bold text-brand-orange mt-0.5 uppercase tracking-wide">{entry.media?.format || "PELÍCULA"}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Related Content Horizontal Section (Full Width) */}
            {entry.media?.relations && entry.media.relations.length > 0 && (
                <div className="w-full max-w-[1800px] mx-auto px-6 sm:px-12 md:px-24 mt-8 pb-16 animate-fade-in">
                    <div className="flex flex-col gap-6">
                        <h3 className="text-2xl font-bebas tracking-[0.15em] text-white uppercase border-b border-white/5 pb-3">Contenido Relacionado</h3>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                            {entry.media.relations.map((relation, idx) => {
                                if (!relation.node) return null;
                                const node = relation.node;
                                const title = node.titleSpanish || node.titleRomaji || node.titleEnglish || "Título Desconocido";
                                const isMovie = node.format === "MOVIE" || node.format === "SPECIAL" || node.format === "OVA";
                                const relationGenres = parseGenres(node.genres);
                                
                                return (
                                    <div key={idx} className="flex flex-col gap-2">
                                        <PremiumPosterCard
                                            id={node.id}
                                            title={title}
                                            posterUrl={node.posterImage || ""}
                                            rating={node.score}
                                            year={node.year}
                                            format={node.format}
                                            genres={relationGenres}
                                            onClick={() => {
                                                navigate({
                                                    to: isMovie ? "/movies/$movieId" : "/series/$seriesId",
                                                    params: isMovie ? { movieId: String(node.id) } : { seriesId: String(node.id) }
                                                })
                                            }}
                                        />
                                        <span className="text-[9px] font-black text-brand-orange uppercase tracking-widest mt-1 px-1">
                                            {relation.relationType}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

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
                        setPlayTarget(null)
                        refetchContinuity()
                        queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, String(movieId)] })
                    }}
                />
            )}
        </div>
    )
}
