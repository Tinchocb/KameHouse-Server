import { GradientBackground } from "@/components/shared/gradient-background"
import { TextGenerateEffect } from "@/components/shared/text-generate-effect"
import { Button } from "@/components/ui/button"
import { LoadingOverlay } from "@/components/ui/loading-spinner"
import { __isDesktop__ } from "@/types/constants"
import { SeaImage } from "@/components/shared/sea-image"
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
        <LoadingOverlay showSpinner={false}>
            {/* Cinematic Background Decoration */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.05]">
                <svg className="w-full h-full" viewBox="0 0 900 320" preserveAspectRatio="xMidYMid slice">
                    {Array.from({ length: 40 }).map((_, i) => (
                        <line
                            key={i}
                            x1="450" y1="160"
                            x2={450 + Math.cos((i / 40) * Math.PI * 2) * 1200}
                            y2={160 + Math.sin((i / 40) * Math.PI * 2) * 1200}
                            stroke="white"
                            strokeWidth={i % 5 === 0 ? "2" : "0.5"}
                        />
                    ))}
                </svg>
            </div>
            
            <SeaImage
            src="/kamehouse-logo.png"
            alt="Loading..."
            priority
            width={100}
            height={100}
            className="animate-pulse z-[1] rounded-2xl"
        />
        <GradientBackground />

        {timedOut ? (
            <div className="flex flex-col items-center gap-4 mt-4 z-[1] animate-in fade-in duration-500">
                <p className="text-[--muted] text-sm text-center max-w-xs">
                    No se pudo conectar al servidor.<br />
                    Verificá que el servidor esté corriendo.
                </p>
                <div className="flex gap-3">
                    <Button
                        onClick={() => window.location.reload()}
                        intent="gray-outline"
                        size="sm"
                        leftIcon={<RiRefreshLine />}
                    >
                        Reintentar
                    </Button>
                    <Button
                        onClick={() => { window.location.href = "/settings" }}
                        intent="primary-subtle"
                        size="sm"
                        leftIcon={<RiSettings3Line />}
                    >
                        Configuración
                    </Button>
                </div>
            </div>
        ) : (
            <TextGenerateEffect className="text-lg mt-2 text-[--muted] animate-pulse z-[1]" words={title ?? "K a m e H o u s e"} />
        )}

        {(__isDesktop__ && !!refetch) && (
            <Button
                onClick={() => window.location.reload()}
                className="mt-4 z-[1]"
                intent="gray-outline"
                size="sm"
                leftIcon={<RiRefreshLine />}
            >Recargar</Button>
        )}
    </LoadingOverlay>
    )
}
