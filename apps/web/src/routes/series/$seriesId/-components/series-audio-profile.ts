import type { MediaAudioProfile } from "@/api/generated/types"

export type AudioProfileChoice = "latino" | "castellano" | "japanese" | "english" | "auto"

export const AUDIO_PROFILE_LABELS: Record<AudioProfileChoice, string> = {
    latino: "Latino",
    castellano: "Castellano",
    japanese: "Japonés",
    english: "Inglés",
    auto: "Automático",
}

export const AUDIO_PROFILE_SIGLAS: Record<AudioProfileChoice, string> = {
    latino: "LAT",
    castellano: "CAS",
    japanese: "JAP",
    english: "ENG",
    auto: "AUTO",
}

interface AudioProfileOption {
    /** "" = la serie sigue el perfil global de Ajustes. */
    value: AudioProfileChoice | ""
    /** Sigla para mostrar en la interfaz (GLO (LAT), LAT, CAS, JAP, ENG, AUTO). */
    label: string
    /** Nombre accesible completo para lectores de pantalla. */
    ariaLabel: string
}

export function isAudioProfileChoice(value: unknown): value is AudioProfileChoice {
    return typeof value === "string" && value in AUDIO_PROFILE_LABELS
}

/**
 * Opciones del selector: primero "GLO", con la sigla del perfil de Ajustes entre paréntesis
 * para que se vea qué suena cuando la serie no tiene perfil propio.
 */
export function audioProfileOptions(globalProfile: AudioProfileChoice): AudioProfileOption[] {
    const globalSigla = AUDIO_PROFILE_SIGLAS[globalProfile] ?? "LAT"
    const globalLabel = AUDIO_PROFILE_LABELS[globalProfile] ?? "Latino"
    return [
        {
            value: "",
            label: `GLO (${globalSigla})`,
            ariaLabel: `Global (${globalLabel})`,
        },
        {
            value: "latino",
            label: AUDIO_PROFILE_SIGLAS.latino,
            ariaLabel: AUDIO_PROFILE_LABELS.latino,
        },
        {
            value: "castellano",
            label: AUDIO_PROFILE_SIGLAS.castellano,
            ariaLabel: AUDIO_PROFILE_LABELS.castellano,
        },
        {
            value: "japanese",
            label: AUDIO_PROFILE_SIGLAS.japanese,
            ariaLabel: AUDIO_PROFILE_LABELS.japanese,
        },
        {
            value: "english",
            label: AUDIO_PROFILE_SIGLAS.english,
            ariaLabel: AUDIO_PROFILE_LABELS.english,
        },
        {
            value: "auto",
            label: AUDIO_PROFILE_SIGLAS.auto,
            ariaLabel: AUDIO_PROFILE_LABELS.auto,
        },
    ]
}

/** Perfil propio guardado para la serie, o "" si no tiene (sigue el global). */
export function seriesAudioProfileValue(
    profiles: MediaAudioProfile[] | undefined,
    mediaId: number,
): AudioProfileChoice | "" {
    const saved = profiles?.find(p => p.mediaId === mediaId)?.audioProfile
    return isAudioProfileChoice(saved) ? saved : ""
}
