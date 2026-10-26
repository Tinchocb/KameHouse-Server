/** Error de la descarga de un archivo de subtítulos, con el estado HTTP si lo hubo. */
export class SubtitleFetchError extends Error {
    constructor(message: string, public readonly status?: number) {
        super(message)
        this.name = "SubtitleFetchError"
    }
}

/** Mensaje para mostrar cuando un subtítulo no se pudo cargar. */
export function describeSubtitleError(err: unknown): string {
    const status = err instanceof SubtitleFetchError ? err.status : undefined
    const msg = err instanceof Error ? err.message : ""
    if (status === 404) return "Este subtítulo no está disponible en el servidor."
    if (status === 503) return "El servidor sigue extrayendo los subtítulos. Inténtalo de nuevo en un momento."
    if (msg.includes("too large")) return "El archivo de subtítulos es demasiado grande."
    if (msg.includes("empty")) return "El archivo de subtítulos está vacío."
    if (msg.includes("never became available")) return "Los subtítulos tardaron demasiado en extraerse. Inténtalo de nuevo."
    return "No se pudo cargar el subtítulo."
}
