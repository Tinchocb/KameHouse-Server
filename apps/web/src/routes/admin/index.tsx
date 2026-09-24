import { createFileRoute } from "@tanstack/react-router"
import { AppErrorBoundary } from "@/components/shared/app-error-boundary"

export const Route = createFileRoute("/admin/")({
    errorComponent: AppErrorBoundary,
})