import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useDeleteLogs, useGetLogContent, useGetLogFilenames } from "@/api/hooks/diagnostics.hooks"
import { __isTauriDesktop__ } from "@/types/constants"

/** Líneas que se muestran: las últimas del archivo, para que el panel siga siendo rápido. */
const MAX_VISIBLE_LINES = 300

type LineTone = "error" | "warn" | "muted" | "default"

/** Formato del servidor (`|ERR|`, `|WRN|`…) y de la app de escritorio (`[ERROR]`, `[WARN]`…). */
function toneOf(line: string): LineTone {
    if (/\|ERR\||\[ERROR\]/.test(line)) return "error"
    if (/\|WRN\||\[WARN\]/.test(line)) return "warn"
    if (/\|DBG\||\|TRC\||\[DEBUG\]|\[TRACE\]/.test(line)) return "muted"
    return "default"
}

const TONE_CLASS: Record<LineTone, string> = {
    error: "text-status-error",
    warn: "text-status-warning",
    muted: "text-on-surface-variant/60",
    default: "text-on-surface-variant",
}

/**
 * Registros de la app (servidor Go y, en escritorio, la propia app Tauri). Sustituye al
 * registro que antes solo salía por consola: en la app instalada no hay consola visible.
 */
export function ServerLogsViewer() {
    const { data: filenames, isLoading: isLoadingFiles } = useGetLogFilenames()
    const [selected, setSelected] = useState<string | null>(null)
    const { data: content, isLoading: isLoadingContent, isFetching, refetch } = useGetLogContent(selected)
    const { mutate: deleteLogs, isPending: isDeleting } = useDeleteLogs()
    const [onlyProblems, setOnlyProblems] = useState(false)
    const boxRef = useRef<HTMLDivElement>(null)

    const files = filenames ?? []

    const visibleLines = useMemo(() => {
        const lines = (content ?? "").split("\n").filter((line) => line.trim() !== "")
        const filtered = onlyProblems
            ? lines.filter((line) => {
                  const tone = toneOf(line)
                  return tone === "error" || tone === "warn"
              })
            : lines
        return filtered.slice(-MAX_VISIBLE_LINES)
    }, [content, onlyProblems])

    // Lo último queda a la vista: al cargar o actualizar, el panel baja al final.
    useEffect(() => {
        const box = boxRef.current
        if (box) box.scrollTop = box.scrollHeight
    }, [visibleLines])

    return (
        <div className="space-y-3.5">
            <div className="flex flex-col sm:flex-row gap-2.5">
                <select
                    value={selected ?? ""}
                    onChange={(e) => setSelected(e.target.value || null)}
                    aria-label="Archivo de registro"
                    disabled={isLoadingFiles || files.length === 0}
                    className="flex-1 px-4 py-2 rounded-full bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-control-shadow)] text-base md:text-sm font-mono text-on-surface min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)] transition-[background-color,border-color,box-shadow] duration-fast ease-smooth-out disabled:opacity-50 cursor-pointer"
                >
                    <option value="" className="bg-[var(--neutral-elev-2)] text-on-surface">Registro activo</option>
                    {files.map((f) => (
                        <option key={f} value={f} className="bg-[var(--neutral-elev-2)] text-on-surface">{f}</option>
                    ))}
                </select>
                <div className="flex flex-wrap gap-2.5">
                    <Button
                        intent="outline"
                        onClick={() => {
                            refetch().catch(() => {})
                        }}
                        disabled={isFetching}
                    >
                        {isFetching ? "Actualizando…" : "Actualizar"}
                    </Button>
                    <Button
                        intent="outline"
                        onClick={() => setOnlyProblems((v) => !v)}
                        aria-pressed={onlyProblems}
                    >
                        {onlyProblems ? "Mostrar todo" : "Solo avisos y errores"}
                    </Button>
                    {__isTauriDesktop__ && (
                        <Button
                            intent="outline"
                            onClick={() => {
                                window.desktop?.logs.openFolder().catch(() => toast.error("No se pudo abrir la carpeta de registros"))
                            }}
                        >
                            Abrir carpeta
                        </Button>
                    )}
                    <Button
                        intent="outline"
                        className="text-status-error border-status-error/30 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-status-error/10"
                        onClick={() => {
                            if (!selected) {
                                toast.error("Elige un archivo para eliminar. El registro activo está protegido.")
                                return
                            }
                            deleteLogs({ filenames: [selected] }, {
                                onSuccess: () => setSelected(null),
                            })
                        }}
                        disabled={isDeleting || !selected}
                    >
                        {isDeleting ? "Eliminando…" : "Eliminar"}
                    </Button>
                </div>
            </div>
            <div
                ref={boxRef}
                className="max-h-[400px] overflow-auto p-4 rounded-xl bg-[var(--neutral-elev-0)] border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-inset-shadow)] text-xs font-mono whitespace-pre-wrap break-all select-text leading-relaxed no-scrollbar"
                aria-live="polite"
            >
                {isLoadingContent ? (
                    <span className="text-on-surface-variant">Cargando…</span>
                ) : visibleLines.length === 0 ? (
                    <span className="text-on-surface-variant">
                        {onlyProblems ? "No hay avisos ni errores en este archivo." : "Sin contenido."}
                    </span>
                ) : (
                    visibleLines.map((line, i) => {
                        const tone = toneOf(line)
                        return (
                            <div key={i} className={TONE_CLASS[tone]}>
                                {line}
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
