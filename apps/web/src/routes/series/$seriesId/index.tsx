import { createFileRoute } from "@tanstack/react-router"
import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query"
import { fetchAnimeEntry, useGetAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { Anime_Episode } from "@/api/generated/types"
import { EmptyState } from "@/components/shared/empty-state"
import { MediaActionButtons, EpisodeClientCard } from "./series-interactivity-client"

export const Route = createFileRoute("/series/$seriesId/")({
    component: SeriesDetailPage,
})

async function SeriesDetailPage() {
    const { seriesId } = Route.useParams()
    const queryClient = new QueryClient()

    await queryClient.prefetchQuery({
        queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, seriesId],
        queryFn: () => fetchAnimeEntry(seriesId),
    })

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <SeriesDetailClient seriesId={seriesId} />
        </HydrationBoundary>
    )
}

function SeriesDetailClient({ seriesId }: { seriesId: string }) {
    const { data: entry } = useGetAnimeEntry(seriesId)

    if (!entry || !entry.media) {
        return (
            <div className="min-h-screen bg-[#0B0B0F] text-white flex items-center justify-center px-6">
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

    return (
        <div className="min-h-screen bg-[#0B0B0F] text-white pb-16">
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

            <EpisodesSection 
                seriesTitle={title} 
                fallbackThumb={heroBackdrop} 
                episodes={entry.episodes || []} 
            />
        </div>
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

function HeroSection({ seriesId, directoryPath, backdropUrl, coverUrl, title, year, genres, synopsis, episodesCount }: HeroSectionProps) {
    return (
        <section className="relative isolate overflow-hidden">
            <div className="absolute inset-0">
                <img
                    src={backdropUrl}
                    alt={title}
                    className="h-full w-full object-cover blur-[2px] scale-105"
                    loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#05050a] via-[#05050a]/70 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#05050a] via-[#05050a]/65 to-transparent" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_45%)]" />
            </div>

            <div className="relative px-6 sm:px-10 lg:px-16 pt-24 pb-18 lg:pb-24">
                <div className="mx-auto flex max-w-6xl flex-col gap-10 lg:flex-row lg:items-end">
                    <div className="mx-auto w-40 sm:w-48 md:w-60 lg:mx-0">
                        <img
                            src={coverUrl}
                            alt={`${title} cover`}
                            loading="lazy"
                            className="aspect-[2/3] w-full rounded-3xl border border-white/10 object-cover shadow-[0_25px_80px_rgba(0,0,0,0.6)]"
                        />
                    </div>

                    <div className="flex flex-1 flex-col gap-5 pb-4">
                        <div className="flex flex-wrap items-center gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-white/80">
                            {year && <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">{year}</span>}
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{episodesCount} episodios</span>
                            <span className="rounded-full border border-orange-500/40 bg-orange-500/15 px-3 py-1 text-orange-200">1080p</span>
                        </div>

                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight drop-shadow-[0_10px_40px_rgba(0,0,0,0.65)]" dangerouslySetInnerHTML={{ __html: title }}></h1>

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

                        <p className="max-w-4xl text-base sm:text-lg text-white/85 leading-relaxed line-clamp-4" dangerouslySetInnerHTML={{ __html: synopsis }}></p>

                        <MediaActionButtons 
                            seriesId={seriesId} 
                            directoryPath={directoryPath} 
                        />
                    </div>
                </div>
            </div>
        </section>
    )
}

interface EpisodesSectionProps {
    seriesTitle: string
    fallbackThumb: string
    episodes: Anime_Episode[]
}

function EpisodesSection({ seriesTitle, fallbackThumb, episodes }: EpisodesSectionProps) {
    if (!episodes || episodes.length === 0) return null

    const groupedEpisodes = episodes.reduce((acc, ep) => {
        const key = ep.seasonNumber || 1
        if (!acc[key]) acc[key] = []
        acc[key].push(ep)
        return acc
    }, {} as Record<number, Anime_Episode[]>)

    return (
        <section className="relative z-[1] -mt-10 space-y-10 px-6 sm:px-10 lg:px-16">
            {Object.entries(groupedEpisodes).map(([seasonNum, seasonEpisodes]) => (
                <div key={seasonNum} className="space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-[0.22em] text-white/60">Temporada</p>
                            <h2 className="text-2xl font-black">{seasonNum}</h2>
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                            {seasonEpisodes.length} episodios
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {seasonEpisodes.map((episode) => (
                            <EpisodeClientCard
                                key={episode.episodeNumber}
                                episode={episode}
                                seriesTitle={seriesTitle}
                                fallbackThumb={fallbackThumb}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </section>
    )
}
