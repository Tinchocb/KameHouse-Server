import { ApiError, isTransientStatus } from "@/api/client/requests"
import { WebsocketProvider } from "@/app/websocket-provider"
import { PwaRegistry } from "@/components/pwa-registry"
import { Toaster } from "@/components/ui/toaster"
import { QueryClient } from "@tanstack/react-query"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import { onCacheRestored, queryPersistOptions } from "@/lib/query-persister"
import { LazyMotion, MotionConfig } from "framer-motion"
import { loadMotionFeatures } from "@/lib/motion-features-loader"

import React from "react"
import { ServerAccessGate } from "./server-access-gate"

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
            // Excepción: 502/503/504 con Retry-After (backend arrancando o gateway caído) se reintentan
            // con backoff (~30s en total). Sin Retry-After el error es permanente y no se reintenta.
            retry: (failureCount, error) => {
                if (error instanceof ApiError) {
                    return isTransientStatus(error.status) && error.retryAfterMs !== undefined && failureCount < 15
                }
                return failureCount < 1
            },
            retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 3000),
        },
    },
})

export const ClientProviders: React.FC<ClientProvidersProps> = ({ children }) => {

    return (
        <MotionConfig reducedMotion="user">
            {/* Funciones de animación en un chunk aparte (ver motion-features-loader). */}
            <LazyMotion features={loadMotionFeatures} strict>
                <PersistQueryClientProvider
                    client={queryClient}
                    persistOptions={queryPersistOptions} onSuccess={onCacheRestored}
                >
                    <ServerAccessGate><WebsocketProvider>
                        {children}
                        <Toaster />
                        <PwaRegistry />
                    </WebsocketProvider></ServerAccessGate>
                </PersistQueryClientProvider>
            </LazyMotion>
        </MotionConfig>
    )
}
