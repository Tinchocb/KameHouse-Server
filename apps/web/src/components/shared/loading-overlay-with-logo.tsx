import { Button } from "@/components/ui/button"
import React, { useEffect, useState } from "react"
import { IconUiRefresh, IconNavigationSettings } from "@/components/ui/icons";
import { cn } from "@/components/ui/core/styling"

const CONNECTION_TIMEOUT_MS = 25000 // 25 seconds before showing troubleshooting box

export function LoadingOverlayWithLogo({
    refetch,
    title,
    isError,
    message,
    className,
}: {
    refetch?: () => void
    title?: string
    isError?: boolean
    message?: string
    className?: string
}) {
    const [timedOut, setTimedOut] = useState(false)
    const [dynamicStatusMessage, setStatusMessage] = useState("Iniciando KameHouse...")
    const statusMessage = message || dynamicStatusMessage

    useEffect(() => {
        let isMounted = true
        // Progressive status message transitions
        const t1 = setTimeout(() => { if (isMounted) setStatusMessage("Iniciando servicios...") }, 2000)
        const t2 = setTimeout(() => { if (isMounted) setStatusMessage("Conectando con el servidor...") }, 4500)
        const t3 = setTimeout(() => { if (isMounted) setStatusMessage("Sincronizando estado local...") }, 8000)

        // Listen for Tauri backend events if available
        let unlisten: (() => void) | undefined
        if (typeof window !== "undefined") {
            const hasTauri = typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== "undefined"
            if (hasTauri) {
                import("@tauri-apps/api/event").then(({ listen }) => {
                    if (!isMounted) return
                    listen<string>("server-status", (event) => {
                        if (!isMounted) return
                        if (event.payload === "compiling") {
                            setStatusMessage("Compilando servidor...")
                        } else if (event.payload === "starting") {
                            setStatusMessage("Iniciando backend...")
                        } else if (event.payload === "ready") {
                            setStatusMessage("Servidor listo. Conectando...")
                        }
                    }).then((fn) => {
                        if (isMounted) unlisten = fn
                        else fn()
                    }).catch(() => {})
                }).catch(() => {})
            }
        }

        // Connection timeout
        const timeoutTimer = setTimeout(() => {
            if (isMounted) setTimedOut(true)
        }, CONNECTION_TIMEOUT_MS)

        return () => {
            isMounted = false
            clearTimeout(t1)
            clearTimeout(t2)
            clearTimeout(t3)
            clearTimeout(timeoutTimer)
            if (unlisten) unlisten()
        }
    }, [])

    useEffect(() => {
        // Sync message with HTML global loader text if present
        const textEl = document.getElementById("global-loader-text")
        if (textEl && textEl.textContent !== statusMessage) {
            textEl.textContent = statusMessage
        }
    }, [statusMessage])

    useEffect(() => {
        // If we have an error and haven't timed out yet, poll the backend periodically.
        if (isError && !timedOut) {
            const interval = setInterval(() => {
                if (refetch) {
                    refetch()
                }
            }, 1200)
            return () => clearInterval(interval)
        }
    }, [isError, timedOut, refetch])

    const showFailure = timedOut || (isError && timedOut)

    return (
        <div
            className={cn(
                "UI-LoadingOverlay__overlay fixed inset-0 z-50 bg-[var(--bg-primary)] flex flex-col justify-center items-center overflow-hidden select-none",
                className
            )}
        >
            {/* Título & Branding */}
            <div className="flex flex-col items-center gap-7 z-[1] text-center">
                <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-cinema-md uppercase leading-none text-white drop-shadow-[0_0_28px_rgba(245,158,11,0.25)] pl-[0.3em]">
                    {title ?? "KAMEHOUSE"}
                </h1>

                {/* 3 Pelotas de Dragon Ball cargando */}
                {!showFailure && (
                    <div className="flex flex-col items-center gap-3.5 animate-in fade-in duration-300">
                        <div className="flex items-center gap-3 h-8">
                            <span className="w-3.5 h-3.5 rounded-full bg-[radial-gradient(circle_at_35%_35%,#fde68a,#f59e0b_60%,#b45309_100%)] shadow-[0_0_16px_rgba(245,158,11,0.65)] animate-bounce [animation-delay:-0.32s]" />
                            <span className="w-3.5 h-3.5 rounded-full bg-[radial-gradient(circle_at_35%_35%,#fde68a,#f59e0b_60%,#b45309_100%)] shadow-[0_0_16px_rgba(245,158,11,0.65)] animate-bounce [animation-delay:-0.16s]" />
                            <span className="w-3.5 h-3.5 rounded-full bg-[radial-gradient(circle_at_35%_35%,#fde68a,#f59e0b_60%,#b45309_100%)] shadow-[0_0_16px_rgba(245,158,11,0.65)] animate-bounce" />
                        </div>
                        <p className="text-caption font-mono tracking-ultra text-on-surface-variant uppercase transition-all duration-300">
                            {statusMessage}
                        </p>
                    </div>
                )}
            </div>

            {/* Estado de error / Desconexión solo tras timeout real */}
            {showFailure ? (
                <div className="flex flex-col items-center gap-3 mt-6 z-[1] animate-in fade-in zoom-in-95 duration-300 max-w-sm px-6 py-5 rounded-2xl bg-surface-container-high/80 border border-outline-variant/40 backdrop-blur-overlay-md shadow-2xl shadow-black/80 text-center mx-4">
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-brand-destructive/10 border border-brand-destructive/20">
                        <span className="w-2 h-2 rounded-full bg-brand-destructive animate-pulse" />
                        <span className="text-caption font-medium uppercase tracking-wider text-brand-destructive font-mono">
                            Error de conexión
                        </span>
                    </div>
                    <p className="text-on-surface-variant text-xs font-normal leading-relaxed">
                        El servidor no responde. Comprueba que el backend de KameHouse esté en ejecución.
                    </p>
                    <div className="flex items-center gap-3 mt-2 w-full">
                        <Button
                            onClick={() => {
                                if (refetch) refetch()
                                else window.location.reload()
                            }}
                            intent="primary-glass"
                            size="sm"
                            className="flex-1 rounded-xl uppercase tracking-wider text-xs font-semibold hover:bg-white/15"
                            leftIcon={<IconUiRefresh className="w-3.5 h-3.5" />}
                        >
                            Reintentar
                        </Button>
                        <Button
                            onClick={() => { window.location.href = "/settings" }}
                            intent="gray-glass"
                            size="sm"
                            className="flex-1 rounded-xl uppercase tracking-wider text-xs font-semibold"
                            leftIcon={<IconNavigationSettings className="w-3.5 h-3.5" />}
                        >
                            Ajustes
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
