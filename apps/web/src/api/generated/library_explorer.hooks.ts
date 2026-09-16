import { useServerMutation } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { useQueryClient } from "@tanstack/react-query"

export function useRefreshLibraryExplorerFileTree() {
    const queryClient = useQueryClient()
    return useServerMutation<boolean>({
        endpoint: API_ENDPOINTS.LIBRARY_EXPLORER.RefreshLibraryExplorerFileTree.endpoint,
        method: API_ENDPOINTS.LIBRARY_EXPLORER.RefreshLibraryExplorerFileTree.methods[0],
        mutationKey: [API_ENDPOINTS.LIBRARY_EXPLORER.RefreshLibraryExplorerFileTree.key],
        onSuccess: async () => {
            queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.LIBRARY_EXPLORER.GetLibraryExplorerFileTree.key] })
        },
    })
}
