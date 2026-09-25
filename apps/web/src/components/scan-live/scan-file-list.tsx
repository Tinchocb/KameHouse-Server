import React, { useDeferredValue, useMemo, useState } from "react"
import { Check, Cloud, FileVideo, Film, HardDrive, Search, Trash2, Tv } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { MagneticIndicator } from "@/components/ui/kinetics/magnetic-indicator"
import { useReducedMotion } from "@/components/ui/kinetics/hooks"
import type { ScanFeedIcon, ScanLiveView } from "./views"

const FEED_ICONS: Record<ScanFeedIcon, { icon: React.ElementType; className: string; label: string }> = {
    episode: { icon: Tv, className: "text-brand-accent", label: "Episodio" },
    movie: { icon: Film, className: "text-amber-400", label: "Película" },
    file: { icon: FileVideo, className: "text-brand-accent", label: "Archivo" },
    pruned: { icon: Trash2, className: "text-amber-400", label: "Eliminado" },
    done: { icon: Check, className: "text-emerald-400", label: "Listo" },
}

/** Filas renderizadas a la vez; el resto se alcanza con el buscador o los filtros. */
const RENDER_LIMIT = 400

/** "(1990-10-17) Dragon Ball Z - La Batalla.mkv" → "Dragon Ball Z - La Batalla". */
function prettyFileName(name: string): string {
    return name.replace(/^\s*[([]\d{4}(?:-\d{2}){0,2}[)\]]\s*/, "").replace(/\.[a-z0-9]{2,4}$/i, "")
}

/**
 * Todo lo que detectó el escaneo, en vivo: lo más nuevo arriba, filtrable por serie
 * (chips) y con buscador. Con disco local y Drive a la vez, se elige el origen.
 */
