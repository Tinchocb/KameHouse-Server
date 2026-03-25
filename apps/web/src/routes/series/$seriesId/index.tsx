import { createFileRoute } from "@tanstack/react-router"
import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query"
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
import { DRAGON_BALL_SAGAS } from "@/lib/config/dragonball.config"
import { Link } from "@tanstack/react-router"

export const Route = createFileRoute("/series/$seriesId/")({
    loader: async ({ params: { seriesId } }) => {
        const queryClient = new QueryClient()
        await queryClient.prefetchQuery({
            queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, seriesId],
            queryFn: () => fetchAnimeEntry(seriesId),
        })
        return { dehydrateState: dehydrate(queryClient) }
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

    // Safely resolve the Dragon Ball Saga by TMDB ID first, or fallback to Title matching
    let resolvedSagas: any[] = []
    const tmdbId = entry.media?.tmdbId || 0
    
    if (tmdbId && DRAGON_BALL_SAGAS[tmdbId]) {
        resolvedSagas = DRAGON_BALL_SAGAS[tmdbId]
    } else {
        // Fallback: match by title if tmdbId is 0 or missing from backend, stripping all spaces first
        const searchTitle = title.toLowerCase().replace(/\s+/g, "")
        if (searchTitle.includes("dragonballz") || searchTitle === "dbz") {
            resolvedSagas = DRAGON_BALL_SAGAS[12971] // Z
        } else if (searchTitle.includes("dragonballgt")) {
            resolvedSagas = DRAGON_BALL_SAGAS[888] // GT
        } else if (searchTitle.includes("dragonballsuper")) {
            resolvedSagas = DRAGON_BALL_SAGAS[62715] // Super
        } else if (searchTitle.includes("dragonballkai")) {
            resolvedSagas = DRAGON_BALL_SAGAS[61709] // Kai
        } else if (searchTitle.includes("dragonballdaima")) {
            resolvedSagas = DRAGON_BALL_SAGAS[240411] // Daima
        } else if (searchTitle === "dragonball") {
            resolvedSagas = DRAGON_BALL_SAGAS[862] // Original
        }
    }

    // Always fallback to Original DB if we have a match for "dragon ball" but no specific suffix, 
    // unless it's explicitly a movie (which shouldn't have sagas). This acts as a final safety net.
    if (!resolvedSagas || resolvedSagas.length === 0) {
        const pureTitle = title.toLowerCase().replace(/\s+/g, "")
        // Verify it isn't a known movie substring to avoid false positives on DB movies
        const isMovie = entry.media?.format === "MOVIE" || pureTitle.includes("movie") || pureTitle.includes("pelicula") || pureTitle.includes("aventura")
        if (!isMovie && pureTitle.includes("dragonball")) {
            resolvedSagas = DRAGON_BALL_SAGAS[862]
        }
    }

    const hasSagas = resolvedSagas.length > 0
    const sagas = resolvedSagas

    return (
        <div className="min-h-screen bg-background text-white pb-16">
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
    )
}

function SagasSection({ seriesId, sagas }: { seriesId: string, sagas: any[] }) {
    return (
        <section className="relative z-[1] -mt-10 px-6 sm:px-10 lg:px-16 pb-20">
            <div className="flex flex-col gap-8">
                <div className="space-y-1 border-b border-white/5 pb-4">
                    <h2 className="text-3xl font-black tracking-tight text-orange-500 uppercase tracking-widest drop-shadow-[0_0_15px_rgba(249,115,22,0.4)]">
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
                            className="group relative flex h-64 flex-col justify-end overflow-hidden rounded-2xl p-6 transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_20px_40px_rgba(249,115,22,0.15)] focus:outline-none focus:ring-2 focus:ring-orange-500 ring-offset-2 ring-offset-background"
                        >
                            <div className="absolute inset-0">
                                <img
                                    src={saga.image}
                                    alt={saga.title}
                                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent transition-opacity group-hover:opacity-90" />
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(249,115,22,0.15),transparent)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            </div>

                            <div className="relative z-10 translate-y-2 transition-transform duration-300 group-hover:translate-y-0 text-left">
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-500 mb-2 drop-shadow-md">
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

const HeroSection = React.memo(({ seriesId, directoryPath, backdropUrl, coverUrl, title, year, genres, synopsis, episodesCount }: HeroSectionProps) => {
    return (
        <section className="relative isolate overflow-hidden">
            <div className="absolute inset-0">
                <img
                    src={backdropUrl}
                    alt={title}
                    className="h-full w-full object-cover blur-[2px] opacity-60 animate-ken-burns"
                    loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-background via-background/65 to-transparent" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.05),transparent_45%)]" />
            </div>

            <div className="relative px-6 sm:px-10 lg:px-16 pt-24 pb-18 lg:pb-24">
                <div className="mx-auto flex max-w-6xl flex-col gap-10 lg:flex-row lg:items-end">
                    <div className="mx-auto w-40 sm:w-48 md:w-60 lg:mx-0">
                        <img
                            src={coverUrl}
                            alt={`${title} cover`}
                            loading="lazy"
                            className="aspect-[2/3] w-full rounded-2xl border border-white/10 object-cover shadow-[0_20px_50px_rgba(0,0,0,0.5)] group/cover hover:scale-[1.02] transition-transform duration-500"
                        />
                    </div>

                    <div className="flex flex-1 flex-col gap-5 pb-4">
                        <div className="flex flex-wrap items-center gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-white/80">
                            {year && <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">{year}</span>}
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{episodesCount} episodios</span>
                            <span className="rounded-full border border-orange-500/40 bg-orange-500/15 px-3 py-1 text-orange-200">1080p</span>
                        </div>

                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight drop-shadow-[0_10px_40px_rgba(0,0,0,0.65)]" dangerouslySetInnerHTML={{ __html: sanitizeHtml(title) }}></h1>

                        <div className="flex flex-wrap gap-2">
                            {genres.map((genre) => (
                                <span
                                    key={genre}
                                    className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-white/80 backdrop-blur-sm"
                                >
                                    {genre}
                                </span>
                            ))}
                        </div>

                        <p className="max-w-4xl text-base sm:text-lg text-zinc-400 leading-relaxed line-clamp-4" dangerouslySetInnerHTML={{ __html: sanitizeHtml(synopsis) }}></p>

                        <MediaActionButtons 
                            seriesId={seriesId} 
                            directoryPath={directoryPath} 
                        />
                    </div>
                </div>
            </div>
        </section>
    )
})

interface EpisodesSectionProps {
    seriesTitle: string
    fallbackThumb: string
    episodes: Anime_Episode[]
}

const EpisodesSection = React.memo(({ seriesTitle, fallbackThumb, episodes }: EpisodesSectionProps) => {
    // Grouping logic: Season 0 for null/undefined
    const groupedEpisodes = useMemo(() => {
        const groups = episodes.reduce((acc, ep) => {
            const season = ep.seasonNumber ?? 0
            if (!acc[season]) acc[season] = []
            acc[season].push(ep)
            return acc
        }, {} as Record<number, Anime_Episode[]>)
        return groups
    }, [episodes])

    // Numerical sorting of season keys
    const seasonKeys = useMemo(() => 
        Object.keys(groupedEpisodes)
            .map(Number)
            .sort((a, b) => a - b), 
        [groupedEpisodes]
    )

    const [activeSeason, setActiveSeason] = useState<number>(() => seasonKeys[0] ?? 1)
    const sectionRef = useRef<HTMLElement>(null)
    
    // Smooth scroll to section top on season change with offset
    useEffect(() => {
        if (activeSeason !== undefined && sectionRef.current) {
            const offset = 100 
            const bodyRect = document.body.getBoundingClientRect().top
            const elementRect = sectionRef.current.getBoundingClientRect().top
            const elementPosition = elementRect - bodyRect
            const offsetPosition = elementPosition - offset

            window.scrollTo({
                top: offsetPosition,
                behavior: "smooth",
            })
        }
    }, [activeSeason])

    // State synchronization
    useEffect(() => {
        if (seasonKeys.length > 0 && !seasonKeys.includes(activeSeason)) {
            setActiveSeason(seasonKeys[0])
        }
    }, [seasonKeys, activeSeason])

    if (!episodes || episodes.length === 0) return null

    return (
        <section ref={sectionRef} className="relative z-[1] -mt-10 space-y-8 px-6 sm:px-10 lg:px-16 pb-20">
            <Tabs 
                value={activeSeason.toString()} 
                onValueChange={(val) => setActiveSeason(parseInt(val))}
                className="w-full"
            >
                <div className="flex flex-col gap-8">
                    {/* Season Navigation Bar */}
                    <div className="flex flex-col gap-3">
                        <p className="text-[0.65rem] font-bold uppercase tracking-[0.3em] text-white/40 ml-1">Seleccionar Temporada</p>
                        <ScrollArea orientation="horizontal" className="w-full">
                            <TabsList className="justify-start gap-3 bg-transparent h-auto p-0 pb-3">
                                {seasonKeys.map((s) => (
                                    <TabsTrigger
                                        key={s}
                                        value={s.toString()}
                                        className={cn(
                                            "h-11 whitespace-nowrap rounded-full border border-white/5 bg-white/[0.03] px-6 text-xs font-bold uppercase tracking-widest text-zinc-400 transition-all backdrop-blur-md",
                                            "hover:bg-white/[0.05] hover:text-zinc-200",
                                            "data-[state=active]:border-primary/50 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_rgba(249,115,22,0.3)]"
                                        )}
                                    >
                                        {s === 0 ? "Especiales" : `Temporada ${s}`}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </ScrollArea>
                    </div>

                    {/* Episodes Display Area */}
                    <div className="space-y-6">
                        <div className="flex items-end justify-between border-b border-white/5 pb-4">
                            <div className="space-y-1">
                                <h2 className="text-3xl font-black tracking-tight">
                                    {activeSeason === 0 ? "Episodios Especiales" : `Temporada ${activeSeason}`}
                                </h2>
                                <p className="text-sm font-medium text-white/50 lowercase">
                                    <span className="text-white font-bold">{groupedEpisodes[activeSeason]?.length || 0}</span> episodios disponibles
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {groupedEpisodes[activeSeason]?.map((episode) => (
                                <EpisodeClientCard
                                    key={episode.episodeNumber}
                                    episode={episode}
                                    seriesTitle={seriesTitle}
                                    fallbackThumb={fallbackThumb}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </Tabs>
        </section>
    )
})
