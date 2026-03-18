import { createFileRoute } from "@tanstack/react-router"
import { dbzData } from "@/lib/dbz-data"
import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"

export const Route = createFileRoute("/series/")({
    component: SeriesPage,
})

function SeriesPage() {
    const navigate = useNavigate()
    const [hoveredId, setHoveredId] = useState<string | null>(null)

    const accents = ["#f97316", "#3b82f6", "#a855f7", "#10b981", "#f43f5e"]

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
                    justify-content: center;
                    padding: 32px 24px;
                    gap: 32px;
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
                    max-width: 1200px;
                    height: min(90vh, 1200px);
                    gap: 6px;
                }

                /* Each card */
                .card {
                    position: relative;
                    overflow: hidden;
                    cursor: pointer;
                    border-radius: 14px;
                    flex-shrink: 0;
                    flex-grow: 1;          /* collapsed: equal share */
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
                    /* fade out when expanded, fade in when collapsed-while-any-hovered */
                    transition: opacity 280ms;
                }
                .card.is-hovered   .card-title-vertical { opacity: 0; pointer-events: none; }
                /* Always show when nothing is hovered; hide when this one is collapsed */
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
            `}</style>

            <div className="series-page">
                <h1 className="page-title">KameHouse</h1>

                <div className="card-stack">
                    {dbzData.map((series, idx) => {
                        const isHovered = hoveredId === series.id
                        const isAnyHovered = hoveredId !== null
                        const isCollapsed = isAnyHovered && !isHovered
                        const accent = accents[idx % accents.length]

                        return (
                            <div
                                key={series.id}
                                className={`card ${isHovered ? "is-hovered" : ""} ${isCollapsed ? "is-collapsed" : ""}`}
                                onMouseEnter={() => setHoveredId(series.id)}
                                onMouseLeave={() => setHoveredId(null)}
                                onClick={() => navigate({ to: `/series/${series.id}` })}
                            >
                                <img className="card-bg" src={series.image} alt={series.title} />
                                <div className="card-scrim" />
                                <div className="card-accent-line" style={{ background: accent }} />

                                {/* Vertical title — visible when not expanded */}
                                <div className="card-title-vertical">
                                    <span className="card-title-vertical-text">{series.title}</span>
                                </div>

                                {/* Expanded content */}
                                <div className="card-content">
                                    <p className="card-meta">{series.year} · {series.episodesCount} ep.</p>
                                    <h2 className="card-title-expanded">{series.title}</h2>
                                    <p className="card-description">{series.description}</p>
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
                                            navigate({ to: `/series/${series.id}` })
                                        }}
                                    >
                                        ▶ Ver serie
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>

                <p style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: "10px",
                    letterSpacing: "0.3em",
                    color: "rgba(255,255,255,0.18)",
                    textTransform: "uppercase",
                }}>
                    Pasá el mouse sobre una serie
                </p>
            </div>
        </>
    )
}