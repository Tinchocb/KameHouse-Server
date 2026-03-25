import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo, memo } from "react"
import { FaSearch, FaFilter } from "react-icons/fa"
import { EmptyState } from "@/components/shared/empty-state"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { Anime_LibraryCollectionEntry } from "@/api/generated/types"
import { Loader2, Tv } from "lucide-react"
import { cn } from "@/components/ui/core/styling"

export const Route = createFileRoute("/series/")(
    { component: SeriesPage }
)

function SeriesPage() {
    const navigate = useNavigate()
    const [hoveredId, setHoveredId] = useState<string | null>(null)
    const [search, setSearch] = useState("")
    const [activeGenre, setActiveGenre] = useState<string | null>(null)

    const { data: collection, isLoading } = useGetLibraryCollection()

    const accents = ["#f97316", "#3b82f6", "#a855f7", "#10b981", "#f43f5e"]

    // ── All series (non-movie) ─────────────────────────────────────────────
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

    // Limit fan-out cards to 8 most recent for UI performance
    const displayCards = useMemo(() => filtered.slice(0, 40), [filtered])

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600&display=swap');

                .series-page {
                    position: fixed;
                    inset: 0;
                    background: #0d0d0d;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: flex-start;
                    padding: 0;
                    overflow: hidden;
                }

                .page-title {
                    font-family: 'Bebas Neue', sans-serif;
                    font-size: clamp(36px, 5vw, 64px);
                    color: #fff;
                    letter-spacing: 0.06em;
                    line-height: 1;
                    margin: 0;
                }

                /* ── Horizontal stack ── */
                .card-stack {
                    display: flex;
                    flex-direction: row;
                    align-items: stretch;
                    width: 100%;
                    max-width: none;
                    flex: 1;
                    min-height: 0;
                    gap: 6px;
                    padding: 0 4vw;
                }

                /* Each card */
                .card {
                    position: relative;
                    overflow: hidden;
                    cursor: pointer;
                    border-radius: 14px;
                    flex-shrink: 0;
                    flex-grow: 1;
                    transition:
                        flex-grow 360ms cubic-bezier(0.4, 0, 0.2, 1),
                        box-shadow 360ms cubic-bezier(0.4, 0, 0.2, 1);
                }
                .card.is-hovered   { flex-grow: 5; box-shadow: 0 24px 64px rgba(0,0,0,0.7); }
                .card.is-collapsed { flex-grow: 0.35; }

                /* BG image */
                .card-bg {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    object-position: center 15%;
                    transition: transform 600ms ease, filter 360ms ease;
                }
                .card.is-hovered   .card-bg { transform: scale(1.05); filter: brightness(0.4); }
                .card:not(.is-hovered) .card-bg { transform: scale(1);    filter: brightness(0.22); }

                /* Gradient scrim */
                .card-scrim {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(
                        to top,
                        rgba(0,0,0,0.95) 0%,
                        rgba(0,0,0,0.4)  45%,
                        rgba(0,0,0,0.1)  100%
                    );
                }

                /* Accent line — bottom edge */
                .card-accent-line {
                    position: absolute;
                    bottom: 0; left: 0; right: 0;
                    height: 3px;
                    transition: opacity 360ms;
                }
                .card.is-hovered .card-accent-line   { opacity: 1; }
                .card:not(.is-hovered) .card-accent-line { opacity: 0; }

                /* ── Collapsed title (vertical, centered) ── */
                .card-title-vertical {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: opacity 280ms;
                }
                .card.is-hovered   .card-title-vertical { opacity: 0; pointer-events: none; }
                .card-title-vertical-text {
                    font-family: 'Bebas Neue', sans-serif;
                    font-size: clamp(18px, 2.2vw, 26px);
                    color: rgba(255,255,255,0.75);
                    letter-spacing: 0.12em;
                    writing-mode: vertical-rl;
                    text-orientation: mixed;
                    transform: rotate(180deg);
                    white-space: nowrap;
                    text-shadow: 0 2px 12px rgba(0,0,0,0.8);
                }

                /* ── Expanded content (bottom) ── */
                .card-content {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-end;
                    padding: 28px 30px;
                    transition: opacity 300ms 90ms;
                }
                .card:not(.is-hovered) .card-content { opacity: 0; pointer-events: none; }
                .card.is-hovered       .card-content { opacity: 1; }

                .card-meta {
                    font-family: 'Inter', sans-serif;
                    font-size: 11px;
                    font-weight: 600;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                    color: rgba(255,255,255,0.35);
                    margin-bottom: 8px;
                }

                .card-title-expanded {
                    font-family: 'Bebas Neue', sans-serif;
                    font-size: clamp(36px, 4.5vw, 60px);
                    color: #fff;
                    letter-spacing: 0.04em;
                    line-height: 1;
                    margin: 0 0 12px;
                }

                .card-description {
                    font-family: 'Inter', sans-serif;
                    font-size: 13px;
                    line-height: 1.7;
                    color: rgba(255,255,255,0.55);
                    max-width: 420px;
                    display: -webkit-box;
                    -webkit-line-clamp: 3;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                    margin-bottom: 18px;
                }

                .card-cta {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    font-family: 'Inter', sans-serif;
                    font-size: 11px;
                    font-weight: 600;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                    border-radius: 6px;
                    padding: 9px 18px;
                    border: 1.5px solid;
                    background: transparent;
                    cursor: pointer;
                    transition: background 180ms, color 180ms;
                    width: fit-content;
                }
                .stroke-text {
                    -webkit-text-stroke: 1.5px white;
                }

                .series-controls {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 12px;
                    padding: 20px 24px;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                    background: rgba(0,0,0,0.5);
                    backdrop-filter: blur(20px);
                    z-index: 20;
                }
            `}</style>

            <div className="series-page">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-rose-600/[0.02] pointer-events-none z-0" />

                {/* ── Header ── */}
                <div className="relative z-10 w-full max-w-none flex items-center justify-between pt-8 pb-6 px-[4vw]">
                    <div>
                        <h1 className="page-title">
                            CRÓNICAS <span className="text-transparent stroke-text opacity-30">DB</span>
                        </h1>
                        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "rgba(255,255,255,0.3)", marginTop: "4px", letterSpacing: "0.1em" }}>
                            {isLoading ? "Cargando..." : `${allSeries.length} series · ${filtered.length} mostradas`}
                        </p>
                    </div>
                </div>

                {/* ── Controls ── */}
                <div className="series-controls relative z-10">
                    {/* Search */}
                    <div className="relative w-72 group">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary transition-colors text-xs" />
                        <input
                            className="w-full pl-9 pr-4 py-2 bg-white/[0.03] border border-white/5 focus:border-primary/40 rounded-xl text-sm text-white outline-none transition-all duration-300 placeholder:text-zinc-600 hover:bg-white/[0.05] focus:bg-white/[0.08]"
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar series..."
                        />
                    </div>

                    {/* Genres */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 mr-1 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5">
                            <FaFilter className="text-[10px] text-zinc-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Géneros</span>
                        </div>
                        <GenrePill label="TODOS" active={activeGenre === null} onClick={() => setActiveGenre(null)} />
                        {ALL_GENRES.slice(0, 10).map(g => (
                            <GenrePill
                                key={g}
                                label={g.toUpperCase()}
                                active={activeGenre === g}
                                onClick={() => setActiveGenre(activeGenre === g ? null : g)}
                            />
                        ))}
                    </div>
                </div>

                {/* ── Content ── */}
                <div className="relative z-10 flex-1 min-h-0 w-full flex flex-col items-center justify-center">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center gap-4">
                            <Loader2 className="w-10 h-10 text-primary animate-spin" />
                            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "10px", letterSpacing: "0.3em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>
                                Cargando biblioteca...
                            </p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <EmptyState
                            title="Sin series"
                            message={
                                allSeries.length === 0
                                    ? "No se encontraron series en tu biblioteca. Ejecutá un escaneo en Ajustes → Buscador."
                                    : "Ninguna serie coincide con tu búsqueda actual."
                            }
                            illustration={<Tv className="w-20 h-20 text-zinc-800" />}
                        />
                    ) : (
                        <div className="card-stack pb-6">
                            {displayCards.map((entry, idx) => (
                                <SeriesCard
                                    key={entry.mediaId}
                                    entry={entry}
                                    isHovered={hoveredId === String(entry.mediaId)}
                                    isAnyHovered={hoveredId !== null}
                                    accent={accents[idx % accents.length]}
                                    onHover={() => setHoveredId(String(entry.mediaId))}
                                    onLeave={() => setHoveredId(null)}
                                    onNavigate={() => navigate({ to: "/series/$seriesId", params: { seriesId: String(entry.mediaId) } })}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {filtered.length > 8 && (
                    <p style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: "10px",
                        letterSpacing: "0.3em",
                        color: "rgba(255,255,255,0.18)",
                        textTransform: "uppercase",
                        paddingBottom: "16px",
                        position: "relative",
                        zIndex: 10,
                    }}>
                        Mostrando las primeras 40 series · {filtered.length} en total
                    </p>
                )}
                {filtered.length <= 40 && filtered.length > 0 && (
                    <p style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: "10px",
                        letterSpacing: "0.3em",
                        color: "rgba(255,255,255,0.18)",
                        textTransform: "uppercase",
                        paddingBottom: "16px",
                        position: "relative",
                        zIndex: 10,
                    }}>
                        Pasá el mouse sobre una serie
                    </p>
                )}
            </div>
        </>
    )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const GenrePill = memo(function GenrePill({
    label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            className={cn(
                "px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest transition-all duration-300 border",
                active
                    ? "bg-primary text-white border-primary shadow-[0_0_20px_rgba(249,115,22,0.3)] scale-105"
                    : "bg-white/[0.03] text-zinc-500 border-white/5 hover:border-primary/40 hover:text-primary"
            )}
            onClick={onClick}
        >
            {label}
        </button>
    )
})

const SeriesCard = memo(function SeriesCard({
    entry, isHovered, isAnyHovered, accent, onHover, onLeave, onNavigate,
}: {
    entry: Anime_LibraryCollectionEntry
    isHovered: boolean
    isAnyHovered: boolean
    accent: string
    onHover: () => void
    onLeave: () => void
    onNavigate: () => void
}) {
    const media = entry.media
    if (!media) return null

    const isCollapsed = isAnyHovered && !isHovered
    const title = media.titleRomaji || media.titleEnglish || media.titleOriginal || "Sin título"
    const image = media.bannerImage || media.posterImage || ""
    const description = media.description?.replace(/<[^>]*>/g, "") || ""
    const metaParts = [
        media.year ? String(media.year) : null,
        media.totalEpisodes ? `${media.totalEpisodes} ep.` : null,
        media.format || null,
    ].filter(Boolean)

    return (
        <div
            className={`card ${isHovered ? "is-hovered" : ""} ${isCollapsed ? "is-collapsed" : ""}`}
            onMouseEnter={onHover}
            onMouseLeave={onLeave}
            onClick={onNavigate}
        >
            {image ? (
                <img className="card-bg" src={image} alt={title} />
            ) : (
                <div className="card-bg" style={{ background: `linear-gradient(135deg, rgba(15,15,15,1) 0%, rgba(30,30,30,1) 100%)` }} />
            )}
            <div className="card-scrim" />
            <div className="card-accent-line" style={{ background: accent }} />

            {/* Vertical title */}
            <div className="card-title-vertical">
                <span className="card-title-vertical-text">{title}</span>
            </div>

            {/* Expanded content */}
            <div className="card-content">
                <p className="card-meta">{metaParts.join(" · ")}</p>
                <h2 className="card-title-expanded">{title}</h2>
                <p className="card-description">{description}</p>
                <button
                    className="card-cta"
                    style={{ borderColor: accent, color: accent }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = accent
                        e.currentTarget.style.color = "#000"
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = "transparent"
                        e.currentTarget.style.color = accent
                    }}
                    onClick={e => {
                        e.stopPropagation()
                        onNavigate()
                    }}
                >
                    ▶ Ver serie
                </button>
            </div>
        </div>
    )
})