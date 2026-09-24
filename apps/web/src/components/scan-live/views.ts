import type React from "react"
import { useMemo } from "react"
import { useShallow } from "zustand/react/shallow"
import { Database, FileSearch, FolderSearch, ShieldCheck, Sparkles, Trash2 } from "lucide-react"
import { useScannerStore } from "@/lib/stores/scanner-store"
import { useDriveStatus } from "@/lib/drive-status"
import type { DriveScanProgress } from "@/lib/server/ws-events"

export type ScanFeedIcon = "episode" | "movie" | "file" | "pruned" | "done"

/** Modelo común que pinta ScanLivePanel, sea cual sea el origen del escaneo. */
export interface ScanLiveView {
    source: "local" | "drive"
    sourceLabel: string
    title: string
    state: "running" | "done" | "error"
    steps: { label: string; icon: React.ElementType }[]
    activeStep: number
    /** null = total desconocido → barra indeterminada. */
    percent: number | null
    currentLine: string
    counter?: string
    startedAt?: number
    finishedAt?: number
    stats: { label: string; value: number | string; hint?: string; tone?: "warn" }[]
    chips?: { label: string; count: number }[]
    /** Todo lo detectado en el escaneo, el más reciente primero. */
    feed: { id: string; icon: ScanFeedIcon; title?: string; badge?: string; detail: string; group?: string }[]
    error?: string
}

/** Grupo de las películas en los chips (coincide con scanMoviesGroupName del servidor). */
const DRIVE_MOVIES_GROUP = "Películas y especiales"

function finishedLabel(finishedAt?: number): string {
    return finishedAt ? `Terminado ${new Date(finishedAt).toLocaleTimeString()}` : "Terminado"
}

// ─── Google Drive ──────────────────────────────────────────────────────────────

const DRIVE_STEPS = [
    { phase: "listing", label: "Explorando carpetas", icon: FolderSearch },
    { phase: "indexing", label: "Clasificando", icon: Sparkles },
    { phase: "saving", label: "Guardando", icon: Database },
    { phase: "pruning", label: "Limpiando", icon: Trash2 },
] as const

/**
 * @param isScanning true desde el click en "Escanear" aunque el primer snapshot aún no
 * llegó: mientras tanto se muestra el estado inicial, no el resumen del escaneo anterior.
 */
export function driveScanView(progress: DriveScanProgress | undefined, isScanning: boolean): ScanLiveView {
    const stale = isScanning && (!progress || progress.phase === "done" || progress.phase === "error")
    const p = stale ? undefined : progress
    const phase = p?.phase ?? "listing"
    const state = phase === "done" ? "done" : phase === "error" ? "error" : "running"
    const finishedAt = p?.finishedAt ? new Date(p.finishedAt).getTime() : undefined

    const percent = phase === "indexing" && p && p.total > 0
        ? Math.round((p.indexed / p.total) * 100)
        : phase === "saving" || phase === "pruning" || state === "done" ? 100 : null

    const currentLine = state === "done" ? finishedLabel(finishedAt)
        : phase === "saving" ? "Escribiendo en la base de datos…"
        : phase === "pruning" ? "Quitando archivos que ya no están en Drive…"
        : p?.currentFolder || "Conectando con Google Drive…"

    return {
        source: "drive",
        sourceLabel: "Google Drive",
        title: state === "running" ? "Escaneando Google Drive" : state === "done" ? "Último escaneo de Drive" : "Falló el escaneo de Drive",
        state,
        steps: DRIVE_STEPS.map(({ label, icon }) => ({ label, icon })),
        activeStep: DRIVE_STEPS.findIndex(s => s.phase === phase),
        percent,
        currentLine,
        counter: phase === "indexing" && p ? `${p.indexed} / ${p.total}` : percent !== null ? `${percent}%` : undefined,
        startedAt: p?.startedAt ? new Date(p.startedAt).getTime() : undefined,
        finishedAt,
        stats: [
            { label: "Carpetas", value: p?.foldersScanned ?? 0, hint: state === "running" && p?.foldersPending ? `+${p.foldersPending} en cola` : undefined },
            { label: "Videos", value: p?.filesFound ?? 0 },
            { label: "Series", value: p?.series?.length ?? 0 },
            { label: "Eliminados", value: p?.pruned ?? 0, tone: p?.pruned ? "warn" : undefined },
        ],
        chips: p?.series?.map(s => ({ label: s.title, count: s.count })),
        feed: (p?.items ?? []).map(item => ({
            id: `${item.folder}/${item.name}`,
            icon: item.isMovie ? "movie" as const : "episode" as const,
            title: item.series,
            badge: !item.isMovie && item.episode ? `E${item.episode.toString().padStart(3, "0")}` : undefined,
            detail: item.name,
            group: item.isMovie ? DRIVE_MOVIES_GROUP : item.series,
        })).reverse(),
        error: p?.error,
    }
}

