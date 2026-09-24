import { useServerQuery, useServerMutation } from "@/api/client/requests"
import { Models_Settings, Status } from "@/api/generated/types"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { SaveSettings_Variables, GettingStarted_Variables } from "@/api/generated/endpoint.types"
import { useQueryClient } from "@tanstack/react-query"

export function useGetStatus(options?: { enabled?: boolean }) {
    return useServerQuery<Status>({
        endpoint: API_ENDPOINTS.STATUS.GetStatus.endpoint,
        method: API_ENDPOINTS.STATUS.GetStatus.methods[0],
        queryKey: [API_ENDPOINTS.STATUS.GetStatus.key],
        enabled: options?.enabled ?? true,
        muteError: true,
        retry: (failureCount) => failureCount < 40,
        retryDelay: (attemptIndex) => Math.min(600 * (attemptIndex + 1), 1500),
    })
}

export function useGetSettings() {
    return useServerQuery<Models_Settings>({
        endpoint: API_ENDPOINTS.SETTINGS.GetSettings.endpoint,
        method: API_ENDPOINTS.SETTINGS.GetSettings.methods[0],
        queryKey: [API_ENDPOINTS.SETTINGS.GetSettings.key],
        enabled: true,
        muteError: true,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        // El servidor serializa `platform` en minúsculas (json tag de Go).
        // Normalizar aquí para compat con payloads legacy que traían `Platform`.
        select: (data) => {
            if (!data) return data
            const raw = data as unknown as Record<string, unknown>
            const normalized = (raw.platform ?? raw.Platform ?? { hideAudienceScore: false }) as Models_Settings["platform"]
            return { ...data, platform: normalized } as Models_Settings
        },
    })
}

export function useSaveSettings() {
    const queryClient = useQueryClient()
    return useServerMutation<Models_Settings, SaveSettings_Variables>({
        endpoint: API_ENDPOINTS.SETTINGS.SaveSettings.endpoint,
        method: API_ENDPOINTS.SETTINGS.SaveSettings.methods[0],
        mutationKey: [API_ENDPOINTS.SETTINGS.SaveSettings.key],
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.STATUS.GetStatus.key] })
            await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.SETTINGS.GetSettings.key] })
        },
    })
}

export function useGettingStarted() {
    const queryClient = useQueryClient()
    return useServerMutation<Status, GettingStarted_Variables>({
        endpoint: API_ENDPOINTS.SETTINGS.GettingStarted.endpoint,
        method: API_ENDPOINTS.SETTINGS.GettingStarted.methods[0],
        mutationKey: [API_ENDPOINTS.SETTINGS.GettingStarted.key],
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.STATUS.GetStatus.key] })
            await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.SETTINGS.GetSettings.key] })
        },
    })
}


