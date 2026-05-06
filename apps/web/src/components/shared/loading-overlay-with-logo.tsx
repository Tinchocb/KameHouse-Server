import { Button } from "@/components/ui/button"
import { LoadingOverlay } from "@/components/ui/loading-spinner"
import { __isDesktop__ } from "@/types/constants"
import { DeferredImage } from "@/components/shared/deferred-image"
import React, { useEffect, useState } from "react"
import { RiSettings3Line, RiRefreshLine } from "react-icons/ri"

const CONNECTION_TIMEOUT_MS = 15000 // 15 seconds

export function LoadingOverlayWithLogo({ refetch, title }: { refetch?: () => void, title?: string }) {
    const [timedOut, setTimedOut] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => {
            setTimedOut(true)
        }, CONNECTION_TIMEOUT_MS)
        return () => clearTimeout(timer)
    }, [])

    return (
        <LoadingOverlay showSpinner={false} className="bg-black">
            {/* Cinematic Background Decoration - Monochromatic */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
                <svg className="w-full h-full" viewBox="0 0 900 320" preserveAspectRatio="xMidYMid slice">
                    {Array.from({ length: 60 }).map((_, i) => (
                        <line
                            key={i}
                            x1="450" y1="160"
                            x2={450 + Math.cos((i / 60) * Math.PI * 2) * 1200}
                            y2={160 + Math.sin((i / 60) * Math.PI * 2) * 1200}
                            stroke="white"
                            strokeWidth="0.5"
                        />
                    ))}
                </svg>
            </div>
            
            <DeferredImage
                src="/kamehouse-logo.png"
                alt="Loading..."
                priority
                className="w-24 h-24 animate-pulse z-[1] grayscale brightness-200"
            />


        {timedOut ? (
            <div className="flex flex-col items-center gap-4 mt-6 z-[1] animate-in fade-in slide-in-from-bottom-2 duration-500">
                <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest text-center max-w-xs">
                    Error de conexión<br />
                    <span className="opacity-50 mt-1 block">El servidor no responde</span>
                </p>
                <div className="flex gap-4">
                    <Button
                        onClick={() => window.location.reload()}
                        intent="gray"
                        size="sm"
                        className="rounded-none border-zinc-800"
                        leftIcon={<RiRefreshLine />}
                    >
                        Reintentar
                    </Button>
                    <Button
                        onClick={() => { window.location.href = "/settings" }}
                        intent="white"
                        size="sm"
                        className="rounded-none"
                        leftIcon={<RiSettings3Line />}
                    >
                        Configuración
                    </Button>
                </div>
            </div>
        ) : (
            <div className="mt-6 flex flex-col items-center gap-2 z-[1]">
                <h1 className="text-white text-3xl font-bebas tracking-[0.2em] uppercase animate-pulse">
                    {title ?? "KameHouse"}
                </h1>
                <div className="h-[1px] w-12 bg-white/20 animate-scale-x" />
            </div>
        )}

        {(__isDesktop__ && !!refetch) && (
            <Button
                onClick={() => window.location.reload()}
                className="mt-8 z-[1] rounded-none border-zinc-800"
                intent="gray"
                size="sm"
                leftIcon={<RiRefreshLine />}
            >Recargar página</Button>
        )}
    </LoadingOverlay>
    )
}