/** Escaneo de Drive a mostrar: en curso, o el resumen del último desde que arrancó el servidor. */
export function useDriveScanView(): ScanLiveView | null {
    const { data } = useDriveStatus()
    if (!data?.connected || (!data.isScanning && !data.progress)) return null
    return driveScanView(data.progress, Boolean(data.isScanning))
}

// ─── Disco local ───────────────────────────────────────────────────────────────

/**
 * El escáner local reporta un porcentaje global por etapa (scanner_engine.go):
 * 0-29 recolección, 30-49 análisis, 50-69 matching, 70-89 metadatos, 90+ cierre.
 */
const LOCAL_STEPS = [
    { from: 0, label: "Explorando carpetas", icon: FolderSearch },
    { from: 30, label: "Analizando archivos", icon: FileSearch },
    { from: 50, label: "Identificando", icon: Sparkles },
    { from: 70, label: "Metadatos", icon: Database },
    { from: 90, label: "Verificando", icon: ShieldCheck },
] as const

/** Vista del escaneo local, o null si no hubo ninguno en esta sesión. */
export function useLocalScanView(): ScanLiveView | null {
    const s = useScannerStore(useShallow(state => ({
        isScanning: state.isScanning,
        scanProgress: state.scanProgress,
        currentScanningFile: state.currentScanningFile,
        statusMessage: state.statusMessage,
        events: state.events,
        lastFinish: state.lastFinish,
        pruneCount: state.pruneCount,
        startedAt: state.startedAt,
        finishedAt: state.finishedAt,
        filesCurrent: state.filesCurrent,
        filesTotal: state.filesTotal,
        error: state.error,
    })))

    return useMemo(() => {
        const state = s.error ? "error" : s.isScanning ? "running" : s.finishedAt || s.lastFinish ? "done" : null
        if (!state) return null

        const pct = Math.round(Math.min(100, Math.max(0, s.scanProgress || 0)))
        let activeStep = 0
        LOCAL_STEPS.forEach((step, i) => { if (pct >= step.from) activeStep = i })
        const inAnalysis = activeStep === 1 && s.currentScanningFile

        const seen = new Set<string>()
        const feed: ScanLiveView["feed"] = []
        for (const evt of s.events) {
            if (evt.kind !== "file" || !evt.file || seen.has(evt.file)) continue
            seen.add(evt.file)
            feed.push({ id: evt.id, icon: "file", detail: evt.file })
        }

        const processed = s.lastFinish?.total_processed
        return {
            source: "local",
            sourceLabel: "Disco local",
            title: state === "running" ? "Escaneando disco local" : state === "done" ? "Último escaneo local" : "Falló el escaneo local",
            state,
            steps: LOCAL_STEPS.map(({ label, icon }) => ({ label, icon })),
            activeStep,
            percent: state === "done" ? 100 : pct,
            currentLine: state === "done" ? finishedLabel(s.finishedAt ?? undefined)
                : inAnalysis ? s.currentScanningFile
                : s.statusMessage || "Preparando escaneo…",
            counter: state === "running" && inAnalysis && s.filesTotal ? `${s.filesCurrent} / ${s.filesTotal}` : `${state === "done" ? 100 : pct}%`,
            startedAt: s.startedAt ?? undefined,
            finishedAt: s.finishedAt ?? undefined,
            stats: [
                { label: "Archivos", value: s.filesTotal || processed || 0 },
                { label: "Analizados", value: processed ?? s.filesCurrent },
                { label: "Eliminados", value: s.pruneCount, tone: s.pruneCount ? "warn" : undefined },
                { label: "Progreso", value: `${state === "done" ? 100 : pct}%` },
            ],
            feed,
            error: s.error ?? undefined,
        }
    }, [s])
}
