import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { Check } from "lucide-react"
import type { EpisodeSource } from "@/api/types/unified.types"

interface QualitySettingsProps {
    sources: EpisodeSource[]
    currentSourceUrl?: string
    onSourceChange: (source: EpisodeSource) => void
}

export function QualitySettings({
    sources,
    currentSourceUrl,
    onSourceChange,
}: QualitySettingsProps) {
    return (
        <div className="flex flex-col">
            {sources.map((source, idx) => {
                const isActive = source.url === currentSourceUrl
                return (
                    <button
                        key={idx}
                        onClick={() => onSourceChange(source)}
                        className={cn(
                            "flex items-center justify-between px-4 py-3 transition-all",
                            isActive ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"
                        )}
                    >
                        <div className="flex flex-col">
                            <span className="text-xs font-bold leading-none">
                                {source.quality || "Original"}
                            </span>
                            <span className={cn(
                                "text-[9px] font-bold mt-1.5 uppercase opacity-60",
                                isActive ? "text-white" : "text-zinc-500"
                            )}>
                                {source.type === 'local' ? "Local" : "Provider"}
                            </span>
                        </div>
                        {isActive && <Check className="w-3.5 h-3.5" />}
                    </button>
                )
            })}
        </div>
    )
}
