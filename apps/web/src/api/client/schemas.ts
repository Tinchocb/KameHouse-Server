import { z } from "zod"
import type { Continuity_WatchHistoryItemResponse, Mediastream_MediaContainer } from "@/api/generated/types"
import { ApiError } from "@/api/client/requests"

// ─── Validación en runtime de DTOs críticos ───────────────────────────────────
// buildSeaQuery castea `as T` sin validar. Estos dos DTOs deciden desde dónde
// se reproduce y qué se reproduce, así que se validan en el borde. Solo se
// comprueban los campos que consumimos; .passthrough() tolera campos nuevos.

const finiteNonNegative = z.number().finite().nonnegative()

const continuityItemResponseSchema = z.object({
    found: z.boolean(),
    item: z.object({
        mediaId: z.number(),
        episodeNumber: z.number(),
        currentTime: finiteNonNegative,
        duration: finiteNonNegative,
        timeUpdated: z.string(),
    }).passthrough().nullable(),
}).passthrough()

const mediaContainerSchema = z.object({
    filePath: z.string(),
    hash: z.string(),
    streamType: z.enum(["transcode", "optimized", "direct"]),
    streamUrl: z.string().min(1),
    mediaInfo: z.unknown(),
}).passthrough()

/**
 * Continuidad inválida = sin progreso: mejor empezar desde 0 que reanudar en
 * un segundo basura. `undefined` (sin datos aún) pasa tal cual.
 */
export function parseContinuityItemResponse(
    data: Continuity_WatchHistoryItemResponse | undefined
): Continuity_WatchHistoryItemResponse | undefined {
    if (data === undefined) return undefined
    const res = continuityItemResponseSchema.safeParse(data)
    if (res.success) return data
    console.warn("[continuity] respuesta inválida, se ignora:", res.error.issues)
    return { found: false, item: null }
}

/** Contenedor inválido = error de la query (el reproductor lo muestra en su overlay). */
export function parseMediaContainer(data: Mediastream_MediaContainer | undefined): Mediastream_MediaContainer | undefined {
    if (data === undefined) return undefined
    const res = mediaContainerSchema.safeParse(data)
    if (res.success) return data
    throw new ApiError("Respuesta inválida del servidor al preparar el stream", 0, res.error.issues)
}
