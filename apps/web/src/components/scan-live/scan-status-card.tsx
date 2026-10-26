import { useEffect, useState } from "react"
import { AnimatePresence, m } from "framer-motion"
import { AlertCircle, Check, Cloud, HardDrive, RefreshCw } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { Button } from "@/components/ui/button"
import { useSpringPreset } from "@/components/ui/kinetics/hooks"
import { IconSwap } from "@/components/ui/kinetics/icon-swap"
import type { ScanLiveView } from "./views"

interface ScanStatusStat {
    label: string
    value: number | string
    /** Con total se dibuja "valor / total" y una barra de cobertura. */
    total?: number
    tone?: "warn" | "ok"
}

interface ScanStatusCardProps {
    /** Escaneo a mostrar: el que corre, o el último terminado. null = ninguno en esta sesión. */
    view: ScanLiveView | null
    isScanning: boolean
    canScan: boolean
    onScan: () => void
    /** "Google Drive", "Disco local"… null = no hay fuentes configuradas. */
    sourcesLabel: string | null
    stats: ScanStatusStat[]
    secondaryAction?: { label: string; title?: string; onClick: () => void; disabled?: boolean }
}

function formatDuration(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000))
    const min = Math.floor(total / 60)
    const sec = total % 60
    return min > 0 ? `${min}m ${sec.toString().padStart(2, "0")}s` : `${sec}s`
}

/** "hace 5 min", "hoy 15:22" o "24/09 15:22". */
function formatWhen(ts: number, now: number): string {
    const diff = now - ts
    if (diff < 60_000) return "recién"
    if (diff < 3_600_000) return `hace ${Math.floor(diff / 60_000)} min`
    const d = new Date(ts)
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    return d.toDateString() === new Date(now).toDateString() ? `hoy ${time}` : `${d.toLocaleDateString([], { day: "2-digit", month: "2-digit" })} ${time}`
}

/** Reloj que avanza cada segundo solo mientras hace falta. */
function useNow(active: boolean): number {
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        if (!active) return
        const id = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(id)
    }, [active])
    return now
}

/**
 * Estado del escáner en una sola tarjeta: qué pasa ahora, el botón para escanear,
 * el progreso mientras corre y la cobertura de la biblioteca al pie.
 */
