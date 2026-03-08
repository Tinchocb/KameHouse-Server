import { APIError } from "@/api/client/requests"
import { WebsocketProvider } from "@/app/websocket-provider"
import { CustomCSSProvider } from "@/components/shared/custom-css-provider"
import { CustomThemeProvider } from "@/components/shared/custom-theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createStore } from "jotai"
import { Provider as JotaiProvider } from "jotai/react"
import { ThemeProvider } from "next-themes"
import React, { useEffect } from "react"
import { CookiesProvider } from "react-cookie"
import { toast } from "sonner"

interface ClientProvidersProps {
    children?: React.ReactNode
}

/** Status codes that should NEVER be retried — they indicate a definitive client error. */
const NO_RETRY_STATUSES = new Set([400, 401, 403, 404, 422])

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            staleTime: 5 * 60 * 1000,        // 5 min fresh
            gcTime: 30 * 60 * 1000,           // 30 min in-cache (prevents flicker on rapid nav)
            // Smart retry: 1 attempt for transient errors, 0 for definitive failures.
            retry: (failureCount, error) => {
                if (error instanceof APIError && NO_RETRY_STATUSES.has(error.status)) {
                    return false
                }
                return failureCount < 1
            },
        },
        mutations: {
            // Global fallback: any unhandled mutation failure shows a toast.
            // Individual hooks can still add their own onError and call options.onError().
            onError: (error) => {
                if (error instanceof APIError) {
                    const msg = (error.data as Record<string, string>)?.error ?? error.message
                    if (!msg.includes("feature disabled")) {
                        toast.error(msg || "An unexpected error occurred")
                    }
                }
            },
        },
    },
})

export const store = createStore()

export const ClientProviders: React.FC<ClientProvidersProps> = ({ children }) => {

    // Register the Workbox/OPFS Service Worker for Aggressive Video Caching
    useEffect(() => {
        if ('serviceWorker' in navigator && import.meta.env.PROD) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').then(
                    (registration) => {
                        console.log('Antigravity OPFS ServiceWorker registered: ', registration.scope);
                    },
                    (err) => {
                        console.error('Antigravity OPFS ServiceWorker registration failed: ', err);
                    }
                );
            });
        }
    }, []);

    return (
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme={"dark"}>
            <CookiesProvider>
                <JotaiProvider store={store}>
                    <QueryClientProvider client={queryClient}>
                        <WebsocketProvider>
                            {children}
                            <CustomThemeProvider />
                            <Toaster />
                        </WebsocketProvider>
                        <CustomCSSProvider />
                        {/*{import.meta.env.MODE === "development" && <React.Suspense fallback={null}>*/}
                        {/*    <ReactQueryDevtools />*/}
                        {/*</React.Suspense>}*/}
                    </QueryClientProvider>
                </JotaiProvider>
            </CookiesProvider>
        </ThemeProvider>
    )

}
