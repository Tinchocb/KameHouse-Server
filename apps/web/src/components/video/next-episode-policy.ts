export interface SegmentStatus {
    remaining: number
    progress: number
}

/** Segundos restantes y % 0-100 dentro de una ventana [start, end). */
export function getSegmentStatus(curr: number, start: number, end: number): SegmentStatus {
    return {
        remaining: Math.ceil(end - curr),
        progress: Math.round(((curr - start) / Math.max(1, end - start)) * 100),
    }
}

/** Estamos lo bastante cerca del final como para pre-cargar el siguiente episodio. */
export function isNearEnd(total: number, curr: number, edStart?: number): boolean {
    return total > 0 && (total - curr <= 180 || (edStart != null && curr >= edStart))
}

export interface NextEpisodePolicy {
    mediaFormat?: string | null
    marathonMode: boolean
    tvMode: boolean
    hasNextEpisode: boolean
    total: number
    curr: number
    inEdWindow: boolean
}

/** Visibilidad del panel "Up next" + countdown. */
export function shouldShowNextEpisode(p: NextEpisodePolicy): boolean {
    const isPureMarathon = p.marathonMode && !p.tvMode
    const nextThreshold = p.tvMode ? 3 : 15
    return (
        p.mediaFormat?.toUpperCase() !== "MOVIE" &&
        !isPureMarathon &&
        p.hasNextEpisode &&
        ((p.total > 0 && p.total - p.curr <= nextThreshold) || (!p.tvMode && p.inEdWindow))
    )
}

export interface AutoAdvancePolicy {
    marathonMode: boolean
    hasNextEpisode: boolean
    hasOnNext: boolean
    mediaFormat?: string | null
    ended: boolean
    total: number
    curr: number
}

/** Avance automático al terminar (modo maratón, últimos 3s o ended). */
export function shouldAutoAdvanceMarathon(p: AutoAdvancePolicy): boolean {
    return (
        p.marathonMode &&
        p.hasNextEpisode &&
        p.hasOnNext &&
        p.mediaFormat?.toUpperCase() !== "MOVIE" &&
        (p.ended || (p.total > 0 && p.total - p.curr <= 3))
    )
}
