import { useServerQuery, useServerMutation } from "@/api/client/requests"
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

interface ResolveUnlinkedFileVariables {
    path: string
    targetMediaId: number
}

export function useGetUnlinkedFiles() {
    return useServerQuery<UnlinkedFile[], void, UnlinkedFile[]>({
        endpoint: API_ENDPOINTS.LOCALFILES.GetUnlinkedFiles.endpoint,
        method: API_ENDPOINTS.LOCALFILES.GetUnlinkedFiles.methods[0],
        queryKey: [API_ENDPOINTS.LOCALFILES.GetUnlinkedFiles.key],
        refetchOnWindowFocus: false,
    })
}

export function useResolveUnlinkedFile() {
    return useServerMutation<void, ResolveUnlinkedFileVariables>({
        endpoint: API_ENDPOINTS.LOCALFILES.ResolveUnlinkedFile.endpoint,
        method: API_ENDPOINTS.LOCALFILES.ResolveUnlinkedFile.methods[0],
    })
}