export function ScanStatusCard({ view, isScanning, canScan, onScan, sourcesLabel, stats, secondaryAction }: ScanStatusCardProps) {
    const running = isScanning || view?.state === "running"
    const failed = !running && view?.state === "error"
    const now = useNow(running || Boolean(view?.finishedAt))
    const SourceIcon = view?.source === "local" ? HardDrive : Cloud
    const collapseSpring = useSpringPreset("tabContent")

    const title = running
        ? view?.state === "running" ? view.title : "Iniciando el escaneo…"
        : failed ? view?.title ?? "El escaneo falló"
        : "Biblioteca al día"

    const subtitle = running
        ? view?.state === "running" ? view.currentLine : "Conectando con las fuentes…"
        : failed ? view?.error || "Revisa la conexión e inténtalo de nuevo."
        : view?.finishedAt
            ? [
                `Último escaneo: ${formatWhen(view.finishedAt, now)}`,
                view.startedAt ? `duración ${formatDuration(view.finishedAt - view.startedAt)}` : null,
                ...view.stats.filter(s => s.label === "Videos" || s.label === "Archivos").map(s => `${s.value === 1 ? "1 archivo" : `${s.value} archivos`}`),
                ...view.stats.filter(s => s.label === "Eliminados" && Number(s.value) > 0).map(s => `${Number(s.value) === 1 ? "1 eliminado" : `${s.value} eliminados`}`),
            ].filter(Boolean).join(" · ")
            : sourcesLabel ? "Todavía no has escaneado en esta sesión." : "Conecta Google Drive o añade carpetas locales para escanear."

    return (
        <section
            aria-label="Estado del escáner"
            className={cn(
                "rounded-2xl border overflow-hidden transition-colors duration-base ease-smooth-out",
                running ? "bg-brand-accent/[0.04] border-brand-accent/30"
                    : failed ? "bg-status-error/20 border-status-error/25"
                    : "bg-[var(--neutral-elev-2)] border-[var(--neutral-separator)]",
            )}
        >
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-5">
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div
                        className={cn(
                            "size-11 shrink-0 rounded-xl grid place-items-center border transition-colors duration-base ease-smooth-out",
                            running ? "bg-brand-accent/15 border-brand-accent/30 text-brand-accent"
                                : failed ? "bg-status-error/10 border-status-error/30 text-status-error"
                                : "bg-status-success/10 border-status-success/25 text-status-success",
                        )}
                        aria-hidden
                    >
                        {/* Fin del escaneo: el spinner cede su lugar a ✓ o ⚠ en la misma celda. */}
                        <IconSwap swapKey={running ? "run" : failed ? "error" : "ok"}>
                            {running ? <RefreshCw className="size-5 animate-spin" />
                                : failed ? <AlertCircle className="size-5" />
                                : <Check className="size-5" />}
                        </IconSwap>
                    </div>
                    <div className="min-w-0" aria-live="polite">
                        <div className="flex items-center gap-2 min-w-0">
                            <h3 key={title} className="text-sm font-bold text-on-surface tracking-tight truncate animate-text-swap-in">{title}</h3>
                            {sourcesLabel && (
                                <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-3xs font-medium bg-[var(--neutral-elev-3)] border border-[var(--neutral-separator)] text-on-surface-variant shrink-0">
                                    <SourceIcon className="size-3" />
                                    {running && view?.state === "running" ? view.sourceLabel : sourcesLabel}
                                </span>
                            )}
                        </div>
                        <p className={cn("text-2xs truncate mt-0.5", failed ? "text-status-error/90" : "text-label-2")} title={subtitle}>
                            {subtitle}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 sm:flex-col sm:items-end sm:gap-1">
                    <Button
                        intent="primary"
                        size="md"
                        onClick={onScan}
                        disabled={!canScan || running}
                        leftIcon={<RefreshCw className="size-3.5" />}
                        iconSpacing="0.5rem"
                        className="flex-1 sm:flex-none"
                    >
                        {running ? "Escaneando…" : "Escanear"}
                    </Button>
                    {secondaryAction && (
                        <Button
                            intent="ghost"
                            size="xs"
                            onClick={secondaryAction.onClick}
                            disabled={secondaryAction.disabled || running}
                            title={secondaryAction.title}
                            className="text-label-2"
                        >
                            {secondaryAction.label}
                        </Button>
                    )}
                </div>
            </div>

            {/* Progreso: solo mientras corre. Se colapsa como SectionBar: la altura anima
                en el m.div y el padding va en el div interior, para que height 0 sea 0. */}
            <AnimatePresence initial={false}>
            {running && (
                <m.div
                    key="progress"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={collapseSpring}
                    className="overflow-hidden"
                >
                <div className="px-4 sm:px-5 pb-4 space-y-2">
                    {view?.state === "running" && (
                        <ol className="flex items-center gap-1.5 text-3xs font-medium" aria-label="Etapas del escaneo">
                            {view.steps.map((step, i) => {
                                const state = i < view.activeStep ? "done" : i === view.activeStep ? "active" : "pending"
                                return (
                                    <li
                                        key={step.label}
                                        aria-current={state === "active" ? "step" : undefined}
                                        className={cn(
                                            "flex items-center gap-1 min-w-0",
                                            state === "active" ? "text-brand-accent" : state === "done" ? "text-status-success/80" : "text-on-surface-variant/40",
                                        )}
                                    >
                                        {state === "done" ? <Check className="size-3 shrink-0" /> : <step.icon className={cn("size-3 shrink-0", state === "active" && "animate-pulse")} />}
                                        <span className={cn("truncate", state !== "active" && "hidden md:inline")}>{step.label}</span>
                                        {i < view.steps.length - 1 && <span className="text-on-surface-variant/25 px-0.5" aria-hidden>›</span>}
                                    </li>
                                )
                            })}
                            {view.counter && <li className="ml-auto font-mono tabular-nums text-on-surface-variant shrink-0">{view.counter}</li>}
                        </ol>
                    )}
                    <div
                        className="relative h-1.5 rounded-full bg-[var(--neutral-elev-3)] overflow-hidden"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={view?.state === "running" ? view.percent ?? undefined : undefined}
                        aria-label="Progreso del escaneo"
                    >
                        {view?.state !== "running" || view.percent === null ? (
                            <div className="absolute inset-0 origin-left rounded-full bg-brand-accent/80 animate-indeterminate-progress motion-reduce:animate-none motion-reduce:w-1/3" />
                        ) : (
                            <div className="h-full w-full rounded-full bg-brand-accent origin-left transition-transform duration-slow ease-smooth-out" style={{ transform: `scaleX(${Math.min(100, Math.max(0, view.percent)) / 100})` }} />
                        )}
                    </div>
                </div>
                </m.div>
            )}
            </AnimatePresence>

            {/* Cobertura de la biblioteca */}
            {stats.length > 0 && (
                <dl className="grid grid-cols-2 sm:grid-cols-4 border-t border-[var(--neutral-separator)]">
                    {stats.map((stat, i) => {
                        const pct = stat.total ? Math.min(100, Math.round((Number(stat.value) / stat.total) * 100)) : null
                        return (
                            <div
                                key={stat.label}
                                className={cn(
                                    "px-4 sm:px-5 py-3 min-w-0 border-[var(--neutral-separator)]",
                                    // 2 columnas en móvil, 4 en escritorio: separadores internos únicamente.
                                    i % 2 === 0 && "border-r",
                                    i < 2 && "max-sm:border-b",
                                    i === 1 && "sm:border-r",
                                    i === stats.length - 1 && "sm:border-r-0",
                                )}
                            >
                                <dt className="type-caption text-on-surface-variant truncate">{stat.label}</dt>
                                <dd className="mt-0.5">
                                    <span className={cn(
                                        "text-base font-bold font-mono tabular-nums",
                                        stat.tone === "warn" ? "text-status-warning" : stat.tone === "ok" ? "text-status-success" : "text-on-surface",
                                    )}>
                                        {stat.value}
                                    </span>
                                    {stat.total !== undefined && (
                                        <span className="text-2xs font-mono text-label-2"> / {stat.total}</span>
                                    )}
                                    {pct !== null && (
                                        <div className="mt-1.5 h-1 rounded-full bg-[var(--neutral-elev-3)] overflow-hidden" aria-hidden>
                                            <div
                                                className={cn(
                                                    "h-full w-full rounded-full origin-left transition-transform duration-base ease-smooth-out motion-reduce:transition-none",
                                                    pct >= 100 ? "bg-status-success" : "bg-brand-accent",
                                                )}
                                                style={{ transform: `scaleX(${pct / 100})` }}
                                            />
                                        </div>
                                    )}
                                </dd>
                            </div>
                        )
                    })}
                </dl>
            )}
        </section>
    )
}
