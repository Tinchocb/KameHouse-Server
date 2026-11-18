import type { CardAspect } from "@/api/types/intelligence.types"

/**
 * SwimlaneItem — item de carrusel/lane multimedia.
 * El componente Swimlane se eliminó por no usarse; el tipo sigue vivo como
 * contrato entre home.mappers, media-spotlight y spotlight/*.
 */
export interface SwimlaneItem {
    id: string
    title: string
    image: string
    subtitle?: string
    badge?: string
    description?: string
    progress?: number
    aspect?: CardAspect
    year?: string | number
    runtime?: number
    watched?: boolean
    episodeNumber?: number
    tmdbId?: number
    mediaId?: number
    onClick: () => void
    backdropUrl?: string
    isSeriesComplete?: boolean
}
