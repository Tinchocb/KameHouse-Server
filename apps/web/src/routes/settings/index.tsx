import { createFileRoute } from "@tanstack/react-router"
import { AppErrorBoundary } from "@/components/shared/app-error-boundary"
export type { SettingsFormInput, SettingsFormValues } from "@/lib/server/settings"

interface SettingsSearchParams {
    tab?: string
}

export const Route = createFileRoute("/settings/")({
    validateSearch: (search: Record<string, unknown>): SettingsSearchParams => ({
        tab: typeof search.tab === "string" ? search.tab : undefined,
    }),
    errorComponent: AppErrorBoundary,
})
