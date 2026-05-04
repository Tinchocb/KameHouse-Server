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
                <div className="space-y-1 border-b border-white/5 pb-4">
                    <h2 className="text-4xl font-bebas font-normal text-[#ff6b00] uppercase tracking-widest drop-shadow-[0_0_15px_rgba(255,107,0,0.6)]">
                        Crónicas y Sagas
                    </h2>
                    <p className="text-sm font-medium text-white/50">
                        Selecciona un arco argumental para explorar sus episodios
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {sagas.map((saga) => (
                        <Link
                            key={saga.id}
                            to={"/series/$seriesId/$sagaId"}
                            params={{ seriesId, sagaId: saga.id }}
                            className="group relative flex h-64 flex-col justify-end overflow-hidden rounded-2xl p-6 transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_30px_60px_rgba(0,0,0,0.8),0_0_30px_rgba(255,107,0,0.2)] focus:outline-none focus:ring-2 focus:ring-[#ff6b00] ring-offset-2 ring-offset-[#09090b]"
                        >
                            <div className="absolute inset-0">
                                <img
                                    src={saga.image}
                                    alt={saga.title}
                                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#09090b]/95 via-[#09090b]/80 to-transparent transition-opacity group-hover:opacity-90" />
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,107,0,0.2),transparent)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            </div>

                            <div className="relative z-10 translate-y-2 transition-transform duration-300 group-hover:translate-y-0 text-left">
                                <p className="text-sm font-black uppercase tracking-[0.2em] text-[#ff6b00] mb-2 drop-shadow-[0_0_10px_rgba(255,107,0,0.5)]">
                                    Eps {saga.startEp} - {saga.endEp}
                                </p>
                                <h3 className="mb-2 text-2xl font-black text-white leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
                                    {saga.title}
                                </h3>
                                <p className="text-sm text-zinc-300 line-clamp-2 opacity-0 transition-all duration-300 group-hover:opacity-100 delay-100 drop-shadow-md">
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
            {/* Backdrop */}
            {backdropUrl && (
                <div className="absolute inset-0 overflow-hidden">
                    <img
                        src={backdropUrl}
                        alt={title}
                        className="w-full h-full object-cover object-center animate-ken-burns"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-[#09090b]/20" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#09090b]/80 via-transparent to-transparent" />
                </div>
            )}

            {/* Content */}
            <div className="relative z-10 flex flex-col lg:flex-row items-end gap-8 px-6 sm:px-10 pb-12 pt-32">
                {/* Cover Poster */}
                {coverUrl && (
                    <div className="hidden lg:block shrink-0 w-40 xl:w-48 rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
                        <img src={coverUrl} alt={title} className="w-full aspect-[2/3] object-cover" />
                    </div>
                )}

                {/* Meta */}
                <div className="flex-1 flex flex-col gap-4 min-w-0">
                    {/* Genres */}
                    <div className="flex flex-wrap gap-2">
                        {genres.slice(0, 4).map((g) => (
                            <span
                                key={g}
                                className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full bg-white/8 text-neutral-300 border border-white/10"
                            >
                                {g}
                            </span>
                        ))}
                    </div>

                    {/* Title */}
                    <h1 className="text-5xl sm:text-6xl xl:text-[7rem] font-bebas font-normal leading-[0.85] tracking-normal text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)] uppercase">
                        {title}
                    </h1>

                    {/* Stats */}
                    <div className="flex flex-wrap items-center gap-3 text-sm text-white/50 font-medium">
                        {year && <span>{year}</span>}
                        {year && episodesCount > 0 && <span className="w-1 h-1 rounded-full bg-white/20" />}
                        {episodesCount > 0 && <span>{episodesCount} episodios</span>}
                    </div>

                    {/* Synopsis */}
                    <div className="max-w-2xl">
                        <p
                            className={cn(
                                "text-sm text-white/60 leading-relaxed transition-all",
                                synopsisExpanded ? "" : "line-clamp-3",
                            )}
                            dangerouslySetInnerHTML={{ __html: cleanSynopsis }}
                        />
                        {synopsis.length > 180 && (
                            <button
                                onClick={() => setSynopsisExpanded((v) => !v)}
                                className="mt-1 text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors"
                            >
                                {synopsisExpanded ? "Ver menos" : "Ver más"}
                            </button>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="mt-2">
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
            <div className="flex flex-col gap-6">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <h2 className="text-3xl font-bebas tracking-widest text-white/90">EPISODIOS</h2>
                    {episodes.length > 0 && (
                        <span className="text-sm text-white/30 font-medium">{episodes.length} en total</span>
                    )}
                </div>

                {/* Tab pagination for large series */}
                {tabs && (
                    <Tabs value={tabValue} onValueChange={setActiveTab}>
                        <ScrollArea>
                            <TabsList className="mb-4 bg-white/5 rounded-xl h-9 px-1 gap-1 inline-flex flex-nowrap">
                                {tabs.map((t) => (
                                    <TabsTrigger
                                        key={t.label}
                                        value={t.label}
                                        className="text-xs font-bold tracking-wide data-[state=active]:bg-orange-500 data-[state=active]:text-white rounded-lg px-3"
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
