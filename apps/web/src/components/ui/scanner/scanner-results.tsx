import React, { useRef } from "react"
import { motion } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { Link } from "@tanstack/react-router"
import { LucideChevronRight, LucideHistory, LucideRefreshCw } from "lucide-react"
import { type ScanEvent } from "@/lib/store"
import { type ScannerMessage } from "@/lib/server/ws-events"
import { Summary_ScanSummaryItem, Summary_ScanSummaryGroup, Summary_ScanSummaryFile } from "@/api/generated/types"

export function SectionHeader({ label, icon }: { label: string; icon: React.ReactNode }) {
    return (
        <div className="flex items-center gap-4">
            <div className="h-px w-12 bg-white/20" />
            <span className="text-sm font-black uppercase tracking-[0.4em] text-zinc-400 flex items-center gap-3">
                {icon}
                {label}
            </span>
            <div className="h-px flex-1 bg-white/5" />
        </div>
    )
}

export function ScanActionCard({
    label, desc, icon, onClick, disabled, loading, to, accentColor
}: {
    label: string
    desc: string
    icon: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    loading?: boolean
    to?: string
    accentColor: "white" | "zinc"
}) {
    const colors: Record<string, { border: string; bg: string; glow: string; text: string }> = {
        white: { border: "border-white/20", bg: "hover:bg-white/10", glow: "", text: "text-white" },
        zinc: { border: "border-white/10", bg: "hover:bg-white/5", glow: "", text: "text-zinc-400" },
    }
    const c = colors[accentColor]

    const baseClasses = cn(
        "group relative block p-8 rounded-none border bg-white/[0.02] transition-all duration-500 text-left",
        c.border, c.bg,
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-white/10 active:scale-[0.98]"
    )

    const content = (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div className="p-4 rounded-2xl bg-black/40 border border-white/10 group-hover:border-white/20 transition-all">
                    {loading ? <LucideRefreshCw size={24} className={cn("animate-spin", c.text)} /> : icon}
                </div>
                <LucideChevronRight size={20} className="text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-1 transition-all" />
            </div>
            <div>
                <p className="font-black text-white text-lg tracking-tight">{label}</p>
                <p className="text-sm text-zinc-500 mt-2 leading-relaxed">{desc}</p>
            </div>
        </div>
    )

    if (to) {
        return (
            <Link to={to as any} className={baseClasses}>
                {content}
            </Link>
        )
    }

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            type="button"
            className={baseClasses}
        >
            {content}
        </button>
    )
}

export function EventFeed({ events }: { events: ScanEvent[] }) {
    const listRef = useRef<HTMLDivElement>(null)

    const getEventColor = (status: ScannerMessage["status"]) => {
        switch (status) {
            case "START": return "text-blue-400"
            case "PROCESSING": return "text-zinc-400"
            case "PRUNED": return "text-rose-400"
            case "FINISH": return "text-emerald-400"
            default: return "text-zinc-500"
        }
    }

    const getEventLabel = (evt: ScanEvent) => {
        switch (evt.status) {
            case "START": return "Escaneo iniciado"
            case "PROCESSING":
                return evt.file
                    ? `Procesando: ${evt.file}`
                    : `Archivo ${evt.current ?? "?"} de ${evt.total ?? "?"}`
            case "PRUNED":
                return `Purgados ${evt.removed ?? 0} archivos de la DB`
            case "FINISH":
                return evt.total_processed
                    ? `Completado — ${evt.total_processed} archivos en ${(evt.duration_seconds ?? 0).toFixed(1)}s`
                    : "Completado sin cambios"
            default: return evt.status
        }
    }

    const visibleEvents = events.filter(e => e.status !== "PROCESSING" || events.indexOf(e) < 3)
        .slice(0, 50)

    return (
        <div className="rounded-none overflow-hidden border border-white/5 bg-black/20">
            <div
                ref={listRef}
                className="max-h-80 overflow-y-auto divide-y divide-white/[0.03]"
            >
                {visibleEvents.map((evt: ScanEvent & { id?: string; timestamp: number }) => (
                    <motion.div
                        key={evt.id || `${evt.timestamp}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-5 px-8 py-4"
                    >
                        <div className={cn("w-2 h-2 rounded-none shrink-0", {
                            "bg-white": evt.status === "START" || evt.status === "FINISH",
                            "bg-zinc-600": evt.status === "PROCESSING",
                            "bg-zinc-400": evt.status === "PRUNED",
                        })} />
                        <span className={cn("text-sm font-mono truncate flex-1", getEventColor(evt.status))}>
                            {getEventLabel(evt)}
                        </span>
                        <span className="text-xs text-zinc-600 shrink-0">
                            {new Date(evt.timestamp).toLocaleTimeString()}
                        </span>
                    </motion.div>
                ))}
            </div>
        </div>
    )
}

export function ScanHistory({ summaries }: { summaries: Summary_ScanSummaryItem[] }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {summaries.map((s, idx) => {
                const summary = s.scanSummary ?? s

                const groups: Summary_ScanSummaryGroup[] = summary?.groups ?? []
                const unmatched: Summary_ScanSummaryFile[] = summary?.unmatchedFiles ?? []
                const matchedCount = groups.reduce((acc: number, g: Summary_ScanSummaryGroup) => acc + (g.files?.length ?? 0), 0)
                const totalCount = matchedCount + unmatched.length

                const files = totalCount > 0 ? totalCount : "?"
                const matched = matchedCount > 0 || totalCount > 0 ? matchedCount : "?"

                const createdAt = s.createdAt ? new Date(s.createdAt).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                }) : "—"

                return (
                    <div key={idx} className="p-7 rounded-none border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-all space-y-4 group">
                        <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-zinc-500">
                            <LucideHistory size={14} />
                            {createdAt}
                        </div>
                        <div className="flex items-baseline gap-3">
                            <span className="font-bebas text-5xl text-white">{files}</span>
                            <span className="text-sm text-zinc-600">archivos</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-zinc-500">
                            <span className="text-white font-bold">{matched} match</span>
                            {unmatched.length > 0 && <span className="text-zinc-400 border border-white/10 px-2 py-0.5 text-[10px]">· {unmatched.length} sin match</span>}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
