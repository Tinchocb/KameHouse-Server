"use no memo"

import { AppErrorBoundary } from "@/components/shared/app-error-boundary"
import { LoadingOverlayWithLogo } from "@/components/shared/loading-overlay-with-logo"
import { NotFound } from "@/components/shared/not-found"
import { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, Outlet, redirect } from "@tanstack/react-router"
import React from "react"
import { AppLayout, AppLayoutContent } from "@/components/ui/app-layout/app-layout"
import { AppBottomNav } from "@/components/ui/app-layout/app-topnav"
import { AppSidebar } from "@/components/ui/app-layout/app-sidebar"

const CommandPalette = React.lazy(() =>
    import("@/components/ui/search/command-palette").then((m) => ({ default: m.CommandPalette }))
)
const VideoPlayer = React.lazy(() =>
    import("@/components/video/player").then((m) => ({ default: m.VideoPlayer }))
)
const PerformanceMonitor = React.lazy(() =>
    import("@/components/shared/performance-monitor").then((m) => ({ default: m.PerformanceMonitor }))
)
import { useRouterState } from "@tanstack/react-router"
import { PageTransition } from "@/components/shared/page-transition"
import { FaBars } from "react-icons/fa"
import { useAppStore } from "@/lib/store"
import { DynamicBackdrop } from "@/components/shared/dynamic-backdrop"
import { useGetStatus } from "@/api/hooks/settings.hooks"
import { GettingStarted } from "@/components/shared/getting-started"
import { GlobalQueueSidebar } from "@/components/shared/global-queue-sidebar"
import { startViewTransition } from "@/lib/helpers/transitions"

function RootComponent() {
    const routerState = useRouterState()
    const activeQueuePlayItem = useAppStore(state => state.activeQueuePlayItem)
    const playlistQueue = useAppStore(state => state.playlistQueue)
    const currentQueueIndex = useAppStore(state => state.currentQueueIndex)
    const setCurrentQueueIndex = useAppStore(state => state.setCurrentQueueIndex)
    const clearQueue = useAppStore(state => state.clearQueue)
    const activeTheme = useAppStore(state => state.activeTheme)

    const sidebarOpen = useAppStore(state => state.sidebarOpen)
    const { data: status, isLoading, isError, refetch } = useGetStatus()

    React.useEffect(() => {
        document.documentElement.dataset.theme = activeTheme || "dark"
    }, [activeTheme])

    if (isLoading || !status) {
        return <LoadingOverlayWithLogo isError={isError} refetch={refetch} />
    }

    if (!status.settings?.id) {
        return (
            <AppLayout>
                <GettingStarted status={status} />
            </AppLayout>
        )
    }

    return (
        <AppLayout>
            <DynamicBackdrop />
            <React.Suspense fallback={null}>
                <PerformanceMonitor />
            </React.Suspense>
            <AppSidebar />
            <React.Suspense fallback={null}>
                <CommandPalette />
            </React.Suspense>
            <GlobalQueueSidebar />
            <AppLayoutContent>
                {/* Mobile Menu Trigger */}
                <button 
                    onClick={() => useAppStore.getState().setSidebarOpen(true)}
                    tabIndex={sidebarOpen ? -1 : 0}
                    aria-hidden={sidebarOpen ? "true" : undefined}
                    className="md:hidden fixed top-6 left-6 z-[60] p-3 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-white/70 hover:text-white transition-all active:scale-90"
                >
                    <FaBars className="w-5 h-5" />
                </button>

                <PageTransition key={routerState.location.pathname} transitionKey={routerState.location.pathname} className="flex-1 w-full">
                    <Outlet />
                </PageTransition>
            </AppLayoutContent>
            <AppBottomNav />

            {activeQueuePlayItem && (() => {
                const nextItem = currentQueueIndex + 1 < playlistQueue.length ? playlistQueue[currentQueueIndex + 1] : null;
                return (
                    <React.Suspense fallback={null}>
                        <VideoPlayer
                            streamUrl={activeQueuePlayItem.playableUrl}
                            streamType="direct"
                            title={activeQueuePlayItem.title}
                            episodeLabel={activeQueuePlayItem.subtitle}
                            episodeNumber={activeQueuePlayItem.episodeNumber}
                            mediaId={activeQueuePlayItem.mediaId}
                            malId={activeQueuePlayItem.malId}
                            mediaFormat={activeQueuePlayItem.mediaFormat}
                            nextStreamUrl={nextItem?.playableUrl}
                            nextStreamType="direct"
                            nextEpisodeTitle={nextItem?.subtitle || nextItem?.title}
                            nextEpisodeNumber={nextItem?.episodeNumber}
                            nextEpisodeImage={nextItem?.thumbnail}
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
                                startViewTransition(() => {
                                    useAppStore.setState({ activeQueuePlayItem: null, currentQueueIndex: -1 });
                                })
                            }}
                        />
                    </React.Suspense>
                );
            })()}
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
