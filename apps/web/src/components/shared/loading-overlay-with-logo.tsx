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
        <LoadingOverlay showSpinner={false} className="bg-zinc-950">
            {/* Cinematic Background Decoration - Spirit Bomb convergence */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,165,0,0.05)_0%,transparent_70%)] animate-pulse" />
                <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: `url("https://grainy-gradients.vercel.app/noise.svg")` }} />
            </div>
            
            <div className="relative flex items-center justify-center">
                {/* 7 Dragon Balls Orbiting */}
                <div className="absolute w-48 h-48 animate-spin-slow">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <div
                            key={i}
                            className="absolute w-3 h-3 bg-brand-orange rounded-full shadow-[0_0_15px_rgba(251,146,60,0.8)]"
                            style={{
                                top: "50%",
                                left: "50%",
                                transform: `rotate(${i * (360 / 7)}deg) translate(80px) rotate(-${i * (360 / 7)}deg)`,
                            }}
                        >
                            <div className="absolute inset-0 bg-white/20 blur-[1px] rounded-full scale-50" />
                        </div>
                    ))}
                </div>

                {/* Central Logo with aura */}
                <div className="relative group">
                    <div className="absolute inset-0 bg-brand-orange/20 blur-3xl rounded-full animate-pulse" />
                    <DeferredImage
                        src="/kamehouse-logo.png"
                        alt="Loading..."
                        priority
                        className="w-24 h-24 z-[1] relative hover:scale-110 transition-transform duration-700 brightness-110"
                    />
                </div>
            </div>


        {timedOut ? (
            <div className="flex flex-col items-center gap-4 mt-12 z-[1] animate-in fade-in slide-in-from-bottom-2 duration-500">
                <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest text-center max-w-xs">
                    Error de conexión<br />
                    <span className="opacity-50 mt-1 block font-light">El servidor de la Capsule Corp. no responde</span>
                </p>
                <div className="flex gap-4">
                    <Button
                        onClick={() => window.location.reload()}
                        intent="gray"
                        size="sm"
                        className="rounded-xl border-zinc-800 uppercase tracking-widest text-[10px]"
                        leftIcon={<RiRefreshLine />}
                    >
                        Reintentar
                    </Button>
                    <Button
                        onClick={() => { window.location.href = "/settings" }}
                        intent="white"
                        size="sm"
                        className="rounded-xl uppercase tracking-widest text-[10px]"
                        leftIcon={<RiSettings3Line />}
                    >
                        Configuración
                    </Button>
                </div>
            </div>
        ) : (
            <div className="mt-12 flex flex-col items-center gap-4 z-[1]">
                <div className="flex flex-col items-center">
                    <h1 className="text-white text-4xl font-bebas tracking-[0.3em] uppercase leading-none">
                        {title ?? "KameHouse"}
                    </h1>
                    <span className="text-[10px] text-brand-orange font-black tracking-[0.5em] uppercase opacity-50 mt-2">Ultra Instinct</span>
                </div>
                <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-scale-x" />
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
