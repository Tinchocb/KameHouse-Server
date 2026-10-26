import { create } from "zustand"
import type { DriveWindowDiag } from "./drive-subtitles"

/**
 * Estado de carga de subtítulos que el panel "Audio y subtítulos" necesita mostrar.
 *
 * Vive en un store propio (y no como props) porque lo escriben el hook de JASSUB y el
 * orquestador, y lo lee el panel, que está varios niveles más abajo en el árbol del
 * reproductor. Solo hay un reproductor activo a la vez; el orquestador lo reinicia en
 * cada episodio.
 */
type SubtitleLoadPhase = "idle" | "loading" | "extracting" | "error"

export type DriveExtractionState = "none" | "queued" | "running" | "done" | "error"

export interface DriveExtractionStatus {
    state: DriveExtractionState
    /** 0-100, aproximado. */
    percent: number
    /** Mensaje de error ya traducido para mostrar. */
    error?: string
}

/** Estado de la lectura por franjas de Drive que ve el panel. */
interface DriveWindowInfo {
    /** Falla vigente (texto ya traducido) o null. */
    error: string | null
    /** El archivo no admite franjas (definitivo). */
    unsupported: boolean
    diag: DriveWindowDiag | null
    state: string
    version: number
    coveredFrom: number
    coveredUntil: number
}

interface SubtitleLoadState {
    /** De dónde viene el episodio: decide los mensajes de "sin subtítulos". */
    source: "local" | "drive"
    /** Fase de carga de la pista activa. */
    phase: SubtitleLoadPhase
    /** Pista a la que se refiere `phase`. */
    trackIndex: number | null
    /** Mensaje de error de la pista activa (fase "error"). */
    message: string | null
    /** Extracción de subtítulos embebidos de Drive (solo si source === "drive"). */
    drive: DriveExtractionStatus
    driveActions: { extract: () => void; cancel: () => void } | null
    windowInfo: DriveWindowInfo | null
    setWindowInfo: (info: DriveWindowInfo | null) => void

    setSource: (source: "local" | "drive") => void
    setTrackLoad: (phase: SubtitleLoadPhase, trackIndex: number | null, message?: string | null) => void
    setDrive: (drive: DriveExtractionStatus) => void
    setDriveActions: (actions: { extract: () => void; cancel: () => void } | null) => void
    reset: () => void
}

const INITIAL: Pick<SubtitleLoadState, "source" | "phase" | "trackIndex" | "message" | "drive" | "driveActions" | "windowInfo"> = {
    source: "local",
    phase: "idle",
    trackIndex: null,
    message: null,
    drive: { state: "none", percent: 0 },
    driveActions: null,
    windowInfo: null,
}

export const useSubtitleLoadStore = create<SubtitleLoadState>()((set) => ({
    ...INITIAL,
    setSource: (source) => set({ source }),
    setTrackLoad: (phase, trackIndex, message = null) => set({ phase, trackIndex, message }),
    setDrive: (drive) => set({ drive }),
    setDriveActions: (driveActions) => set({ driveActions }),
    setWindowInfo: (windowInfo) => set({ windowInfo }),
    reset: () => set({ ...INITIAL }),
}))
