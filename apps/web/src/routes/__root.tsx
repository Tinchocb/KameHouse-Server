import { AppErrorBoundary } from "@/components/shared/app-error-boundary"
import { LoadingOverlayWithLogo } from "@/components/shared/loading-overlay-with-logo"
import { NotFound } from "@/components/shared/not-found"
import { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, Outlet, redirect } from "@tanstack/react-router"
import React from "react"
import { AppLayout, AppLayoutContent } from "@/components/ui/app-layout/app-layout"
import { AppBottomNav } from "@/components/ui/app-layout/app-topnav"
import { AppSidebar } from "@/components/ui/app-layout/app-sidebar"
import { CommandPalette } from "@/components/ui/search/command-palette"
import { AnimatePresence } from "framer-motion"
import { useRouterState } from "@tanstack/react-router"
import { PageTransition } from "@/components/shared/page-transition"
import { WebsocketProvider } from "@/app/websocket-provider"
import { FaBars } from "react-icons/fa"
import { useAppStore } from "@/lib/store"
import { DynamicBackdrop } from "@/components/shared/dynamic-backdrop"

import { VideoPlayer } from "@/components/video/player"

function RootComponent() {
    const routerState = useRouterState()
    const activeQueuePlayItem = useAppStore(state => state.activeQueuePlayItem)
    const playlistQueue = useAppStore(state => state.playlistQueue)
    const currentQueueIndex = useAppStore(state => state.currentQueueIndex)
    const setCurrentQueueIndex = useAppStore(state => state.setCurrentQueueIndex)
    const clearQueue = useAppStore(state => state.clearQueue)

    return (
        <AppLayout>
            <DynamicBackdrop />
            <WebsocketProvider>
                <AppSidebar />
                <CommandPalette />
                <AppLayoutContent>
                    {/* Mobile Menu Trigger */}
                    <button 
                        onClick={() => useAppStore.getState().setSidebarOpen(true)}
                        className="md:hidden fixed top-6 left-6 z-[60] p-3 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-white/70 hover:text-white transition-all active:scale-90"
                    >
                        <FaBars className="w-5 h-5" />
                    </button>

                    <AnimatePresence mode="wait">
                        <PageTransition transitionKey={routerState.location.pathname} className="flex-1 w-full">
                            <Outlet />
                        </PageTransition>
                    </AnimatePresence>
                </AppLayoutContent>
                <AppBottomNav />
            </WebsocketProvider>

            {activeQueuePlayItem && (
                <VideoPlayer
                    streamUrl={activeQueuePlayItem.playableUrl}
                    streamType="direct"
                    title={activeQueuePlayItem.title}
                    episodeLabel={activeQueuePlayItem.subtitle}
                    episodeNumber={activeQueuePlayItem.episodeNumber}
                    mediaId={activeQueuePlayItem.mediaId}
                    malId={activeQueuePlayItem.malId}
                    mediaFormat={activeQueuePlayItem.mediaFormat}
                    marathonMode={false}
                    onNextEpisode={() => {
                        const nextIdx = currentQueueIndex + 1;
                        if (nextIdx < playlistQueue.length) {
                            setCurrentQueueIndex(nextIdx);
                        } else {
                            clearQueue();
                        }
                    }}
                    hasNextEpisode={currentQueueIndex + 1 < playlistQueue.length}
                    onClose={() => {
                        useAppStore.setState({ activeQueuePlayItem: null, currentQueueIndex: -1 });
                    }}
                />
            )}
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
