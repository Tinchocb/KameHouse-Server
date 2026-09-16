import { AppErrorBoundary } from "@/components/shared/app-error-boundary"
import { LoadingOverlayWithLogo } from "@/components/shared/loading-overlay-with-logo"
import { NotFound } from "@/components/shared/not-found"
import { QueryClient, useIsFetching, useQueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, Outlet, redirect, useRouterState } from "@tanstack/react-router"
import React from "react"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { AppLayout, AppLayoutContent } from "@/components/ui/app-layout/app-layout"
import { AppBottomNav, AppTopNav } from "@/components/ui/app-layout/app-topnav"
import { FloatingPillNav } from "@/components/ui/app-layout/floating-pill-nav"
import { TvNavBar } from "@/components/ui/app-layout/tv-nav-bar"
import { useTvDpad } from "@/hooks/use-tv-dpad"
import { LiquidGlassDefs } from "@/components/shared/liquid-glass-defs"

const CommandPalette = React.lazy(() =>
    import("@/components/ui/search/command-palette").then((m) => ({ default: m.CommandPalette }))
)
const VideoPlayer = React.lazy(() =>
    import("@/components/video/player").then((m) => ({ default: m.VideoPlayer }))
)
const PerformanceMonitor = React.lazy(() =>
    import("@/components/shared/performance-monitor").then((m) => ({ default: m.PerformanceMonitor }))
)
import { PageTransition } from "@/components/shared/page-transition"

import { useAppStore } from "@/lib/store"
import { DynamicBackdrop } from "@/components/shared/dynamic-backdrop"
import { useGetStatus } from "@/api/hooks/settings.hooks"
const GlobalQueueSidebar = React.lazy(() =>
    import("@/components/shared/global-queue-sidebar").then((m) => ({ default: m.GlobalQueueSidebar }))
)
const GettingStarted = React.lazy(() =>
    import("@/components/shared/getting-started").then((m) => ({ default: m.GettingStarted }))
)
const ChronologyModal = React.lazy(() =>
    import("@/components/shared/chronology-modal").then((m) => ({ default: m.ChronologyModal }))
)
import { startViewTransition } from "@/lib/helpers/transitions"
import { useApplyCustomTheme, CustomThemeStyles } from "@/lib/theme/apply-custom-theme"
import { prewarmVideoPlayer } from "@/components/video/prewarm"

const GlobalQueuePlayerOverlay = React.memo(function GlobalQueuePlayerOverlay() {
    const activeQueuePlayItem = useAppStore(state => state.activeQueuePlayItem)
    const playlistQueue = useAppStore(state => state.playlistQueue)
    const currentQueueIndex = useAppStore(state => state.currentQueueIndex)
    const queueRepeatMode = useAppStore(state => state.queueRepeatMode)
    const [replayNonce, setReplayNonce] = React.useState(0)

    if (!activeQueuePlayItem) return null

    let nextItem = null
    if (queueRepeatMode === "one") {
        nextItem = activeQueuePlayItem
    } else if (currentQueueIndex + 1 < playlistQueue.length) {
        nextItem = playlistQueue[currentQueueIndex + 1]
    } else if (queueRepeatMode === "all" && playlistQueue.length > 0) {
        nextItem = playlistQueue[0]
    }

    const hasNext = queueRepeatMode === "one" || currentQueueIndex + 1 < playlistQueue.length || (queueRepeatMode === "all" && playlistQueue.length > 0)

    return (
        <React.Suspense fallback={null}>
            <VideoPlayer
                key={`${String(activeQueuePlayItem.id)}_${String(activeQueuePlayItem.episodeNumber ?? '')}_${String(activeQueuePlayItem.mediaId)}_${replayNonce}`}
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
                    const { playlistQueue: q, currentQueueIndex: idx, setCurrentQueueIndex: setIdx, clearQueue: clear, queueRepeatMode: mode } = useAppStore.getState()
                    if (mode === "one") {
                        setReplayNonce(n => n + 1)
                        return
                    }
                    const nextIdx = idx + 1
                    if (nextIdx < q.length) {
                        setIdx(nextIdx)
                    } else if (mode === "all" && q.length > 0) {
                        setIdx(0)
                    } else {
                        clear()
                    }
                }}
                hasNextEpisode={hasNext}
                onClose={() => {
                    startViewTransition(() => {
                        const { setActiveQueuePlayItem, setTvMode } = useAppStore.getState()
                        setActiveQueuePlayItem(null)
                        setTvMode(false)
                    })
                }}
            />
        </React.Suspense>
    )
})

