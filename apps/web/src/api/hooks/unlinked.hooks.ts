import { useServerQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"

export interface UnlinkedFile {
    id: number
    path: string
    originalTitle: string
    algorithmScore: number
    targetMediaId: number
    userResolved: boolean
    ghostMatchCount: number
}

export function useGetUnlinkedFiles({ enabled = true }: { enabled?: boolean } = {}) {
    return useServerQuery<UnlinkedFile[], void, UnlinkedFile[]>({
        endpoint: API_ENDPOINTS.SCAN.GetUnlinkedFiles.endpoint,
        method: API_ENDPOINTS.SCAN.GetUnlinkedFiles.methods[0],
        queryKey: [API_ENDPOINTS.SCAN.GetUnlinkedFiles.key],
        enabled,
        refetchOnWindowFocus: false,
    })
}