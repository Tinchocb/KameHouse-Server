import { useServerMutation, useServerQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { useQueryClient } from "@tanstack/react-query"

export function useGetAllExtensions() {
    return useServerMutation<any>({
        endpoint: API_ENDPOINTS.EXTENSIONS.GetAllExtensions.endpoint,
        method: API_ENDPOINTS.EXTENSIONS.GetAllExtensions.methods[0],
        mutationKey: [API_ENDPOINTS.EXTENSIONS.GetAllExtensions.key],
    })
}

export function useListMangaProviderExtensions() {
    return useServerQuery<any>({
        endpoint: API_ENDPOINTS.EXTENSIONS.ListMangaProviderExtensions.endpoint,
        method: API_ENDPOINTS.EXTENSIONS.ListMangaProviderExtensions.methods[0],
        queryKey: [API_ENDPOINTS.EXTENSIONS.ListMangaProviderExtensions.key],
        enabled: true,
    })
}

export function useListOnlinestreamProviderExtensions() {
    return useServerQuery<any>({
        endpoint: API_ENDPOINTS.EXTENSIONS.ListOnlinestreamProviderExtensions.endpoint,
        method: API_ENDPOINTS.EXTENSIONS.ListOnlinestreamProviderExtensions.methods[0],
        queryKey: [API_ENDPOINTS.EXTENSIONS.ListOnlinestreamProviderExtensions.key],
        enabled: true,
    })
}

export function useAnimeListTorrentProviderExtensions() {
    return useServerQuery<any>({
        endpoint: API_ENDPOINTS.EXTENSIONS.ListAnimeTorrentProviderExtensions.endpoint,
        method: API_ENDPOINTS.EXTENSIONS.ListAnimeTorrentProviderExtensions.methods[0],
        queryKey: [API_ENDPOINTS.EXTENSIONS.ListAnimeTorrentProviderExtensions.key],
        enabled: true,
    })
}

export function useListCustomSourceExtensions() {
    return useServerQuery<any>({
        endpoint: API_ENDPOINTS.EXTENSIONS.ListCustomSourceExtensions.endpoint,
        method: API_ENDPOINTS.EXTENSIONS.ListCustomSourceExtensions.methods[0],
        queryKey: [API_ENDPOINTS.EXTENSIONS.ListCustomSourceExtensions.key],
        enabled: true,
    })
}

export function useGetExtensionUpdateData() {
    return useServerQuery<any[]>({
        endpoint: API_ENDPOINTS.EXTENSIONS.GetExtensionUpdateData.endpoint,
        method: API_ENDPOINTS.EXTENSIONS.GetExtensionUpdateData.methods[0],
        queryKey: [API_ENDPOINTS.EXTENSIONS.GetExtensionUpdateData.key],
        enabled: true,
    })
}

export function usePluginWithIssuesCount() {
    return 0
}

// ─── HTTP Addon hooks ────────────────────────────────────────────────────

/** Lists all installed extensions with their metadata */
export function useListExtensionData() {
    return useServerQuery<ExtensionData[]>({
        endpoint: API_ENDPOINTS.EXTENSIONS.ListExtensionData.endpoint,
        method: API_ENDPOINTS.EXTENSIONS.ListExtensionData.methods[0],
        queryKey: [API_ENDPOINTS.EXTENSIONS.ListExtensionData.key],
        enabled: true,
    })
}

/** Installs an external extension from a manifest URL */
export function useInstallExternalExtension() {
    const qc = useQueryClient()
    return useServerMutation<boolean, InstallExtensionVariables>({
        endpoint: API_ENDPOINTS.EXTENSIONS.InstallExternalExtension.endpoint,
        method: API_ENDPOINTS.EXTENSIONS.InstallExternalExtension.methods[0],
        mutationKey: [API_ENDPOINTS.EXTENSIONS.InstallExternalExtension.key],
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: [API_ENDPOINTS.EXTENSIONS.ListExtensionData.key] })
        },
    })
}

/** Uninstalls an external extension by its ID */
export function useUninstallExternalExtension() {
    const qc = useQueryClient()
    return useServerMutation<boolean, UninstallExtensionVariables>({
        endpoint: API_ENDPOINTS.EXTENSIONS.UninstallExternalExtension.endpoint,
        method: API_ENDPOINTS.EXTENSIONS.UninstallExternalExtension.methods[0],
        mutationKey: [API_ENDPOINTS.EXTENSIONS.UninstallExternalExtension.key],
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: [API_ENDPOINTS.EXTENSIONS.ListExtensionData.key] })
        },
    })
}

// ─── Types (until generated types cover these) ───────────────────────────

export interface ExtensionData {
    id: string
    name: string
    version: string
    manifestURI: string
    language: string
    type: string
    description: string
    author: string
    icon: string
    hasUpdate: boolean
}

export interface InstallExtensionVariables {
    manifestURI: string
}

export interface UninstallExtensionVariables {
    id: string
}
