import { buildSeaQuery, useServerMutation } from "@/api/client/requests"
import { EXTRA_ENDPOINTS } from "@/api/client/endpoints.extra"

interface CastDevice {
    id: string
    name: string
}

interface CastDevicesResponse {
    devices: CastDevice[]
}

interface CastPlayVariables {
    deviceId?: string
    mediaId: number
    episodeNumber: number
    episodeId?: string
    title?: string
    episodeLabel?: string
}

interface CastPlayResponse {
    sentTo: string[]
}

// Consulta puntual (sin polling) de las TVs conectadas.
export const fetchCastDevices = async () => {
    return buildSeaQuery<CastDevicesResponse>({
        endpoint: EXTRA_ENDPOINTS.CAST.GetDevices.endpoint,
        method: "GET",
    })
}

// Envía un comando de reproducción a la(s) TV(s) conectadas.
export function useCastPlay() {
    return useServerMutation<CastPlayResponse, CastPlayVariables>({
        endpoint: EXTRA_ENDPOINTS.CAST.Play.endpoint,
        method: "POST",
    })
}
