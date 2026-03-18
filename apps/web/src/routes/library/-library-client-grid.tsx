"use client"

import React, { useMemo, useState } from "react"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { useGetLocalFilesInfinite } from "@/api/hooks/localfiles.hooks"
import { MediaCard } from "@/components/ui/media-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs/tabs"
import { Anime_LocalFile, Models_LibraryMedia, Anime_LibraryCollectionEntry } from "@/api/generated/types"
import { VirtualizedMediaGrid } from "@/components/shared/virtualized-media-grid"
import { MediaGridSkeleton } from "@/components/shared/media-grid-skeleton"
import { EmptyState } from "@/components/shared/empty-state"

function getTitle(media: Models_LibraryMedia | null | undefined): string {
    return media?.titleEnglish || media?.titleRomaji || media?.titleOriginal || "Desconocido"
}

// ─── Speed lines SVG ────────────────────────────────────

function SpeedLines({ opacity = 0.04 }: { opacity?: number }) {
    return (
        <svg
            aria-hidden
            style={{
                position: "absolute", inset: 0,
                width: "100%", height: "100%",
                opacity, pointerEvents: "none",
            }}
            viewBox="0 0 900 320"
            preserveAspectRatio="xMidYMid slice"
        >
            {Array.from({ length: 32 }).map((_, i) => {
                const angle = (i / 32) * 360
                const rad = (angle * Math.PI) / 180
                return (
                    <line
                        key={i}
                        x1="450" y1="160"
                        x2={450 + Math.cos(rad) * 1400}
                        y2={160 + Math.sin(rad) * 1400}
                        stroke="white"
                        strokeWidth={i % 4 === 0 ? "1.5" : "0.6"}
                    />
                )
            })}
        </svg>
    )
}

// ─── Halftone dot pattern ─────────────────────────────────────────────────────