function RootComponent() {
    const tvMode = useAppStore(state => state.tvMode)
    const showInitialSetup = useAppStore(state => state.showInitialSetup)
    const setShowInitialSetup = useAppStore(state => state.setShowInitialSetup)
    const chronologyOpen = useAppStore(state => state.chronologyOpen)
    const setChronologyOpen = useAppStore(state => state.setChronologyOpen)
    useTvDpad()
    const { data: status, isLoading, isError, refetch } = useGetStatus()

    const queryClient = useQueryClient()
    const routerState = useRouterState()
    const isCollectionFetching = useIsFetching({ queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key] }) > 0
    const [isInterfaceReady, setIsInterfaceReady] = React.useState(false)

    useApplyCustomTheme()

    // Warm the player chunk during idle so the first play is instant (no on-click
    // JS download, no Suspense fallback flash).
    React.useEffect(() => { prewarmVideoPlayer() }, [])

    // Update the splash status text dynamically
    React.useEffect(() => {
        const textEl = document.getElementById("global-loader-text")
        if (!textEl) return
        if (isLoading || !status) {
            textEl.textContent = "Iniciando KameHouse..."
        } else if (!isInterfaceReady) {
            textEl.textContent = "Cargando biblioteca..."
        } else {
            textEl.textContent = "Listo"
        }
    }, [isLoading, status, isInterfaceReady])

    // Coordinate splash screen dismissal with full interface readiness
    React.useEffect(() => {
        if (isLoading || !status) return

        // Onboarding wizard is ready as soon as status is available
        if (!status.settings?.id || showInitialSetup) {
            setIsInterfaceReady(true)
            return
        }

        // Normal dashboard mode: check if library collection or route is ready
        const hasCollection = !!queryClient.getQueryData([API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key])
        const routeReady = !routerState.isLoading && (!isCollectionFetching || hasCollection)

        if (routeReady) {
            setIsInterfaceReady(true)
        }

        // Safety fallback timeout: never hold splash screen longer than 1.5s after status is resolved
        const safetyTimer = setTimeout(() => {
            setIsInterfaceReady(true)
        }, 1500)

        return () => clearTimeout(safetyTimer)
    }, [isLoading, status, showInitialSetup, routerState.isLoading, isCollectionFetching, queryClient])

    // Once interface is ready, smoothly transition and remove the splash loader
    React.useEffect(() => {
        if (!isInterfaceReady) return

        const loader = document.getElementById("global-loader")
        if (loader) {
            loader.style.opacity = "0"
            loader.style.transform = "scale(1.02)"
            loader.style.pointerEvents = "none"
            const timer = setTimeout(() => {
                loader.remove()
            }, 450)

            // Notify Tauri desktop that the renderer is fully ready
            const desktopApi = typeof window !== "undefined" ? window.desktop : undefined
            if (desktopApi?.startup?.ready) {
                desktopApi.startup.ready()
            }

            return () => clearTimeout(timer)
        } else {
            const desktopApi = typeof window !== "undefined" ? window.desktop : undefined
            if (desktopApi?.startup?.ready) {
                desktopApi.startup.ready()
            }
        }
    }, [isInterfaceReady])

    // If server status errors completely, remove static loader and show interactive retry box
    React.useEffect(() => {
        if (isError && !status) {
            const loader = document.getElementById("global-loader")
            if (loader) {
                loader.remove()
            }
        }
    }, [isError, status])

    if (isLoading || !status) {
        return <LoadingOverlayWithLogo isError={isError} refetch={refetch} />
    }

    if (!status.settings?.id || showInitialSetup) {
        return (
            <AppLayout>
                <React.Suspense fallback={null}>
                    <GettingStarted status={status} onClose={() => setShowInitialSetup(false)} />
                </React.Suspense>
            </AppLayout>
        )
    }

    return (
        <AppLayout>
            <CustomThemeStyles />
            <LiquidGlassDefs />
            <DynamicBackdrop />
            <React.Suspense fallback={null}>
                <PerformanceMonitor />
            </React.Suspense>
            {!tvMode && <FloatingPillNav />}
            <React.Suspense fallback={null}>
                <CommandPalette />
            </React.Suspense>
            <React.Suspense fallback={null}>
                <GlobalQueueSidebar />
            </React.Suspense>
            <AppLayoutContent
                className={tvMode ? "pb-24" : "w-full"}
            >
                {!tvMode && <AppTopNav />}

                <PageTransition className={`flex-1 w-full overflow-y-auto ${!tvMode ? "pt-16 md:pt-0" : ""}`}>
                    <Outlet />
                </PageTransition>
            </AppLayoutContent>
            {tvMode ? <TvNavBar /> : <AppBottomNav />}

            <React.Suspense fallback={null}>
                <ChronologyModal isOpen={chronologyOpen} onClose={() => setChronologyOpen(false)} />
            </React.Suspense>

            <GlobalQueuePlayerOverlay />
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
    errorComponent: AppErrorBoundary,
    notFoundComponent: NotFound,
})
