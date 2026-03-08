import { createFileRoute, useNavigate } from "@tanstack/react-router"
import React from "react"
import { HeroSection } from "@/components/ui/hero-section"
import { MediaCard } from "@/components/ui/media-card"
import { Slider } from "@/components/shared/slider"
import { LoadingOverlayWithLogo } from "@/components/shared/loading-overlay-with-logo"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { useGetContinuityWatchHistory } from "@/api/hooks/continuity.hooks"
import type { Anime_LibraryCollectionList, Models_LibraryMedia } from "@/api/generated/types"
import type { Continuity_WatchHistory } from "@/api/generated/types"
import type { CardAspect } from "@/lib/home-catalog"

export const Route = createFileRoute("/home/")({
    component: HomePage,
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Pick the best available title from the media object */
function getTitle(media: Models_LibraryMedia): string {
    return media.titleEnglish || media.titleRomaji || media.titleOriginal || "Untitled"
}

/** Human-readable label for an AniList-style list status */
const STATUS_LABELS: Record<string, string> = {
    CURRENT: "Viendo Ahora",
    COMPLETED: "Completadas",
    PAUSED: "En Pausa",
    DROPPED: "Abandonadas",
    PLANNING: "En Mi Lista",
    REPEATING: "Reviendo",
}

function getListLabel(list: Anime_LibraryCollectionList): string {
    return STATUS_LABELS[list.status?.toUpperCase() ?? ""] ?? list.status ?? "Mi Biblioteca"
}

// ─── Error Banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
            <div className="flex flex-col items-center gap-4 max-w-md text-center">
                {/* Animated flame icon */}
                <span className="text-5xl animate-bounce select-none">🔥</span>
                <h2 className="text-xl font-black text-zinc-100 uppercase tracking-wider">
                    No se pudo cargar la biblioteca
                </h2>
                <p className="text-zinc-400 text-sm leading-relaxed">{message}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-2 px-6 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white font-bold text-sm
                               transition-all duration-200 hover:scale-105 shadow-[0_0_20px_rgba(255,122,0,0.35)]"
                >
                    Reintentar
                </button>
            </div>
        </div>
    )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
            <div className="flex flex-col items-center gap-4 max-w-md text-center">
                <span className="text-5xl select-none">📂</span>
                <h2 className="text-xl font-black text-zinc-100 uppercase tracking-wider">
                    Biblioteca vacía
                </h2>
                <p className="text-zinc-400 text-sm leading-relaxed">
                    Aún no has añadido ninguna serie a tu biblioteca. Ve a Configuración para
                    escanear tus carpetas de medios.
                </p>
            </div>
        </div>
    )
}

// ─── Content Row Section ──────────────────────────────────────────────────────

interface ContentRowSectionProps {
    label: string
    entries: NonNullable<Anime_LibraryCollectionList["entries"]>
    onNavigate: (mediaId: number) => void
    aspect?: CardAspect
    watchHistory?: Continuity_WatchHistory
    progressColor?: "white" | "orange"
}

function ContentRowSection({ label, entries, onNavigate, aspect = "poster", watchHistory, progressColor }: ContentRowSectionProps) {
    // Filter out entries without media data
    const validEntries = entries.filter((e) => e.media)

    if (validEntries.length === 0) return null

    return (
        <section className="flex flex-col gap-3">
            {/* Row label */}
            <div className="flex items-center gap-3 px-4 md:px-12 lg:px-16">
                {/* Orange accent bar */}
                <span className="w-1.5 h-6 rounded-full bg-orange-500 shrink-0 shadow-[0_0_10px_rgba(255,122,0,0.6)]" />
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-[0.1em] text-zinc-100 drop-shadow-md">
                    {label}
                </h2>
            </div>

            {/* Horizontal slider */}
            <Slider containerClassName="px-4 md:px-12 lg:px-16 pb-4">
                {validEntries.map((entry, i) => {
                    const media = entry.media!
                    const title = getTitle(media)
                    const artwork = aspect === "wide" ? (media.bannerImage || media.posterImage) : media.posterImage

                    return (
                        <MediaCard
                            key={`${entry.mediaId}-${i}`}
                            artwork={artwork!}
                            title={title}
                            subtitle={media.year ? String(media.year) : undefined}
                            badge={media.format || undefined}
                            description={media.description?.slice(0, 120) || undefined}
                            aspect={aspect}
                            progress={watchHistory?.[media.id]?.duration ? (watchHistory[media.id].currentTime / watchHistory[media.id].duration) * 100 : undefined}
                            progressColor={progressColor}
                            onClick={() => onNavigate(entry.mediaId)}
                        />
                    )
                })}
            </Slider>
        </section>
    )
}

// ─── Home Page ────────────────────────────────────────────────────────────────

