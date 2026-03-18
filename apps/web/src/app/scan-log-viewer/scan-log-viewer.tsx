import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/components/ui/core/styling"
import { TextInput } from "@/components/ui/text-input"
import React, { useMemo, useState } from "react"
import { BiCheck, BiChevronDown, BiChevronRight, BiError, BiFile, BiInfoCircle, BiLinkAlt, BiSearch, BiX } from "react-icons/bi"
import { RiFileSettingsFill } from "react-icons/ri"
import { Virtuoso } from "react-virtuoso"

type LogLevel = "trace" | "debug" | "info" | "warn" | "error"
type LogContext = "Matcher" | "FileHydrator" | "MediaFetcher" | "MediaContainer" | "Scanner"

interface ParsedLogLine {
    idx: number
    level: LogLevel
    context?: LogContext
    filename?: string
    message?: string
    raw: any
}

type Phase = "overview" | "parsing" | "matcher" | "hydrator" | "issues"

interface FileGroup {
    filename: string
    parsingLog?: ParsedLogLine
    matcherLogs: ParsedLogLine[]
    hydratorLogs: ParsedLogLine[]
    matchResult?: { id: number; match: string; score: number } | null
    hydrationResult?: { episode: number; aniDBEpisode: string; type: string } | null
    hasError: boolean
    hasWarning: boolean
    isUnmatched: boolean
}

interface ScanStats {
    totalFiles: number
    matchedFiles: number
    unmatchedFiles: number
    errorCount: number
    warningCount: number
    scanDuration: string | null
    matcherDuration: string | null
    hydratorDuration: string | null
    mediaCount: number
    fetchedMediaCount: number
    unknownMediaCount: number
    tokenIndexSize: number
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function parseLogLines(content: string): ParsedLogLine[] {
    const lines = content.split("\n")
    const parsed: ParsedLogLine[] = []
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        try {
            const data: any = JSON.parse(line)
            parsed.push({
                idx: i,
                level: data.level || "debug",
                context: data.context || undefined,
                filename: data.filename || undefined,
                message: data.message || undefined,
                raw: data,
            })
        }
        catch {
            // non-JSON lines ignored
        }
    }
    return parsed
}

function extractStats(lines: ParsedLogLine[]): ScanStats {
    const stats: ScanStats = {
        totalFiles: 0,
        matchedFiles: 0,
        unmatchedFiles: 0,
        errorCount: 0,
        warningCount: 0,
        scanDuration: null,
        matcherDuration: null,
        hydratorDuration: null,
        mediaCount: 0,
        fetchedMediaCount: 0,
        unknownMediaCount: 0,
        tokenIndexSize: 0,
    }

    const matchedFilenames = new Set<string>()
    const allMatcherFilenames = new Set<string>()

    for (const line of lines) {
        if (line.level === "error") stats.errorCount++
        if (line.level === "warn") stats.warningCount++

        const d = line.raw

        // matcher stats
        if (line.context === "Matcher") {
            if (line.filename) allMatcherFilenames.add(line.filename)
            if (d.message === "Best match found" && line.filename) {
                matchedFilenames.add(line.filename)
            }
            if (d.message === "Finished matching process") {
                stats.matcherDuration = d.ms ? `${d.ms}ms` : null
                stats.totalFiles = d.files || 0
                stats.unmatchedFiles = d.unmatched || 0
            }
        }

        // media fetcher stats
        if (line.context === "MediaFetcher") {
            if (d.message === "Finished creating media fetcher") {
                stats.fetchedMediaCount = d.allMediaCount || 0
                stats.unknownMediaCount = d.unknownMediaCount || 0
            }
        }

        // media container stats
        if (line.context === "MediaContainer") {
            if (d.message === "Created media container") {
                stats.mediaCount = d.mediaCount || 0
                stats.tokenIndexSize = d.tokenIndexSize || 0
            }
        }

        // hydrator timing
        if (line.context === "FileHydrator") {
            if (d.message === "Finished metadata hydration") {
                stats.hydratorDuration = d.ms ? `${d.ms}ms` : null
            }
        }

        // Scan completion
        if (d.message === "Scan completed" && d.count) {
            stats.totalFiles = d.count
        }
    }

    stats.matchedFiles = matchedFilenames.size
    if (stats.totalFiles === 0) stats.totalFiles = allMatcherFilenames.size
    if (stats.unmatchedFiles === 0) stats.unmatchedFiles = stats.totalFiles - stats.matchedFiles

    return stats
}

