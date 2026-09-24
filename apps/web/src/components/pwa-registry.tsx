"use client"
import { useEffect } from "react"
import { toast } from "sonner"

/**
 * Registra y gestiona el ciclo de vida del Service Worker (PWA) de KameHouse.
 * 
 * - En desarrollo desregistra service workers previos para no interferir con HMR.
 * - En producción detecta actualizaciones en segundo plano y muestra un prompt
 *   amigable usando Sonner sin interrumpir la reproducción HLS activa.
 */
export function PwaRegistry() {
    useEffect(() => {
        if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

        if (import.meta.env.DEV) {
            navigator.serviceWorker.getRegistrations().then((registrations) => {
                registrations.forEach((registration) => registration.unregister())
            })
            return
        }

        let refreshing = false

        // Al activarse el nuevo SW que toma control, recargamos la página una sola vez
        navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (!refreshing) {
                refreshing = true
                window.location.reload()
            }
        })

        const isVideoPlaying = () => {
            const video = document.querySelector("video")
            return Boolean(video && !video.paused && !video.ended && video.readyState > 2)
        }

        const promptUserForUpdate = (waitingWorker: ServiceWorker) => {
            // Si el usuario está viendo video, diferir un momento o mostrar acción no intrusiva
            const onUpdateClick = () => {
                waitingWorker.postMessage({ type: "SKIP_WAITING" })
            }

            // Mostrar toast con Sonner (respetando theming y tokens)
            toast("Nueva versión disponible", {
                description: isVideoPlaying()
                    ? "Hay una actualización lista. Se aplicará al recargar o al pulsar Actualizar."
                    : "Actualiza para disfrutar de las últimas mejoras y optimizaciones.",
                action: {
                    label: "Actualizar",
                    onClick: onUpdateClick,
                },
                duration: 12000,
            })
        }

        const register = async () => {
            try {
                const registration = await navigator.serviceWorker.register("/sw.js")

                // Si ya había un worker esperando activación cuando se abrió la app
                if (registration.waiting) {
                    promptUserForUpdate(registration.waiting)
                    return
                }

                // Escuchar cuando se descubra un nuevo worker instalándose
                registration.addEventListener("updatefound", () => {
                    const newWorker = registration.installing
                    if (!newWorker) return

                    newWorker.addEventListener("statechange", () => {
                        // Solo avisar si ya había un SW previo controlando la página
                        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                            promptUserForUpdate(newWorker)
                        }
                    })
                })
            } catch (err) {
                console.warn("[PWA] ServiceWorker registration failed: ", err)
            }
        }

        if (document.readyState === "complete") {
            register()
        } else {
            window.addEventListener("load", register)
            return () => window.removeEventListener("load", register)
        }
    }, [])

    return null
}
