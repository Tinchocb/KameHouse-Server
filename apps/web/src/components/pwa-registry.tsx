"use client"
import { useEffect } from "react"
import { toast } from "sonner"

/**
 * Registra y gestiona el ciclo de vida del Service Worker (PWA) de KameHouse.
 * 
 * - En desarrollo desregistra service workers previos para no interferir con HMR.
 * - En producción detecta actualizaciones en segundo plano. Si la app se acaba de abrir
 *   y no hay video reproduciéndose, la nueva versión se aplica sola (una recarga);
 *   en cualquier otro momento muestra un prompt con Sonner sin interrumpir la
 *   reproducción HLS activa.
 *
 * Sin la aplicación automática, una versión nueva queda "esperando" hasta que se
 * cierren todas las ventanas: en la app de escritorio (una sola ventana) el aviso de
 * 12 s se pierde fácilmente y se sigue viendo la interfaz vieja durante días.
 */

/** Ventana desde la carga de la página en la que aplicar una actualización es inocuo. */
export const APPLY_UPDATE_WINDOW_MS = 30_000

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
        // Sin controlador al abrir = primera instalación: el SW toma control
        // (clientsClaim) con la misma versión que ya está cargada. Recargar ahí
        // mostraba el splash dos veces y bajaba todo de nuevo.
        const hadController = Boolean(navigator.serviceWorker.controller)

        // Al activarse el nuevo SW que toma control, recargamos la página una sola vez
        const onControllerChange = () => {
            if (!hadController) return
            if (!refreshing) {
                refreshing = true
                window.location.reload()
            }
        }
        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange)

        const isVideoPlaying = () => {
            const video = document.querySelector("video")
            return Boolean(video && !video.paused && !video.ended && video.readyState > 2)
        }

        // Recién abierta la app y sin video: recargar cuesta un instante y evita que el
        // usuario quede con la versión anterior. Después, se le avisa y decide.
        const handleUpdateReady = (waitingWorker: ServiceWorker) => {
            if (!isVideoPlaying() && performance.now() < APPLY_UPDATE_WINDOW_MS) {
                waitingWorker.postMessage({ type: "SKIP_WAITING" })
                return
            }
            promptUserForUpdate(waitingWorker)
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
                    handleUpdateReady(registration.waiting)
                    return
                }

                // Escuchar cuando se descubra un nuevo worker instalándose
                registration.addEventListener("updatefound", () => {
                    const newWorker = registration.installing
                    if (!newWorker) return

                    newWorker.addEventListener("statechange", () => {
                        // Solo avisar si ya había un SW previo controlando la página
                        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                            handleUpdateReady(newWorker)
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
        }

        return () => {
            navigator.serviceWorker.removeEventListener?.("controllerchange", onControllerChange)
            window.removeEventListener("load", register)
        }
    }, [])

    return null
}