export function ScanFileList({ views }: { views: ScanLiveView[] }) {
    const [source, setSource] = useState<ScanLiveView["source"] | null>(null)
    const reduceMotion = useReducedMotion()
    const view = views.find(v => v.source === source) ?? views[0]

    const [group, setGroup] = useState<string | null>(null)
    const [query, setQuery] = useState("")
    const deferredQuery = useDeferredValue(query.trim().toLowerCase())

    const feed = useMemo(() => view?.feed ?? [], [view])
    const filtered = useMemo(() => feed.filter(item =>
        (!group || item.group === group) &&
        (!deferredQuery || `${item.title ?? ""} ${item.detail}`.toLowerCase().includes(deferredQuery))
    ), [feed, group, deferredQuery])

    if (!view) {
        return (
            <section className="rounded-2xl border border-dashed border-white/10 bg-white/[0.01] px-5 py-8 text-center">
                <FileVideo className="size-6 mx-auto text-on-surface-variant/40" />
                <h4 className="mt-2 text-xs font-bold text-on-surface">Todavía no hay archivos escaneados</h4>
                <p className="mt-1 text-2xs text-on-surface-variant/70">
                    Tocá <span className="font-semibold text-on-surface">Escanear</span> y vas a ver cada episodio y película a medida que se detecta.
                </p>
            </section>
        )
    }

    const isRunning = view.state === "running"
    const newestId = isRunning ? feed[0]?.id : undefined
    const chips = view.chips ?? []

    return (
        <section aria-label="Archivos escaneados" className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            {/* Encabezado: título, contador, origen y buscador */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 sm:px-5 py-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2 min-w-0">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface">Archivos escaneados</h4>
                    <span className="px-1.5 py-0.5 rounded-md bg-white/[0.06] text-3xs font-mono font-bold tabular-nums text-on-surface-variant">
                        {filtered.length === feed.length ? feed.length : `${filtered.length} / ${feed.length}`}
                    </span>
                    {isRunning && (
                        <span className="inline-flex items-center gap-1.5 text-3xs font-bold uppercase tracking-wider text-brand-accent">
                            <span className="relative flex size-2">
                                <span className="absolute inline-flex size-full rounded-full bg-brand-accent opacity-60 animate-ping" />
                                <span className="relative inline-flex size-2 rounded-full bg-brand-accent" />
                            </span>
                            En vivo
                        </span>
                    )}
                </div>

                {views.length > 1 && (
                    <div className="flex items-center gap-1 p-1 rounded-full bg-zinc-950/40 border border-white/20 border-t-white/40 border-b-white/10" role="tablist" aria-label="Origen">
                        {views.map(v => {
                            const Icon = v.source === "drive" ? Cloud : HardDrive
                            const active = v.source === view.source
                            return (
                                <button
                                    key={v.source}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => { setSource(v.source); setGroup(null) }}
                                    className={cn(
                                        "relative flex min-h-11 min-w-11 items-center justify-center gap-1 px-3 rounded-full text-3xs font-medium transition-colors duration-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
                                        active ? "text-on-surface" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5",
                                    )}
                                >
                                    <MagneticIndicator
                                        layoutId="scanFileListSource"
                                        active={active}
                                        disableAnimation={!!reduceMotion}
                                        className="bg-white/10"
                                    />
                                    <Icon className="relative z-10 size-3" />
                                    <span className="relative z-10">{v.sourceLabel}</span>
                                </button>
                            )
                        })}
                    </div>
                )}

                <label className="flex items-center gap-1.5 w-full sm:w-56 sm:ml-auto px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 focus-within:border-brand-accent/50 transition-colors">
                    <Search className="size-3.5 shrink-0 text-on-surface-variant/60" />
                    <input
                        type="search"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Buscar archivo o serie"
                        aria-label="Buscar en los archivos escaneados"
                        className="min-w-0 w-full appearance-none bg-transparent border-0 p-0 shadow-none ring-0 focus:ring-0 text-2xs text-on-surface placeholder:text-on-surface-variant/45 focus:outline-none"
                    />
                </label>
            </div>

            {/* Filtros por serie */}
            {chips.length > 0 && (
                <div className="flex gap-1.5 px-4 sm:px-5 py-2.5 border-b border-white/[0.06] overflow-x-auto no-scrollbar" role="group" aria-label="Filtrar por serie">
                    <FilterChip label="Todo" count={feed.length} active={group === null} onClick={() => setGroup(null)} />
                    {chips.map(chip => (
                        <FilterChip
                            key={chip.label}
                            label={chip.label}
                            count={chip.count}
                            active={group === chip.label}
                            onClick={() => setGroup(group === chip.label ? null : chip.label)}
                        />
                    ))}
                </div>
            )}

            {/* Listado */}
            <ul className="max-h-96 overflow-y-auto divide-y divide-white/[0.04]">
                {filtered.slice(0, RENDER_LIMIT).map(item => {
                    const { icon: Icon, className, label } = FEED_ICONS[item.icon]
                    return (
                        <li
                            key={item.id}
                            className={cn(
                                "flex items-center gap-3 px-4 sm:px-5 py-2 min-w-0 hover:bg-white/[0.02]",
                                item.id === newestId && "bg-brand-accent/[0.08] animate-in fade-in slide-in-from-top-1 duration-200",
                            )}
                        >
                            <Icon className={cn("size-3.5 shrink-0", className)} aria-label={label} />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 min-w-0">
                                    {item.title && <span className="text-2xs font-semibold text-on-surface truncate">{item.title}</span>}
                                    {item.badge && (
                                        <span className="shrink-0 px-1.5 rounded bg-white/[0.06] text-3xs font-mono font-bold text-emerald-300/90 tabular-nums">
                                            {item.badge}
                                        </span>
                                    )}
                                </div>
                                <p className="text-3xs font-mono text-on-surface-variant/60 truncate" title={item.detail}>
                                    {prettyFileName(item.detail)}
                                </p>
                            </div>
                        </li>
                    )
                })}
                {filtered.length === 0 && (
                    <li className="px-5 py-6 text-2xs text-on-surface-variant/60 text-center">
                        {feed.length === 0 ? "Esperando los primeros archivos…" : "Nada coincide con el filtro."}
                    </li>
                )}
                {filtered.length > RENDER_LIMIT && (
                    <li className="px-5 py-2.5 text-3xs text-on-surface-variant/60 text-center">
                        Mostrando {RENDER_LIMIT} de {filtered.length}. Usá el buscador o filtrá por serie para ver el resto.
                    </li>
                )}
            </ul>
        </section>
    )
}

function FilterChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            className={cn(
                "inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full text-3xs font-medium border transition-colors whitespace-nowrap",
                active
                    ? "bg-brand-accent/15 border-brand-accent/45 text-on-surface"
                    : "bg-white/[0.03] border-white/10 text-on-surface-variant hover:text-on-surface hover:border-white/20",
            )}
        >
            {label}
            <span className={cn("font-mono font-bold tabular-nums", active ? "text-brand-accent" : "text-on-surface-variant/70")}>{count}</span>
        </button>
    )
}
