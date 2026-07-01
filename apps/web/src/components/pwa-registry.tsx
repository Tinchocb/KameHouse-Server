"use client"
import { useEffect } from "react"

export function PwaRegistry() {
    useEffect(() => {
        if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

        if (process.env.NODE_ENV !== "production") {
            // Dev mode never generates /sw.js (see rsbuild.config.ts), but a
            // service worker registered by an earlier production build can
            // still be active and keep serving its precached (stale) bundle
            // instead of the live dev server output. Unregister it so dev
            // always reflects the current code.
            navigator.serviceWorker.getRegistrations().then((registrations) => {
                registrations.forEach((registration) => registration.unregister())
            })
            return
        }

        window.addEventListener("load", () => {
            navigator.serviceWorker.register("/sw.js").catch((err) => {
                console.error("[PWA] ServiceWorker registration failed: ", err)
            })
        })
    }, [])

    return null
}
