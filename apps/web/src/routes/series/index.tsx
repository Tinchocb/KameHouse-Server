import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo, memo } from "react"
import { FaSearch, FaFilter, FaStar, FaPlay, FaListOl } from "react-icons/fa"
import { EmptyState } from "@/components/shared/empty-state"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { Anime_LibraryCollectionEntry } from "@/api/generated/types"
import { Tv } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { GenrePill } from "@/components/shared/genre-pill"
import { DeferredImage } from "@/components/shared/deferred-image"
import { HeroSection } from "@/components/shared/hero-section"

export const Route = createFileRoute("/series/")(
    { component: SeriesPage }
)

// ─── Cassette thickness in px ─────────────────────────────────────────────────
const SPINE_W = 52
const CASSETTE_W = 220  // cover width in px
const CASSETTE_H = 330  // cover height in px
const OVERLAP = 80      // how much cassettes overlap each other

function SeriesPage() {
    const [search, setSearch] = useState("")
    const [activeGenre, setActiveGenre] = useState<string | null>(null)

    const { data: collection, isLoading } = useGetLibraryCollection()

    const allSeries = useMemo(() => {
        if (!collection?.lists) return []
        const raw = collection.lists
            .flatMap(list => list.entries || [])
            .filter(entry => entry.media?.format !== "MOVIE")
        const unique = new Map<number, NonNullable<typeof raw[0]>>()
        raw.forEach(s => { if (s.mediaId) unique.set(s.mediaId, s) })
        return Array.from(unique.values())
    }, [collection])

    const ALL_GENRES = useMemo(() => {
        const genres = new Set<string>()
        allSeries.forEach(s => { s.media?.genres?.forEach(g => genres.add(g)) })
        return Array.from(genres).sort()
    }, [allSeries])

    const filtered = useMemo(() => {
        return allSeries.filter(s => {
            const media = s.media
            if (!media) return false
            const matchesGenre = activeGenre ? media.genres?.includes(activeGenre) : true
            const title = media.titleRomaji || media.titleEnglish || media.titleOriginal || ""
            const matchesSearch = search
                ? title.toLowerCase().includes(search.toLowerCase()) ||
                  (media.description || "").toLowerCase().includes(search.toLowerCase())
                : true
            return matchesGenre && matchesSearch
        })
    }, [allSeries, search, activeGenre])

    return (
        <div className="flex-1 w-full min-h-screen bg-[#09090b] text-white overflow-hidden font-sans selection:bg-primary/30">

            {/* ── Page Header ── */}
            <HeroSection
                title={<>CRÓNICAS<br /><span className="text-transparent stroke-text opacity-20">Z</span></>}
                subtitle="El registro definitivo de los guerreros y las batallas que marcaron el destino del universo."
                decorationTag="Archivo Maestro"
                verticalTag="SAYAYIN · ANDROIDES · MAJIN BUU"
                count={isLoading ? "..." : allSeries.length}
                countLabel="Sagas"
            />

            {/* ── Controls ── */}
            <div className="sticky top-0 z-30 bg-[#09090b]/80 border-b border-white/[0.04] backdrop-blur-2xl">
                <div className="px-8 md:px-16 py-3 flex flex-wrap gap-4 items-center">
                    {/* Search */}
                    <div className="relative group">
                        <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-white transition-colors text-xs" />
                        <input
                            className="pl-10 pr-4 py-2 bg-black hover:bg-zinc-900 border border-white/10 focus:border-white rounded-none text-sm outline-none transition-all duration-200 placeholder:text-zinc-700 w-64"
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="BUSCAR SERIES..."
                        />
                    </div>

                    {/* Genres */}
                    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto no-scrollbar">
                        <div className="flex items-center gap-1.5 mr-1 px-2.5 py-1.5 bg-black border border-white/10">
                            <FaFilter className="text-[9px] text-zinc-600" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Filtro</span>
                        </div>
                        <GenrePill label="TODOS" active={activeGenre === null} onClick={() => setActiveGenre(null)} />
                        {ALL_GENRES.slice(0, 12).map(g => (
                            <GenrePill
                                key={g}
                                label={g.toUpperCase()}
                                active={activeGenre === g}
                                onClick={() => setActiveGenre(activeGenre === g ? null : g)}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Cassette Shelf ── */}
            <div className="relative w-full overflow-hidden">
                {/* Shelf floor shadow */}
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent pointer-events-none z-10" />

                {isLoading ? (
                    <ShelfSkeleton />
                ) : filtered.length === 0 ? (
                    <div className="px-16 py-24">
                        <EmptyState
                            title="Sin coincidencias"
                            message="No hemos encontrado series que coincidan con tu búsqueda actual."
                            illustration={<Tv className="w-20 h-20 text-zinc-800" />}
                        />
                    </div>
                ) : (
                    <div
                        className="flex flex-nowrap items-end overflow-x-auto no-scrollbar py-20 px-16"
                        style={{ perspective: "2400px" }}
                    >
                        {filtered.map((entry, idx) => (
                            <CassetteItem
                                key={entry.mediaId}
                                entry={entry}
                                idx={idx}
                            />
                        ))}
                        {/* Right breathing room */}
                        <div className="shrink-0 w-32" />
                    </div>
                )}
            </div>

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                @keyframes cassette-in {
                    from { opacity: 0; transform: rotateY(60deg) translateZ(-100px); }
                    to   { opacity: 1; }
                }
            `}</style>
        </div>
    )
}

// ─── Individual Cassette ───────────────────────────────────────────────────────

const CassetteItem = memo(function CassetteItem({
    entry, idx
}: { entry: Anime_LibraryCollectionEntry; idx: number }) {
    const navigate = useNavigate()
    const media = entry.media
    if (!media) return null

    const title = media.titleEnglish || media.titleRomaji || media.titleOriginal || "Sin título"
    const score = media.score ? (media.score > 10 ? media.score / 10 : media.score).toFixed(1) : null
    const genres = media.genres?.slice(0, 3) || []

    const spineAccent = "#ffffff"

    return (
        <div
            className={cn(
                "group/item relative shrink-0 transition-all duration-500 ease-&lsqb;cubic-bezier(0.34,1.56,0.64,1)&rsqb; hover:z-[9999]",
                idx !== 0 && "ml-[-" + OVERLAP + "px]"
            )}
            style={{
                marginLeft: idx !== 0 ? -OVERLAP : 0,
                zIndex: idx,
            }}
        >
            {/* ── 3D wrapper ── */}
            <div
                className="relative transition-all duration-500 ease-&lsqb;cubic-bezier(0.34,1.56,0.64,1)&rsqb; [transform-style:preserve-3d]"
                style={{
                    width: CASSETTE_W + SPINE_W,
                    height: CASSETTE_H,
                    transform: "rotateY(35deg)",
                }}
                onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.transform = "rotateY(0deg) translateZ(80px) translateY(-30px)"
                    el.style.transitionDuration = "400ms"
                }}
                onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.transform = "rotateY(35deg)"
                    el.style.transitionDuration = "500ms"
                }}
            >
                {/* ── Spine ─────────────────────────────────────────────── */}
                <div
                    className="absolute inset-y-0 left-0 flex flex-col justify-between overflow-hidden border border-white/20 bg-black"
                    style={{
                        width: SPINE_W,
                    }}
                >
                    {/* Accent stripe */}
                    <div className="absolute left-0 inset-y-0 w-1 bg-white" />
                    {/* Score chip */}
                    {score && (
                        <div className="mt-3 ml-4 flex items-center gap-1">
                            <FaStar className="text-[8px] text-white" />
                            <span className="text-[9px] font-black tabular-nums text-white">{score}</span>
                        </div>
                    )}
                    {/* Title rotated */}
                    <span
                        className="flex-1 text-[10px] font-black text-zinc-400 tracking-widest whitespace-nowrap px-2 py-4 uppercase"
                        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", textOverflow: "ellipsis", overflow: "hidden" }}
                    >
                        {title}
                    </span>
                    {/* Year */}
                    {media.year && (
                        <div className="mb-3 ml-3">
                            <span className="text-[8px] font-black text-zinc-700 tracking-wider">{media.year}</span>
                        </div>
                    )}
                </div>

                {/* ── Cover ─────────────────────────────────────────────── */}
                <div
                    className="absolute inset-y-0 right-0 overflow-hidden border border-white/20 cursor-pointer bg-black"
                    style={{ left: SPINE_W }}
                    onClick={() => navigate({ to: "/series/$seriesId", params: { seriesId: entry.mediaId.toString() } })}
                >
                    {/* Poster */}
                    <DeferredImage
                        src={media.posterImage || ""}
                        alt={title}
                        className="w-full h-full object-cover grayscale group-hover/item:grayscale-0 transition-all duration-500"
                    />

                    {/* Dark gradient base */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />

                    {/* ── Hover info overlay ─────────────────────────────── */}
                    <div className="absolute inset-0 flex flex-col justify-end p-5 opacity-0 group-hover/item:opacity-100 transition-all duration-400 bg-black/90">
                        {/* Play CTA */}
                        <button
                            onClick={() => navigate({ to: "/series/$seriesId", params: { seriesId: entry.mediaId.toString() } })}
                            className="mb-6 w-full flex items-center justify-center gap-2 py-3 font-black text-[11px] uppercase tracking-[0.2em] text-black bg-white hover:bg-zinc-200 transition-all duration-200"
                        >
                            <FaPlay className="text-[10px]" />
                            Explorar serie
                        </button>

                        {/* Title */}
                        <h3 className="text-[16px] font-black text-white leading-tight mb-3 uppercase tracking-tight line-clamp-2">
                            {title}
                        </h3>

                        {/* Meta row */}
                        <div className="flex items-center gap-2 mb-4 flex-wrap">
                            {score && (
                                <span className="flex items-center gap-1 text-[10px] font-black px-2 py-1 bg-white text-black">
                                    <FaStar className="text-[8px]" /> {score}
                                </span>
                            )}
                            {media.year && (
                                <span className="text-[10px] font-black text-zinc-400 px-2 py-1 border border-white/20">
                                    {media.year}
                                </span>
                            )}
                            {media.totalEpisodes && (
                                <span className="flex items-center gap-1 text-[10px] font-black text-zinc-400 px-2 py-1 border border-white/20">
                                    <FaListOl className="text-[8px]" /> {media.totalEpisodes} EPS
                                </span>
                            )}
                        </div>

                        {/* Genres */}
                        <div className="flex flex-wrap gap-1.5 mb-4">
                            {genres.map(g => (
                                <span
                                    key={g}
                                    className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border border-white/20 text-white"
                                >
                                    {g}
                                </span>
                            ))}
                        </div>

                        {/* Description */}
                        {media.description && (
                            <p className="text-[12px] text-zinc-400 leading-relaxed line-clamp-4 font-medium">
                                {media.description.replace(/<[^>]+>/g, "").trim()}
                            </p>
                        )}
                    </div>

                    {/* ── Always visible bottom title strip ── */}
                    <div className="absolute bottom-0 left-0 right-0 px-3 py-3 group-hover/item:opacity-0 transition-opacity duration-300">
                        <p className="text-[11px] font-black text-white uppercase tracking-wider line-clamp-1">
                            {title}
                        </p>
                    </div>
                </div>

                {/* ── Drop shadow beneath cassette ── */}
                <div
                    className="absolute -bottom-6 left-4 right-4 h-6 opacity-0 group-hover/item:opacity-100 transition-opacity duration-500 blur-xl bg-white/10"
                />
            </div>
        </div>
    )
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genreColor(genre: string): string {
    const map: Record<string, string> = {
        "Action":     "#3b82f6",
        "Adventure":  "#f59e0b",
        "Comedy":     "#22d3ee",
        "Drama":      "#8b5cf6",
        "Fantasy":    "#10b981",
        "Horror":     "#ef4444",
        "Mystery":    "#6366f1",
        "Romance":    "#ec4899",
        "Sci-Fi":     "#06b6d4",
        "Thriller":   "#dc2626",
        "Sports":     "#84cc16",
        "Slice of Life": "#34d399",
    }
    return map[genre] ?? "#ffffff"
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ShelfSkeleton() {
    return (
        <div className="flex flex-nowrap items-end py-20 px-16 gap-0 overflow-hidden">
            {Array.from({ length: 10 }).map((_, i) => (
                <div
                    key={i}
                    className="shrink-0 rounded-r-xl animate-pulse bg-white/[0.03] border border-white/5"
                    style={{
                        width: CASSETTE_W,
                        height: CASSETTE_H + Math.random() * 20,
                        marginLeft: i !== 0 ? -OVERLAP : 0,
                    }}
                />
            ))}
        </div>
    )
}

export const SeriesCardSkeleton = ShelfSkeleton;