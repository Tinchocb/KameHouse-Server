import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { buildSeaQuery } from "@/api/client/requests"

/**
 * Persiste flags de Biblioteca al servidor sin pasar por el form de Ajustes
 * (fire-and-forget). Los toggles fuera de Ajustes (Modo TV, maraton) solo
 * tocaban el store local y el servidor quedaba divergente: al visitar
 * Ajustes, el sync reseteaba el store y el modo se "perdia" solo.
 */
export function persistLibraryPatch(patch: Record<string, unknown>): void {
    try {
        void buildSeaQuery({
            endpoint: API_ENDPOINTS.SETTINGS.SaveSettings.endpoint,
            method: API_ENDPOINTS.SETTINGS.SaveSettings.methods[0] as "PATCH",
            data: { library: patch },
        }).catch(() => {})
    } catch {}
}

/**
 * Persiste flags de Tema/Audio al servidor sin pasar por el form de Ajustes
 * (fire-and-forget). Los toggles fuera de Ajustes (audio master en navbar)
 * solo tocaban el store local y el servidor quedaba divergente: al visitar
 * Ajustes, el sync reseteaba el store y el sonido se reactivaba solo.
 */
export function persistThemePatch(patch: Record<string, unknown>): void {
    try {
        void buildSeaQuery({
            endpoint: API_ENDPOINTS.SETTINGS.SaveSettings.endpoint,
            method: API_ENDPOINTS.SETTINGS.SaveSettings.methods[0] as "PATCH",
            data: { theme: patch },
        }).catch(() => {})
    } catch {}
}
