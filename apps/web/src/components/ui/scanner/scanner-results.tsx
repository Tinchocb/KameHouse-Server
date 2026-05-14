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
        <div className="flex items-center gap-5">
            <div className="flex items-center gap-3 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full">
                <span className="text-primary">{icon}</span>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">
                    {label}
                </span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
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
    const cardRef = useRef<HTMLButtonElement | HTMLAnchorElement>(null)

    const colors: Record<string, { border: string; bg: string; glow: string; text: string; iconBg: string }> = {
        white: { 
            border: "border-white/10 hover:border-primary/40", 
            bg: "bg-white/[0.02] hover:bg-primary/[0.02]", 
            glow: "hover:shadow-[0_0_40px_-10px_rgba(255,110,58,0.1)]", 
            text: "text-primary",
            iconBg: "bg-white/5 group-hover:bg-primary/10"
        },
        zinc: { 
            border: "border-white/5 hover:border-white/20", 
            bg: "bg-white/[0.01] hover:bg-white/[0.04]", 
            glow: "", 
            text: "text-zinc-600",
            iconBg: "bg-white/[0.02] group-hover:bg-white/[0.05]"
        },
    }
    const c = colors[accentColor]

    const baseClasses = cn(
        "group relative block p-8 rounded-none border transition-all duration-500 text-left overflow-hidden backdrop-blur-md",
        c.border, c.bg, c.glow,
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer active:scale-[0.98]"
    )

    const content = (
        <div className="relative z-10 space-y-8">
            <div className="flex items-center justify-between">
                <div className={cn("w-14 h-14 rounded-none flex items-center justify-center border border-white/5 transition-all duration-500", c.iconBg)}>
                    {loading ? <LucideRefreshCw size={24} className={cn("animate-spin", c.text)} /> : icon}
                </div>
                <LucideChevronRight size={20} className="text-zinc-800 group-hover:text-primary group-hover:translate-x-1 transition-all duration-500" />
            </div>
            <div className="space-y-2">
                <p className="font-bebas text-5xl text-white tracking-wider uppercase leading-none">{label}</p>
                <p className="text-zinc-500 group-hover:text-zinc-400 text-sm leading-relaxed transition-colors duration-500">{desc}</p>
            </div>
            
            {/* Background Gradient Pulse */}
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
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
            ref={cardRef as any}
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
                }) : "—"
                
                const timeAt = s.createdAt ? new Date(s.createdAt).toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                }) : ""

                return (
                    <motion.div 
                        key={idx} 
                        whileHover={{ y: -4 }}
                        className="p-8 rounded-none border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all space-y-6 group relative overflow-hidden"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                <LucideHistory size={12} className="text-primary" />
                                {createdAt} <span className="opacity-30">/</span> {timeAt}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-baseline gap-2">
                                <span className="font-bebas text-6xl text-white leading-none">{files}</span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 italic">Files</span>
                            </div>
                            <div className="flex items-center gap-3 pt-2">
                                <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-primary" 
                                        style={{ width: `${totalCount > 0 ? (matchedCount / totalCount) * 100 : 0}%` }} 
                                    />
                                </div>
                                <span className="text-[10px] font-bold text-zinc-400">{matched} match</span>
                            </div>
                        </div>

                        {unmatched.length > 0 && (
                            <div className="text-[9px] font-black uppercase tracking-widest text-rose-500/60 bg-rose-500/5 px-2 py-1 inline-block border border-rose-500/10">
                                {unmatched.length} Missing Info
                            </div>
                        )}
                        
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                    </motion.div>
                )
            })}
        </div>
    )
}
