import { ClientProviders, queryClient } from "@/app/client-providers"
import "./app/globals.css"
import { createRouter, RouterProvider } from "@tanstack/react-router"
import React from "react"
import ReactDOM from "react-dom/client"
import { routeTree } from "./routeTree.gen"
import "@fontsource-variable/inter"
import "@fontsource/bebas-neue/400.css"

const router = createRouter({
    routeTree,
    // defaultPreload: import.meta.env.PROD ? "intent" : false,
    defaultPreload: false, // Platform rate limits
    context: {
        queryClient,
    },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
})

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router
    }
}

// react-scan is available for profiling, but opt-in only via VITE_REACT_SCAN=true
// to avoid mandatory internet access on every dev start.
// To enable: VITE_REACT_SCAN=true npm run dev
if (import.meta.env.DEV && import.meta.env.VITE_REACT_SCAN === "true") {
    const script = document.createElement("script")
    script.src = "https://unpkg.com/react-scan/dist/auto.global.js"
    script.crossOrigin = "anonymous"
    document.head.appendChild(script)
}

ReactDOM.createRoot(document.getElementById("root")!).render(
    <ClientProviders>
        <RouterProvider router={router} />
    </ClientProviders>,
)
