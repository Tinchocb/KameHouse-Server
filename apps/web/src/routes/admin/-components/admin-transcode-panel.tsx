import { cn } from "@/components/ui/core/styling"
import { IconButton } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton/skeleton"
import { IconUiDelete } from "@/components/ui/icons"
import type { useGetTranscodeStats } from "@/api/hooks/admin.hooks"
import { useGetPreTranscodeJobs, useCancelPreTranscode } from "@/api/hooks/pretranscode.hooks"

function StatBar({ label, value, max, display, color }: { label: string; value: number; max: number; display: string; color?: string }) {
    const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-label-sm font-bold text-on-surface-variant">
                <span>{label}</span>
                <span className="font-mono normal-case tracking-normal" style={{ fontVariantNumeric: "tabular-nums" }}>{display}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--neutral-elev-3)] overflow-hidden border border-[var(--neutral-separator)]">
                <div
                    className="w-full h-full rounded-full origin-left transition-transform duration-slow ease-smooth-out"
                    style={{ transform: `scaleX(${percent / 100})`, background: color || "hsl(var(--brand-accent))" }}
                />
            </div>
        </div>
    )
}

function formatGb(bytes: number | undefined): string {
    return ((bytes || 0) / 1024 / 1024 / 1024).toFixed(1)
}

export function AdminRowSkeletons({ count }: { count: number }) {
    return (
        <>
            {Array.from({ length: count }, (_, i) => (
                <Skeleton key={i} className="h-[58px] rounded-xl" />
            ))}
        </>
    )
}

