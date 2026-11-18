import React, { useDeferredValue, useMemo, useState } from "react"
import { Cloud, FileVideo, Film, HardDrive, Search, Tv, X } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/button/icon-button"
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control"
import type { ScanFeedIcon, ScanLiveView } from "./views"

const FEED_ICONS: Record<ScanFeedIcon, { icon: React.ElementType; className: string; label: string }> = {
    episode: { icon: Tv, className: "text-brand-accent", label: "Episodio" },
    movie: { icon: Film, className: "text-status-warning", label: "Película" },
    file: { icon: FileVideo, className: "text-brand-accent", label: "Archivo" },
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
    const view = views.find(v => v.source === source) ?? views[0]

    const viewOptions = useMemo<SegmentedOption<string>[]>(() => {
        return views.map(v => {
            const Icon = v.source === "drive" ? Cloud : HardDrive
            return {
                value: v.source,
                label: v.sourceLabel,
                icon: <Icon className="size-3" />,
            }
        })
    }, [views])

    const [group, setGroup] = useState<string | null>(null)
    const [query, setQuery] = useState("")
    const searchRef = React.useRef<HTMLInputElement>(null)
    const deferredQuery = useDeferredValue(query.trim().toLowerCase())

    const feed = useMemo(() => view?.feed ?? [], [view])
    const filtered = useMemo(() => feed.filter(item =>
        (!group || item.group === group) &&
        (!deferredQuery || `${item.title ?? ""} ${item.detail}`.toLowerCase().includes(deferredQuery))
    ), [feed, group, deferredQuery])

    if (!view) {
        return (
            <section className="rounded-2xl border border-dashed border-[var(--neutral-separator)] bg-[var(--neutral-elev-2)] px-5 py-8 text-center">
                <FileVideo className="size-6 mx-auto text-on-surface-variant/40" />
                <h3 className="mt-2 text-xs font-bold text-on-surface">Todavía no hay archivos escaneados</h3>
                <p className="mt-1 text-2xs text-label-2">
                    Pulsa <span className="font-semibold text-on-surface">Escanear</span> y verás cada episodio y película a medida que se detecta.
                </p>
            </section>
        )
    }

    const isRunning = view.state === "running"
    const newestId = isRunning ? feed[0]?.id : undefined
    const chips = view.chips ?? []

    return (
        <section aria-label="Archivos escaneados" className="rounded-2xl border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] bg-[var(--neutral-elev-2)] shadow-[shadow:var(--double-bezel-shadow)] overflow-hidden">
            {/* Encabezado: título, contador, origen y buscador */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 sm:px-5 py-3 border-b border-[var(--neutral-separator)]">
                <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-xs font-bold text-on-surface">Archivos escaneados</h3>
                    <span className="px-1.5 py-0.5 rounded-md bg-[var(--neutral-elev-3)] text-3xs font-mono font-bold tabular-nums text-on-surface-variant">
                        {filtered.length === feed.length ? feed.length : `${filtered.length} / ${feed.length}`}
                    </span>
                    {isRunning && (
                        <span className="inline-flex items-center gap-1.5 text-3xs font-bold text-brand-accent-readable">
                            <span className="relative flex size-2">
                                <span className="absolute inline-flex size-full rounded-full bg-brand-accent opacity-60 animate-ping" />
                                <span className="relative inline-flex size-2 rounded-full bg-brand-accent" />
                            </span>
                            En vivo
                        </span>
                    )}
                </div>

                {views.length > 1 && (
                    <SegmentedControl
                        aria-label="Origen de escaneo"
                        layoutId="scanFileListSource"
                        semantics="tablist"
                        tone="neutral"
                        surface="glass"
                        value={view.source}
                        onChange={(val) => { setSource(val as ScanLiveView["source"]); setGroup(null) }}
                        options={viewOptions}
                    />
                )}

                <div className="flex items-center gap-2 w-full sm:w-56 sm:ml-auto pl-4 pr-1 h-11 rounded-full bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] has-[input:focus-visible]:outline has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:[outline-color:hsl(var(--focus-ring)/0.9)] transition-[border-color,background-color] duration-fast ease-smooth-out">
                    <Search className="size-3.5 shrink-0 text-label-3" />
                    <input
                        ref={searchRef}
                        data-field-embedded
                        type="search"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Buscar archivo o serie…"
                        aria-label="Buscar en los archivos escaneados"
                        className="[&::-webkit-search-cancel-button]:appearance-none min-w-0 w-full appearance-none bg-transparent border-0 p-0 shadow-none ring-0 focus:ring-0 text-base md:text-sm text-on-surface placeholder:text-label-3 focus:outline-none"
                    />
                    {query && (
                        <IconButton
                            type="button"
                            intent="ghost"
                            size="sm"
                            aria-label="Limpiar búsqueda"
                            icon={<X className="size-4" />}
                            onClick={() => {
                                setQuery("")
                                searchRef.current?.focus()
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Filtros por serie */}
            {chips.length > 0 && (
                <div className="flex gap-1.5 px-4 sm:px-5 py-2.5 border-b border-[var(--neutral-separator)] overflow-x-auto no-scrollbar" role="group" aria-label="Filtrar por serie">
                    <FilterChip label="Todas" count={feed.length} active={group === null} onClick={() => setGroup(null)} />
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
                                "[content-visibility:auto] [contain-intrinsic-size:auto_56px] flex items-center gap-3 px-4 sm:px-5 py-2 min-w-0 hover:bg-[var(--neutral-elev-3)]",
                                item.id === newestId && "bg-brand-accent/[0.08] animate-in fade-in slide-in-from-top-1 duration-200",
                            )}
                        >
                            <Icon className={cn("size-3.5 shrink-0", className)} aria-label={label} />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 min-w-0">
                                    {item.title && <span className="text-2xs font-semibold text-on-surface truncate">{item.title}</span>}
                                    {item.badge && (
                                        <span className="shrink-0 px-1.5 rounded bg-[var(--neutral-elev-3)] text-3xs font-mono font-bold text-status-success/90 tabular-nums">
                                            {item.badge}
                                        </span>
                                    )}
                                </div>
                                <p className="text-3xs font-mono text-label-2 truncate" title={item.detail}>
                                    {prettyFileName(item.detail)}
                                </p>
                            </div>
                        </li>
                    )
                })}
                {filtered.length === 0 && (
                    <li className="px-5 py-6 text-2xs text-label-2 text-center">
                        {feed.length === 0 ? "Esperando los primeros archivos…" : "Ningún archivo coincide con el filtro."}
                    </li>
                )}
                {filtered.length > RENDER_LIMIT && (
                    <li className="px-5 py-2.5 text-3xs text-label-2 text-center">
                        Mostrando {RENDER_LIMIT} de {filtered.length}. Usa el buscador o filtra por serie para ver el resto.
                    </li>
                )}
            </ul>
        </section>
    )
}

function FilterChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
    return (
        <Button
            intent={active ? "primary" : "secondary"}
            size="xs"
            aria-pressed={active}
            onClick={onClick}
            className="shrink-0"
        >
            {label}
            <span className={cn("ml-1.5 font-mono font-bold tabular-nums", active ? "opacity-70" : "text-label-2")}>{count}</span>
        </Button>
    )
}