function HomePage() {
    const navigate = useNavigate()
    const { data, isLoading, error } = useGetLibraryCollection()
    const { data: historyData } = useGetContinuityWatchHistory()

    // ── Loading ────────────────────────────────────────────────────────────
    if (isLoading) {
        return <LoadingOverlayWithLogo />
    }

    // ── Error ──────────────────────────────────────────────────────────────
    if (error) {
        const msg =
            error instanceof Error
                ? error.message
                : "Ocurrió un error al conectar con el servidor. Asegúrate de que el servidor esté corriendo."
        return <ErrorBanner message={msg} />
    }

    // ── Empty collection ───────────────────────────────────────────────────
    const lists = data?.lists ?? []
    if (lists.length === 0) {
        return <EmptyState />
    }

    // ── Derive featured item (first entry in CURRENT, else first with banner) ─────────────
    let featuredMedia: Models_LibraryMedia | undefined

    // First try "CURRENT" list
    const currentList = lists.find(l => l.status === "CURRENT")
    if (currentList?.entries?.length) {
        featuredMedia = currentList.entries.find(e => e.media?.bannerImage || e.media?.posterImage)?.media
    }

    // Default to the first known banner if nothing is currently being watched
    if (!featuredMedia) {
        for (const list of lists) {
            for (const entry of list.entries ?? []) {
                if (entry.media && (entry.media.bannerImage || entry.media.posterImage)) {
                    featuredMedia = entry.media
                    break
                }
            }
            if (featuredMedia) break
        }
    }

    // ── Navigation handler ──────────────────────────────────────────────────
    const handleNavigate = React.useCallback(
        (mediaId: number) => {
            navigate({ to: "/series/$seriesId", params: { seriesId: String(mediaId) } })
        },
        [navigate],
    )

    // ── Dynamic distribution for UI ──────────────────────────────────────────────
    const allEntries = lists.flatMap((l) => l.entries ?? []).filter((e) => !!e.media)

    // Helper to safely format rows for the UI (using mediaId property mapping)
    const mapEntries = (arr: any[]) => arr.map(e => ({ ...e, mediaId: e.mediaId }))

    // Authentic Categories based on backend
    const movies = allEntries.filter(e => e.media!.format === "MOVIE" || e.media!.format === "MOVIE_ROM")
    const tvShows = allEntries.filter(e => e.media!.format === "TV" || e.media!.format === "TV_SHORT")

    const curatedRows: { label: string, data: any[], aspect: CardAspect, progressColor?: "white" | "orange" }[] = []

    // 1. Continuar Viendo (CURRENT list)
    if (currentList && currentList.entries && currentList.entries.length > 0) {
        curatedRows.push({
            label: "Continuar Viendo",
            data: mapEntries(currentList.entries),
            aspect: "borderless" as CardAspect,
            progressColor: "orange"
        })
    }

    // 2. Mis Series (TV Shows)
    if (tvShows.length > 0) {
        curatedRows.push({
            label: "Sagas Imperdibles",
            data: mapEntries(tvShows),
            aspect: "poster" as CardAspect
        })
    }

    // 3. Mis Películas (Movies)
    if (movies.length > 0) {
        curatedRows.push({
            label: "Películas Clásicas",
            data: mapEntries(movies),
            aspect: "wide" as CardAspect
        })
    }

    // 4. Fallback (If the user only has other things or the parsing left few)
    if (curatedRows.length === 0) {
        curatedRows.push({
            label: "Toda la Biblioteca",
            data: mapEntries(allEntries),
            aspect: "poster" as CardAspect
        })
    }

    return (
        <div className="min-h-screen bg-zinc-950 pb-32">
            {/* ── Hero ──────────────────────────────────────────────────── */}
            {featuredMedia && (
                <HeroSection
                    title={getTitle(featuredMedia)}
                    synopsis={featuredMedia.description || ""}
                    backgroundUrl={featuredMedia.bannerImage || featuredMedia.posterImage}
                    meta={{
                        year: featuredMedia.year || undefined,
                        episodeCount: featuredMedia.totalEpisodes || undefined,
                        genres: featuredMedia.format ? [featuredMedia.format] : undefined,
                    }}
                    onWatchClick={() => handleNavigate(featuredMedia!.id)}
                    onAddToListClick={() => {
                        /* TODO: wishlist */
                    }}
                />
            )}

            {/* ── Content Rows ───────────────────────────────────────────── */}
            <div className="flex flex-col gap-12 md:gap-16 mt-8 py-12 relative z-10">
                {curatedRows.map((row, index) => (
                    <ContentRowSection
                        key={index}
                        label={row.label}
                        entries={row.data as NonNullable<Anime_LibraryCollectionList["entries"]>}
                        onNavigate={handleNavigate}
                        aspect={row.aspect}
                        watchHistory={historyData}
                        progressColor={row.progressColor}
                    />
                ))}
            </div>
        </div>
    )
}
