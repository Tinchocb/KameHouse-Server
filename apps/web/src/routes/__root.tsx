import { AppErrorBoundary } from "@/components/shared/app-error-boundary"
import { LoadingOverlayWithLogo } from "@/components/shared/loading-overlay-with-logo"
import { NotFound } from "@/components/shared/not-found"
import { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, Outlet, redirect } from "@tanstack/react-router"
import { createStore } from "jotai"
import React from "react"
import { AppLayout, AppLayoutSidebar, AppLayoutContent } from "@/components/ui/app-layout/app-layout"
import { AppSidebar, AppSidebarProvider, AppBottomNav } from "@/components/ui/app-layout/app-sidebar"

export const Route = createRootRouteWithContext<{
    queryClient: QueryClient
    store: ReturnType<typeof createStore>
}>()({
    component: () => (
        /*
         * Root shell — zinc-950 body, fixed 240px sidebar (md) by default.
         * On desktop the sidebar collapses to 64px icon-rail via the toggle
         * button at the bottom of AppSidebar.
         *
         * AppLayoutContent uses overflow-y-auto + h-screen so only the main
         * column scrolls, keeping the sidebar fixed in place at all times.
         */
        <AppSidebarProvider>
            <AppLayout withSidebar sidebarSize="md">
                <AppLayoutSidebar>
                    <AppSidebar />
                </AppLayoutSidebar>
                <AppLayoutContent>
                    <Outlet />
                </AppLayoutContent>
                <AppBottomNav />
            </AppLayout>
        </AppSidebarProvider>
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
