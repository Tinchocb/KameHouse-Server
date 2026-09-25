import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { buildSeaQuery } from "@/api/client/requests"

/**
 * Refleja el parche en la caché de GetSettings. La query tiene staleTime de 5 min:
 * sin esto, Ajustes montaba con la copia vieja, `syncStoresWithSettings` la volcaba
 * al store y el cambio recién hecho (p. ej. desde el reproductor) se revertía.
 * Import dinámico: client-providers importa los stores, que importan este módulo.
 */
function patchSettingsCache(section: "library" | "theme", patch: Record<string, unknown>): void {
    void import("@/app/client-providers")
        .then(({ queryClient }) => {
            queryClient.setQueryData<Record<string, unknown>>(
                [API_ENDPOINTS.SETTINGS.GetSettings.key],
                (old) => {
                    if (!old) return old
                    const prev = (old[section] ?? {}) as Record<string, unknown>
                    return { ...old, [section]: { ...prev, ...patch } }
                },
            )
        })
        .catch(() => {})
}

/**
 * Persiste flags de Biblioteca al servidor sin pasar por el form de Ajustes
 * (fire-and-forget). Los toggles fuera de Ajustes (Modo TV, maraton) solo
 * tocaban el store local y el servidor quedaba divergente: al visitar
 * Ajustes, el sync reseteaba el store y el modo se "perdia" solo.
 */
export function persistLibraryPatch(patch: Record<string, unknown>): void {
    patchSettingsCache("library", patch)
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
    patchSettingsCache("theme", patch)
    try {
        void buildSeaQuery({
            endpoint: API_ENDPOINTS.SETTINGS.SaveSettings.endpoint,
            method: API_ENDPOINTS.SETTINGS.SaveSettings.methods[0] as "PATCH",
            data: { theme: patch },
        }).catch(() => {})
    } catch {}
}
