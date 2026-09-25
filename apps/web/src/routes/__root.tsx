import { AppErrorBoundary } from "@/components/shared/app-error-boundary"
import { LoadingOverlayWithLogo } from "@/components/shared/loading-overlay-with-logo"
import { NotFound } from "@/components/shared/not-found"
import { QueryClient, useIsFetching, useQueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, Outlet, redirect, useRouter, useRouterState } from "@tanstack/react-router"
import { __isTauriDesktop__ } from "@/types/constants"
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

import { useAppStore, usePlayerStore, useQueueStore, useUIStore } from "@/lib/store"
import { DynamicBackdrop } from "@/components/shared/dynamic-backdrop"
import { useGetStatus } from "@/api/hooks/settings.hooks"
const GlobalQueueSidebar = React.lazy(() =>
    import("@/components/shared/global-queue-sidebar").then((m) => ({ default: m.GlobalQueueSidebar }))
)
const GettingStarted = React.lazy(() =>
    import("@/components/shared/getting-started").then((m) => ({ default: m.GettingStarted }))
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
                    const { playlistQueue: q, currentQueueIndex: idx, setCurrentQueueIndex: setIdx, clearQueue: clear, queueRepeatMode: mode } = useQueueStore.getState()
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
                        useQueueStore.getState().setActiveQueuePlayItem(null)
                        usePlayerStore.getState().setTvMode(false)
                    })
                }}
            />
        </React.Suspense>
    )
})

function RootComponent() {
    const tvMode = useAppStore(state => state.tvMode)
    const showInitialSetup = useAppStore(state => state.showInitialSetup)
    const setShowInitialSetup = useUIStore(state => state.setShowInitialSetup)
    useTvDpad()
    const { data: status, isLoading, isError, refetch } = useGetStatus()

    const router = useRouter()
    const queryClient = useQueryClient()
    const routerState = useRouterState()
    const isCollectionFetching = useIsFetching({ queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key] }) > 0
    const [isInterfaceReady, setIsInterfaceReady] = React.useState(false)

    useApplyCustomTheme()

    // Warm the player chunk during idle so the first play is instant (no on-click
    // JS download, no Suspense fallback flash).
    React.useEffect(() => { prewarmVideoPlayer() }, [])

    // Precargar rutas de secciones principales en idle tras montar la interfaz
    React.useEffect(() => {
        if (!isInterfaceReady) return
        const runPreload = () => {
            void router.preloadRoute({ to: "/movies" }).catch(() => {})
            void router.preloadRoute({ to: "/series" }).catch(() => {})
        }
        if (typeof window !== "undefined" && "requestIdleCallback" in window) {
            const handle = (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number; cancelIdleCallback: (id: number) => void }).requestIdleCallback(runPreload, { timeout: 3000 })
            return () => (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(handle)
        } else {
            const timer = setTimeout(runPreload, 800)
            return () => clearTimeout(timer)
        }
    }, [isInterfaceReady, router])

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

    const isReadyNow = !isLoading && !!status && (
        !status.settings?.id ||
        showInitialSetup ||
        (!routerState.isLoading && (!isCollectionFetching || !!queryClient.getQueryData([API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key])))
    )

    if (!isInterfaceReady && isReadyNow) {
        setIsInterfaceReady(true)
    }

    // Safety fallback timeout: never hold splash screen longer than 1.5s after status is resolved
    React.useEffect(() => {
        if (isInterfaceReady || isLoading || !status) return

        const safetyTimer = setTimeout(() => {
            setIsInterfaceReady(true)
        }, 1500)

        return () => clearTimeout(safetyTimer)
    }, [isInterfaceReady, isLoading, status])

    // Once interface is ready, reveal the interface and remove the HTML loader.
    React.useEffect(() => {
        if (!isInterfaceReady) return

        // Avisar inmediatamente a Tauri para destruir el splash nativo y revelar la ventana main
        const desktopApi = typeof window !== "undefined" ? window.desktop : undefined
        if (desktopApi?.startup?.ready) {
            desktopApi.startup.ready()
        }

        const loader = document.getElementById("global-loader")
        if (!loader) return

        // Transición splash → interfaz (estilos en index.html): el loader se abre y
        // se desvanece mientras la interfaz entra con un leve zoom de asentamiento.
        // En Tauri la ventana main se revela recién tras ready(); se espera un
        // instante para que la transición se vea en vez de correr con la ventana oculta.
        const startDelay = __isTauriDesktop__ ? 140 : 0
        const root = document.getElementById("root")
        let removeTimer: ReturnType<typeof setTimeout> | undefined

        const startTimer = setTimeout(() => {
            loader.classList.add("is-exiting")
            if (root) {
                root.classList.add("kh-root-enter")
                const onEnd = (e: AnimationEvent) => {
                    // animationend burbujea desde los hijos: solo cuenta la del propio #root
                    if (e.target !== root) return
                    root.classList.remove("kh-root-enter")
                    root.removeEventListener("animationend", onEnd)
                }
                root.addEventListener("animationend", onEnd)
            }
            removeTimer = setTimeout(() => loader.remove(), 600)
        }, startDelay)

        return () => {
            clearTimeout(startTimer)
            if (removeTimer) clearTimeout(removeTimer)
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
        if (isError) {
            return <LoadingOverlayWithLogo isError={isError} refetch={refetch} />
        }
        // Anti-flash: no montar un segundo loader React sobre el HTML splash.
        // El #global-loader de index.html sigue visible hasta isInterfaceReady.
        return null
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
            <SkipToContent />
            <CustomThemeStyles />
            <LiquidGlassDefs />
            <DynamicBackdrop />
            {import.meta.env.DEV && (
                <React.Suspense fallback={null}>
                    <PerformanceMonitor />
                </React.Suspense>
            )}
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

                <PageTransition
                    id={MAIN_CONTENT_ID}
                    tabIndex={-1}
                    data-scroll-container="true"
                    className={`flex-1 w-full overflow-y-auto outline-none ${!tvMode ? "pt-[calc(4rem+env(safe-area-inset-top,0px))] md:pt-0" : ""}`}
                >
                    <Outlet />
                </PageTransition>
            </AppLayoutContent>
            {tvMode ? <TvNavBar /> : <AppBottomNav />}

            <GlobalQueuePlayerOverlay />
        </AppLayout>
    )
}

const MAIN_CONTENT_ID = "main-content"

/** Primer foco de Tab: salta la navegación. Foco manual en vez de navegar al
 *  hash para no tocar la URL del router. */
function SkipToContent() {
    return (
        <a
            href={`#${MAIN_CONTENT_ID}`}
            onClick={(e) => {
                e.preventDefault()
                document.getElementById(MAIN_CONTENT_ID)?.focus()
            }}
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[9999] focus:inline-flex focus:items-center focus:min-h-[44px] focus:px-5 focus:rounded-full focus:bg-white focus:text-zinc-950 focus:text-sm focus:font-semibold focus:outline-none focus:ring-2 focus:ring-brand-accent"
        >
            Saltar al contenido
        </a>
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
