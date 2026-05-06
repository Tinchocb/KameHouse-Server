import { createFileRoute } from "@tanstack/react-router"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import React, { useMemo, useState, useEffect, useRef } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/components/ui/core/styling"
import { fetchAnimeEntry, useGetAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { Anime_Episode } from "@/api/generated/types"
import { EmptyState } from "@/components/shared/empty-state"
import { MediaActionButtons, EpisodeClientCard } from "./-series-interactivity-client"
import { sanitizeHtml } from "@/lib/helpers/sanitizer"
import { resolveSeriesSagas, type SagaDefinition } from "@/lib/config/dragonball.config"
import { Link } from "@tanstack/react-router"

export const Route = createFileRoute("/series/$seriesId/")({
    loader: async ({ params: { seriesId }, context }) => {
        const qc = context.queryClient
        await qc.prefetchQuery({
            queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, seriesId],
            queryFn: () => fetchAnimeEntry(seriesId),
        })
        return { dehydrateState: dehydrate(qc) }
    },
    component: SeriesDetailPage,
})

function SeriesDetailPage() {
    const { seriesId } = Route.useParams()
    const { dehydrateState } = Route.useLoaderData()

    return (
        <HydrationBoundary state={dehydrateState}>
            <SeriesDetailClient seriesId={seriesId} />
        </HydrationBoundary>
    )
}

