import { ApiError, isTransientStatus } from "@/api/client/requests"
import { WebsocketProvider } from "@/app/websocket-provider"
import { PwaRegistry } from "@/components/pwa-registry"
import { Toaster } from "@/components/ui/toaster"
import { QueryClient } from "@tanstack/react-query"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import { queryPersistOptions } from "@/lib/query-persister"
import { LazyMotion, MotionConfig, domMax } from "framer-motion"

import React, { useEffect } from "react"
import { CookiesProvider } from "react-cookie"
import { usePlayerStore } from "@/lib/store"

interface ClientProvidersProps {
    children?: React.ReactNode
}

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            structuralSharing: true,
            staleTime: 60 * 60 * 1000,         // 1 hour (reducido de 24h para mantener datos frescos)
            gcTime: 24 * 60 * 60 * 1000,       // 24 hours en memoria, persistido en IndexedDB
            // Smart retry: requests.ts ya absorbe los reintentos idempotentes (GET) a nivel transporte.
            // Para ApiError no duplicar tormenta; para fallos de red inesperados permitir 1 reintento.
            // Excepción: 502/503/504 significa backend arrancando (sidecar) o gateway caído;
            // es transitorio, así que se reintenta con backoff (~30s en total).
            retry: (failureCount, error) => {
                if (error instanceof ApiError) {
                    return isTransientStatus(error.status) && failureCount < 15
                }
                return failureCount < 1
            },
            retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 3000),
        },
    },
})

export const ClientProviders: React.FC<ClientProvidersProps> = ({ children }) => {
    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            if (params.get("tvMode") === "true") {
                usePlayerStore.getState().setTvMode(true);
                // Remove parameter from URL history so navigation remains clean
                window.history.replaceState({}, "", window.location.pathname);
            }
        }
    }, []);

    return (
        <MotionConfig reducedMotion="user">
            <LazyMotion features={domMax} strict>
                <CookiesProvider>
                    <PersistQueryClientProvider
                        client={queryClient}
                        persistOptions={queryPersistOptions}
                    >
                        <WebsocketProvider>
                            {children}
                            <Toaster />
                            <PwaRegistry />
                        </WebsocketProvider>
                    </PersistQueryClientProvider>
                </CookiesProvider>
            </LazyMotion>
        </MotionConfig>
    )
}