function buildFileGroups(lines: ParsedLogLine[]): FileGroup[] {
    const fileMap = new Map<string, FileGroup>()

    const getOrCreate = (filename: string): FileGroup => {
        let group = fileMap.get(filename)
        if (!group) {
            group = {
                filename,
                parsingLog: undefined,
                matcherLogs: [],
                hydratorLogs: [],
                matchResult: null,
                hydrationResult: null,
                hasError: false,
                hasWarning: false,
                isUnmatched: false,
            }
            fileMap.set(filename, group)
        }
        return group
    }

    for (const line of lines) {
        if (!line.filename) continue

        // Parsed file lines (no context, has path)
        if (!line.context && line.raw.path) {
            const group = getOrCreate(line.filename)
            group.parsingLog = line
        }

        if (line.context === "Matcher") {
            const group = getOrCreate(line.filename)
            group.matcherLogs.push(line)
            if (line.level === "error") group.hasError = true
            if (line.level === "warn") group.hasWarning = true

            if (line.raw.message === "Best match found" || line.raw.message === "Hook overrode match" || line.raw.message === "Matched by rule") {
                group.matchResult = {
                    id: line.raw.id,
                    match: line.raw.match,
                    score: line.raw.score || 0,
                }
            }
            if (line.raw.message === "No match found") {
                group.isUnmatched = true
            }
        }

        if (line.context === "FileHydrator") {
            const group = getOrCreate(line.filename)
            group.hydratorLogs.push(line)
            if (line.level === "error") group.hasError = true
            if (line.level === "warn") group.hasWarning = true

            if (line.raw.hydrated) {
                group.hydrationResult = {
                    episode: line.raw.hydrated.episode || 0,
                    aniDBEpisode: line.raw.hydrated.aniDBEpisode || "",
                    type: (line.raw.message?.includes("File has been marked as")
                        ? line.raw.message.replace("File has been marked as ", "")
                        : group.hydrationResult?.type) || "unknown",
                }
            }
        }
    }

    return Array.from(fileMap.values())
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function ScanLogViewer({ content }: { content: string }) {
    const [activePhase, setActivePhase] = useState<Phase>("overview")
    const [searchQuery, setSearchQuery] = useState("")
    const [levelFilter, setLevelFilter] = useState<LogLevel | "all">("all")
    const [statusFilter, setStatusFilter] = useState<"all" | "matched" | "unmatched" | "errors">("all")
    const [selectedFile, setSelectedFile] = useState<string | null>(null)

    const lines = useMemo(() => parseLogLines(content), [content])
    const stats = useMemo(() => extractStats(lines), [lines])
    const fileGroups = useMemo(() => buildFileGroups(lines), [lines])

    const fileGroupMap = useMemo(() => {
        const map = new Map<string, FileGroup>()
        for (const g of fileGroups) map.set(g.filename, g)
        return map
    }, [fileGroups])

    const parsingLines = useMemo(
        () => lines.filter((l) => !l.context && l.raw.path && l.raw.filename),
        [lines],
    )

    const systemLines = useMemo(
        () => lines.filter((l) => l.context === "MediaFetcher" || l.context === "MediaContainer" || (!l.context && !l.raw.path)),
        [lines],
    )

    const issueLines = useMemo(
        () => lines.filter((l) => l.level === "error" || l.level === "warn"),
        [lines],
    )

    const onSelectFile = (filename: string) => {
        setSelectedFile(filename)
    }

    if (!content) {
        return (
            <div className="flex flex-col items-center justify-center h-[40vh] gap-4 glass-panel rounded-[2rem] border-white/5 bg-white/[0.01]">
                <div className="p-4 rounded-full bg-primary/10 border border-primary/20">
                    <BiInfoCircle className="w-8 h-8 text-primary opacity-50" />
                </div>
                <p className="font-bebas text-2xl tracking-widest text-zinc-500 uppercase">Sin datos cargados</p>
                <p className="text-xs font-bold text-zinc-600 uppercase tracking-tighter">Arrastra un archivo de log para comenzar el análisis</p>
            </div>
        )
    }

    // file flow view (full journey of a file)
    if (selectedFile) {
        const group = fileGroupMap.get(selectedFile)
        return (
            <div className="glass-panel-premium rounded-[2rem] overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                <div className="flex items-center gap-4 px-8 py-6 border-b border-white/5 bg-white/[0.02] backdrop-blur-xl">
                    <button 
                        onClick={() => setSelectedFile(null)}
                        className="group flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-primary/20 border border-white/10 hover:border-primary/30 transition-all duration-300"
                    >
                        <BiChevronRight className="w-6 h-6 text-white group-hover:text-primary rotate-180 transition-transform" />
                    </button>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70">Trace de Archivo</span>
                        <h2 className="text-sm font-bold text-white break-all tracking-tight leading-none mt-1">{selectedFile}</h2>
                    </div>
                </div>
                <div className="p-8 min-h-[60vh] bg-gradient-to-b from-transparent to-black/20">
                    {group ? (
                        <FileFlowPanel group={group} />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full py-20 opacity-40">
                            <BiFile className="w-12 h-12 mb-4" />
                            <p className="text-sm font-bold uppercase tracking-widest">Sin registros encontrados</p>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="glass-panel-premium rounded-[2.5rem] overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* ── Tabs Navigation ── */}
            <div className="flex flex-wrap gap-1 px-4 pt-4 border-b border-white/5 bg-white/[0.02]">
                {([
                    { key: "overview", label: "Panorama", icon: BiInfoCircle },
                    { key: "parsing", label: "Parsers", icon: BiFile },
                    { key: "matcher", label: "Matcher", icon: BiSearch },
                    { key: "hydrator", label: "Hydrator", icon: RiFileSettingsFill },
                    { key: "issues", label: `Incidencias (${stats.errorCount + stats.warningCount})`, icon: BiError },
                ] as const).map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setActivePhase(key as Phase)}
                        className={cn(
                            "group relative flex items-center gap-2.5 px-6 py-4 transition-all duration-500",
                            activePhase === key ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                        )}
                    >
                        <Icon className={cn(
                            "text-xl transition-all duration-500",
                            activePhase === key ? "text-primary drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]" : "opacity-50"
                        )} />
                        <span className="font-bebas text-lg tracking-[0.1em]">{label}</span>
                        
                        {/* Active Indicator */}
                        <div className={cn(
                            "absolute bottom-0 left-4 right-4 h-1 rounded-t-full bg-primary transition-all duration-500 shadow-[0_0_12px_rgba(249,115,22,0.6)]",
                            activePhase === key ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"
                        )} />
                    </button>
                ))}
            </div>

            <div className="min-h-[60vh] bg-white/[0.01]">
                <div className="p-8">
                    {activePhase === "overview" && (
                        <OverviewPanel stats={stats} lines={systemLines} />
                    )}
                    {activePhase === "parsing" && (
                        <ParsingPanel lines={parsingLines} searchQuery={searchQuery} setSearchQuery={setSearchQuery} onSelectFile={onSelectFile} />
                    )}
                    {activePhase === "matcher" && (
                        <MatcherPanel
                            fileGroups={fileGroups}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            statusFilter={statusFilter}
                            setStatusFilter={setStatusFilter}
                            onSelectFile={onSelectFile}
                        />
                    )}
                    {activePhase === "hydrator" && (
                        <HydratorPanel
                            fileGroups={fileGroups}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            levelFilter={levelFilter}
                            setLevelFilter={setLevelFilter}
                            onSelectFile={onSelectFile}
                        />
                    )}
                    {activePhase === "issues" && (
                        <IssuesPanel lines={issueLines} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
                    )}
                </div>
            </div>
        </div>
    )
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function OverviewPanel({ stats, lines }: { stats: ScanStats; lines: ParsedLogLine[] }) {
    return (
        <div className="space-y-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    label="Archivos Totales" 
                    value={stats.totalFiles} 
                    icon={<BiFile />} 
                    color="text-blue-400" 
                    glowColor="rgba(59,130,246,0.3)"
                />
                <StatCard
                    label="Emparejados"
                    value={stats.matchedFiles}
                    icon={<BiCheck />}
                    color="text-emerald-400"
                    glowColor="rgba(16,185,129,0.3)"
                    sub={stats.totalFiles > 0 ? `${((stats.matchedFiles / stats.totalFiles) * 100).toFixed(0)}%` : undefined}
                    active
                />
                <StatCard
                    label="Sin Coincidencia"
                    value={stats.unmatchedFiles}
                    icon={<BiX />}
                    color={stats.unmatchedFiles > 0 ? "text-amber-400" : "text-zinc-600"}
                    glowColor="rgba(245,158,11,0.3)"
                />
                <StatCard
                    label="Incidencias"
                    value={stats.errorCount + stats.warningCount}
                    icon={<BiError />}
                    color={stats.errorCount > 0 ? "text-rose-400" : "text-zinc-600"}
                    glowColor="rgba(244,63,94,0.3)"
                    danger={stats.errorCount > 0}
                />
            </div>

            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">Pipeline Timeline</span>
                    <div className="h-px flex-1 bg-white/5" />
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                    <PipelineStep label="Descubrimiento" detail={`${stats.totalFiles} archivos`} active />
                    <BiChevronRight className="text-zinc-700 text-2xl" />
                    <PipelineStep label="Media Fetch" detail={`${stats.fetchedMediaCount} media`} />
                    <BiChevronRight className="text-zinc-700 text-2xl" />
                    <PipelineStep label="Token Index" detail={`${stats.tokenIndexSize} tokens`} />
                    <BiChevronRight className="text-zinc-700 text-2xl" />
                    <PipelineStep label="Matcher" detail={stats.matcherDuration || "—"} active highlight />
                    <BiChevronRight className="text-zinc-700 text-2xl" />
                    <PipelineStep label="Hydrator" detail={stats.hydratorDuration || "—"} />
                </div>
            </div>

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">Eventos de Sistema</span>
                </div>
                <div className="glass-panel rounded-3xl overflow-hidden border-white/5 bg-black/40">
                    <Virtuoso
                        style={{ height: "40vh" }}
                        totalCount={lines.length}
                        itemContent={(index) => (
                            <div className="border-b border-white/[0.02] last:border-none">
                                <SystemLogLine line={lines[index]} />
                            </div>
                        )}
                    />
                </div>
            </div>
        </div>
    )
}

function StatCard({ 
    label, value, icon, color, glowColor, sub, active, danger 
}: { 
    label: string; value: number; icon: React.ReactNode; color: string; glowColor: string; sub?: string; active?: boolean; danger?: boolean 
}) {
    return (
        <div className={cn(
            "group relative p-8 rounded-[2rem] border transition-all duration-500 overflow-hidden",
            active ? "bg-white/[0.03] border-white/10" : "bg-black/20 border-white/5 hover:border-white/10 hover:bg-white/[0.01]",
            danger && "border-rose-500/20 bg-rose-500/[0.02]"
        )}>
            {/* Background Glow */}
            <div 
                className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                style={{ backgroundColor: glowColor }}
            />
            
            <div className="relative space-y-4">
                <div className="flex items-center gap-3">
                    <span className={cn(
                        "text-2xl p-3 rounded-2xl bg-black/40 border border-white/10 transition-transform duration-500 group-hover:scale-110 group-hover:border-white/20",
                        color
                    )}>
                        {icon}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 group-hover:text-zinc-400 transition-colors">{label}</span>
                </div>
                <div className="flex items-baseline gap-3">
                    <span className="font-bebas text-5xl text-white tracking-tight">{value}</span>
                    {sub && <span className="font-bebas text-xl text-zinc-600">{sub}</span>}
                </div>
            </div>
        </div>
    )
}

function PipelineStep({ label, detail, active, highlight }: { label: string; detail: string; active?: boolean; highlight?: boolean }) {
    return (
        <div className={cn(
            "relative px-6 py-4 rounded-2xl border transition-all duration-500 min-w-[150px]",
            highlight ? "bg-primary/5 border-primary/20" : 
            active ? "bg-white/5 border-white/10" : "bg-transparent border-white/5 opacity-50"
        )}>
            <p className={cn(
                "text-[9px] font-black uppercase tracking-widest",
                highlight ? "text-primary" : active ? "text-zinc-400" : "text-zinc-600"
            )}>{label}</p>
            <p className={cn(
                "font-bebas text-xl mt-1 tracking-wide",
                highlight ? "text-white" : active ? "text-zinc-200" : "text-zinc-500"
            )}>{detail}</p>
            
            {highlight && (
                <div className="absolute inset-0 bg-primary/10 blur-xl -z-10 rounded-2xl" />
            )}
        </div>
    )
}

function SystemLogLine({ line, showFilename = true }: { line: ParsedLogLine; showFilename?: boolean }) {
    const d = line.raw
    return (
        <div className={cn(
            "flex items-start gap-4 px-6 py-3 text-sm font-mono group transition-colors",
            line.level === "error" ? "bg-rose-500/5" : line.level === "warn" ? "bg-amber-500/5" : "hover:bg-white/[0.02]"
        )}>
            <div className="mt-1">
                <LevelBadge level={line.level} />
            </div>
            <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-4 gap-y-1">
                {d.context && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">
                        {d.context}
                    </span>
                )}
                {showFilename && d.filename && <span className="text-[10px] font-black uppercase tracking-widest text-blue-400/60">{d.filename}</span>}
                <span className={cn(
                    "break-all tracking-tight",
                    line.level === "error" ? "text-rose-300 font-bold" : 
                    line.level === "warn" ? "text-amber-300" : "text-zinc-400"
                )}>
                    {d.message}
                </span>
                
                <div className="flex gap-4 ml-auto opacity-40 group-hover:opacity-100 transition-opacity">
                    {d.ms !== undefined && <span className="text-[10px] font-bold text-primary">{d.ms}ms</span>}
                    {d.count !== undefined && <span className="text-[10px] text-zinc-500">n={d.count}</span>}
                </div>
            </div>
        </div>
    )
}



///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function ParsingPanel({ lines, searchQuery, setSearchQuery, onSelectFile }: {
    lines: ParsedLogLine[];
    searchQuery: string;
    setSearchQuery: (v: string) => void;
    onSelectFile: (f: string) => void
}) {
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

    const toggleExpanded = (id: number) => {
        setExpandedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const filtered = useMemo(() => {
        if (!searchQuery) return lines
        const q = searchQuery.toLowerCase()
        return lines.filter((l) => l.raw.filename?.toLowerCase().includes(q) || l.raw.path?.toLowerCase().includes(q))
    }, [lines, searchQuery])

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between sticky top-0 z-10 bg-background/50 backdrop-blur-md py-2 px-1 rounded-2xl">
                <div className="relative w-full max-w-md group">
                    <BiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary transition-colors" />
                    <TextInput
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar archivos procesados..."
                        className="pl-12 bg-white/[0.03] border-white/5 rounded-2xl h-12 focus:ring-primary/20 transition-all"
                    />
                </div>
                <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="font-bebas text-lg text-white">{filtered.length}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Archivos</span>
                </div>
            </div>

            <div className="glass-panel rounded-3xl overflow-hidden border-white/5 bg-black/20">
                <Virtuoso
                    style={{ height: "calc(100vh - 400px)" }}
                    totalCount={filtered.length}
                    itemContent={(index) => {
                        const line = filtered[index]
                        return (
                            <div className="border-b border-white/[0.02] last:border-none">
                                <ParsedFileLine
                                    line={line}
                                    onSelectFile={onSelectFile}
                                    isExpanded={expandedIds.has(line.idx)}
                                    toggleExpanded={() => toggleExpanded(line.idx)}
                                />
                            </div>
                        )
                    }}
                />
            </div>
        </div>
    )
}

