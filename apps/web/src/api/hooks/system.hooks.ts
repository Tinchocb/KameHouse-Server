import { useServerMutation } from "@/api/client/requests"

export interface DatabaseBackupResult {
    path: string
    sizeBytes: number
    createdAt: string
}

export function useBackupDatabase() {
    return useServerMutation<DatabaseBackupResult, void>({
        endpoint: "/api/v1/system/backup",
        method: "POST",
        mutationKey: ["system-backup"],
    })
}
