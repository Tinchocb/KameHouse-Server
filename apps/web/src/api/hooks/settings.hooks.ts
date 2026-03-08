import { useServerQuery, useServerMutation } from "@/api/client/requests"
import { Models_Settings } from "@/api/generated/types"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { SaveSettings_Variables, SaveAutoDownloaderSettings_Variables, SaveMediaPlayerSettings_Variables } from "@/api/generated/endpoint.types"
import { useQueryClient } from "@tanstack/react-query"

export function useGetSettings() {
    return useServerQuery<Models_Settings>({
        endpoint: API_ENDPOINTS.SETTINGS.GetSettings.endpoint,
        method: API_ENDPOINTS.SETTINGS.GetSettings.methods[0],
        queryKey: [API_ENDPOINTS.SETTINGS.GetSettings.key],
        enabled: true,
    })
}

export function useSaveSettings() {
    const queryClient = useQueryClient()
    return useServerMutation<Models_Settings, SaveSettings_Variables>({
        endpoint: API_ENDPOINTS.SETTINGS.SaveSettings.endpoint,
        method: API_ENDPOINTS.SETTINGS.SaveSettings.methods[0],
        mutationKey: [API_ENDPOINTS.SETTINGS.SaveSettings.key],
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.SETTINGS.GetSettings.key] })
        },
    })
}

export function useSaveAutoDownloaderSettings() {
    const queryClient = useQueryClient()
    return useServerMutation<Models_Settings, SaveAutoDownloaderSettings_Variables>({
        endpoint: API_ENDPOINTS.SETTINGS.SaveAutoDownloaderSettings.endpoint,
        method: API_ENDPOINTS.SETTINGS.SaveAutoDownloaderSettings.methods[0],
        mutationKey: [API_ENDPOINTS.SETTINGS.SaveAutoDownloaderSettings.key],
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.SETTINGS.GetSettings.key] })
        },
    })
}

export function useSaveMediaPlayerSettings() {
    const queryClient = useQueryClient()
    return useServerMutation<Models_Settings, SaveMediaPlayerSettings_Variables>({
        endpoint: API_ENDPOINTS.SETTINGS.SaveMediaPlayerSettings.endpoint,
        method: API_ENDPOINTS.SETTINGS.SaveMediaPlayerSettings.methods[0],
        mutationKey: [API_ENDPOINTS.SETTINGS.SaveMediaPlayerSettings.key],
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.SETTINGS.GetSettings.key] })
        },
    })
}