function SeriesDetailClient({ seriesId }: { seriesId: string }) {
    const { data: entry } = useGetAnimeEntry(seriesId)

    if (!entry || !entry.media) {
        return (
            <div className="min-h-screen bg-background text-white flex items-center justify-center px-6">
                <EmptyState
                    title="Serie no encontrada"
                    message="No pudimos cargar esta serie. Vuelve al inicio o intenta con otra."
                />
            </div>
        )
    }

    const heroBackdrop = entry.media.bannerImage || entry.media.posterImage || ""
    const coverImage = entry.media.posterImage || ""
    const genres = entry.media.genres || ["Anime"]
    const title = entry.media.titleRomaji || entry.media.titleEnglish || "Título Desconocido"
    const year = entry.media.year?.toString() || ""
    const synopsis = entry.media.description || "Sin descripción disponible."
    const episodesCount = entry.media.totalEpisodes || entry.episodes?.length || 0

    const resolvedSagas = resolveSeriesSagas(entry.media)
    const hasSagas = resolvedSagas.length > 0
    const sagas = resolvedSagas

    return (
        <div className="min-h-screen bg-[#09090b] text-white pb-16">
            <HeroSection
                seriesId={seriesId}
                directoryPath={entry.libraryData?.sharedPath || ""}
                backdropUrl={heroBackdrop}
                coverUrl={coverImage}
                title={title}
                year={year}
                genres={genres}
                synopsis={synopsis}
                episodesCount={episodesCount}
            />

            <div className="w-full">
                {hasSagas ? (
                    <SagasSection seriesId={seriesId} sagas={sagas} />
                ) : (
                    <EpisodesSection 
                        seriesTitle={title} 
                        fallbackThumb={heroBackdrop} 
                        episodes={entry.episodes || []} 
                    />
                )}
            </div>
        </div>
    )
}
function SagasSection({ seriesId, sagas }: { seriesId: string, sagas: SagaDefinition[] }) {
    return (
        <section className="relative z-[1] px-6 sm:px-10 pb-20">
            <div className="flex flex-col gap-8">
                <div className="space-y-1 border-b border-white/10 pb-6">
                    <h2 className="text-4xl font-bebas font-normal text-white uppercase tracking-widest">
                        CRÓNICAS Y SAGAS
                    </h2>
                    <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">
                        Selecciona un arco argumental para explorar sus episodios
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {sagas.map((saga) => (
                        <Link
                            key={saga.id}
                            to={"/series/$seriesId/$sagaId"}
                            params={{ seriesId, sagaId: saga.id }}
                            className="group relative flex h-72 flex-col justify-end overflow-hidden rounded-none border border-white/10 p-8 transition-all duration-300 hover:border-white"
                        >
                            <div className="absolute inset-0 grayscale group-hover:grayscale-0 transition-all duration-500">
                                <img
                                    src={saga.image}
                                    alt={saga.title}
                                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/60 group-hover:bg-black/20 transition-all" />
                                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black to-transparent" />
                            </div>

                            <div className="relative z-10 text-left">
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 mb-3 group-hover:text-white transition-colors">
                                    EPS {saga.startEp} — {saga.endEp}
                                </p>
                                <h3 className="mb-3 text-3xl font-black text-white leading-tight uppercase tracking-tight">
                                    {saga.title}
                                </h3>
                                <p className="text-[13px] text-zinc-400 font-bold uppercase tracking-wide line-clamp-2 opacity-0 transition-all duration-300 group-hover:opacity-100">
                                    {saga.description}
                                </p>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    )
}

interface HeroSectionProps {
    seriesId: string
    directoryPath: string
    backdropUrl: string
    coverUrl: string
    title: string
    year: string
    genres: string[]
    synopsis: string
    episodesCount: number
}

const HeroSection = React.memo(function HeroSection({
    seriesId,
    directoryPath,
    backdropUrl,
    coverUrl,
    title,
    year,
    genres,
    synopsis,
    episodesCount,
}: HeroSectionProps) {
    const [synopsisExpanded, setSynopsisExpanded] = useState(false)
    const cleanSynopsis = useMemo(() => sanitizeHtml(synopsis), [synopsis])

    return (
        <section className="relative w-full min-h-[60vh] flex flex-col justify-end overflow-hidden">
            {/* Backdrop (Grayscale & Solid) */}
            {backdropUrl && (
                <div className="absolute inset-0 overflow-hidden bg-black">
                    <img
                        src={backdropUrl}
                        alt={title}
                        className="w-full h-full object-cover object-center opacity-30 grayscale"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                </div>
            )}

            {/* Content */}
            <div className="relative z-10 flex flex-col lg:flex-row items-end gap-12 px-6 sm:px-12 pb-20 pt-40 max-w-[1800px] mx-auto w-full">
                {/* Cover Poster (Flat Sharp) */}
                {coverUrl && (
                    <div className="hidden lg:block shrink-0 w-52 xl:w-60 bg-black border border-white/20 transition-all duration-300 hover:border-white">
                        <img src={coverUrl} alt={title} className="w-full aspect-[2/3] object-cover grayscale" />
                    </div>
                )}

                {/* Meta Information */}
                <div className="flex-1 flex flex-col gap-8 min-w-0">
                    {/* Tags */}
                    <div className="flex flex-wrap gap-3">
                        {genres.slice(0, 5).map((g) => (
                            <span
                                key={g}
                                className="px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] bg-white text-black border border-white"
                            >
                                {g}
                            </span>
                        ))}
                    </div>

                    {/* Main Title (Bebas Massive Solid) */}
                    <h1 className="text-6xl sm:text-7xl xl:text-[9rem] font-bebas font-normal leading-[0.85] tracking-tight text-white uppercase drop-shadow-none">
                        {title}
                    </h1>

                    {/* Metadata Strip */}
                    <div className="flex flex-wrap items-center gap-6 text-[10px] font-black uppercase tracking-[0.4em] text-white/50">
                        {year && <span>{year}</span>}
                        {episodesCount > 0 && <span>{episodesCount} EPISODIOS</span>}
                    </div>

                    {/* Minimal Synopsis */}
                    <div className="max-w-3xl relative">
                        <div 
                            className={cn(
                                "text-[15px] text-zinc-400 leading-relaxed font-bold uppercase tracking-wide transition-all duration-300",
                                synopsisExpanded ? "" : "line-clamp-3",
                            )}
                            dangerouslySetInnerHTML={{ __html: cleanSynopsis }}
                        />
                        {synopsis.length > 200 && (
                            <button
                                onClick={() => setSynopsisExpanded((v) => !v)}
                                className="mt-4 text-[10px] font-black uppercase tracking-[0.4em] text-white hover:underline underline-offset-8"
                            >
                                {synopsisExpanded ? "[ LEER MENOS ]" : "[ LEER MÁS ]"}
                            </button>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="mt-6">
                        <MediaActionButtons seriesId={seriesId} directoryPath={directoryPath} />
                    </div>
                </div>
            </div>
        </section>
    )
})
HeroSection.displayName = "HeroSection"

interface EpisodesSectionProps {
    seriesTitle: string
    fallbackThumb: string
    episodes: Anime_Episode[]
}

const EpisodesSection = React.memo(function EpisodesSection({
    seriesTitle,
    fallbackThumb,
    episodes,
}: EpisodesSectionProps) {
    const [activeTab, setActiveTab] = useState("all")

    const tabs = useMemo(() => {
        if (episodes.length <= 24) return null
        const groups: { label: string; range: [number, number] }[] = []
        for (let i = 0; i < episodes.length; i += 24) {
            const from = episodes[i].episodeNumber
            const to = episodes[Math.min(i + 23, episodes.length - 1)].episodeNumber
            groups.push({ label: `${from} - ${to}`, range: [i, i + 24] })
        }
        return groups
    }, [episodes])

    const visibleEpisodes = useMemo(() => {
        if (!tabs) return episodes
        const idx = tabs.findIndex((t) => t.label === activeTab)
        if (idx < 0) return episodes
        const [start, end] = tabs[idx].range
        return episodes.slice(start, end)
    }, [episodes, tabs, activeTab])

    const tabValue = tabs ? (activeTab === "all" ? tabs[0]?.label ?? "all" : activeTab) : "all"

    return (
        <section className="relative z-[1] px-6 sm:px-10 pb-20">
            <div className="flex flex-col gap-8">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-6">
                    <h2 className="text-4xl font-bebas tracking-widest text-white uppercase">EPISODIOS</h2>
                    {episodes.length > 0 && (
                        <span className="text-[10px] font-black tracking-[0.3em] text-white/30 uppercase">{episodes.length} TOTAL</span>
                    )}
                </div>

                {/* Tab pagination for large series */}
                {tabs && (
                    <Tabs value={tabValue} onValueChange={setActiveTab}>
                        <ScrollArea>
                            <TabsList className="mb-6 bg-black border border-white/10 h-11 px-1 gap-1 inline-flex flex-nowrap rounded-none">
                                {tabs.map((t) => (
                                    <TabsTrigger
                                        key={t.label}
                                        value={t.label}
                                        className="text-[10px] font-black uppercase tracking-widest text-zinc-500 data-[state=active]:bg-white data-[state=active]:text-black px-4 transition-all rounded-none"
                                    >
                                        {t.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </ScrollArea>
                    </Tabs>
                )}

                {/* Episode grid */}
                {visibleEpisodes.length === 0 ? (
                    <div className="py-16 text-center text-white/30 text-sm">
                        No hay episodios disponibles en la biblioteca.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {visibleEpisodes.map((ep) => (
                            <EpisodeClientCard
                                key={ep.episodeNumber}
                                episode={ep}
                                seriesTitle={seriesTitle}
                                fallbackThumb={fallbackThumb}
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    )
})
EpisodesSection.displayName = "EpisodesSection"
