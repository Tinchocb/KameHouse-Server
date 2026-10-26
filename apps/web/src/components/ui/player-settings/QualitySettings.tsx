import { cn } from "@/components/ui/core/styling"
import { IconUiCheck } from "@/components/ui/icons";
import type { EpisodeSource } from "@/api/types/unified.types"

interface QualitySettingsProps {
    sources: EpisodeSource[]
    currentSourceUrl?: string
    currentSourceType?: string
    onSourceChange: (source: EpisodeSource) => void
}

export function QualitySettings({
    sources,
    currentSourceUrl,
    currentSourceType,
    onSourceChange,
}: QualitySettingsProps) {
    // Activa = la que coincide por URL. Solo si ninguna coincide (p. ej. la URL
    // reproducida es la de transcode, no la de la fuente) se cae al tipo, y aun así
    // se marca una sola: antes todas las fuentes del mismo tipo salían tildadas.
    const urlMatch = currentSourceUrl ? sources.findIndex(s => s.url === currentSourceUrl) : -1
    const activeIdx = urlMatch !== -1
        ? urlMatch
        : (currentSourceType ? sources.findIndex(s => s.type === currentSourceType) : -1)

    return (
        <div className="flex flex-col">
            {sources.map((source, idx) => {
                const isActive = idx === activeIdx
                const sourceSubtext = source.type === 'direct'
                    ? "Original, sin conversión"
                    : source.type === 'transcode'
                        ? "Convertido, con calidad adaptativa"
                        : (source.type === 'local' ? "Archivo local" : "Proveedor")

                return (
                    <button
                        key={idx}
                        onClick={() => onSourceChange(source)}
                        className={cn(
                            "w-full flex items-center justify-between min-h-[44px] py-2 px-3 rounded-full transition-[background-color,color,transform] duration-fast ease-out-strong active:scale-95 cursor-pointer group text-left relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
                            isActive ? "bg-[var(--neutral-elev-3)] text-label-1" : "text-label-2 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-label-1"
                        )}
                    >
                        {/* Hover/Active left-edge accent indicator */}
                        <span className={cn(
                            "hidden",
                            isActive ? "h-1/2 bg-brand-accent shadow-brand-focus" : "h-0 bg-outline-variant [@media(hover:hover)_and_(pointer:fine)]:group-hover:h-1/3"
                        )} />

                        <div className="flex flex-col [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-1.5 transition-transform duration-base ease-out">
                            <span className={cn(
                                "text-xs font-bold leading-none transition-colors duration-base",
                                isActive ? "text-brand-accent-readable" : "text-on-surface [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-on-surface"
                            )}>
                                {source.title || source.quality || "Original"}
                            </span>
                            <span className={cn(
                                "text-label-sm font-bold mt-1.5 transition-colors duration-base",
                                isActive ? "text-label-2" : "text-label-2 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-on-surface"
                            )}>
                                {sourceSubtext}
                            </span>
                        </div>
                        {isActive && <IconUiCheck className="w-3.5 h-3.5 text-brand-accent" />}
                    </button>
                )
            })}
        </div>
    )
}
