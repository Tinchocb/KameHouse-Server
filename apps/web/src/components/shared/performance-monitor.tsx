import React, { useEffect, useState, useRef } from "react"
import { m, AnimatePresence } from "framer-motion"
import { useReducedMotion } from "@/components/ui/kinetics/hooks"
import { IconStatusActivity, IconUiTrash, IconUiClose, IconStatusZap, IconStatusCpu, IconUiAlert, IconUiCheckCircle } from "@/components/ui/icons";
import { useRouteLatency } from "./use-route-latency"
import { usePerformanceStore } from "@/lib/hardware/performance-store"
import { createFrameWindow } from "@/lib/hardware/frame-window"

// Custom global event to toggle performance monitor from sidebar/settings
const TOGGLE_PERF_MONITOR_EVENT = "kamehouse:toggle-perf-monitor"

export function PerformanceMonitor() {
    const [isOpen, setIsOpen] = useState(() => localStorage.getItem("kamehouse:perf-monitor-enabled") === "true")
    const [fps, setFps] = useState(60)
    const [droppedFrames, setDroppedFrames] = useState(0)
    const [totalFrames, setTotalFrames] = useState(0)
    const [smoothFrames, setSmoothFrames] = useState(0)
    const [longestFrame, setLongestFrame] = useState(0)
    const [memory, setMemory] = useState<{ used: number; total: number } | null>(null)
    const routeLatency = useRouteLatency()
    const reduceMotion = useReducedMotion()
    const rafIdRef = useRef<number | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const fpsHistoryRef = useRef<number[]>([])

    const hardwareSpecs = usePerformanceStore(s => s.hardwareSpecs)
    const autoThrottleActive = usePerformanceStore(s => s.autoThrottleActive)
    const setAutoThrottleActive = usePerformanceStore(s => s.setAutoThrottleActive)
    const getEffectiveTier = usePerformanceStore(s => s.getEffectiveTier)

    // Accumulators in refs to avoid React re-renders on every frame tick
    const totalFramesRef = useRef(0)
    const smoothFramesRef = useRef(0)
    const droppedFramesRef = useRef(0)
    const longestFrameRef = useRef(0)
    const lastUpdateRef = useRef<number>(0)

    // Toggle visibility with keyboard shortcut (Ctrl + Shift + F)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") {
                e.preventDefault()
                setIsOpen(prev => !prev)
            }
        }

        const handleCustomToggle = () => {
            setIsOpen(prev => !prev)
        }

        window.addEventListener("keydown", handleKeyDown)
        window.addEventListener(TOGGLE_PERF_MONITOR_EVENT, handleCustomToggle)
        
        return () => {
            window.removeEventListener("keydown", handleKeyDown)
            window.removeEventListener(TOGGLE_PERF_MONITOR_EVENT, handleCustomToggle)
        }
    }, [])

    // ─── Loop de DISPLAY (solo cuando el panel está abierto) ─────────────────────
    // Actualiza estado React (FPS, dropped frames, memoria) y dibuja el canvas.
    useEffect(() => {
        if (!isOpen) {
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current)
                rafIdRef.current = null
            }
            return
        }

        lastUpdateRef.current = performance.now()
        const frames = createFrameWindow()
        let stopped = false
        const observable = () => document.visibilityState === "visible" && document.hasFocus()
        const schedule = () => {
            if (!stopped && observable() && rafIdRef.current === null) rafIdRef.current = requestAnimationFrame(loop)
        }

        const loop = (now: number) => {
            if (stopped) return
            rafIdRef.current = null
            if (!observable()) {
                frames.reset()
                return
            }
            const sample = frames.sample(now)
            if (!sample) {
                schedule()
                return
            }
            const { delta, fps: currentFps } = sample

            // En primer plano un delta largo es un bloqueo, no una muestra descartable.
            if (delta > 0) {
                longestFrameRef.current = Math.max(longestFrameRef.current, delta)
                totalFramesRef.current += 1

                const targetHz = hardwareSpecs?.screenRefreshRate || 60
                const expectedDelta = 1000 / targetHz
                const dropThreshold = Math.max(28, expectedDelta * 2.2)

                if (delta > dropThreshold) {
                    droppedFramesRef.current += 1
                } else {
                    smoothFramesRef.current += 1
                }
            }

            // Throttle React state updates a 400 ms para no saturar el Virtual DOM
            if (now - lastUpdateRef.current >= 400) {
                lastUpdateRef.current = now
                setFps(currentFps)
                setDroppedFrames(droppedFramesRef.current)
                setTotalFrames(totalFramesRef.current)
                setSmoothFrames(smoothFramesRef.current)
                setLongestFrame(Math.round(longestFrameRef.current))

                const perfMemory = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit?: number; totalJSHeapSize?: number } }).memory
                if (perfMemory) {
                    const used = Math.round((perfMemory.usedJSHeapSize || 0) / (1024 * 1024))
                    const limit = perfMemory.jsHeapSizeLimit || perfMemory.totalJSHeapSize || 0
                    const total = limit > 0 ? Math.round(limit / (1024 * 1024)) : 2048
                    setMemory({ used, total })
                }
            }

            // Dibujar gráfica de canvas
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext("2d")
                if (ctx) {
                    fpsHistoryRef.current.push(currentFps)
                    if (fpsHistoryRef.current.length > 100) fpsHistoryRef.current.shift()

                    const width = canvasRef.current.width
                    const height = canvasRef.current.height
                    const maxScale = Math.max(75, Math.ceil((hardwareSpecs?.screenRefreshRate || 60) * 1.15))

                    ctx.clearRect(0, 0, width, height)

                    ctx.strokeStyle = "rgba(255, 255, 255, 0.07)"
                    ctx.lineWidth = 1

                    const y60 = height - (60 / maxScale) * height
                    ctx.beginPath()
                    ctx.moveTo(0, y60)
                    ctx.lineTo(width, y60)
                    ctx.stroke()

                    if (maxScale >= 120) {
                        const y120 = height - (120 / maxScale) * height
                        ctx.beginPath()
                        ctx.moveTo(0, y120)
                        ctx.lineTo(width, y120)
                        ctx.stroke()
                    }

                    const targetHz = hardwareSpecs?.screenRefreshRate || 60
                    const healthyThreshold = targetHz >= 120 ? 80 : 50
                    const warnThreshold = targetHz >= 120 ? 55 : 35
                    ctx.strokeStyle = currentFps >= healthyThreshold ? "#22c55e" : currentFps >= warnThreshold ? "#f59e0b" : "#ef4444"
                    ctx.lineWidth = 1.5
                    ctx.beginPath()

                    fpsHistoryRef.current.forEach((val, index) => {
                        const x = (index / 100) * width
                        const y = height - (Math.min(maxScale, val) / maxScale) * height
                        if (index === 0) ctx.moveTo(x, y)
                        else ctx.lineTo(x, y)
                    })
                    ctx.stroke()

                    ctx.fillStyle = currentFps >= healthyThreshold
                        ? "rgba(34, 197, 94, 0.08)"
                        : currentFps >= warnThreshold
                            ? "rgba(245, 158, 11, 0.08)"
                            : "rgba(239, 68, 68, 0.08)"
                    ctx.beginPath()
                    ctx.moveTo(0, height)
                    fpsHistoryRef.current.forEach((val, index) => {
                        const x = (index / 100) * width
                        const y = height - (Math.min(maxScale, val) / maxScale) * height
                        ctx.lineTo(x, y)
                    })
                    ctx.lineTo(width, height)
                    ctx.closePath()
                    ctx.fill()
                }
            }

            schedule()
        }

        const syncActivity = () => {
            frames.reset()
            lastUpdateRef.current = performance.now()
            if (!observable()) {
                if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
                rafIdRef.current = null
            } else schedule()
        }
        document.addEventListener("visibilitychange", syncActivity)
        window.addEventListener("blur", syncActivity)
        window.addEventListener("focus", syncActivity)
        syncActivity()

        return () => {
            stopped = true
            document.removeEventListener("visibilitychange", syncActivity)
            window.removeEventListener("blur", syncActivity)
            window.removeEventListener("focus", syncActivity)
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current)
                rafIdRef.current = null
            }
        }
    }, [isOpen, hardwareSpecs])

    const handleClearStats = () => {
        totalFramesRef.current = 0
        smoothFramesRef.current = 0
        droppedFramesRef.current = 0
        longestFrameRef.current = 0
        setDroppedFrames(0)
        setTotalFrames(0)
        setSmoothFrames(0)
        setLongestFrame(0)
        fpsHistoryRef.current = []
        setAutoThrottleActive(false)
    }

    const smoothnessIndex = totalFrames > 0 
        ? Math.max(0, Math.min(100, Math.round((smoothFrames / totalFrames) * 100))) 
        : 100

    const targetHz = hardwareSpecs?.screenRefreshRate || 60
    const healthyFpsThreshold = targetHz >= 120 ? 80 : 50
    const warnFpsThreshold = targetHz >= 120 ? 55 : 35

    const getFpsColor = (val: number) => {
        if (val >= healthyFpsThreshold) return "text-status-success"
        if (val >= warnFpsThreshold) return "text-status-warning"
        return "text-status-error"
    }

    const getSmoothnessColor = (val: number) => {
        if (val >= 90) return "text-status-success"
        if (val >= 75) return "text-status-warning"
        return "text-status-error"
    }

    // Optimization tips engine based on actual statistics
    const optimizationTips = React.useMemo(() => {
        const tips: { id: string; text: string; level: "info" | "warning" }[] = []

        if (fps < warnFpsThreshold && fps > 0) {
            tips.push({
                id: "fps-low",
                text: `Rendimiento bajo: La tasa de cuadros actual (${fps} FPS) está por debajo de lo esperado (${targetHz} Hz). Se recomienda el perfil Ahorro / PC Modesta.`,
                level: "warning"
            })
        }

        if (droppedFrames > 40 && smoothnessIndex < 75) {
            tips.push({
                id: "stuttering",
                text: "Se detectaron cuadros lentos. Un perfil de rendimiento permite identificar si el coste está en JavaScript, layout o pintura.",
                level: "warning"
            })
        }

        if (memory && memory.used > 600) {
            tips.push({
                id: "memory-high",
                text: "Consumo de memoria elevado: Considera recargar la aplicación para limpiar la caché de imágenes.",
                level: "info"
            })
        }

        // General suggestions
        tips.push({
            id: "judder-tip",
            text: "Consejo visual: Gran parte del lag aparente al reproducir anime se debe a la disparidad 24fps vs Hz de tu monitor. Pon tu pantalla en múltiplos de 24Hz (e.g. 72Hz, 120Hz) para paneos suaves.",
            level: "info"
        })

        return tips
    }, [fps, droppedFrames, smoothnessIndex, memory, targetHz, warnFpsThreshold])

    return (
        <AnimatePresence>
            {isOpen && (
                <m.div
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
                    transition={reduceMotion ? { duration: 0.15 } : { type: "spring", stiffness: 380, damping: 26 }}
                    className="fixed top-6 left-4 right-4 sm:left-auto sm:right-6 z-tooltip w-auto sm:w-[350px] max-w-sm max-h-[calc(100dvh-3rem)] overflow-y-auto backdrop-blur-overlay-md bg-[color-mix(in_srgb,var(--neutral-elev-1)_88%,transparent)] [[data-flat=true]_&]:bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] rounded-corner-lg shadow-[shadow:var(--double-bezel-shadow-strong)] p-4 sm:p-5 select-none font-sans text-on-surface"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-[var(--neutral-separator)]">
                        <div className="flex items-center gap-2">
                            <IconStatusActivity className="text-brand-accent animate-pulse motion-reduce:animate-none w-4 h-4" />
                            <span className="text-label-sm font-black uppercase tracking-ultra text-on-surface-variant">
                                Diagnóstico de Rendimiento
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={handleClearStats}
                                className="min-h-11 min-w-11 [@media(pointer:fine)]:min-h-7 [@media(pointer:fine)]:min-w-7 [@media(pointer:fine)]:w-7 [@media(pointer:fine)]:h-7 flex items-center justify-center rounded bg-surface-container [@media(hover:hover)_and_(pointer:fine)]:hover:bg-surface-container-high text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent transition-[background-color,color,transform] duration-fast ease-smooth-out motion-safe:active:scale-[0.97] cursor-pointer"
                                aria-label="Reiniciar estadísticas"
                                title="Reiniciar estadísticas"
                            >
                                <IconUiTrash size={12} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="min-h-11 min-w-11 [@media(pointer:fine)]:min-h-7 [@media(pointer:fine)]:min-w-7 [@media(pointer:fine)]:w-7 [@media(pointer:fine)]:h-7 flex items-center justify-center rounded bg-surface-container [@media(hover:hover)_and_(pointer:fine)]:hover:bg-surface-container-high text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent transition-[background-color,color,transform] duration-fast ease-smooth-out motion-safe:active:scale-[0.97] cursor-pointer"
                                aria-label="Cerrar diagnóstico de rendimiento"
                                title="Cerrar diagnóstico"
                            >
                                <IconUiClose size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Hardware Tier Badge */}
                    <div className="mt-3 p-2 bg-surface-container-low border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] rounded-xl shadow-[shadow:var(--double-bezel-ring)] flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                            <IconStatusZap size={13} className="text-brand-accent shrink-0" />
                            <span className="text-caption font-bold text-on-surface-variant truncate" title={hardwareSpecs?.gpuRenderer || "Detectando GPU..."}>
                                {hardwareSpecs ? `${hardwareSpecs.isDedicatedGpu ? "GPU Dedicada" : "GPU"} · ${hardwareSpecs.cpuCores}c` : "Detectando hardware..."}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            {autoThrottleActive && (
                                <span className="text-caption font-black px-1.5 py-0.5 rounded bg-status-warning/20 text-status-warning border border-status-warning/30">
                                    THROTTLED
                                </span>
                            )}
                            <span className="text-caption font-black uppercase px-2 py-0.5 rounded bg-[var(--neutral-elev-2)] text-brand-accent-readable border border-[var(--neutral-separator)]">
                                {getEffectiveTier() === "high" ? "TIER 1 (ULTRA)" : getEffectiveTier() === "balanced" ? "TIER 2 (BALANCED)" : "TIER 3 (ECO)"}
                            </span>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 py-4">
                        {/* Live FPS */}
                        <div className="bg-surface-container-low border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] rounded-xl shadow-[shadow:var(--double-bezel-ring)] p-3 flex flex-col items-start">
                            <span className="text-caption font-black uppercase tracking-wider text-on-surface-variant/60">FPS Actual</span>
                            <div className="flex items-baseline gap-1 mt-1">
                                <span className={`text-3xl font-display tracking-wide ${getFpsColor(fps)}`}>
                                    {fps}
                                </span>
                                <span className="text-label-sm font-bold text-on-surface-variant/50">FPS</span>
                            </div>
                        </div>

                        {/* Stability Index */}
                        <div className="bg-surface-container-low border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] rounded-xl shadow-[shadow:var(--double-bezel-ring)] p-3 flex flex-col items-start">
                            <span className="text-caption font-black uppercase tracking-wider text-on-surface-variant/60">Estabilidad UI</span>
                            <div className="flex items-baseline gap-1 mt-1">
                                <span className={`text-3xl font-display tracking-wide ${getSmoothnessColor(smoothnessIndex)}`}>
                                    {smoothnessIndex}%
                                </span>
                                <span className="text-label-sm font-bold text-on-surface-variant/50">INDEX</span>
                            </div>
                        </div>

                        {/* Dropped Frames */}
                        <div className="bg-surface-container-low border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] rounded-xl shadow-[shadow:var(--double-bezel-ring)] p-3 flex flex-col items-start">
                            <span className="text-caption font-black uppercase tracking-wider text-on-surface-variant/60">Cuadros lentos</span>
                            <span className="text-xl font-bold text-status-error mt-2 font-mono tabular-nums">
                                {droppedFrames}
                            </span>
                            <span className="text-caption text-on-surface-variant/60 font-mono tabular-nums">Máximo: {longestFrame} ms</span>
                        </div>

                        {/* JS Memory */}
                        <div className="bg-surface-container-low border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] rounded-xl shadow-[shadow:var(--double-bezel-ring)] p-3 flex flex-col items-start">
                            <span className="text-caption font-black uppercase tracking-wider text-on-surface-variant/60">Memoria Heap JS</span>
                            {memory ? (
                                <div className="flex items-baseline gap-0.5 mt-2">
                                    <span className="text-xl font-bold text-on-surface font-mono tabular-nums">{memory.used}</span>
                                    <span className="text-caption font-bold text-on-surface-variant/50">/{memory.total}MB</span>
                                </div>
                            ) : (
                                <span className="text-xs text-on-surface-variant/75 font-bold mt-2">N/A (No Chrome)</span>
                            )}
                        </div>
                    </div>

                    {/* Chart Canvas */}
                    <div className="bg-[var(--neutral-elev-1)] border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] rounded-xl shadow-[shadow:var(--double-bezel-ring)] p-2 relative h-16 w-full flex items-center justify-center">
                        <canvas ref={canvasRef} width={300} height={48} className="w-full h-full block" />
                        <span className="absolute bottom-1 right-2 text-caption text-on-surface-variant/50 font-black tracking-widest uppercase pointer-events-none">HISTORIAL 10s</span>
                    </div>

                    {/* Page transition latency info */}
                    <div className="mt-4 p-3 bg-surface-container-low border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] rounded-xl shadow-[shadow:var(--double-bezel-ring)] flex items-center justify-between">
                        <span className="text-caption font-black uppercase tracking-wider text-on-surface-variant/60 flex items-center gap-1.5">
                            <IconStatusCpu size={12} className="text-brand-accent" />
                            Navegación estimada
                        </span>
                        <span className="text-xs font-bold text-on-surface-variant/80 font-mono">
                            {routeLatency !== null ? `${routeLatency} ms` : "---"}
                        </span>
                    </div>

                    {/* Tips and Solutions */}
                    <div className="mt-4 border-t border-[var(--neutral-separator)] pt-4 space-y-2.5 max-h-[140px] overflow-y-auto no-scrollbar">
                        <p className="text-caption font-black uppercase tracking-cinema text-on-surface-variant/60 mb-1">
                            Diagnóstico y Solución
                        </p>
                        {optimizationTips.map((tip) => (
                            <div key={tip.id} className="flex items-start gap-2.5 bg-surface-container-low p-2.5 border border-[var(--neutral-separator)] rounded-lg">
                                {tip.level === "warning" ? (
                                    <IconUiAlert size={14} className="text-status-warning shrink-0 mt-0.5" />
                                ) : (
                                    <IconUiCheckCircle size={14} className="text-status-success shrink-0 mt-0.5" />
                                )}
                                <span className="text-label-sm text-on-surface-variant/80 leading-relaxed font-medium">
                                    {tip.text}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 pt-3 border-t border-outline-variant/30 flex items-center justify-between text-caption text-on-surface-variant/50 font-black tracking-widest uppercase">
                        <span>ATAJO: CTRL + SHIFT + F</span>
                        <span>KAMEHOUSE ENGINE</span>
                    </div>
                </m.div>
            )}
        </AnimatePresence>
    )
}
