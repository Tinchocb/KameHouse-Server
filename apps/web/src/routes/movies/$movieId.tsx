import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { HydrationBoundary, dehydrate, useQueryClient } from "@tanstack/react-query"
import React, { useMemo, useState } from "react"
import { toast } from "sonner"
import { useAppStore } from "@/lib/store"
import { ListPlus } from "lucide-react"
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
import { MovieHeroSection } from "../series/$seriesId/-components/movie-hero"
import { PremiumPosterCard } from "@/components/shared/premium-poster-card"
import { DeferredImage } from "@/components/shared/deferred-image"

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
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const { data: entry, isLoading } = useGetAnimeEntry(movieId)
    const { data: continuityData, refetch: refetchContinuity } = useGetContinuityWatchHistoryItem(Number(movieId))

    React.useEffect(() => {
        if (entry) {
            const audio = new Audio("/sounds/entrar detalle serie-peliculas.wav")
            audio.volume = 0.4
            audio.play().catch(() => {})
        }
    }, [entry?.media?.id])

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

    const parseGenres = (g: any): string[] => {
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

    const tech = useMemo(() => entry?.localFiles?.[0]?.technicalInfo as any, [entry])
    const isMp4 = useMemo(() => entry?.localFiles?.[0]?.path?.toLowerCase().endsWith(".mp4"), [entry])

    const audioLangs = useMemo(() => {
        if (!tech?.audioStreams || tech.audioStreams.length === 0) return []
        return (tech.audioStreams as any[])
            .map((a: any) => {
                const l = a.language?.toLowerCase() || ""
                if (l.includes("spa") || l.includes("esp") || l.includes("lat")) return "ESPAÑOL"
                if (l.includes("jpn") || l.includes("jap")) return "JAPONÉS"
                if (l.includes("eng") || l.includes("ing")) return "INGLÉS"
                return a.language?.toUpperCase() || a.title?.toUpperCase() || "AUD"
            })
            .filter((value: string, index: number, self: string[]) => self.indexOf(value) === index)
    }, [tech])

    const subtitleLangs = useMemo(() => {
        if (!tech?.subtitleStreams || tech.subtitleStreams.length === 0) return []
        return (tech.subtitleStreams as any[])
            .map((s: any) => {
                const l = s.language?.toLowerCase() || ""
                if (l.includes("spa") || l.includes("esp") || l.includes("lat")) return "ESPAÑOL"
                if (l.includes("eng") || l.includes("ing")) return "INGLÉS"
                return s.language?.toUpperCase() || s.title?.toUpperCase() || "SUB"
            })
            .filter((value: string, index: number, self: string[]) => self.indexOf(value) === index)
    }, [tech])

    const handlePlayLocalFile = (localFile: Anime_LocalFile) => {
        if (!localFile.path) {
            toast.error("Archivo no disponible.")
            return
        }
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

    const handleAddToQueue = (lf: Anime_LocalFile) => {
        if (!entry) {
            toast.error("La información de la película no está cargada.")
            return
        }
        if (!lf.path) {
            toast.error("Archivo no disponible.")
            return
        }
        const epNum = lf.parsedInfo?.episode || lf.metadata?.episode || 1
        
        useAppStore.getState().addToQueue({
            id: entry.mediaId || Number(movieId),
            title: title,
            playableUrl: lf.path || "",
            thumbnail: getHighResImage(entry.media?.posterImage || ""),
            mediaId: entry.mediaId || Number(movieId),
            episodeNumber: Number(epNum),
            malId: entry?.media?.idMal ?? null,
            mediaFormat: entry?.media?.format ?? "MOVIE"
        })
        toast.success(`Añadido a la cola: ${lf.name || title}`)
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

    if (isLoading && !entry) {
        return (
            <div className="h-full w-full flex flex-col overflow-y-auto bg-[#09090b] text-white pb-16 animate-pulse">
                {/* Ambient glow */}
                <div className="absolute top-[400px] inset-x-0 flex justify-center pointer-events-none z-0 opacity-15 select-none">
                    <div className="w-[900px] h-[550px] rounded-full bg-zinc-800 blur-[130px]" />
                </div>
                {/* Hero Skeleton */}
                <div className="relative w-full min-h-[75vh] flex flex-col justify-end overflow-hidden bg-[#09090b] select-none">
                    <div className="absolute inset-0 bg-zinc-900/40" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/50 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#09090b]/80 via-transparent to-transparent" />

                    <div className="relative z-20 flex flex-col justify-end items-start px-6 sm:px-12 pb-16 pt-48 gap-5">
                        <div className="flex items-center gap-3">
                            <div className="h-6 w-16 bg-white/10 rounded-md" />
                            <div className="h-6 w-12 bg-white/10 rounded-md" />
                            <div className="h-6 w-20 bg-white/10 rounded-md" />
                        </div>
                        <div className="flex flex-col gap-3 w-full">
                            <div className="h-20 md:h-28 w-2/3 bg-white/10 rounded-lg" />
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="h-4 w-10 bg-white/8 rounded" />
                            <div className="h-5 w-20 bg-white/8 rounded-md" />
                        </div>
                        <div className="flex gap-4 mt-2">
                            <div className="h-12 w-44 bg-brand-orange/20 rounded-xl border border-brand-orange/10" />
                        </div>
                    </div>
                </div>

                {/* Two-column layout skeleton */}
                <div className="w-full max-w-[1800px] mx-auto px-6 sm:px-12 mt-12 pb-12">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

                        {/* Left col: synopsis + cast */}
                        <div className="lg:col-span-8 flex flex-col gap-10">
                            {/* Section header */}
                            <div className="h-7 w-32 bg-white/10 rounded border-b border-white/5" />
                            {/* Synopsis lines */}
                            <div className="flex flex-col gap-2 -mt-6">
                                <div className="h-4 w-full bg-white/8 rounded" />
                                <div className="h-4 w-full bg-white/8 rounded" />
                                <div className="h-4 w-5/6 bg-white/8 rounded" />
                                <div className="h-4 w-4/5 bg-white/8 rounded" />
                                <div className="h-4 w-2/3 bg-white/8 rounded" />
                            </div>
                            {/* Cast skeleton */}
                            <div className="flex flex-col gap-4">
                                <div className="h-6 w-40 bg-white/10 rounded" />
                                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <div key={i} className="flex items-center gap-3 p-3.5 bg-zinc-950/20 border border-white/5 rounded-2xl">
                                            <div className="w-12 h-12 rounded-full bg-zinc-900 shrink-0" />
                                            <div className="flex flex-col gap-1.5 flex-1">
                                                <div className="h-3.5 w-full bg-white/10 rounded" />
                                                <div className="h-2.5 w-2/3 bg-white/6 rounded" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right col: bento technical metadata */}
                        <div className="lg:col-span-4 flex flex-col gap-6">
                            <div className="h-4 w-36 bg-white/8 rounded" />
                            <div className="grid grid-cols-2 gap-4">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className={`${i >= 4 ? 'col-span-2' : 'col-span-1'} bg-zinc-950/25 border border-white/5 rounded-3xl p-5`}
                                        style={{ animationDelay: `${i * 60}ms` }}
                                    >
                                        <div className="h-2.5 w-16 bg-white/8 rounded mb-3" />
                                        <div className="h-5 w-3/4 bg-white/12 rounded" />
                                        <div className="h-3 w-1/2 bg-white/6 rounded mt-2" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
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
        <div className="h-full w-full flex flex-col overflow-y-auto bg-[#09090b] text-white pb-16 relative">
            {/* Ambient page glow from poster cover */}
            {(entry.media.posterImage || entry.media.bannerImage) && (
                <div className="absolute top-[400px] inset-x-0 flex justify-center pointer-events-none z-0 opacity-25 select-none animate-fade-in">
                    <div 
                        className="w-[900px] h-[550px] rounded-full bg-cover bg-center blur-[130px] saturate-200 opacity-40 will-change-[filter,transform]"
                        style={{
                            backgroundImage: `url(${getLowResImage(entry.media.posterImage || entry.media.bannerImage)})`,
                        }}
                    />
                </div>
            )}

            <MovieHeroSection
                seriesId={movieId}
                directoryPath={entry.libraryData?.sharedPath || ""}
                backdropUrl={getHighResImage(entry.media.bannerImage || entry.media.posterImage)}
                entry={entry}
                onPlay={handlePlayDefault}
                continuityItem={continuityData?.item}
                className="md:w-[calc(100%+6rem)] md:-ml-24 cursor-pointer group/hero animate-fade-in"
            />

            {/* Custom 2-Column Layout */}
            <div className="w-full max-w-[1800px] mx-auto px-6 sm:px-12 mt-12 pb-12 animate-fade-in">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                    
                    {/* Left Column: Synopsis, Tech specs capsules, Cast */}
                    <div className="lg:col-span-8 flex flex-col gap-12 relative z-10">
                        {/* Synopsis section */}
                        <div className="flex flex-col gap-4">
                            <h3 className="text-2xl font-bebas tracking-[0.15em] text-white uppercase border-b border-white/5 pb-3">Sinopsis</h3>
                            <p 
                                className="text-[17px] text-zinc-300 leading-relaxed font-normal tracking-wide antialiased"
                                dangerouslySetInnerHTML={{ __html: cleanSynopsis }}
                            />
                        </div>

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
                                                {edge.node?.image?.large ? (
                                                    <DeferredImage
                                                        src={edge.node.image.large}
                                                        alt={edge.node.name?.full || "Character"}
                                                        showSkeleton={false}
                                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-zinc-950 flex items-center justify-center text-[10px] text-zinc-600 font-bold uppercase">
                                                        {edge.node?.name?.full ? edge.node.name.full.slice(0, 2) : "C"}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col truncate">
                                                <span className="text-[13px] font-bold text-white group-hover:text-brand-orange transition-colors truncate">{edge.node?.name?.full}</span>
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
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => handlePlayLocalFile(lf)}
                                                    className="px-4 py-2 bg-white/5 hover:bg-brand-orange hover:text-white hover:border-brand-orange border border-white/10 rounded-xl text-[10px] font-black text-brand-orange uppercase tracking-wider transition-all duration-300"
                                                >
                                                    REPRODUCIR
                                                </button>
                                                <button 
                                                    onClick={() => handleAddToQueue(lf)}
                                                    className="p-2 bg-white/5 hover:bg-brand-orange hover:text-white hover:border-brand-orange border border-white/10 rounded-xl text-zinc-400 hover:text-white transition-all duration-300"
                                                    title="Agregar a la cola"
                                                >
                                                    <ListPlus className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Premium Bento Grid Metadata */}
                    <div className="lg:col-span-4 flex flex-col gap-6 relative z-10">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 pl-1">DATOS TÉCNICOS & ARCHIVO</h4>
                        
                        <div className="grid grid-cols-2 gap-4">
                            
                            {/* Bento Item 1: Calidad & Contenedor */}
                            {tech?.videoStream && (
                                <div className="col-span-1 bg-zinc-950/25 backdrop-blur-md border border-white/5 rounded-3xl p-5 hover:border-brand-orange/30 hover:bg-zinc-900/10 transition-all duration-500 shadow-xl relative overflow-hidden group/bento animate-fade-in">
                                    <span className="text-[9px] font-black text-zinc-500 tracking-widest uppercase">Calidad</span>
                                    <div className="flex flex-col mt-2">
                                        <span className="text-sm font-bold text-white uppercase tracking-wider">
                                            {tech.videoStream.width >= 1920 ? "1080P FHD" : "720P HD"}
                                        </span>
                                        <span className="text-[10px] font-black text-zinc-500 tracking-widest uppercase mt-0.5">
                                            {isMp4 ? "MP4" : "MKV"}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Bento Item 2: Códec & Cuadros */}
                            {tech?.videoStream && (
                                <div className="col-span-1 bg-zinc-950/25 backdrop-blur-md border border-white/5 rounded-3xl p-5 hover:border-white/10 hover:bg-zinc-900/10 transition-all duration-500 shadow-xl relative overflow-hidden group/bento animate-fade-in">
                                    <span className="text-[9px] font-black text-zinc-500 tracking-widest uppercase">Formato Video</span>
                                    <div className="flex flex-col mt-2">
                                        <span className="text-sm font-bold text-brand-orange uppercase tracking-wider">
                                            {tech.videoStream.codec || "H264"}
                                        </span>
                                        <span className="text-[10px] font-black text-zinc-500 tracking-widest uppercase mt-0.5">
                                            {tech.videoStream.frameRate ? `${parseFrameRate(tech.videoStream.frameRate)} FPS` : "24 FPS"}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Bento Item 3: Tamaño total de archivo */}
                            {tech?.size && (
                                <div className="col-span-1 bg-zinc-950/25 backdrop-blur-md border border-white/5 rounded-3xl p-5 hover:border-white/10 hover:bg-zinc-900/10 transition-all duration-500 shadow-xl relative overflow-hidden group/bento animate-fade-in">
                                    <span className="text-[9px] font-black text-zinc-500 tracking-widest uppercase">Tamaño</span>
                                    <div className="text-sm font-bold text-white mt-3">
                                        {formatFileSize(tech.size)}
                                    </div>
                                </div>
                            )}

                            {/* Bento Item 4: Estado de Reproducción */}
                            <div className="col-span-1 bg-zinc-950/25 backdrop-blur-md border border-white/5 rounded-3xl p-5 hover:border-emerald-500/20 hover:bg-zinc-900/10 transition-all duration-500 shadow-xl relative overflow-hidden group/bento animate-fade-in">
                                <span className="text-[9px] font-black text-zinc-500 tracking-widest uppercase">Estado</span>
                                <div className="flex items-center gap-2 mt-3">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                    <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">
                                        {entry.media?.status || "LISTO"}
                                    </span>
                                </div>
                            </div>

                            {/* Bento Item 5: Pistas de Audio */}
                            {audioLangs.length > 0 && (
                                <div className="col-span-2 bg-zinc-950/25 backdrop-blur-md border border-white/5 rounded-3xl p-5 hover:border-white/10 hover:bg-zinc-900/10 transition-all duration-500 shadow-xl relative overflow-hidden group/bento animate-fade-in">
                                    <span className="text-[9px] font-black text-zinc-500 tracking-widest uppercase block mb-3">Idiomas de Audio</span>
                                    <div className="flex flex-wrap gap-2">
                                        {audioLangs.map((lang: string) => (
                                            <span key={lang} className="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-white rounded-lg">
                                                {lang}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Bento Item 6: Pistas de Subtítulos */}
                            {subtitleLangs.length > 0 && (
                                <div className="col-span-2 bg-zinc-950/25 backdrop-blur-md border border-white/5 rounded-3xl p-5 hover:border-white/10 hover:bg-zinc-900/10 transition-all duration-500 shadow-xl relative overflow-hidden group/bento animate-fade-in">
                                    <span className="text-[9px] font-black text-zinc-500 tracking-widest uppercase block mb-3">Subtítulos Disponibles</span>
                                    <div className="flex flex-wrap gap-2">
                                        {subtitleLangs.map((lang: string) => (
                                            <span key={lang} className="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest bg-brand-orange/10 border border-brand-orange/20 text-brand-orange rounded-lg">
                                                {lang}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Bento Item 7: Géneros */}
                            {genres.length > 0 && (
                                <div className="col-span-2 bg-zinc-950/25 backdrop-blur-md border border-white/5 rounded-3xl p-6 hover:border-white/10 hover:bg-zinc-900/10 transition-all duration-500 shadow-xl relative overflow-hidden group/bento">
                                    <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/[0.02] blur-xl rounded-full pointer-events-none" />
                                    <span className="text-[9px] font-black text-zinc-500 tracking-widest uppercase block mb-3">Géneros Explorados</span>
                                    <div className="flex flex-wrap gap-2">
                                        {genres.map((gen: string) => (
                                            <span 
                                                key={gen} 
                                                className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/70 hover:text-white rounded-xl transition-all duration-300 cursor-pointer"
                                            >
                                                {gen}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </div>

            {/* Related Content Horizontal Section (Full Width) */}
            {entry.media?.relations && entry.media.relations.length > 0 && (
                <div className="w-full max-w-[1800px] mx-auto px-6 sm:px-12 mt-8 pb-16 animate-fade-in">
                    <div className="flex flex-col gap-6">
                        <h3 className="text-2xl font-bebas tracking-[0.15em] text-white uppercase border-b border-white/5 pb-3">Contenido Relacionado</h3>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                            {entry.media.relations.map((relation, idx) => {
                                if (!relation.media) return null;
                                const node = relation.media;
                                const title = node.title?.spanish || node.title?.romaji || node.title?.english || "Título Desconocido";
                                const isMovie = node.format === "MOVIE" || node.format === "SPECIAL" || node.format === "OVA";
                                const relationGenres = parseGenres(node.genres);
                                
                                return (
                                    <div key={idx} className="flex flex-col gap-2">
                                        <PremiumPosterCard
                                            id={node.id}
                                            title={title}
                                            posterUrl={node.coverImage?.large || node.coverImage?.medium || ""}
                                            rating={node.score}
                                            year={node.startDate?.year}
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
                        startViewTransition(() => {
                            setPlayTarget(null)
                        })
                        refetchContinuity()
                        queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, String(movieId)] })
                    }}
                />
            )}
        </div>
    )
}
