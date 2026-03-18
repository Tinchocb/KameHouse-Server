import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo, memo } from "react"
import { FaPlay, FaSearch, FaFilter } from "react-icons/fa"
import { EmptyState } from "@/components/shared/empty-state"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { Anime_LibraryCollectionEntry } from "@/api/generated/types"
import { Loader2 } from "lucide-react"

export const Route = createFileRoute("/movies/")({
    component: MoviesPage,
})

// ─── Page ─────────────────────────────────────────────────────────────────────

function MoviesPage() {
    const [search, setSearch] = useState("")
    const [activeGenre, setActiveGenre] = useState<string | null>(null)

    const { data: collection, isLoading } = useGetLibraryCollection()

    const allMovies = useMemo(() => {
        if (!collection?.lists) return []
        const rawMovies = collection.lists
            .flatMap(list => list.entries || [])
            .filter(entry => entry.media?.format === "MOVIE")
        const unique = new Map<number, NonNullable<typeof rawMovies[0]>>()
        rawMovies.forEach(m => { if (m.mediaId) unique.set(m.mediaId, m) })
        return Array.from(unique.values())
    }, [collection])

    const ALL_GENRES = useMemo(() => {
        const genres = new Set<string>()
        allMovies.forEach(m => { m.media?.genres?.forEach(g => genres.add(g)) })
        return Array.from(genres).sort()
    }, [allMovies])

    const filtered = useMemo(() => {
        return allMovies.filter(m => {
            const media = m.media
            if (!media) return false
            const matchesGenre = activeGenre ? media.genres?.includes(activeGenre) : true
            const title = media.titleRomaji || media.titleEnglish || media.titleOriginal || ""
            const matchesSearch = search
                ? title.toLowerCase().includes(search.toLowerCase()) ||
                  (media.description || "").toLowerCase().includes(search.toLowerCase())
                : true
            return matchesGenre && matchesSearch
        })
    }, [search, activeGenre, allMovies])

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap');

                /* ── Page shell ── */
                .mp-page {
                    flex: 1;
                    width: 100%;
                    min-height: 100vh;
                    background: #0b0b0f;
                    color: #fff;
                    overflow-y: auto;
                    padding-bottom: 96px;
                    font-family: 'Inter', sans-serif;
                }

                /* ── Hero ── */
                .mp-hero {
                    position: relative;
                    overflow: hidden;
                    padding: 96px 56px 52px;
                }
                @media (max-width: 768px) { .mp-hero { padding: 80px 24px 40px; } }

                .mp-hero-glow {
                    position: absolute;
                    top: -160px; left: -80px;
                    width: 640px; height: 520px;
                    border-radius: 50%;
                    background: radial-gradient(circle, #f97316 0%, #dc2626 100%);
                    opacity: 0.08;
                    filter: blur(120px);
                    pointer-events: none;
                }

                .mp-hero-inner {
                    position: relative;
                    z-index: 1;
                    max-width: 1200px;
                    margin: 0 auto;
                }

                .mp-eyebrow {
                    font-size: 10px;
                    font-weight: 700;
                    letter-spacing: 0.35em;
                    text-transform: uppercase;
                    color: #f97316;
                    margin: 0 0 12px;
                }

                .mp-title {
                    font-family: 'Bebas Neue', sans-serif;
                    font-size: clamp(52px, 7vw, 88px);
                    line-height: 0.92;
                    letter-spacing: 0.04em;
                    color: #fff;
                    margin: 0;
                }

                .mp-subtitle {
                    font-family: 'Bebas Neue', sans-serif;
                    font-size: clamp(26px, 3.5vw, 42px);
                    letter-spacing: 0.04em;
                    color: #f97316;
                    margin: 2px 0 20px;
                }

                .mp-count {
                    font-size: 13px;
                    font-weight: 500;
                    color: rgba(255,255,255,0.3);
                    letter-spacing: 0.04em;
                }

                /* ── Controls bar ── */
                .mp-controls {
                    position: sticky;
                    top: 0;
                    z-index: 30;
                    background: rgba(11,11,15,0.9);
                    backdrop-filter: blur(24px);
                    -webkit-backdrop-filter: blur(24px);
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }
                .mp-controls-inner {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 14px 56px;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;
                    align-items: center;
                    justify-content: space-between;
                }
                @media (max-width: 768px) { .mp-controls-inner { padding: 12px 24px; } }

                /* Search */
                .mp-search-wrap {
                    position: relative;
                    width: 260px;
                    flex-shrink: 0;
                }
                @media (max-width: 640px) { .mp-search-wrap { width: 100%; } }

                .mp-search-icon {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: rgba(255,255,255,0.22);
                    pointer-events: none;
                    width: 13px; height: 13px;
                }

                .mp-search-input {
                    width: 100%;
                    padding: 10px 14px 10px 34px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.07);
                    border-radius: 8px;
                    color: #fff;
                    font-family: 'Inter', sans-serif;
                    font-size: 13px;
                    outline: none;
                    transition: border-color 200ms, box-shadow 200ms;
                    box-sizing: border-box;
                }
                .mp-search-input::placeholder { color: rgba(255,255,255,0.22); }
                .mp-search-input:focus {
                    border-color: rgba(249,115,22,0.45);
                    box-shadow: 0 0 0 3px rgba(249,115,22,0.08);
                }

                /* Genre pills */
                .mp-pills {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    align-items: center;
                }

                .mp-pill {
                    padding: 6px 13px;
                    border-radius: 999px;
                    font-family: 'Inter', sans-serif;
                    font-size: 11px;
                    font-weight: 600;
                    letter-spacing: 0.05em;
                    border: 1px solid;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: background 160ms, border-color 160ms, color 160ms, box-shadow 160ms;
                }
                .mp-pill.on {
                    background: #f97316;
                    border-color: #f97316;
                    color: #fff;
                    box-shadow: 0 0 16px rgba(249,115,22,0.3);
                }
                .mp-pill.off {
                    background: rgba(255,255,255,0.04);
                    border-color: rgba(255,255,255,0.07);
                    color: rgba(255,255,255,0.4);
                }
                .mp-pill.off:hover {
                    border-color: rgba(249,115,22,0.4);
                    color: #f97316;
                    background: rgba(249,115,22,0.05);
                }

                /* ── Grid wrapper ── */
                .mp-grid-wrap {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 36px 56px 0;
                }
                @media (max-width: 768px) { .mp-grid-wrap { padding: 24px 24px 0; } }

                .mp-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 16px;
                }
                @media (min-width: 480px)  { .mp-grid { grid-template-columns: repeat(3, 1fr); } }
                @media (min-width: 768px)  { .mp-grid { grid-template-columns: repeat(4, 1fr); gap: 20px; } }
                @media (min-width: 1024px) { .mp-grid { grid-template-columns: repeat(5, 1fr); } }
                @media (min-width: 1280px) { .mp-grid { grid-template-columns: repeat(6, 1fr); } }

                /* ── Movie card ── */
                .mc {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    cursor: pointer;
                }

                .mc-poster {
                    position: relative;
                    aspect-ratio: 2 / 3;
                    border-radius: 10px;
                    overflow: hidden;
                    background: rgba(255,255,255,0.04);
                    box-shadow:
                        0 0 0 1px rgba(255,255,255,0.06),
                        0 8px 24px rgba(0,0,0,0.5);
                    transition:
                        box-shadow 300ms cubic-bezier(0.4,0,0.2,1),
                        transform 300ms cubic-bezier(0.4,0,0.2,1);
                }
                .mc:hover .mc-poster {
                    box-shadow:
                        0 0 0 1.5px rgba(249,115,22,0.55),
                        0 20px 48px rgba(0,0,0,0.7);
                    transform: translateY(-5px) scale(1.01);
                }

                .mc-poster img {
                    width: 100%; height: 100%;
                    object-fit: cover;
                    display: block;
                    transition: transform 500ms cubic-bezier(0.4,0,0.2,1);
                }
                .mc:hover .mc-poster img { transform: scale(1.07); }

                /* Gradient scrim */
                .mc-scrim {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(
                        to top,
                        rgba(0,0,0,0.9) 0%,
                        rgba(0,0,0,0.05) 50%,
                        transparent 100%
                    );
                    opacity: 0;
                    transition: opacity 280ms;
                }
                .mc:hover .mc-scrim { opacity: 1; }

                /* Play button */
                .mc-play {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    transform: scale(0.85);
                    transition: opacity 240ms, transform 240ms cubic-bezier(0.4,0,0.2,1);
                }
                .mc:hover .mc-play { opacity: 1; transform: scale(1); }

                .mc-play-btn {
                    width: 50px; height: 50px;
                    border-radius: 50%;
                    background: rgba(249,115,22,0.9);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 0 32px rgba(249,115,22,0.5);
                    backdrop-filter: blur(4px);
                }

                /* Badges */
                .mc-badge {
                    position: absolute;
                    padding: 3px 7px;
                    border-radius: 5px;
                    font-size: 10px;
                    font-weight: 700;
                    backdrop-filter: blur(8px);
                    letter-spacing: 0.04em;
                    line-height: 1.4;
                }
                .mc-badge-score { top: 8px; right: 8px; background: rgba(0,0,0,0.6); color: #fff; }
                .mc-badge-year  { top: 8px; left:  8px; background: rgba(249,115,22,0.85); color: #fff; }

                /* Fallback */
                .mc-fallback {
                    width: 100%; height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #1c1c28;
                    font-size: 44px;
                }

                /* Card info */
                .mc-info { padding: 0 2px; display: flex; flex-direction: column; gap: 3px; }

                .mc-title {
                    font-size: 13px;
                    font-weight: 600;
                    color: #fff;
                    line-height: 1.35;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                    transition: color 200ms;
                }
                .mc:hover .mc-title { color: #f97316; }

                .mc-genre {
                    font-size: 11px;
                    font-weight: 500;
                    color: rgba(249,115,22,0.55);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                /* Loader */
                .mp-loader {
                    display: flex;
                    height: 256px;
                    align-items: center;
                    justify-content: center;
                }
                @keyframes mp-spin { to { transform: rotate(360deg); } }
                .mp-spinner {
                    width: 32px; height: 32px;
                    color: #f97316;
                    animation: mp-spin 1s linear infinite;
                }
            `}</style>

            <div className="mp-page">

                {/* ── Hero ── */}
                <div className="mp-hero">
                    <div className="mp-hero-glow" />
                    <div className="mp-hero-inner">
                        <p className="mp-eyebrow">Colección</p>
                        <h1 className="mp-title">PELÍCULAS</h1>
                        <p className="mp-subtitle">Biblioteca Local</p>
                        <p className="mp-count">
                            {isLoading ? "Cargando..." : `${allMovies.length} películas en tu biblioteca`}
                        </p>
                    </div>
                </div>

                {/* ── Controls ── */}
                <div className="mp-controls">
                    <div className="mp-controls-inner">
                        <div className="mp-search-wrap">
                            <FaSearch className="mp-search-icon" />
                            <input
                                className="mp-search-input"
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar película..."
                            />
                        </div>
                        <div className="mp-pills">
                            <FaFilter style={{ color: "rgba(255,255,255,0.2)", width: 13, height: 13, flexShrink: 0 }} />
                            <GenrePill label="Todo"  active={activeGenre === null} onClick={() => setActiveGenre(null)} />
                            {ALL_GENRES.slice(0, 10).map(g => (
                                <GenrePill
                                    key={g}
                                    label={g}
                                    active={activeGenre === g}
                                    onClick={() => setActiveGenre(activeGenre === g ? null : g)}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Grid ── */}
                <div className="mp-grid-wrap">
                    {isLoading ? (
                        <div className="mp-loader">
                            <Loader2 className="mp-spinner" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <EmptyState title="Sin resultados" message="Intenta con otro filtro o búsqueda" />
                    ) : (
                        <div className="mp-grid">
                            {filtered.map(entry => (
                                <MovieCard key={entry.mediaId} entry={entry} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}

// ─── Genre pill ───────────────────────────────────────────────────────────────

const GenrePill = memo(function GenrePill({
    label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button className={`mp-pill ${active ? "on" : "off"}`} onClick={onClick}>
            {label}
        </button>
    )
})

// ─── Movie card ───────────────────────────────────────────────────────────────

const MovieCard = memo(function MovieCard({ entry }: { entry: Anime_LibraryCollectionEntry }) {
    const navigate = useNavigate()
    const [imgError, setImgError] = useState(false)
    const movie = entry.media

    if (!movie) return null

    return (
        <div
            className="mc"
            onClick={() => navigate({ to: "/series/$seriesId", params: { seriesId: entry.mediaId.toString() } })}
        >
            <div className="mc-poster">
                {!imgError ? (
                    <img
                        src={movie.posterImage}
                        alt={movie.titleRomaji || movie.titleEnglish || ""}
                        onError={() => setImgError(true)}
                        loading="lazy"
                    />
                ) : (
                    <div className="mc-fallback">🎬</div>
                )}

                <div className="mc-scrim" />

                <div className="mc-play">
                    <div className="mc-play-btn">
                        <FaPlay style={{ width: 17, height: 17, color: "#fff", marginLeft: 3 }} />
                    </div>
                </div>

                {movie.score > 0 && (
                    <div className="mc-badge mc-badge-score">★ {(movie.score / 10).toFixed(1)}</div>
                )}
                {movie.year > 0 && (
                    <div className="mc-badge mc-badge-year">{movie.year}</div>
                )}
            </div>

            <div className="mc-info">
                <p className="mc-title" title={movie.titleRomaji || movie.titleEnglish}>
                    {movie.titleRomaji || movie.titleEnglish || "Sin título"}
                </p>
                <p className="mc-genre">{movie.genres?.[0] || "Anime"}</p>
            </div>
        </div>
    )
})