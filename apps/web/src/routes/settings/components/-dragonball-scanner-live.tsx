import { useState, useMemo } from "react"
import { m } from "framer-motion"
import { Check, CheckCircle2, Film, X } from "lucide-react"
import { useFormContext } from "react-hook-form"
import { useScanLocalFiles } from "@/api/hooks/scan.hooks"
import { useGetAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { useDriveScanView, useLocalScanView, type ScanLiveView } from "@/components/scan-live/views"
import { ScanStatusCard } from "@/components/scan-live/scan-status-card"
import { ScanFileList } from "@/components/scan-live/scan-file-list"
import { useDriveStatus, useTriggerDriveScan } from "@/lib/drive-status"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { cn } from "@/components/ui/core/styling"
import { Button, IconButton } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { useCardMotionProps } from "@/components/ui/kinetics/hooks"
import type { SettingsFormValues } from "../index"

import {
    DRAGON_BALL_SCANNER_SERIES as DRAGON_BALL_SERIES,
    DRAGON_BALL_SCANNER_MOVIES,
    type DBFranchiseSeries,
} from "@/lib/config/dragonball_scanner_series"

const OFFICIAL_SERIES_COUNT = DRAGON_BALL_SERIES.filter(s => s.type === "SERIES").length

/**
 * Escáner de biblioteca unificado: dispara escaneos de disco local y de Google
 * Drive, muestra la actividad en vivo de ambos y la cobertura del catálogo.
 */
export function DragonBallScannerLive() {
    const { mutate: scanLibrary, isPending } = useScanLocalFiles()
    const { data: collection } = useGetLibraryCollection()
    const [selectedSeries, setSelectedSeries] = useState<DBFranchiseSeries | null>(null)
    // Abrir y cerrar van aparte de la serie: al cerrar, el Modal la sigue mostrando mientras corre su salida.
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [modalTab, setModalTab] = useState<"sagas" | "movies">("sagas")
    const openDetail = (series: DBFranchiseSeries) => {
        setSelectedSeries(series)
        setModalTab(series.type === "MOVIES" ? "movies" : "sagas")
        setIsDetailOpen(true)
    }
    // Hover y tap de las portadas según el tier: en subtle y off no se mueven.
    const cardMotion = useCardMotionProps()
    const { data: driveStatus } = useDriveStatus()
    const { mutate: scanDrive, isPending: isDrivePending } = useTriggerDriveScan()

    // El disco local solo se puede escanear si está conectado y hay carpetas cargadas.
    const { watch } = useFormContext<SettingsFormValues>()
    const localDisconnected = Boolean(watch("library.disableLocalScanning"))
    const localPathCount = (watch("library.seriesPaths")?.length ?? 0) + (watch("library.moviePaths")?.length ?? 0)
    const canScanLocal = !localDisconnected && localPathCount > 0
    const canScanDrive = Boolean(driveStatus?.connected)
    const unmatchedCount = collection?.unmatchedLocalFiles?.length ?? 0

    // Episodios reales de la serie abierta en el detalle: el estado de cada saga
    // sale de los números presentes, no del total de archivos.
    const { data: selectedEntry, isLoading: isEntryLoading } = useGetAnimeEntry(
        selectedSeries?.type === "SERIES" ? selectedSeries.tmdbId : null
    )
    const presentEpisodes = useMemo(() => {
        const set = new Set<number>()
        for (const lf of selectedEntry?.localFiles ?? []) {
            const eps = lf.metadata?.episodes?.length ? lf.metadata.episodes : [lf.metadata?.episode ?? 0]
            for (const ep of eps) if (ep > 0) set.add(ep)
        }
        return set
    }, [selectedEntry])

    // Un solo botón escanea todas las fuentes disponibles (Drive y/o disco local).
    const localView = useLocalScanView()
    const driveView = useDriveScanView()
    const isLocalScanning = localView?.state === "running" || isPending
    const isDriveScanning = driveView?.state === "running" || isDrivePending
    const isScanning = isLocalScanning || isDriveScanning
    const canScan = canScanDrive || canScanLocal
    const sourcesLabel = canScanDrive && canScanLocal ? "Google Drive y disco local"
        : canScanDrive ? "Google Drive"
        : canScanLocal ? "Disco local"
        : null

    // Escaneos de esta sesión: el que corre primero, después el más reciente.
    const scanViews = [localView, driveView]
        .filter((v): v is ScanLiveView => v !== null)
        .sort((a, b) =>
            Number(b.state === "running") - Number(a.state === "running") ||
            (b.finishedAt ?? 0) - (a.finishedAt ?? 0))

    const scanAll = () => {
        if (canScanDrive && !isDriveScanning) scanDrive()
        if (canScanLocal && !isLocalScanning) scanLibrary({ mode: "fast", skipLockedFiles: false, skipIgnoredFiles: false })
    }

    // Map collection entries by TMDB ID and track movies
    const { collectionMap, movieDetailsMap, detectedMovieIds, totalMoviesDetected } = useMemo(() => {
        const map = new Map<number, { count: number; poster?: string; banner?: string; title?: string }>()
        const movieMap = new Map<number, { title: string; year?: number; poster?: string; banner?: string }>()
        const detectedIds = new Set<number>()

        if (!collection?.lists) return { collectionMap: map, movieDetailsMap: movieMap, detectedMovieIds: detectedIds, totalMoviesDetected: 0 }

        let movieCount = 0

        for (const list of collection.lists) {
            if (!list.entries) continue
            for (const entry of list.entries) {
                const rawId = entry.media?.tmdbId || entry.mediaId
                const count = entry.libraryData?.mainFileCount || 0
                const poster = entry.media?.posterImage
                const banner = entry.media?.bannerImage
                const title = entry.media?.titleSpanish || entry.media?.titleEnglish || entry.media?.titleRomaji || "Sin título"
                const format = entry.media?.format
                // El offset TMDB (+1M) NO indica película: las series también lo usan.
                const isMovie = format === "MOVIE" || format === "SPECIAL" || format === "OVA" || entry.media?.type === "MOVIE"

                const normalizedTmdbId = rawId ? (rawId >= 1000000 ? rawId - 1000000 : rawId) : 0

                if (isMovie && normalizedTmdbId > 0) {
                    if (!detectedIds.has(normalizedTmdbId)) {
                        movieCount++
                    }
                    detectedIds.add(normalizedTmdbId)
                    movieMap.set(normalizedTmdbId, {
                        title,
                        year: entry.media?.year,
                        poster,
                        banner,
                    })
                }

                if (rawId) {
                    const existing = map.get(rawId)
                    map.set(rawId, {
                        count: (existing?.count || 0) + count,
                        poster: poster || existing?.poster,
                        banner: banner || existing?.banner,
                        title: title || existing?.title,
                    })
                    if (normalizedTmdbId > 0 && normalizedTmdbId !== rawId) {
                        map.set(normalizedTmdbId, {
                            count: (existing?.count || 0) + count,
                            poster: poster || existing?.poster,
                            banner: banner || existing?.banner,
                            title: title || existing?.title,
                        })
                    }
                }
            }
        }

        return { collectionMap: map, movieDetailsMap: movieMap, detectedMovieIds: detectedIds, totalMoviesDetected: movieCount }
    }, [collection])

    // Compute metrics
    const metrics = useMemo(() => {
        let totalDetectedEps = 0
        let totalOfficialEps = 0
        let seriesFoundCount = 0

        for (const series of DRAGON_BALL_SERIES) {
            if (series.type === "MOVIES") continue
            const entry = collectionMap.get(series.tmdbId)
            const count = entry?.count || 0
            totalDetectedEps += count
            totalOfficialEps += series.totalEpisodes
            if (count > 0) seriesFoundCount++
        }

        const matchRatio = totalOfficialEps > 0 ? Math.min(100, Math.round((totalDetectedEps / totalOfficialEps) * 100)) : 0

        const catalogMoviesDetected = DRAGON_BALL_SCANNER_MOVIES.filter(m => detectedMovieIds.has(m.tmdbId)).length

        return {
            totalDetectedEps,
            totalOfficialEps,
            seriesFoundCount,
            totalMoviesDetected,
            catalogMoviesDetected,
            matchRatio,
        }
    }, [collectionMap, detectedMovieIds, totalMoviesDetected])

    return (
        <div className="space-y-5 animate-in fade-in duration-base">
            {/* ── 1. ESTADO + ACCIÓN ÚNICA + COBERTURA ────────────────────────────── */}
            <ScanStatusCard
                view={scanViews[0] ?? null}
                isScanning={isScanning}
                canScan={canScan}
                onScan={scanAll}
                sourcesLabel={sourcesLabel}
                stats={[
                    { label: "Episodios", value: metrics.totalDetectedEps, total: metrics.totalOfficialEps },
                    { label: "Películas", value: metrics.catalogMoviesDetected, total: DRAGON_BALL_SCANNER_MOVIES.length },
                    { label: "Series", value: metrics.seriesFoundCount, total: OFFICIAL_SERIES_COUNT },
                    unmatchedCount > 0
                        ? { label: "Sin vincular", value: unmatchedCount, tone: "warn" }
                        : { label: "Sin vincular", value: "Ninguno", tone: "ok" },
                ]}
                secondaryAction={canScanLocal ? {
                    label: "Escaneo profundo del disco",
                    title: "Vuelve a analizar todo el disco local ignorando la caché",
                    onClick: () => scanLibrary({ mode: "deep", skipLockedFiles: false, skipIgnoredFiles: false }),
                    disabled: isLocalScanning,
                } : undefined}
            />

            {/* ── 2. ARCHIVOS ESCANEADOS EN VIVO ──────────────────────────────────── */}
            <ScanFileList views={scanViews} />

            {/* ── 3. COLECCIÓN: COBERTURA POR SERIE ───────────────────────────────── */}
            <div className="space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-xs font-bold text-on-surface">Colección</h3>
                    <p className="text-xs text-label-2">Haz clic en una portada para ver sagas y películas</p>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
                    {DRAGON_BALL_SERIES.map((series) => {
                        const colData = collectionMap.get(series.tmdbId)
                        const seriesMovies = series.movies || []
                        const detectedMoviesInSeries = seriesMovies.filter(m => detectedMovieIds.has(m.tmdbId)).length
                        const count = series.type === "MOVIES" ? detectedMoviesInSeries : colData?.count || 0
                        const poster = colData?.poster || series.officialPoster
                        const isComplete = count >= series.totalEpisodes
                        const isPartial = count > 0 && !isComplete
                        const percentage = Math.min(100, Math.round((count / series.totalEpisodes) * 100))

                        return (
                            <m.button
                                type="button"
                                key={series.id}
                                {...cardMotion}
                                aria-label={`Ver detalle de ${series.title}`}
                                onClick={() => openDetail(series)}
                                className={cn(
                                    "group relative flex flex-col text-left rounded-xl overflow-hidden cursor-pointer border border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent transition-[border-color,box-shadow,opacity] duration-fast ease-smooth-out bg-[var(--neutral-elev-2)]",
                                    (count > 0 || detectedMoviesInSeries > 0)
                                        ? "border-[var(--neutral-separator)] [@media(hover:hover)_and_(pointer:fine)]:hover:border-brand-accent/60 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-elevation-3"
                                        : "border-[var(--neutral-separator)] opacity-75 [@media(hover:hover)_and_(pointer:fine)]:hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:hover:border-[var(--neutral-separator)]"
                                )}
                            >
                                {/* Poster Image Container (2:3 Aspect Ratio) */}
                                <div className="relative aspect-[2/3] w-full overflow-hidden bg-surface-container-lowest">
                                    <img
                                        src={poster}
                                        alt={series.title}
                                        onError={(e) => {
                                            if (e.currentTarget.src !== series.officialPoster) {
                                                e.currentTarget.src = series.officialPoster
                                            }
                                        }}
                                        className={cn(
                                            "w-full h-full object-cover transition-transform duration-slow ease-smooth-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105",
                                            count === 0 && detectedMoviesInSeries === 0 && "grayscale-[40%] opacity-80"
                                        )}
                                        loading="lazy"
                                    />

                                    {/* Gradient overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/20 to-transparent" />

                                    {/* Estado: completa o porcentaje */}
                                    {(isComplete || isPartial) && (
                                        <span
                                            className={cn(
                                                "absolute top-2 right-2 z-10 inline-flex items-center justify-center rounded-full font-bold font-mono shadow-elevation-1",
                                                isComplete
                                                    ? "size-5 bg-status-success text-black"
                                                    : "px-1.5 py-0.5 text-xs bg-[var(--neutral-elev-2)] text-status-warning border border-status-warning/40 shadow-[shadow:var(--double-bezel-ring)]",
                                            )}
                                            aria-label={isComplete ? "Completa" : `${percentage}% detectado`}
                                        >
                                            {isComplete ? <Check className="size-3" strokeWidth={3} /> : `${percentage}%`}
                                        </span>
                                    )}

                                    {/* Bottom Info on Poster */}
                                    <div className="absolute bottom-2 left-2 right-2 z-10">
                                        <h3 className="text-xs font-bold text-label-1 leading-tight line-clamp-1 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-brand-accent-readable transition-colors">
                                            {series.title}
                                        </h3>
                                        <p className="text-xs font-mono text-label-2 mt-0.5 truncate">
                                            {series.subtitle}
                                        </p>
                                    </div>
                                </div>

                                {/* Conteo + barra (+ películas de la serie) */}
                                <div className="px-2.5 py-2 border-t border-[var(--neutral-separator)] space-y-1.5">
                                    <div className="flex items-center justify-between gap-2 text-xs font-mono">
                                        <span className={cn("font-bold tabular-nums whitespace-nowrap", count > 0 ? "text-on-surface" : "text-on-surface-variant/50")}
                                            title={series.type === "MOVIES" ? "Películas detectadas" : "Episodios detectados"}>
                                            {count}<span className="text-on-surface-variant/45 font-normal">/{series.totalEpisodes}</span>
                                        </span>
                                        {seriesMovies.length > 0 && series.type !== "MOVIES" && (
                                            <span
                                                className={cn(
                                                    "inline-flex items-center gap-0.5 tabular-nums shrink-0",
                                                    detectedMoviesInSeries === seriesMovies.length ? "text-status-success/90" : "text-label-3",
                                                )}
                                                title={`${detectedMoviesInSeries} de ${seriesMovies.length} películas`}
                                            >
                                                <Film className="size-3" />
                                                {detectedMoviesInSeries}/{seriesMovies.length}
                                            </span>
                                        )}
                                    </div>

                                    {/* Progress Bar: escala desde la izquierda (transform), no anima width. */}
                                    <div className="w-full h-1 rounded-full bg-[var(--neutral-elev-3)] overflow-hidden">
                                        <div
                                            className={cn(
                                                "w-full h-full origin-left transition-[transform,background-color] duration-slow ease-smooth-out rounded-full",
                                                isComplete
                                                    ? "bg-status-success"
                                                    : count > 0
                                                    ? "bg-brand-accent"
                                                    : "bg-transparent"
                                            )}
                                            style={{ transform: `scaleX(${Math.max(count > 0 ? 4 : 0, percentage) / 100})` }}
                                        />
                                    </div>
                                </div>
                            </m.button>
                        )
                    })}
                </div>
            </div>

            {/* ── 4. MODAL VISUAL DE SAGAS Y PELÍCULAS ───────────────────────────── */}
            {/* Modal porta a body (el scroller de Ajustes usa transform y rompe position: fixed)
                y trae la salida del velo y del diálogo, Escape, clic afuera y el foco. */}
            <Modal
                open={isDetailOpen}
                onOpenChange={setIsDetailOpen}
                srTitle={selectedSeries ? `Detalle del escaneo: ${selectedSeries.title}` : undefined}
                hideCloseButton
                contentClass="max-w-xl max-h-[85vh] p-0 gap-0 flex flex-col overflow-hidden bg-surface-container border border-[var(--neutral-separator)] shadow-elevation-5"
            >
                {selectedSeries && (
                    <>
                            {/* Header with Official Poster Banner */}
                            <div className="relative p-5 bg-[var(--neutral-elev-2)] border-b border-[var(--neutral-separator)] flex items-start justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <img
                                        src={selectedSeries.officialPoster}
                                        alt={selectedSeries.title}
                                        className="w-14 h-20 object-cover rounded-xl shadow-elevation-2 border border-[var(--neutral-separator)] shrink-0"
                                    />
                                    <div>
                                        <span className="text-xs font-bold text-brand-accent-readable block">
                                            Detalle del escaneo
                                        </span>
                                        <h3 className="text-lg font-bold text-label-1 tracking-tight">
                                            {selectedSeries.title}
                                        </h3>
                                        <p className="text-xs text-label-2 mt-0.5">
                                            {selectedSeries.subtitle} • {selectedSeries.totalEpisodes} {selectedSeries.type === "MOVIES" ? "películas" : "episodios"}
                                            {selectedSeries.type === "SERIES" && selectedSeries.movies && selectedSeries.movies.length > 0 && (
                                                <span> • {selectedSeries.movies.length} películas asociadas</span>
                                            )}
                                        </p>
                                    </div>
                                </div>

                                <IconButton
                                    intent="ghost"
                                    size="md"
                                    onClick={() => setIsDetailOpen(false)}
                                    aria-label="Cerrar detalle"
                                    icon={<X className="w-5 h-5" />}
                                />
                            </div>

                            {/* Tab Switcher (Sagas vs Movies) if series has both */}
                            {selectedSeries.type === "SERIES" && selectedSeries.sagas.length > 0 && selectedSeries.movies && selectedSeries.movies.length > 0 && (
                                <div className="flex items-center gap-2 px-5 pt-3 pb-1 border-b border-[var(--neutral-separator)] bg-surface-container-low">
                                    <Button
                                        intent={modalTab === "sagas" ? "secondary" : "ghost"}
                                        size="xs"
                                        aria-pressed={modalTab === "sagas"}
                                        onClick={() => setModalTab("sagas")}
                                    >
                                        Sagas y episodios ({presentEpisodes.size}/{selectedSeries.totalEpisodes})
                                    </Button>
                                    <Button
                                        intent={modalTab === "movies" ? "secondary" : "ghost"}
                                        size="xs"
                                        aria-pressed={modalTab === "movies"}
                                        onClick={() => setModalTab("movies")}
                                    >
                                        Películas ({selectedSeries.movies.filter(m => detectedMovieIds.has(m.tmdbId)).length}/{selectedSeries.movies.length})
                                    </Button>
                                </div>
                            )}

                            {/* Content List: Sagas or Movies */}
                            <div className="p-5 overflow-y-auto space-y-2.5 max-h-[60vh]">
                                {modalTab === "sagas" && selectedSeries.type === "SERIES" && isEntryLoading ? (
                                    <p className="text-center text-label-2 py-8 text-xs">
                                        Cargando episodios detectados…
                                    </p>
                                ) : modalTab === "sagas" && selectedSeries.type === "SERIES" && selectedSeries.sagas.length > 0 ? (
                                    selectedSeries.sagas.map((saga) => {
                                        const sagaTotal = saga.endEp - saga.startEp + 1
                                        let sagaFound = 0
                                        for (let ep = saga.startEp; ep <= saga.endEp; ep++) {
                                            if (presentEpisodes.has(ep)) sagaFound++
                                        }
                                        const sagaCompleted = sagaFound >= sagaTotal

                                        return (
                                            <div
                                                key={saga.id}
                                                className="flex items-center justify-between p-3 rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-ring)] hover:border-[var(--neutral-separator)] transition-[border-color,background-color] duration-fast ease-smooth-out gap-4 overflow-hidden"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    {/* Saga Artwork Thumbnail */}
                                                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-surface-container-lowest border border-[var(--neutral-separator)] shrink-0">
                                                        <img
                                                            src={saga.image}
                                                            alt={saga.name}
                                                            onError={(e) => {
                                                                e.currentTarget.src = selectedSeries.officialPoster
                                                            }}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>

                                                    <div className="min-w-0">
                                                        <h5 className="text-xs font-bold text-label-1 truncate">
                                                            {saga.name}
                                                        </h5>
                                                        <span className="text-xs text-label-2">
                                                            Episodios {saga.startEp}–{saga.endEp} · {sagaFound} de {sagaTotal}
                                                        </span>
                                                    </div>
                                                </div>

                                                <span
                                                    className={cn(
                                                        "px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0",
                                                        sagaCompleted
                                                            ? "bg-status-success/15 text-status-success border border-status-success/30"
                                                            : sagaFound > 0
                                                            ? "bg-status-warning/15 text-status-warning border border-status-warning/30"
                                                            : "bg-[var(--neutral-elev-3)] text-label-3"
                                                    )}
                                                >
                                                    {sagaCompleted ? "Completa" : sagaFound > 0 ? "Incompleta" : "Pendiente"}
                                                </span>
                                            </div>
                                        )
                                    })
                                ) : (modalTab === "movies" || selectedSeries.type === "MOVIES") && selectedSeries.movies && selectedSeries.movies.length > 0 ? (
                                    selectedSeries.movies.map((movie) => {
                                        const isDetected = detectedMovieIds.has(movie.tmdbId)
                                        const movieDetails = movieDetailsMap.get(movie.tmdbId)

                                        return (
                                            <div
                                                key={movie.id}
                                                className={cn(
                                                    "flex items-center justify-between p-3 rounded-xl border border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-ring)] transition-[border-color,background-color] duration-fast ease-smooth-out gap-4 overflow-hidden",
                                                    isDetected
                                                        ? "bg-[var(--neutral-elev-2)] border-[var(--neutral-separator)]"
                                                        : "bg-[var(--neutral-elev-2)] border-[var(--neutral-separator)] opacity-60"
                                                )}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-10 h-14 rounded-lg overflow-hidden bg-surface-container-lowest border border-[var(--neutral-separator)] shrink-0">
                                                        <img
                                                            src={movieDetails?.poster || selectedSeries.officialPoster}
                                                            alt={movie.title}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold px-1.5 py-px rounded bg-[var(--neutral-elev-3)] text-on-surface-variant">
                                                                {movie.type}
                                                            </span>
                                                            <span className="text-xs font-mono text-label-2">
                                                                {movie.year}
                                                            </span>
                                                        </div>
                                                        <h5 className="text-xs font-bold text-label-1 truncate mt-0.5">
                                                            {movie.title}
                                                        </h5>
                                                    </div>
                                                </div>

                                                <span
                                                    className={cn(
                                                        "px-2.5 py-1 rounded-full text-xs font-bold shrink-0 flex items-center gap-1",
                                                        isDetected
                                                            ? "bg-status-success/20 text-status-success border border-status-success/40"
                                                            : "bg-surface-container-lowest text-label-3 border border-[var(--neutral-separator)]"
                                                    )}
                                                >
                                                    {isDetected ? (
                                                        <>
                                                            <CheckCircle2 className="w-3 h-3 text-status-success" />
                                                            Detectada
                                                        </>
                                                    ) : (
                                                        "No detectada"
                                                    )}
                                                </span>
                                            </div>
                                        )
                                    })
                                ) : (
                                    <p className="text-center text-label-2 py-8 text-xs">
                                        No hay información disponible para esta sección.
                                    </p>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="p-3.5 bg-[var(--neutral-elev-2)] border-t border-[var(--neutral-separator)] flex items-center justify-end">
                                <Button intent="secondary" size="sm" onClick={() => setIsDetailOpen(false)}>
                                    Cerrar
                                </Button>
                            </div>
                    </>
                )}
            </Modal>
        </div>
    )
}