function HalftoneDots() {
    return (
        <svg
            aria-hidden
            style={{
                position: "absolute", inset: 0,
                width: "100%", height: "100%",
                opacity: 0.025, pointerEvents: "none",
            }}
        >
            <defs>
                <pattern id="dots" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
                    <circle cx="6" cy="6" r="1.5" fill="white" />
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
    )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LibraryClientGrid() {
    const [searchQuery, setSearchQuery] = useState("")

    const {
        data: libraryData,
        isLoading: libLoading,
        isError: libError,
        error: libErrorData,
        refetch: libRefetch,
    } = useGetLibraryCollection()

    const {
        data: localInfiniteData,
        isLoading: locLoading,
        hasNextPage,
        fetchNextPage,
        isFetchingNextPage,
    } = useGetLocalFilesInfinite()

    const localData = useMemo(() => {
        const items = localInfiniteData?.pages.flatMap(p => p.items) || []
        if (!searchQuery) return items
        return items.filter(f => {
            const parseData: any = f.parsedInfo || (f as any).Parsed || (f as any).parsedData || {}
            const title = parseData.title || parseData.Title || (f as any).name || ""
            return title.toLowerCase().includes(searchQuery.toLowerCase())
        })
    }, [localInfiniteData, searchQuery])

    const lists = libraryData?.lists || []

    const currentlyWatching = useMemo(() => {
        const entries = lists.find(l => l.status === "CURRENT")?.entries || []
        if (!searchQuery) return entries
        return entries.filter(e => getTitle(e.media).toLowerCase().includes(searchQuery.toLowerCase()))
    }, [lists, searchQuery])

    const planned = useMemo(() => {
        const entries = lists.find(l => l.status === "PLANNING")?.entries || []
        if (!searchQuery) return entries
        return entries.filter(e => getTitle(e.media).toLowerCase().includes(searchQuery.toLowerCase()))
    }, [lists, searchQuery])

    const completed = useMemo(() => {
        const entries = lists.find(l => l.status === "COMPLETED")?.entries || []
        if (!searchQuery) return entries
        return entries.filter(e => getTitle(e.media).toLowerCase().includes(searchQuery.toLowerCase()))
    }, [lists, searchQuery])

    const renderGrid = (entries: Anime_LibraryCollectionEntry[], emptyMessage: string) => (
        <VirtualizedMediaGrid entries={entries} emptyMessage={emptyMessage} />
    )

    const errorState = libError ? (
        <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", minHeight: "40vh", gap: 20, textAlign: "center",
        }}>
            <div style={{ fontSize: 48, lineHeight: 1 }}>！</div>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: "0.1em", color: "#e8001c" }}>
                CONEXIÓN INTERRUMPIDA
            </p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", maxWidth: 360 }}>
                {(libErrorData as any)?.message || "No se pudo cargar la biblioteca."}
            </p>
            <button className="lib-retry-btn" onClick={() => libRefetch()}>REINTENTAR</button>
        </div>
    ) : null

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Noto+Sans+JP:wght@400;700;900&display=swap');

                /* ── Variables ── */
                :root {
                    --ink: #e8001c;
                    --page: #0a0a0c;
                    --panel: #111114;
                    --border: rgba(255,255,255,0.07);
                    --muted: rgba(255,255,255,0.3);
                    --text: #f0ede8;
                }

                /* ── Page ── */
                .lib-page {
                    flex: 1;
                    width: 100%;
                    min-height: 100vh;
                    background: var(--page);
                    color: var(--text);
                    font-family: 'Noto Sans JP', sans-serif;
                    overflow-y: auto;
                    padding-bottom: 80px;
                }

                /* ── Hero ── */
                .lib-hero {
                    position: relative;
                    overflow: hidden;
                    padding: 72px 56px 44px;
                    border-bottom: 1px solid var(--border);
                }
                @media (max-width: 768px) { .lib-hero { padding: 60px 24px 36px; } }

                .lib-hero-bg {
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(ellipse 60% 100% at 70% 50%, rgba(232,0,28,0.04) 0%, transparent 70%);
                }

                .lib-hero-inner {
                    position: relative;
                    z-index: 1;
                    max-width: 1280px;
                    margin: 0 auto;
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 24px;
                }

                /* Vertical JP text accent */
                .lib-hero-jp {
                    position: absolute;
                    right: 56px;
                    top: 50%;
                    transform: translateY(-50%);
                    writing-mode: vertical-rl;
                    font-family: 'Noto Sans JP', sans-serif;
                    font-weight: 900;
                    font-size: 11px;
                    letter-spacing: 0.3em;
                    color: rgba(255,255,255,0.06);
                    text-transform: uppercase;
                    user-select: none;
                }

                .lib-eyebrow {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 12px;
                }
                .lib-eyebrow-line {
                    width: 28px;
                    height: 2px;
                    background: var(--ink);
                }
                .lib-eyebrow-text {
                    font-size: 10px;
                    font-weight: 700;
                    letter-spacing: 0.3em;
                    text-transform: uppercase;
                    color: var(--ink);
                }

                .lib-title {
                    font-family: 'Bebas Neue', sans-serif;
                    font-size: clamp(52px, 7vw, 96px);
                    line-height: 0.9;
                    letter-spacing: 0.03em;
                    color: var(--text);
                    margin: 0;
                }
                .lib-title-outline {
                    -webkit-text-stroke: 1px rgba(255,255,255,0.15);
                    color: transparent;
                }

                .lib-count-row {
                    display: flex;
                    align-items: center;
                    gap: 24px;
                    margin-top: 16px;
                    flex-wrap: wrap;
                }
                .lib-count-item {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .lib-count-num {
                    font-family: 'Bebas Neue', sans-serif;
                    font-size: 28px;
                    line-height: 1;
                    color: var(--text);
                }
                .lib-count-label {
                    font-size: 9px;
                    font-weight: 700;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                    color: var(--muted);
                }
                .lib-count-divider {
                    width: 1px;
                    height: 32px;
                    background: var(--border);
                }

                /* ── Search ── */
                .lib-search-wrap {
                    position: relative;
                    width: 280px;
                    flex-shrink: 0;
                }
                @media (max-width: 640px) { .lib-search-wrap { width: 100%; } }

                .lib-search-input {
                    width: 100%;
                    padding: 11px 16px 11px 16px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid var(--border);
                    border-bottom: 2px solid rgba(255,255,255,0.12);
                    border-radius: 0;
                    color: var(--text);
                    font-family: 'Noto Sans JP', sans-serif;
                    font-size: 13px;
                    font-weight: 700;
                    outline: none;
                    letter-spacing: 0.02em;
                    transition: border-color 180ms, box-shadow 180ms;
                    box-sizing: border-box;
                }
                .lib-search-input::placeholder {
                    color: rgba(255,255,255,0.2);
                    font-weight: 400;
                }
                .lib-search-input:focus {
                    border-bottom-color: var(--ink);
                    box-shadow: 0 2px 0 0 rgba(232,0,28,0.15);
                    background: rgba(255,255,255,0.06);
                }

                /* ── Controls bar ── */
                .lib-controls {
                    position: sticky;
                    top: 0;
                    z-index: 30;
                    background: rgba(10,10,12,0.92);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border-bottom: 1px solid var(--border);
                }
                .lib-controls-inner {
                    max-width: 1280px;
                    margin: 0 auto;
                    padding: 0 56px;
                    display: flex;
                    align-items: stretch;
                }
                @media (max-width: 768px) { .lib-controls-inner { padding: 0 24px; } }

                /* ── Tabs ── */
                .lib-tab-btn {
                    position: relative;
                    padding: 16px 24px;
                    font-family: 'Bebas Neue', sans-serif;
                    font-size: 15px;
                    letter-spacing: 0.12em;
                    color: rgba(255,255,255,0.3);
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    transition: color 160ms;
                    white-space: nowrap;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .lib-tab-btn:hover { color: rgba(255,255,255,0.7); }
                .lib-tab-btn[data-state="active"] { color: var(--text); }
                .lib-tab-btn[data-state="active"]::after {
                    content: '';
                    position: absolute;
                    bottom: 0; left: 0; right: 0;
                    height: 2px;
                    background: var(--ink);
                }

                .lib-tab-count {
                    font-family: 'Noto Sans JP', sans-serif;
                    font-size: 11px;
                    font-weight: 700;
                    padding: 2px 7px;
                    border-radius: 3px;
                    background: rgba(255,255,255,0.08);
                    color: rgba(255,255,255,0.5);
                }
                .lib-tab-btn[data-state="active"] .lib-tab-count {
                    background: rgba(232,0,28,0.15);
                    color: var(--ink);
                }

                /* ── Grid wrapper ── */
                .lib-grid-wrap {
                    max-width: 1280px;
                    margin: 0 auto;
                    padding: 36px 56px 0;
                }
                @media (max-width: 768px) { .lib-grid-wrap { padding: 24px 24px 0; } }

                /* ── Local files grid ── */
                .lib-local-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                    gap: 16px;
                    padding-bottom: 48px;
                }
                @media (min-width: 768px) {
                    .lib-local-grid { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; }
                }

                /* ── Load more ── */
                .lib-load-more {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 32px 0 48px;
                }
                .lib-load-btn {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 12px 32px;
                    background: transparent;
                    border: 1px solid rgba(255,255,255,0.12);
                    border-bottom: 2px solid rgba(255,255,255,0.2);
                    color: rgba(255,255,255,0.5);
                    font-family: 'Bebas Neue', sans-serif;
                    font-size: 14px;
                    letter-spacing: 0.18em;
                    cursor: pointer;
                    transition: color 160ms, border-color 160ms, background 160ms;
                }
                .lib-load-btn:hover:not(:disabled) {
                    color: var(--text);
                    border-bottom-color: var(--ink);
                    background: rgba(255,255,255,0.02);
                }
                .lib-load-btn:disabled { opacity: 0.4; cursor: not-allowed; }

                /* ── Retry ── */
                .lib-retry-btn {
                    padding: 10px 28px;
                    background: transparent;
                    border: 1px solid var(--ink);
                    color: var(--ink);
                    font-family: 'Bebas Neue', sans-serif;
                    font-size: 14px;
                    letter-spacing: 0.2em;
                    cursor: pointer;
                    transition: background 160ms;
                }
                .lib-retry-btn:hover { background: rgba(232,0,28,0.1); }

                /* ── Loader ── */
                .lib-loader {
                    display: flex;
                    height: 320px;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                }
                .lib-loader-bar {
                    width: 3px;
                    background: var(--ink);
                    border-radius: 2px;
                    animation: lib-bar 1s ease-in-out infinite;
                }
                .lib-loader-bar:nth-child(1) { height: 20px; animation-delay: 0s; }
                .lib-loader-bar:nth-child(2) { height: 36px; animation-delay: 0.15s; }
                .lib-loader-bar:nth-child(3) { height: 48px; animation-delay: 0.3s; }
                .lib-loader-bar:nth-child(4) { height: 36px; animation-delay: 0.45s; }
                .lib-loader-bar:nth-child(5) { height: 20px; animation-delay: 0.6s; }
                @keyframes lib-bar {
                    0%, 100% { opacity: 0.2; transform: scaleY(0.6); }
                    50% { opacity: 1; transform: scaleY(1); }
                }

                /* ── Panel divider ── */
                .lib-panel-divider {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 28px;
                }
                .lib-panel-divider-line {
                    flex: 1;
                    height: 1px;
                    background: var(--border);
                }
                .lib-panel-divider-text {
                    font-size: 9px;
                    font-weight: 700;
                    letter-spacing: 0.3em;
                    text-transform: uppercase;
                    color: rgba(255,255,255,0.12);
                }
            `}</style>

            <div className="lib-page">
                <Tabs defaultValue="current">

                    {/* ── Hero ── */}
                    <div className="lib-hero">
                        <div className="lib-hero-bg" />
                        <SpeedLines opacity={0.035} />
                        <HalftoneDots />

                        <div className="lib-hero-inner">
                            <div>
                                <div className="lib-eyebrow">
                                    <div className="lib-eyebrow-line" />
                                    <span className="lib-eyebrow-text">Colección Personal</span>
                                </div>
                                <h1 className="lib-title">
                                    MI<br />
                                    <span className="lib-title-outline">BIBLIO</span>TECA
                                </h1>
                                <div className="lib-count-row">
                                    <div className="lib-count-item">
                                        <span className="lib-count-num">{currentlyWatching.length}</span>
                                        <span className="lib-count-label">Viendo</span>
                                    </div>
                                    <div className="lib-count-divider" />
                                    <div className="lib-count-item">
                                        <span className="lib-count-num">{planned.length}</span>
                                        <span className="lib-count-label">Planeado</span>
                                    </div>
                                    <div className="lib-count-divider" />
                                    <div className="lib-count-item">
                                        <span className="lib-count-num">{completed.length}</span>
                                        <span className="lib-count-label">Completado</span>
                                    </div>
                                </div>
                            </div>

                            <input
                                className="lib-search-input"
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="BUSCAR..."
                            />
                        </div>

                        <div className="lib-hero-jp">BIBLIOTECA · COLECCIÓN · ANIME</div>
                    </div>

                    {/* ── Tab bar ── */}
                    <div className="lib-controls">
                        <TabsList
                            className="lib-controls-inner"
                            style={{ background: "transparent", height: "auto", padding: 0, borderRadius: 0, gap: 0 }}
                        >
                            <TabsTrigger value="current" className="lib-tab-btn">
                                VIENDO <span className="lib-tab-count">{currentlyWatching.length}</span>
                            </TabsTrigger>
                            <TabsTrigger value="planned" className="lib-tab-btn">
                                PLANEADO <span className="lib-tab-count">{planned.length}</span>
                            </TabsTrigger>
                            <TabsTrigger value="completed" className="lib-tab-btn">
                                COMPLETADO <span className="lib-tab-count">{completed.length}</span>
                            </TabsTrigger>
                            <TabsTrigger value="local" className="lib-tab-btn">
                                ARCHIVOS LOCALES
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* ── Content ── */}
                    <div className="lib-grid-wrap">

                        <TabsContent value="current" className="m-0 mt-8">
                            {libLoading
                                ? <div className="lib-loader"><div className="lib-loader-bar"/><div className="lib-loader-bar"/><div className="lib-loader-bar"/><div className="lib-loader-bar"/><div className="lib-loader-bar"/></div>
                                : libError
                                    ? errorState
                                    : renderGrid(currentlyWatching, "No estás viendo ninguna serie ahora mismo.")}
                        </TabsContent>

                        <TabsContent value="planned" className="m-0 mt-8">
                            {libLoading
                                ? <div className="lib-loader"><div className="lib-loader-bar"/><div className="lib-loader-bar"/><div className="lib-loader-bar"/><div className="lib-loader-bar"/><div className="lib-loader-bar"/></div>
                                : libError
                                    ? errorState
                                    : renderGrid(planned, "No tenés series planeadas para ver.")}
                        </TabsContent>

                        <TabsContent value="completed" className="m-0 mt-8">
                            {libLoading
                                ? <div className="lib-loader"><div className="lib-loader-bar"/><div className="lib-loader-bar"/><div className="lib-loader-bar"/><div className="lib-loader-bar"/><div className="lib-loader-bar"/></div>
                                : libError
                                    ? errorState
                                    : renderGrid(completed, "Aún no completaste ninguna serie.")}
                        </TabsContent>

                        <TabsContent value="local" className="m-0 mt-8">
                            {locLoading ? (
                                <div className="lib-loader"><div className="lib-loader-bar"/><div className="lib-loader-bar"/><div className="lib-loader-bar"/><div className="lib-loader-bar"/><div className="lib-loader-bar"/></div>
                            ) : !localData.length ? (
                                <EmptyState
                                    title="Sin archivos locales"
                                    message="Configurá una carpeta en Ajustes y volvé a escanear."
                                />
                            ) : (
                                <>
                                    <div className="lib-local-grid">
                                        {localData.map((file: Anime_LocalFile, idx: number) => {
                                            const parseData: any = file.parsedInfo || (file as any).Parsed || (file as any).parsedData || {}
                                            return (
                                                <div key={file.path || `local-${idx}`}>
                                                    <MediaCard
                                                        title={parseData.title || parseData.Title || (file as any).name || "Archivo genérico"}
                                                        artwork="https://placehold.co/220x330/111114/f0ede8?text=LOCAL"
                                                        badge={parseData.resolution || parseData.Resolution || "LOCAL"}
                                                        aspect="poster"
                                                        className="w-full"
                                                    />
                                                </div>
                                            )
                                        })}
                                    </div>
                                    {hasNextPage && (
                                        <div className="lib-load-more">
                                            <button
                                                className="lib-load-btn"
                                                onClick={() => fetchNextPage()}
                                                disabled={isFetchingNextPage}
                                            >
                                                {isFetchingNextPage
                                                    ? "CARGANDO..."
                                                    : "CARGAR MÁS"}
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </>
    )
}