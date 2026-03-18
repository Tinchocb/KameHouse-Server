import { useServerMutation, useServerQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { Progress_UserMediaProgress, SaveProgress_Variables } from "@/api/generated/endpoint.types"

export function useGetProgress() {
    return useServerQuery<Array<Progress_UserMediaProgress>>({
        endpoint: API_ENDPOINTS.PROGRESS.GetProgress.endpoint,
        method: API_ENDPOINTS.PROGRESS.GetProgress.methods[0],
        queryKey: [API_ENDPOINTS.PROGRESS.GetProgress.key],
        enabled: true,
    })
}

export function useSaveProgress() {
    return useServerMutation<Progress_UserMediaProgress, SaveProgress_Variables>({
        endpoint: API_ENDPOINTS.PROGRESS.SaveProgress.endpoint,
        method: API_ENDPOINTS.PROGRESS.SaveProgress.methods[0],
        mutationKey: [API_ENDPOINTS.PROGRESS.SaveProgress.key],
    })
}
