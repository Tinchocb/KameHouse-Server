import { AppErrorBoundary } from "@/components/shared/app-error-boundary"
import { LoadingOverlayWithLogo } from "@/components/shared/loading-overlay-with-logo"
import { NotFound } from "@/components/shared/not-found"
import { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, Outlet, redirect } from "@tanstack/react-router"
import React from "react"
import { AppLayout, AppLayoutContent } from "@/components/ui/app-layout/app-layout"
import { AppTopNav, AppBottomNav } from "@/components/ui/app-layout/app-topnav"
import { AppSidebar } from "@/components/ui/app-layout/app-sidebar"
import { CommandPalette } from "@/components/ui/search/command-palette"
import { AnimatePresence } from "framer-motion"
import { useRouterState } from "@tanstack/react-router"
import { PageTransition } from "@/components/shared/page-transition"
import { WebsocketProvider } from "@/app/websocket-provider"

function RootComponent() {
    const routerState = useRouterState()
    return (
        <AppLayout>
            <WebsocketProvider>
                <AppTopNav />
                <AppSidebar />
                <CommandPalette />
                <AppLayoutContent className="pt-16 md:pl-24">
                    <AnimatePresence mode="wait">
                        <PageTransition transitionKey={routerState.location.pathname} className="flex-1 w-full">
                            <Outlet />
                        </PageTransition>
                    </AnimatePresence>
                </AppLayoutContent>
                <AppBottomNav />
            </WebsocketProvider>
        </AppLayout>
    )
}

export const Route = createRootRouteWithContext<{
    queryClient: QueryClient
}>()({
    component: RootComponent,
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
