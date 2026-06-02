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
            border: "border-white/5 hover:border-brand-orange/45", 
            bg: "bg-white/[0.02] hover:bg-brand-orange/[0.01]", 
            glow: "hover:shadow-[0_0_40px_-10px_rgba(255,110,58,0.15)]", 
            text: "text-brand-orange",
            iconBg: "bg-white/5 group-hover:bg-brand-orange/15 group-hover:border-brand-orange/20"
        },
        zinc: { 
            border: "border-white/5 hover:border-white/20", 
            bg: "bg-white/[0.01] hover:bg-white/[0.03]", 
            glow: "hover:shadow-[0_0_40px_-10px_rgba(255,255,255,0.03)]", 
            text: "text-zinc-500",
            iconBg: "bg-white/[0.01] group-hover:bg-white/[0.04] group-hover:border-white/10"
        },
    }
    const c = colors[accentColor]

    const baseClasses = cn(
        "group relative block p-7 rounded-2xl border transition-all duration-500 text-left overflow-hidden backdrop-blur-md shadow-[0_15px_30px_rgba(0,0,0,0.2)]",
        c.border, c.bg, c.glow,
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer active:scale-[0.98]"
    )

    const content = (
        <div className="relative z-10 space-y-6">
            <div className="flex items-center justify-between">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center border border-white/5 transition-all duration-500 shadow-inner", c.iconBg)}>
                    {loading ? <LucideRefreshCw size={20} className={cn("animate-spin", c.text)} /> : icon}
                </div>
                <LucideChevronRight size={18} className="text-zinc-700 group-hover:text-brand-orange group-hover:translate-x-1.5 transition-all duration-500" />
            </div>
            <div className="space-y-1.5">
                <p className="font-bebas text-4xl text-white tracking-wider uppercase leading-none">{label}</p>
                <p className="text-zinc-500 group-hover:text-zinc-400 text-xs leading-relaxed transition-colors duration-500 font-medium">{desc}</p>
            </div>
            
            {/* Background Gradient Pulse */}
            <div className="absolute -bottom-12 -right-12 w-36 h-36 bg-brand-orange/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
        </div>
    )

    if (to) {
        return (
            <Link to={to as "/home"} className={baseClasses}>
                {content}
            </Link>
        )
    }

    return (
        <button
            ref={cardRef as React.RefObject<HTMLButtonElement>}
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
    const [searchQuery, setSearchQuery] = React.useState("")
    const [selectedStatus, setSelectedStatus] = React.useState<string>("ALL")
    const [isPaused, setIsPaused] = React.useState(false)
    const [frozenEvents, setFrozenEvents] = React.useState<ScanEvent[]>([])

    // Sync or freeze events
    React.useEffect(() => {
        if (!isPaused) {
            setFrozenEvents(events)
        }
    }, [events, isPaused])

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

    const filteredEvents = React.useMemo(() => {
        return frozenEvents.filter(evt => {
            const label = getEventLabel(evt).toLowerCase()
            const matchesSearch = label.includes(searchQuery.toLowerCase())
            const matchesStatus = selectedStatus === "ALL" || evt.status === selectedStatus
            return matchesSearch && matchesStatus
        })
    }, [frozenEvents, searchQuery, selectedStatus])

    const visibleEvents = filteredEvents.slice(0, 100)

    return (
        <div className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
                {/* macOS style Pill Selector */}
                <div className="flex bg-white/[0.02] border border-white/5 rounded-full p-1 self-start gap-1">
                    {["ALL", "START", "PROCESSING", "PRUNED", "FINISH"].map((status) => (
                        <button
                            key={status}
                            onClick={() => setSelectedStatus(status)}
                            className={cn(
                                "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all duration-300",
                                selectedStatus === status
                                    ? "bg-brand-orange text-white shadow-[0_2px_10px_rgba(255,110,58,0.3)]"
                                    : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            {status === "ALL" ? "Todos" : status}
                        </button>
                    ))}
                </div>
                
                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar en logs..."
                        className="bg-white/[0.02] border border-white/5 focus:border-brand-orange/40 rounded-xl px-4 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none w-full sm:w-56 font-mono transition-all duration-300 focus:shadow-[0_0_15px_rgba(255,110,58,0.08)]"
                    />
                    <button
                        onClick={() => setIsPaused(!isPaused)}
                        className={cn(
                            "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border duration-300 active:scale-95",
                            isPaused
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.1)]"
                                : "bg-white/[0.02] border-white/5 text-zinc-400 hover:text-white hover:bg-white/[0.06]"
                        )}
                    >
                        {isPaused ? "Reanudar" : "Pausar"}
                    </button>
                </div>
            </div>

            {/* Event List Container */}
            <div className="rounded-2xl overflow-hidden border border-white/5 bg-white/[0.01] backdrop-blur-md relative shadow-[0_20px_40px_rgba(0,0,0,0.3)]">
                {isPaused && (
                    <div className="absolute top-3 right-4 z-20 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[8px] font-black tracking-widest uppercase px-2.5 py-1 rounded-full animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.15)]">
                        FROZEN FEED
                    </div>
                )}
                <div
                    ref={listRef}
                    className="max-h-80 overflow-y-auto divide-y divide-white/[0.02]"
                >
                    {visibleEvents.length === 0 ? (
                        <div className="p-12 text-center text-zinc-600 uppercase font-black tracking-widest text-[10px]">
                            No se encontraron logs coincidentes
                        </div>
                    ) : (
                        visibleEvents.map((evt: ScanEvent & { id?: string; timestamp: number }) => {
                            const color = getEventColor(evt.status)
                            return (
                                <motion.div
                                    key={evt.id || `${evt.timestamp}`}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center gap-5 px-8 py-3.5 hover:bg-white/[0.005] transition-colors"
                                >
                                    <div 
                                        className={cn("w-1.5 h-1.5 rounded-full shrink-0")} 
                                        style={{ 
                                            backgroundColor: evt.status === "START" || evt.status === "FINISH" ? "rgb(255,110,58)" : evt.status === "PRUNED" ? "#f43f5e" : "#71717a",
                                            boxShadow: evt.status === "START" || evt.status === "FINISH" ? "0 0 6px rgb(255,110,58)" : "none"
                                        }}
                                    />
                                    <span className={cn("text-xs font-mono truncate flex-1 leading-normal", color)}>
                                        {getEventLabel(evt)}
                                    </span>
                                    <span className="text-[10px] font-mono text-zinc-600 shrink-0">
                                        {new Date(evt.timestamp).toLocaleTimeString()}
                                    </span>
                                </motion.div>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    )
}

export function ScanHistory({ summaries }: { summaries: Summary_ScanSummaryItem[] }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {summaries.map((s, idx) => {
                const groups: Summary_ScanSummaryGroup[] = s.scanSummary?.groups ?? []
                const unmatched: Summary_ScanSummaryFile[] = s.scanSummary?.unmatchedFiles ?? []
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
