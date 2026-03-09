import { AppErrorBoundary } from "@/components/shared/app-error-boundary"
import { LoadingOverlayWithLogo } from "@/components/shared/loading-overlay-with-logo"
import { NotFound } from "@/components/shared/not-found"
import { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, Outlet, redirect } from "@tanstack/react-router"
import { createStore } from "jotai"
import React from "react"
import { AppLayout, AppLayoutContent } from "@/components/ui/app-layout/app-layout"
import { AppTopNav, AppBottomNav } from "@/components/ui/app-layout/app-topnav"

export const Route = createRootRouteWithContext<{
    queryClient: QueryClient
    store: ReturnType<typeof createStore>
}>()({
    component: () => (
        /*
         * Root shell — absolute black body
         * AppLayoutContent uses h-dvh and top padding to avoid the fixed AppTopNav.
         */
        <AppLayout>
            <AppTopNav />
            <AppLayoutContent>
                <Outlet />
            </AppLayoutContent>
            <AppBottomNav />
        </AppLayout>
    ),
    beforeLoad: ({ location }) => {
        if (location.pathname === "/") {
            throw redirect({ to: "/home" })
        }
    },
    pendingComponent: LoadingOverlayWithLogo,
    pendingMs: 200,
    errorComponent: AppErrorBoundary,
    notFoundComponent: NotFound,
})