function PreTranscodeJobsList() {
    const { data: jobs, isLoading } = useGetPreTranscodeJobs()
    const { mutate: cancelJob, isPending: isCancelling } = useCancelPreTranscode()

    if (isLoading) {
        return (
            <div className="rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] p-5 mt-3.5 space-y-2.5" role="status" aria-label="Cargando las conversiones pendientes">
                <Skeleton className="h-3 w-40 rounded-full" />
                <AdminRowSkeletons count={2} />
            </div>
        )
    }
    if (!jobs || jobs.length === 0) return null

    return (
        <div className="rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] p-5 mt-3.5">
            <h3 className="text-xs font-bold text-on-surface mb-3">
                Conversiones pendientes ({jobs.length})
            </h3>
            <div className="space-y-2.5">
                {jobs.map((job) => (
                    <div key={job.hash} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)]">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-on-surface truncate" title={job.filePath}>{job.filePath}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                                <div className="flex-1 h-1.5 rounded-full bg-[var(--neutral-elev-3)] overflow-hidden">
                                    <div
                                        className="w-full h-full rounded-full bg-brand-accent origin-left transition-transform duration-slow ease-smooth-out"
                                        style={{ transform: `scaleX(${Math.min(100, Math.max(0, job.progress)) / 100})` }}
                                    />
                                </div>
                                <span className="text-3xs font-mono text-label-2 shrink-0">
                                    {job.status} · {Math.round(job.progress)}%
                                </span>
                            </div>
                            {job.error && (
                                <p className="text-3xs text-status-error mt-1 truncate">{job.error}</p>
                            )}
                        </div>
                        <IconButton
                            intent="ghost"
                            size="sm"
                            onClick={() => cancelJob(job.hash)}
                            disabled={isCancelling}
                            title="Cancelar conversión previa"
                            aria-label="Cancelar conversión previa"
                            className="shrink-0 [@media(hover:hover)_and_(pointer:fine)]:hover:text-status-error"
                            icon={<IconUiDelete size={14} />}
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}

export function AdminTranscodePanel({ trStats }: { trStats?: ReturnType<typeof useGetTranscodeStats>["data"] }) {
    const stats = trStats

    const governor = stats?.governor
    const system = stats?.system
    const gpu = stats?.gpu

    return (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {/* Motor de transcodificación */}
            <div className="rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] p-5 flex flex-col gap-4.5 [@media(hover:hover)_and_(pointer:fine)]:hover:border-[var(--neutral-separator)] transition-[background-color,border-color] duration-base ease-smooth-out">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-on-surface">Motor de reproducción</h3>
                    <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-bold border",
                        stats?.transcoderInitialized
                            ? "bg-status-success/15 border-status-success/30 text-status-success"
                            : "bg-[var(--neutral-elev-3)] border-[var(--neutral-separator)] text-on-surface-variant"
                    )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", stats?.transcoderInitialized ? "bg-status-success" : "bg-on-surface-variant/50")} />
                        {stats?.transcoderInitialized ? "Activo" : "En reposo"}
                    </span>
                </div>
                {governor ? (
                    <>
                        <StatBar
                            label="Procesos de FFmpeg"
                            value={governor.activeProcesses}
                            max={governor.maxConcurrency}
                            display={`${governor.activeProcesses} / ${governor.maxConcurrency}`}
                        />
                        <StatBar
                            label="Sesiones NVENC"
                            value={governor.activeNvenc}
                            max={governor.nvencCap}
                            display={`${governor.activeNvenc} / ${governor.nvencCap}`}
                            color="var(--status-success)"
                        />
                        <div className="flex items-center justify-between text-2xs text-label-2 mt-auto pt-3.5 border-t border-[var(--neutral-separator)]">
                            <span>Iniciados: <span className="font-mono text-on-surface ml-1">{governor.totalLaunched}</span></span>
                            <span>Completados: <span className="font-mono text-on-surface ml-1">{governor.totalCompleted}</span></span>
                        </div>
                    </>
                ) : (
                    <p className="text-2xs text-label-2 my-auto">
                        El motor está en reposo. Se activa al reproducir un video que necesite conversión.
                    </p>
                )}
                <div className="flex items-center justify-between text-2xs text-label-2">
                    <span>Conversiones pendientes</span>
                    <span className="font-mono text-on-surface font-semibold">{stats?.preTranscodeQueue ?? 0}</span>
                </div>
            </div>

            {/* Sistema */}
            <div className="rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] p-5 flex flex-col gap-4.5 [@media(hover:hover)_and_(pointer:fine)]:hover:border-[var(--neutral-separator)] transition-[background-color,border-color] duration-base ease-smooth-out">
                <h3 className="text-xs font-bold text-on-surface">Sistema</h3>
                <StatBar
                    label="CPU"
                    value={system?.cpuPercent || 0}
                    max={100}
                    display={`${(system?.cpuPercent || 0).toFixed(1)}%`}
                />
                <StatBar
                    label="Memoria (RAM)"
                    value={system?.memoryUsed || 0}
                    max={system?.memoryTotal || 1}
                    display={`${formatGb(system?.memoryUsed)} / ${formatGb(system?.memoryTotal)} GB`}
                    color="hsl(var(--brand-accent))"
                />
            </div>

            {/* GPU (solo si nvidia-smi respondió) */}
            <div className="rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] p-5 flex flex-col gap-4.5 [@media(hover:hover)_and_(pointer:fine)]:hover:border-[var(--neutral-separator)] transition-[background-color,border-color] duration-base ease-smooth-out">
                <h3 className="text-xs font-bold text-on-surface">GPU · NVIDIA</h3>
                {gpu ? (
                    <>
                        <StatBar label="Uso de GPU" value={gpu.utilization} max={100} display={`${gpu.utilization}%`} />
                        <StatBar label="Codificador NVENC" value={gpu.encoder} max={100} display={`${gpu.encoder}%`} color="var(--status-success)" />
                        <StatBar
                            label="VRAM"
                            value={gpu.memoryUsed}
                            max={gpu.memoryTotal || 1}
                            display={`${gpu.memoryUsed} / ${gpu.memoryTotal} MB`}
                            color="var(--brand-accent-hex)"
                        />
                    </>
                ) : (
                    <p className="text-2xs text-label-2 my-auto">
                        No se detectó una GPU NVIDIA en el servidor.
                    </p>
                )}
            </div>
        </div>
        <PreTranscodeJobsList />
        </>
    )
}
