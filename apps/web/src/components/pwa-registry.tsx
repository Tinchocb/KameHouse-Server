"use client"
import { useEffect } from "react"

export function PwaRegistry() {
    useEffect(() => {
        if (typeof window !== "undefined" && "serviceWorker" in navigator) {
            window.addEventListener("load", () => {
                navigator.serviceWorker.register("/sw.js").catch((err) => {
                    console.error("[PWA] ServiceWorker registration failed: ", err)
                })
            })
        }
    }, [])

    return null
}
