import { useMutation, useQueryClient } from "@tanstack/react-query"
import { buildSeaQuery, useServerMutation, useServerQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import type { EnqueuePreTranscode_Variables } from "@/api/generated/endpoint.types"
import type { PreTranscodeJob } from "@/api/generated/types"
import { toast } from "sonner"

export function useGetPreTranscodeJobs(enabled = true) {
    return useServerQuery<PreTranscodeJob[]>({
        endpoint: API_ENDPOINTS.PRETRANSCODE.GetPreTranscodeJobs.endpoint,
        method: API_ENDPOINTS.PRETRANSCODE.GetPreTranscodeJobs.methods[0],
        queryKey: [API_ENDPOINTS.PRETRANSCODE.GetPreTranscodeJobs.key],
        enabled,
        staleTime: 5000,
        refetchInterval: 8000,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: false,
    })
}

export function useEnqueuePreTranscode() {
    const queryClient = useQueryClient()
    return useServerMutation<boolean, EnqueuePreTranscode_Variables>({
        endpoint: API_ENDPOINTS.PRETRANSCODE.EnqueuePreTranscode.endpoint,
        method: API_ENDPOINTS.PRETRANSCODE.EnqueuePreTranscode.methods[0],
        mutationKey: [API_ENDPOINTS.PRETRANSCODE.EnqueuePreTranscode.key],
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: [API_ENDPOINTS.PRETRANSCODE.GetPreTranscodeJobs.key],
            })
            toast.success("Pre-transcode encolado")
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "No se pudo encolar el pre-transcode")
        },
    })
}

export function useCancelPreTranscode() {
    const queryClient = useQueryClient()
    return useMutation<boolean | undefined, Error, string>({
        mutationFn: (hash) =>
            buildSeaQuery<boolean, void>({
                endpoint: API_ENDPOINTS.PRETRANSCODE.CancelPreTranscode.endpoint.replace(":hash", hash),
                method: "DELETE",
            }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: [API_ENDPOINTS.PRETRANSCODE.GetPreTranscodeJobs.key],
            })
            toast.success("Pre-transcode cancelado")
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "No se pudo cancelar el pre-transcode")
        },
    })
}
