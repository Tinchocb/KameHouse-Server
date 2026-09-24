import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { __isDesktop__, __isTauriDesktop__ } from "@/types/constants"
import { ClientProviders, queryClient } from "@/app/client-providers"
import "./app/globals.css"
import "@/lib/desktop-bridge"
import { createRouter, RouterProvider } from "@tanstack/react-router"
import React from "react"
import ReactDOM from "react-dom/client"
import { routeTree } from "./routeTree.gen"
import "@fontsource-variable/outfit/wght.css"
import "@fontsource/space-mono/400.css"
import "@fontsource/space-mono/700.css"

const router = createRouter({
    routeTree,
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    // Anti-flash: solo mostrar pending si la carga supera 800ms (evita
    // contenido->skeleton->contenido en navegaciones rápidas con caché),
    // y no forzar duración mínima larga del skeleton.
    defaultPendingMs: 800,
    defaultPendingMinMs: 200,
    context: {
        queryClient,
    },
    scrollRestoration: true,
    defaultPreloadStaleTime: 30000,
})

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router
    }
}

// React Scan para profiling visual (activable con VITE_SCAN=true o localStorage.setItem("kamehouse:scan", "true"))
const shouldEnableScan = typeof window !== "undefined" && import.meta.env.DEV && (
    import.meta.env.VITE_SCAN === "true" ||
    window.localStorage?.getItem("kamehouse:scan") === "true"
)
if (shouldEnableScan) {
    import("react-scan").then(({ scan }) => {
        scan({
            enabled: true,
            log: false,
        })
    }).catch(() => {})
}

// Global error telemetry — capture unhandled errors and promise rejections.
// In desktop (Tauri) mode the errors are also emitted to the Rust-side event
// bus so they appear in the app's native log file.
window.addEventListener("unhandledrejection", (event) => {
    const raw = event.reason
    let reason: { message: string; stack?: string }
    if (raw instanceof Error) {
        reason = { message: raw.message, stack: raw.stack }
    } else if (raw && typeof raw === "object") {
        // Non-Error rejections (e.g. a rejected fetch/Response or an API error
        // object) stringify to "[object Object]" and lose all info. Serialize the
        // object so the log is actually actionable.
        let serialized: string
        try {
            serialized = JSON.stringify(raw, Object.getOwnPropertyNames(raw))
        } catch {
            serialized = String(raw)
        }
        reason = { message: serialized }
    } else {
        reason = { message: String(raw) }
    }
    console.error("[global] Unhandled promise rejection:", reason)
    try {
        if (typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== "undefined") {
            import("@tauri-apps/api/event").then(({ emit }) =>
                emit("web-error", { type: "unhandledrejection", ...reason }).catch(() => {})
            ).catch(() => {})
        }
    } catch { /* non-fatal */ }
})

window.addEventListener("error", (event) => {
    const info = { message: event.message, filename: event.filename, line: event.lineno, col: event.colno }
    console.error("[global] Uncaught error:", info)
    try {
        if (typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== "undefined") {
            import("@tauri-apps/api/event").then(({ emit }) =>
                emit("web-error", { type: "error", ...info }).catch(() => {})
            ).catch(() => {})
        }
    } catch { /* non-fatal */ }
})

function init() {
    const rootElement = document.getElementById("root")
    if (!rootElement) {
        throw new Error("Root element '#root' not found in DOM")
    }
    // Renderizamos la UI de inmediato para que la pantalla de carga se muestre sin ningún retraso
    ReactDOM.createRoot(rootElement).render(
        <ClientProviders>
            <RouterProvider router={router} />
        </ClientProviders>,
    )

    if (__isDesktop__ && __isTauriDesktop__) {
        import("@tauri-apps/api/core").then(({ invoke }) => {
            // NOTA: el aviso `startup_renderer_ready` NO va acá: se envía desde
            // __root.tsx (desktopApi.startup.ready) cuando la interfaz ya está pintada,
            // para que la ventana principal se revele con la app lista y no con el loader.

            // Resolvemos el puerto dinámico del servidor Go
            invoke<number>("get_local_server_port")
                .then((port) => {
                    if (port) {
                        window.__KAMEHOUSE_PORT__ = port
                        queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.STATUS.GetStatus.key] })
                        window.dispatchEvent(new CustomEvent("kamehouse-port-resolved", { detail: { port } }))
                    }
                })
                .catch((e) => {
                    console.error("[Desktop] Failed to get dynamic server port", e)
                })
        }).catch(() => {})
    }
}

init()