function ParsedFileLine({ line, onSelectFile, isExpanded, toggleExpanded }: {
    line: ParsedLogLine;
    onSelectFile?: (f: string) => void;
    isExpanded?: boolean;
    toggleExpanded?: () => void
}) {
    const [internalExpanded, setInternalExpanded] = useState(false)
    const expanded = isExpanded !== undefined ? isExpanded : internalExpanded
    const handleToggle = () => {
        if (toggleExpanded) toggleExpanded()
        else setInternalExpanded(!internalExpanded)
    }

    const d = line.raw // raw log data
    const pd = d.parsedData || {}
    const hasEpisode = !!pd.episode
    const hasSeason = !!pd.season
    const title = pd.title || ""

    return (
        <div className="group transition-all duration-300">
            <button
                onClick={handleToggle}
                className={cn(
                    "flex items-center gap-4 w-full px-6 py-4 text-left transition-all duration-300",
                    expanded ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                )}
            >
                <div className={cn(
                    "transition-transform duration-500",
                    expanded ? "rotate-90 text-primary" : "text-zinc-600"
                )}>
                    <BiChevronRight className="text-xl" />
                </div>
                
                <BiFile className={cn(
                    "text-xl flex-shrink-0 transition-colors",
                    expanded ? "text-blue-400" : "text-zinc-500"
                )} />
                
                <span className="text-sm font-bold text-zinc-300 truncate flex-1 tracking-tight">
                    {d.filename}
                </span>

                <div className="flex gap-2 flex-shrink-0">
                    {title && (
                        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-tighter text-zinc-400">
                            {title}
                        </span>
                    )}
                    {hasSeason && <Badge size="sm" intent="blue">S{pd.season}</Badge>}
                    {hasEpisode && <Badge size="sm" intent="gray">E{pd.episode}</Badge>}
                </div>
            </button>

            {expanded && (
                <div className="px-16 pb-6 pt-2 space-y-6 animate-in fade-in slide-in-from-top-2 duration-500">
                    {onSelectFile && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                onSelectFile(d.filename)
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all group/btn"
                        >
                            <BiLinkAlt className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            <span className="font-bebas text-sm tracking-widest">VER TRAZA COMPLETA</span>
                        </button>
                    )}
                    
                    <div className="space-y-4">
                        <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 block mb-2">Ruta de Origen</span>
                            <span className="text-xs font-mono text-zinc-400 break-all leading-relaxed whitespace-pre-wrap">{d.path}</span>
                        </div>

                        {d.parsedData && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                    <div className="w-1 h-1 rounded-full bg-primary shadow-[0_0_8px_rgba(249,115,22,1)]" />
                                    Data Extraída
                                </div>
                                <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                                    <DataGrid data={d.parsedData} />
                                </div>
                            </div>
                        )}
                        
                        {d.parsedFolderData && d.parsedFolderData.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                    <div className="w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,1)]" />
                                    Jerarquía de Carpetas ({d.parsedFolderData.length})
                                </div>
                                <div className="space-y-2">
                                    {d.parsedFolderData.map((fd: any, i: number) => (
                                        <div key={i} className="pl-4 border-l-2 border-white/5">
                                            <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                                                <DataGrid data={fd} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


function MatcherPanel({
    fileGroups,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    onSelectFile,
}: {
    fileGroups: FileGroup[]
    searchQuery: string
    setSearchQuery: (v: string) => void
    statusFilter: "all" | "matched" | "unmatched" | "errors"
    setStatusFilter: (v: "all" | "matched" | "unmatched" | "errors") => void
    onSelectFile: (f: string) => void
}) {
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())

    const toggleExpanded = (filename: string) => {
        setExpandedFiles(prev => {
            const next = new Set(prev)
            if (next.has(filename)) next.delete(filename)
            else next.add(filename)
            return next
        })
    }

    const filtered = useMemo(() => {
        let groups = fileGroups.filter((g) => g.matcherLogs.length > 0)

        // status filter
        if (statusFilter === "matched") groups = groups.filter((g) => !!g.matchResult)
        if (statusFilter === "unmatched") groups = groups.filter((g) => g.isUnmatched || !g.matchResult)
        if (statusFilter === "errors") groups = groups.filter((g) => g.hasError || g.hasWarning)

        // search
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            groups = groups.filter(
                (g) =>
                    g.filename.toLowerCase().includes(q) ||
                    g.matchResult?.match?.toLowerCase().includes(q) ||
                    String(g.matchResult?.id || "").includes(q),
            )
        }

        return groups
    }, [fileGroups, searchQuery, statusFilter])

    const matchedCount = fileGroups.filter((g) => g.matcherLogs.length > 0 && g.matchResult).length
    const unmatchedCount = fileGroups.filter((g) => g.matcherLogs.length > 0 && (g.isUnmatched || !g.matchResult)).length

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            <div className="flex flex-col lg:flex-row gap-6 items-center justify-between sticky top-0 z-10 bg-background/50 backdrop-blur-md py-4 rounded-2xl">
                <div className="relative w-full max-w-md group">
                    <BiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary transition-colors" />
                    <TextInput
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar por nombre o ID de coincidencia..."
                        className="pl-12 bg-white/[0.03] border-white/5 rounded-2xl h-12 focus:ring-primary/20 transition-all"
                    />
                </div>
                
                <div className="flex flex-wrap gap-2 p-1.5 rounded-2xl bg-black/40 border border-white/5">
                    {([
                        { key: "all" as const, label: "Todos" },
                        { key: "matched" as const, label: `Match (${matchedCount})` },
                        { key: "unmatched" as const, label: `Sin Match (${unmatchedCount})` },
                        { key: "errors" as const, label: "Errores" },
                    ]).map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setStatusFilter(key)}
                            className={cn(
                                "px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-300",
                                statusFilter === key 
                                    ? "bg-primary text-white shadow-[0_4px_12px_rgba(249,115,22,0.3)]" 
                                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="glass-panel rounded-3xl overflow-hidden border-white/5 bg-black/20">
                <Virtuoso
                    style={{ height: "calc(100vh - 400px)" }}
                    totalCount={filtered.length}
                    itemContent={(index) => {
                        const group = filtered[index]
                        return (
                            <div className="border-b border-white/[0.02] last:border-none">
                                <MatcherFileGroup
                                    group={group}
                                    onSelectFile={onSelectFile}
                                    isExpanded={expandedFiles.has(group.filename)}
                                    toggleExpanded={() => toggleExpanded(group.filename)}
                                />
                            </div>
                        )
                    }}
                />
            </div>
        </div>
    )
}

function MatcherFileGroup({ group, onSelectFile, isExpanded, toggleExpanded }: {
    group: FileGroup;
    onSelectFile: (f: string) => void;
    isExpanded?: boolean;
    toggleExpanded?: () => void
}) {
    const [internalExpanded, setInternalExpanded] = useState(false)
    const expanded = isExpanded !== undefined ? isExpanded : internalExpanded
    const handleToggle = () => {
        if (toggleExpanded) toggleExpanded()
        else setInternalExpanded(!internalExpanded)
    }

    const mr = group.matchResult

    return (
        <div className={cn(
            "group transition-all duration-300 border-l-4",
            group.hasError ? "border-rose-500" : group.isUnmatched ? "border-amber-500" : "border-emerald-500/30"
        )}>
            <button
                onClick={handleToggle}
                className={cn(
                    "flex items-center gap-4 w-full px-6 py-4 text-left transition-all duration-300",
                    expanded ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                )}
            >
                <div className={cn(
                    "transition-transform duration-500",
                    expanded ? "rotate-90 text-primary" : "text-zinc-600"
                )}>
                    <BiChevronRight className="text-xl" />
                </div>

                {mr ? (
                    <div className="p-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <BiCheck className="text-emerald-400 text-lg flex-shrink-0" />
                    </div>
                ) : (
                    <div className="p-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                        <BiX className="text-amber-400 text-lg flex-shrink-0" />
                    </div>
                )}

                <span className="text-sm font-bold text-zinc-300 truncate flex-1 tracking-tight">
                    {group.filename}
                </span>

                <div className="flex gap-2 items-center flex-shrink-0">
                    {mr && (
                        <>
                            <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 overflow-hidden max-w-[200px]">
                                <BiLinkAlt className="text-indigo-400 text-xs" />
                                <span className="text-[10px] font-bold text-indigo-300 truncate">{mr.match}</span>
                            </div>
                            <Badge size="sm" intent={mr.score >= 15 ? "success" : mr.score >= 10 ? "warning" : "alert-subtle"}>
                                S: {mr.score}
                            </Badge>
                        </>
                    )}
                    {group.isUnmatched && <Badge size="sm" intent="warning">Unmatched</Badge>}
                    <span className="text-[10px] font-black uppercase text-zinc-600 ml-2 tracking-tighter">
                        {group.matcherLogs.length} TRACES
                    </span>
                </div>
            </button>

            {expanded && (
                <div className="px-16 pb-6 pt-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onSelectFile(group.filename)
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition-all font-bebas text-sm tracking-widest"
                    >
                        EXPLORAR FLUJO CRÍTICO
                    </button>
                    
                    <div className="rounded-2xl bg-black/40 border border-white/5 overflow-hidden">
                        <div className="p-4 space-y-1">
                            {group.matcherLogs.map((log) => (
                                <MatcherLogLine key={log.idx} line={log} />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function ParsingLogLine({ line }: { line: ParsedLogLine }) {
    const l = line.raw
    return (
        <div className="flex gap-3 text-xs font-mono group hover:bg-white/[0.02] py-0.5 px-2 rounded-lg transition-colors">
            <span className="text-zinc-700 w-10 text-right select-none">{line.idx}</span>
            <span className="text-blue-400 font-black uppercase tracking-tighter w-14">PARSER</span>
            <span className="text-zinc-400 flex-1 break-all line-clamp-1 group-hover:line-clamp-none transition-all">{l.message}</span>
        </div>
    )
}

function MatcherLogLine({ line }: { line: ParsedLogLine }) {
    const l = line.raw
    const isError = l.level === "error"
    const isWarn = l.level === "warn"

    return (
        <div className="flex gap-3 text-xs font-mono group hover:bg-white/[0.02] py-0.5 px-2 rounded-lg transition-colors">
            <span className="text-zinc-700 w-10 text-right select-none">{line.idx}</span>
            <span className={cn(
                "font-black uppercase tracking-tighter w-14",
                isError ? "text-rose-400" : isWarn ? "text-amber-400" : "text-emerald-400"
            )}>MATCHER</span>
            <span className={cn(
                "flex-1 break-all line-clamp-1 group-hover:line-clamp-none transition-all",
                isError ? "text-rose-300/70" : isWarn ? "text-amber-300/70" : "text-zinc-400"
            )}>{l.message}</span>
        </div>
    )
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


function HydratorPanel({
    fileGroups,
    searchQuery,
    setSearchQuery,
    levelFilter,
    setLevelFilter,
    onSelectFile,
}: {
    fileGroups: FileGroup[]
    searchQuery: string
    setSearchQuery: (v: string) => void
    levelFilter: LogLevel | "all"
    setLevelFilter: (v: LogLevel | "all") => void
    onSelectFile: (f: string) => void
}) {
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())

    const toggleExpanded = (filename: string) => {
        setExpandedFiles(prev => {
            const next = new Set(prev)
            if (next.has(filename)) next.delete(filename)
            else next.add(filename)
            return next
        })
    }

    const filtered = useMemo(() => {
        let groups = fileGroups.filter((g) => g.hydratorLogs.length > 0)

        if (levelFilter !== "all") {
            groups = groups.filter((g) => g.hydratorLogs.some((l) => l.level === levelFilter))
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            groups = groups.filter(
                (g) =>
                    g.filename.toLowerCase().includes(q) ||
                    String(g.hydratorLogs[0]?.raw?.mediaId || "").includes(q),
            )
        }

        return groups
    }, [fileGroups, searchQuery, levelFilter])

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            <div className="flex flex-col lg:flex-row gap-6 items-center justify-between sticky top-0 z-10 bg-background/50 backdrop-blur-md py-4 rounded-2xl">
                <div className="relative w-full max-w-md group">
                    <BiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary transition-colors" />
                    <TextInput
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar por nombre o ID de media..."
                        className="pl-12 bg-white/[0.03] border-white/5 rounded-2xl h-12 focus:ring-primary/20 transition-all font-bold tracking-tight"
                    />
                </div>
                
                <div className="flex flex-wrap gap-2 p-1.5 rounded-2xl bg-black/40 border border-white/5">
                    {(["all", "error", "warn", "debug"] as const).map((lvl) => (
                        <button
                            key={lvl}
                            onClick={() => setLevelFilter(lvl)}
                            className={cn(
                                "px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-300",
                                levelFilter === lvl 
                                    ? "bg-cyan-500 text-white shadow-[0_4px_12px_rgba(6,182,212,0.3)]" 
                                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                            )}
                        >
                            {lvl === "all" ? "Todos" : lvl}
                        </button>
                    ))}
                </div>
            </div>

            <div className="glass-panel rounded-3xl overflow-hidden border-white/5 bg-black/20">
                <Virtuoso
                    style={{ height: "calc(100vh - 400px)" }}
                    totalCount={filtered.length}
                    itemContent={(index) => {
                        const group = filtered[index]
                        return (
                            <div className="border-b border-white/[0.02] last:border-none">
                                <HydratorFileGroup
                                    group={group}
                                    onSelectFile={onSelectFile}
                                    isExpanded={expandedFiles.has(group.filename)}
                                    toggleExpanded={() => toggleExpanded(group.filename)}
                                />
                            </div>
                        )
                    }}
                />
            </div>
        </div>
    )
}

function HydratorFileGroup({ group, onSelectFile, isExpanded, toggleExpanded }: {
    group: FileGroup;
    onSelectFile: (f: string) => void;
    isExpanded?: boolean;
    toggleExpanded?: () => void
}) {
    const [internalExpanded, setInternalExpanded] = useState(false)
    const expanded = isExpanded !== undefined ? isExpanded : internalExpanded
    const handleToggle = () => {
        if (toggleExpanded) toggleExpanded()
        else setInternalExpanded(!internalExpanded)
    }

    const hr = group.hydrationResult
    const lastLog = group.hydratorLogs[group.hydratorLogs.length - 1]
    const mediaId = lastLog?.raw?.mediaId

    return (
        <div className={cn(
            "group transition-all duration-300 border-l-4",
            group.hasError ? "border-rose-500" : group.hasWarning ? "border-amber-500" : "border-cyan-500/30"
        )}>
            <button
                onClick={handleToggle}
                className={cn(
                    "flex items-center gap-4 w-full px-6 py-4 text-left transition-all duration-300",
                    expanded ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                )}
            >
                <div className={cn(
                    "transition-transform duration-500",
                    expanded ? "rotate-90 text-primary" : "text-zinc-600"
                )}>
                    <BiChevronRight className="text-xl" />
                </div>
                
                <div className="p-1 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                    <RiFileSettingsFill className="text-cyan-400 text-lg flex-shrink-0" />
                </div>

                <span className="text-sm font-bold text-zinc-300 truncate flex-1 tracking-tight">
                    {group.filename}
                </span>

                <div className="flex gap-2 items-center flex-shrink-0">
                    {mediaId && <Badge size="sm" intent="primary">ID: {mediaId}</Badge>}
                    {hr && (
                        <>
                            <Badge size="sm" intent={hr.type === "main" ? "success" : "info"}>
                                {hr.type || "unknown"}
                            </Badge>
                            <span className="font-bebas text-lg text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">
                                {`EP${hr.episode}`}
                            </span>
                        </>
                    )}
                </div>
            </button>

            {expanded && (
                <div className="px-16 pb-6 pt-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onSelectFile(group.filename)
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-all font-bebas text-sm tracking-widest"
                    >
                        INSPECCIONAR SECUENCIA
                    </button>
                    
                    <div className="rounded-2xl bg-black/40 border border-white/5 overflow-hidden">
                        <div className="p-4 space-y-1">
                            {group.hydratorLogs.map((log) => (
                                <HydratorLogLine key={log.idx} line={log} />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function HydratorLogLine({ line }: { line: ParsedLogLine }) {
    const l = line.raw
    const isError = l.level === "error"

    return (
        <div className="flex gap-3 text-xs font-mono group hover:bg-white/[0.02] py-0.5 px-2 rounded-lg transition-colors">
            <span className="text-zinc-700 w-10 text-right select-none">{line.idx}</span>
            <span className={cn(
                "font-black uppercase tracking-tighter w-14",
                isError ? "text-rose-400" : "text-cyan-400"
            )}>HYDRATOR</span>
            <span className={cn(
                "flex-1 break-all line-clamp-1 group-hover:line-clamp-none transition-all",
                isError ? "text-rose-300/70" : "text-zinc-400"
            )}>{l.message}</span>
        </div>
    )
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


function IssuesPanel({ lines, searchQuery, setSearchQuery }: { lines: ParsedLogLine[]; searchQuery: string; setSearchQuery: (v: string) => void }) {
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

    const toggleExpanded = (id: number) => {
        setExpandedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const filtered = useMemo(() => {
        if (!searchQuery) return lines
        const q = searchQuery.toLowerCase()
        return lines.filter((l) =>
            l.raw.filename?.toLowerCase().includes(q) ||
            l.raw.message?.toLowerCase().includes(q) ||
            JSON.stringify(l.raw).toLowerCase().includes(q),
        )
    }, [lines, searchQuery])

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            <div className="flex items-center justify-between sticky top-0 z-10 bg-background/50 backdrop-blur-md py-2">
                <div className="relative w-full max-w-md group">
                    <BiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary transition-colors" />
                    <TextInput
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filtrar por mensaje de error..."
                        className="pl-12 bg-white/[0.03] border-white/5 rounded-2xl h-12"
                    />
                </div>
                <div className={cn(
                    "px-4 py-2 rounded-xl border font-bebas text-lg",
                    filtered.length > 0 ? "bg-rose-500/10 border-rose-500/20 text-rose-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                )}>
                    {filtered.length} INCIDENCIAS
                </div>
            </div>

            {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-50">
                    <div className="p-6 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <BiCheck className="w-12 h-12 text-emerald-400" />
                    </div>
                    <p className="font-bebas text-2xl tracking-widest text-emerald-400/60 uppercase">Estado Nominal</p>
                    <p className="text-xs font-bold text-zinc-600 uppercase tracking-tighter italic">No se han detectado anomalías de nivel crítico o advertencia.</p>
                </div>
            )}

            <div className="glass-panel rounded-3xl overflow-hidden border-white/5 bg-black/20">
                <Virtuoso
                    style={{ height: "calc(100vh - 400px)" }}
                    totalCount={filtered.length}
                    itemContent={(index) => {
                        const line = filtered[index]
                        return (
                            <div className="border-b border-white/[0.02] last:border-none">
                                <IssueLine
                                    line={line}
                                    isExpanded={expandedIds.has(line.idx)}
                                    toggleExpanded={() => toggleExpanded(line.idx)}
                                />
                            </div>
                        )
                    }}
                />
            </div>
        </div>
    )
}

function IssueLine({ line, isExpanded, toggleExpanded }: { line: ParsedLogLine; isExpanded: boolean; toggleExpanded: () => void }) {
    const l = line.raw
    const isError = l.level === "error"

    return (
        <div className={cn(
            "group transition-all duration-300 border-l-4",
            isError ? "border-rose-500" : "border-amber-500"
        )}>
            <button
                onClick={toggleExpanded}
                className={cn(
                    "flex items-center gap-4 w-full px-6 py-4 text-left transition-all duration-300",
                    isExpanded ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                )}
            >
                <div className={cn(
                    "transition-transform duration-500",
                    isExpanded ? "rotate-90 text-primary" : "text-zinc-600"
                )}>
                    <BiChevronRight className="text-xl" />
                </div>

                <div className={cn(
                    "p-1.5 rounded-lg border",
                    isError ? "bg-rose-500/10 border-rose-500/20 text-rose-400" : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                )}>
                    {isError ? <BiX className="text-lg" /> : <BiError className="text-lg" />}
                </div>

                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-zinc-200 truncate group-hover:text-white transition-colors">
                        {l.message}
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-tighter text-zinc-500 mt-0.5 max-w-lg truncate">
                        {l.filename || "System Event"}
                    </p>
                </div>

                <div className="flex gap-2 items-center flex-shrink-0">
                    <span className="text-[10px] font-mono text-zinc-600">#{line.idx}</span>
                    <LevelBadge level={l.level} />
                </div>
            </button>

            {isExpanded && (
                <div className="px-16 pb-6 pt-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
                    <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 block mb-2">Metadata Completa</span>
                        <DataGrid data={l} />
                    </div>
                </div>
            )}
        </div>
    )
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


function FileFlowPanel({ group }: { group: FileGroup }) {
    const allLogs = useMemo(() => {
        const logs = [...group.matcherLogs, ...group.hydratorLogs]
        if (group.parsingLog) logs.unshift(group.parsingLog)
        return logs.sort((a, b) => a.idx - b.idx)
    }, [group])

    return (
        <div className="space-y-6">
            {allLogs.map((log, i) => (
                <div key={log.idx} className="relative pl-8 group">
                    {/* Vertical Line */}
                    {i < allLogs.length - 1 && (
                        <div className="absolute left-[15px] top-6 bottom-[-20px] w-px bg-gradient-to-b from-primary/30 to-transparent" />
                    )}
                    
                    {/* Circle Indicator */}
                    <div className="absolute left-0 top-1.5 w-[31px] h-[31px] rounded-full bg-black border border-white/10 flex items-center justify-center z-10 group-hover:border-primary transition-colors">
                        <div className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            log.context === "Matcher" ? "bg-indigo-500" : 
                            log.context === "FileHydrator" ? "bg-cyan-500" : "bg-blue-500",
                            "shadow-[0_0_8px_rgba(255,255,255,0.3)]"
                        )} />
                    </div>
                    
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-all">
                        <div className="flex items-center gap-3 mb-2">
                            <span className={cn(
                                "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border",
                                log.context === "Matcher" ? "text-indigo-400 border-indigo-500/20 bg-indigo-500/5" :
                                log.context === "FileHydrator" ? "text-cyan-400 border-cyan-500/20 bg-cyan-500/5" :
                                "text-blue-400 border-blue-500/20 bg-blue-500/5"
                            )}>
                                {log.context || "Parser"}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-600 ml-auto">Line #{log.idx}</span>
                        </div>
                        
                        {log.context === "Matcher" ? (
                            <MatcherLogLine line={log} />
                        ) : log.context === "FileHydrator" ? (
                            <HydratorLogLine line={log} />
                        ) : (
                            <ParsingLogLine line={log} />
                        )}
                        
                        <div className="mt-3">
                            <DataGrid data={log.raw} />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


function LevelBadge({ level }: { level: LogLevel }) {
    return (
        <span className={cn(
            "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border",
            level === "error" ? "bg-rose-500/10 border-rose-500/20 text-rose-400" :
            level === "warn" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
            level === "info" ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
            "bg-zinc-500/10 border-white/10 text-zinc-500"
        )}>
            {level}
        </span>
    )
}

function DataGrid({ data }: { data: Record<string, any> }) {
    return (
        <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 bg-black/20 p-3 rounded-xl border border-white/[0.02]">
            {Object.entries(data).map(([key, value]) => {
                if (key === "level" || key === "context" || key === "filename" || key === "message" || key === "time") return null
                const isObj = typeof value === "object" && value !== null
                return (
                    <React.Fragment key={key}>
                        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600 select-all">{key}</span>
                        <span className={cn(
                            "text-[11px] font-mono break-all select-all",
                            isObj ? "text-zinc-500" : "text-zinc-300"
                        )}>
                            {isObj ? JSON.stringify(value) : String(value)}
                        </span>
                    </React.Fragment>
                )
            })}
        </div>
    )
}
