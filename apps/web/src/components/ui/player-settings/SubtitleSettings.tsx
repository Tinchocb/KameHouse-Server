import { useEffect, useState } from "react"
import { cn } from "@/components/ui/core/styling"
import { Button, IconButton } from "@/components/ui/button"
import { IconUiMinus, IconUiPlus, IconUiSpinner } from "@/components/ui/icons";
import { SelectionMark } from "@/components/ui/kinetics/selection-mark"
import { useSubtitleLoadStore } from "@/components/video/subtitle-load-store"
import type { SubtitleTrack } from "../track-types"
import { subtitleTrackName } from "./track-labels"

/** Los subtítulos externos (archivos sueltos junto al video) usan índices desde 1000. */
const EXTERNAL_TRACK_BASE = 1000

interface SubtitleSettingsProps {
    subtitleTracks: SubtitleTrack[]
    activeSubtitleIndex: number | null
    onSelectSubtitle: (track: SubtitleTrack | null, opts?: { auto?: boolean }) => void
    subtitleSize?: number
    onSubtitleSizeChange?: (size: number) => void
    getFriendlyLanguage: (lang: string) => string
}

export function SubtitleSettings({
    subtitleTracks,
    activeSubtitleIndex,
    onSelectSubtitle,
    subtitleSize = 100,
    onSubtitleSizeChange,
    getFriendlyLanguage,
}: SubtitleSettingsProps) {
    const source = useSubtitleLoadStore((st) => st.source)
    const phase = useSubtitleLoadStore((st) => st.phase)
    const loadingIndex = useSubtitleLoadStore((st) => st.trackIndex)
    const loadMessage = useSubtitleLoadStore((st) => st.message)
    const drive = useSubtitleLoadStore((st) => st.drive)
    const driveActions = useSubtitleLoadStore((st) => st.driveActions)

    const windowInfo = useSubtitleLoadStore((st) => st.windowInfo)
    // Diagnóstico de la lectura por franjas: en desarrollo siempre; en producción con Ctrl+Shift+D.
    const [showDiag, setShowDiag] = useState<boolean>(!!import.meta.env.DEV)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d") setShowDiag((v) => !v)
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [])
    const diag = windowInfo?.diag ?? null

    const pendingCount = subtitleTracks.filter((t) => t.needsExtraction).length
    const driveBusy = drive.state === "queued" || drive.state === "running"
    const isEmpty = subtitleTracks.length === 0

    return (
        <div className="flex flex-col">
            {/* Subtitle size control */}
            {onSubtitleSizeChange && (
                <div className="px-3 py-2 border-b border-[var(--neutral-separator)] mb-1">
                    <div className="text-xs font-semibold text-label-2 mb-3">Tamaño de subtítulos</div>
                    <div className="flex items-center justify-between gap-3">
                        <IconButton
                            intent="secondary"
                            size="xs"
                            onClick={() => onSubtitleSizeChange(Math.max(50, subtitleSize - 10))}
                            disabled={subtitleSize <= 50}
                            aria-label="Reducir tamaño de subtítulos"
                            icon={<IconUiMinus className="w-4 h-4" />}
                        />
                        <div className="flex-1 flex flex-col items-center gap-1.5">
                            <span className="text-sm font-bold text-label-1 tabular-nums">{subtitleSize}%</span>
                            <div className="w-full h-1.5 bg-[var(--neutral-elev-3)] rounded-full relative overflow-hidden">
                                {/* scaleX en vez de width: el relleno avanza por el compositor, sin recalcular layout */}
                                <div
                                    className="absolute inset-y-0 left-0 w-full origin-left bg-[var(--selected-bg)] rounded-full transition-transform duration-quick motion-reduce:transition-none"
                                    style={{ transform: `scaleX(${(subtitleSize - 50) / 150})` }}
                                />
                                <input
                                    type="range" min={50} max={200} step={10} aria-label="Tamaño de subtítulos"
                                    value={subtitleSize}
                                    onChange={(e) => onSubtitleSizeChange(Number(e.target.value))}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                            </div>
                        </div>
                        <IconButton
                            intent="secondary"
                            size="xs"
                            onClick={() => onSubtitleSizeChange(Math.min(200, subtitleSize + 10))}
                            disabled={subtitleSize >= 200}
                            aria-label="Aumentar tamaño de subtítulos"
                            icon={<IconUiPlus className="w-4 h-4" />}
                        />
                    </div>
                </div>
            )}

            {/* Subtítulos embebidos de un archivo de Drive: extraerlos requiere leer el archivo entero */}
            {pendingCount > 0 && driveActions && (
                <div className="mx-1 mb-1 rounded-2xl bg-[var(--neutral-elev-2)] px-3 py-2.5 flex flex-col gap-2" role="group" aria-label="Extraer subtítulos de Google Drive">
                    <p className="text-xs text-on-surface">
                        {pendingCount === 1
                            ? "Este video trae 1 pista de subtítulos incrustada."
                            : `Este video trae ${pendingCount} pistas de subtítulos incrustadas.`}
                    </p>
                    {!driveBusy && (
                        <p className="text-xs text-label-2">
                            Para usarlas hay que descargar el archivo completo desde Google Drive una sola vez (puede tardar unos minutos). Después quedan guardadas.
                        </p>
                    )}
                    {driveBusy ? (
                        <div className="flex flex-col gap-1.5" role="status" aria-live="polite">
                            <div className="flex items-center justify-between text-xs text-on-surface">
                                <span className="flex items-center gap-1.5">
                                    <IconUiSpinner className="w-3.5 h-3.5 animate-spin" />
                                    {drive.state === "queued" ? "En espera…" : "Extrayendo subtítulos…"}
                                </span>
                                <span className="tabular-nums text-label-2">{drive.state === "running" ? `${Math.round(drive.percent)}%` : ""}</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-[var(--neutral-elev-3)] overflow-hidden">
                                <div
                                    className="h-full w-full origin-left rounded-full bg-[var(--selected-bg)] transition-transform duration-base motion-reduce:transition-none"
                                    style={{ transform: `scaleX(${(drive.state === "running" ? Math.max(3, drive.percent) : 3) / 100})` }}
                                />
                            </div>
                            <Button type="button" intent="ghost" size="xs" className="self-start" onClick={driveActions.cancel}>
                                Cancelar
                            </Button>
                        </div>
                    ) : (
                        <>
                            {drive.state === "error" && drive.error && (
                                <p className="text-xs text-[color:color-mix(in_srgb,var(--status-error),white_35%)]" role="alert">{drive.error}</p>
                            )}
                            <Button type="button" intent="secondary" size="sm" className="self-start" onClick={driveActions.extract}>
                                {drive.state === "error" ? "Reintentar extracción" : "Extraer subtítulos"}
                            </Button>
                        </>
                    )}
                </div>
            )}

            {/* Track list */}
            <button
                type="button"
                onClick={() => onSelectSubtitle(null)}
                aria-pressed={activeSubtitleIndex === null}
                className={cn(
                    "w-full flex items-center justify-between min-h-[44px] py-2 px-3 rounded-full transition-[background-color,color,transform] duration-fast ease-out-strong motion-safe:active:scale-[0.97] cursor-pointer group text-left relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
                    activeSubtitleIndex === null ? "bg-[var(--neutral-elev-3)] text-label-1" : "text-label-2 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-label-1"
                )}
            >
                <span className={cn(
                    "text-xs font-bold transition-colors duration-base",
                    activeSubtitleIndex === null ? "text-brand-accent-readable" : "text-on-surface [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-on-surface"
                )}>
                    Desactivado
                </span>
                <SelectionMark selected={activeSubtitleIndex === null} />
            </button>

            {isEmpty && (
                <p className="px-3 py-2 text-xs text-label-2" role="status">
                    {source === "drive"
                        ? "Este video no tiene subtítulos: no trae pistas incrustadas ni hay un archivo .srt o .ass con el mismo nombre en su carpeta de Drive."
                        : "Este video no tiene subtítulos: no trae pistas incrustadas ni hay un archivo .srt o .ass con el mismo nombre junto a él."}
                </p>
            )}

            {windowInfo?.error && (
                <p role="alert" className="px-3 py-2 text-xs text-[color:color-mix(in_srgb,var(--status-error),white_35%)]">
                    {windowInfo.error}
                </p>
            )}

            {showDiag && windowInfo && (
                <div data-testid="subtitle-window-diag" className="mx-3 my-2 rounded-lg bg-[var(--neutral-elev-3)] p-2 font-mono text-2xs leading-snug text-label-2">
                    <div>estado: {windowInfo.state} · versión {windowInfo.version}</div>
                    <div>cubierto: {windowInfo.coveredFrom < 0 ? "—" : `${windowInfo.coveredFrom.toFixed(0)}–${windowInfo.coveredUntil > 1e9 ? "fin" : windowInfo.coveredUntil.toFixed(0)} s`}</div>
                    {diag && (
                        <>
                            <div>posición {diag.positionSec.toFixed(0)} s · lee {diag.fromSec.toFixed(0)}–{diag.toSec.toFixed(0)} s (relleno {diag.backfillSec.toFixed(0)} s)</div>
                            <div>clusters {diag.clusters} · lecturas {diag.reads} ({diag.avgReadMs} ms) · {(diag.parsedBytes / 1048576).toFixed(0)}/{(diag.fileBytes / 1048576).toFixed(0)} MiB</div>
                            <div>cartel más largo {diag.longestEventSec.toFixed(0)} s · fallas {diag.failures} · aperturas {diag.opens} · cupos {diag.slotsBusy}</div>
                            {diag.lastError && <div>último error: {diag.lastErrorKind}{diag.lastErrorStatus ? ` (HTTP ${diag.lastErrorStatus})` : ""}</div>}
                            {diag.tracks.map((t) => (
                                <div key={t.index}>pista {t.index}: {t.codec} {t.language ?? ""} · {t.supported ? `${t.events} eventos` : "no se lee"}</div>
                            ))}
                        </>
                    )}
                </div>
            )}

            {subtitleTracks.map((track, position) => {
                const isActive = track.index === activeSubtitleIndex
                const isPending = !!track.needsExtraction
                const isCurrentLoad = isActive && loadingIndex === track.index
                const isLoadingThis = isCurrentLoad && (phase === "loading" || phase === "extracting")
                const hasError = isCurrentLoad && phase === "error"
                const isExternal = track.index >= EXTERNAL_TRACK_BASE
                const subLabel = hasError
                    ? loadMessage || "No se pudo cargar el subtítulo."
                    : isLoadingThis
                        ? (phase === "extracting" ? "Extrayendo… puede tardar un poco" : "Cargando…")
                        : isPending
                            ? "Incrustado · extráelo para usarlo"
                            : [isExternal ? "Archivo externo" : undefined, track.codec?.toUpperCase(), track.forced ? "Forzado" : undefined].filter(Boolean).join(" · ")
                return (
                    <button
                        type="button"
                        key={track.index}
                        onClick={() => onSelectSubtitle(track)}
                        aria-pressed={isActive}
                        disabled={isPending}
                        aria-busy={isLoadingThis}
                        className={cn(
                            "w-full flex items-center justify-between min-h-[44px] py-2 px-3 rounded-full transition-[background-color,color,transform] duration-fast ease-out-strong motion-safe:active:scale-[0.97] cursor-pointer group text-left relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
                            isPending && "opacity-60 cursor-not-allowed motion-safe:active:scale-100",
                            isActive ? "bg-[var(--neutral-elev-3)] text-label-1" : "text-label-2 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-label-1"
                        )}
                    >
                        <div className="flex flex-col transition-transform duration-base ease-out">
                            <span className={cn(
                                "text-xs font-bold leading-none transition-colors duration-base",
                                isActive ? "text-brand-accent-readable" : "text-on-surface [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-on-surface"
                            )}>
                                {subtitleTrackName(track, position, getFriendlyLanguage)}
                            </span>
                            <span
                                className={cn(
                                    "text-xs mt-0.5 transition-colors duration-base",
                                    hasError ? "text-[color:color-mix(in_srgb,var(--status-error),white_35%)]" : isActive ? "text-label-2" : "text-label-2 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-on-surface"
                                )}
                                role={hasError ? "alert" : undefined}
                            >
                                {subLabel}
                            </span>
                        </div>
                        <SelectionMark selected={isActive && !hasError} pending={isLoadingThis} />
                    </button>
                )
            })}
        </div>
    )
}
