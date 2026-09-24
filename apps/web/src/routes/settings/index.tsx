import { createFileRoute } from "@tanstack/react-router"
import { AppErrorBoundary } from "@/components/shared/app-error-boundary"
export type { SettingsFormValues } from "@/lib/server/settings"

export interface SettingsSearchParams {
    tab?: string
}

export const Route = createFileRoute("/settings/")({
    validateSearch: (search: Record<string, unknown>): SettingsSearchParams => ({
        tab: typeof search.tab === "string" ? search.tab : undefined,
    }),
    errorComponent: AppErrorBoundary,
})
