import React, { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { AUTH_CHANGED_EVENT, getServerSession, requestServerSession, SessionError, setServerSession } from "@/api/client/auth"
import { Button } from "@/components/ui/button"
import { TextInput } from "@/components/ui/text-input"
import { queryPersistOptions } from "@/lib/query-persister"
import { useIsMinimalistMode } from "@/lib/theme/use-classic-mode"

export function SessionLogout() {
    if (!getServerSession()?.required) return null
    return <Button intent="secondary" onClick={() => setServerSession(null)}>Cerrar sesión en este dispositivo</Button>
}

/** No cached library or WebSocket is mounted until a live access check succeeds. */
export function ServerAccessGate({ children }: { children: React.ReactNode }) {
    const isMinimalist = useIsMinimalistMode()
    const queryClient = useQueryClient()
    const [state, setState] = useState<"checking" | "open" | "locked" | "error">("checking")
    const [password, setPassword] = useState("")
    const [message, setMessage] = useState("")
    const [busy, setBusy] = useState(false)
    const [retryAt, setRetryAt] = useState(0)
    const [seconds, setSeconds] = useState(0)
    const [probe, setProbe] = useState(0)

    useEffect(() => {
        const changed = () => {
            if (!getServerSession()) {
                setState("locked")
                void queryClient.cancelQueries()
                queryClient.clear()
                void queryPersistOptions.persister.removeClient()
            }
        }
        const portChanged = () => { setState("checking"); setProbe(n => n + 1) }
        window.addEventListener(AUTH_CHANGED_EVENT, changed)
        window.addEventListener("kamehouse-port-resolved", portChanged)
        return () => {
            window.removeEventListener(AUTH_CHANGED_EVENT, changed)
            window.removeEventListener("kamehouse-port-resolved", portChanged)
        }
    }, [queryClient])

    useEffect(() => {
        const controller = new AbortController()
        let retryTimer: ReturnType<typeof setTimeout> | undefined
        const startedAt = Date.now()
        const check = async () => {
            try {
                const port = await window.desktop?.localServer?.getPort()
                if (controller.signal.aborted) return
                if (port && port !== window.__KAMEHOUSE_PORT__) {
                    window.__KAMEHOUSE_PORT__ = port
                    window.dispatchEvent(new CustomEvent("kamehouse-port-resolved", { detail: { port } }))
                    return
                }
                const session = await requestServerSession(undefined, controller.signal)
                if (controller.signal.aborted) return
                setServerSession(session)
                setState("open")
            } catch (error) {
                if (controller.signal.aborted) return
                if (error instanceof SessionError && (error.status === 401 || error.status === 429)) {
                    setServerSession(null)
                    setState("locked")
                    if (error.status === 429) setRetryAt(Date.now() + error.retryAfter * 1000)
                } else {
                    if (Date.now() - startedAt >= 10_000) {
                        setMessage("No se pudo conectar con el servidor.")
                        setState("error")
                    }
                    retryTimer = setTimeout(() => { void check() }, 2000)
                }
            }
        }
        void check()
        return () => { controller.abort(); clearTimeout(retryTimer) }
    }, [probe])

    useEffect(() => {
        if (state !== "open" || !getServerSession()?.required) return
        let stopped = false
        let timer: ReturnType<typeof setTimeout>
        const schedule = () => {
            const remaining = (getServerSession()?.expiresAt ?? 0) * 1000 - Date.now()
            timer = setTimeout(() => { void refresh() }, Math.max(1000, Math.min(60 * 60 * 1000, remaining / 2)))
        }
        const refresh = async () => {
            const current = getServerSession()
            if (!current) { setServerSession(null); return }
            try {
                const refreshed = await requestServerSession()
                // A refresh that finished after logout must not reopen the session.
                if (!stopped && getServerSession() === current) setServerSession(refreshed)
            } catch (error) {
                if (!stopped && error instanceof SessionError && error.status === 401) setServerSession(null)
            }
            if (!stopped) { clearTimeout(timer); schedule() }
        }
        schedule()
        const expiry = setInterval(() => { if (!getServerSession()) setServerSession(null) }, 30 * 1000)
        const visible = () => { if (document.visibilityState === "visible") void refresh() }
        document.addEventListener("visibilitychange", visible)
        return () => { stopped = true; clearTimeout(timer); clearInterval(expiry); document.removeEventListener("visibilitychange", visible) }
    }, [state])

    useEffect(() => {
        const tick = () => {
            const next = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000))
            setSeconds(next)
            return next
        }
        if (retryAt <= Date.now()) {
            const resetId = setTimeout(tick, 0)
            return () => clearTimeout(resetId)
        }
        const initialId = setTimeout(() => {
            if (tick() <= 0) clearInterval(id)
        }, 0)
        const id = setInterval(() => {
            if (tick() <= 0) clearInterval(id)
        }, 1000)
        return () => {
            clearTimeout(initialId)
            clearInterval(id)
        }
    }, [retryAt])

    useEffect(() => {
        if (state !== "locked" && state !== "error") return
        document.getElementById("global-loader")?.remove()
        window.desktop?.startup?.ready?.()
    }, [state])

    async function login(event: React.FormEvent) {
        event.preventDefault()
        setBusy(true)
        setMessage("")
        try {
            const session = await requestServerSession(password)
            setPassword("")
            setServerSession(session)
            queryClient.clear()
            setState("open")
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "No se pudo iniciar sesión.")
            if (error instanceof SessionError && error.status === 429) setRetryAt(Date.now() + error.retryAfter * 1000)
        } finally { setBusy(false) }
    }

    if (state === "open") return children
    return (
        <main
            className="relative min-h-dvh flex items-center justify-center p-4 sm:p-6 text-on-surface overflow-hidden bg-bg-primary select-none"
            aria-busy={state === "checking" || busy}
        >
            {/* Fondo Cinemático: Ocaso en Kame House */}
            {!isMinimalist && (
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden select-none [[data-flat=true]_&]:hidden">
                    {/* Degradado atmosférico de horizonte crepuscular derivado de tokens de era/acento */}
                    <div
                        className="absolute inset-0"
                        style={{
                            background: "linear-gradient(to top, color-mix(in srgb, var(--brand-accent-hex, hsl(var(--brand-accent, 38 92% 50%))) 22%, transparent) 0%, color-mix(in srgb, var(--era-tint, var(--brand-accent-hex, hsl(var(--brand-accent, 38 92% 50%)))) 10%, transparent) 40%, transparent 100%)",
                        }}
                    />

                    {/* Halo de sol poniente en el tercio inferior */}
                    <div
                        className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full blur-3xl opacity-80"
                        style={{
                            background: "radial-gradient(ellipse at center, color-mix(in srgb, var(--brand-accent-hex, hsl(var(--brand-accent, 38 92% 50%))) 28%, transparent) 0%, color-mix(in srgb, var(--era-tint, var(--brand-accent-hex, hsl(var(--brand-accent, 38 92% 50%)))) 12%, transparent) 45%, transparent 75%)",
                        }}
                    />

                    {/* Kanji 亀 emergiendo de la luz crepuscular */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                        <span
                            className="font-kanji font-black text-[260px] sm:text-[360px] leading-none bg-clip-text text-transparent select-none"
                            style={{
                                backgroundImage: "linear-gradient(to bottom, rgba(255, 255, 255, 0.04), color-mix(in srgb, var(--brand-accent-hex, hsl(var(--brand-accent, 38 92% 50%))) 12%, transparent), color-mix(in srgb, var(--brand-accent-hex, hsl(var(--brand-accent, 38 92% 50%))) 22%, transparent))",
                                filter: "drop-shadow(0 10px 30px color-mix(in srgb, var(--brand-accent-hex, hsl(var(--brand-accent, 38 92% 50%))) 15%, transparent))",
                            }}
                        >
                            亀
                        </span>
                    </div>

                    {/* Viñeta cinematográfica para concentrar la mirada en el modal */}
                    <div
                        className="absolute inset-0"
                        style={{
                            background: "radial-gradient(ellipse 120% 85% at 50% 0%, transparent 45%, var(--bg-primary, #08080a) 95%)",
                        }}
                    />
                </div>
            )}

            <section
                className="relative z-10 sectionbar rounded-3xl w-full max-w-md p-6 sm:p-8 space-y-6"
                aria-labelledby="server-access-title"
            >
                <div className="space-y-2">
                    <p className="text-sm text-on-surface-variant">KameHouse</p>
                    <h1 id="server-access-title" className="font-display text-2xl text-balance">{state === "checking" ? "Conectando con tu servidor" : state === "error" ? "Servidor sin conexión" : "Entrar a tu biblioteca"}</h1>
                    {state === "locked" && <p className="text-sm text-on-surface-variant">Introduce la contraseña de este servidor para continuar.</p>}
                </div>
                {state === "locked" && <form onSubmit={login} className="space-y-4">
                    <TextInput label="Contraseña del servidor" type="password" autoComplete="current-password" autoFocus value={password} onValueChange={setPassword} required disabled={busy} aria-describedby={message ? "server-access-error" : undefined} className="text-base" />
                    {message && <p id="server-access-error" role="alert" className="text-sm text-destructive">{message}</p>}
                    <Button type="submit" intent="primary" className="w-full min-h-11" disabled={busy || seconds > 0 || !password}>{busy ? "Entrando…" : seconds > 0 ? `Reintentar en ${seconds} s` : "Entrar"}</Button>
                </form>}
                {state === "error" && <div className="space-y-4"><p role="alert" className="text-sm text-on-surface-variant">{message}</p><Button intent="primary" onClick={() => { setState("checking"); setProbe(n => n + 1) }}>Reintentar</Button></div>}
                {state === "checking" && <p role="status" className="text-sm text-on-surface-variant">Comprobando el acceso…</p>}
            </section>
        </main>
    )
}
