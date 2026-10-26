import { useServerMutation, useServerQuery } from "@/api/client/requests"
import { SetAudioProfile_Variables } from "@/api/generated/endpoint.types"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { MediaAudioProfile } from "@/api/generated/types"
import { useQueryClient } from "@tanstack/react-query"

// ── Perfil de audio por serie ────────────────────────────────────────────────
// Vive en el servidor para que lo vean todos los clientes. Las series sin fila
// usan el perfil global de Ajustes.

export function useMediaAudioProfiles() {
    return useServerQuery<MediaAudioProfile[]>({
        endpoint: API_ENDPOINTS.MEDIA_AUDIO_PROFILE.GetAudioProfiles.endpoint,
        method: API_ENDPOINTS.MEDIA_AUDIO_PROFILE.GetAudioProfiles.methods[0],
        queryKey: [API_ENDPOINTS.MEDIA_AUDIO_PROFILE.GetAudioProfiles.key],
        staleTime: 60000,
    })
}

export function useSetMediaAudioProfile() {
    const queryClient = useQueryClient()

    return useServerMutation<MediaAudioProfile, SetAudioProfile_Variables>({
        endpoint: API_ENDPOINTS.MEDIA_AUDIO_PROFILE.SetAudioProfile.endpoint,
        method: API_ENDPOINTS.MEDIA_AUDIO_PROFILE.SetAudioProfile.methods[0],
        mutationKey: [API_ENDPOINTS.MEDIA_AUDIO_PROFILE.SetAudioProfile.key],
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.MEDIA_AUDIO_PROFILE.GetAudioProfiles.key] })
        },
    })
}
