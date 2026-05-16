import React from "react"
import { cn } from "@/components/ui/core/styling"

export interface InsightNode {
    timestamp: number
    intensity: number
}

interface TimelineHeatmapProps {
    duration: number
    insights: InsightNode[]
    className?: string
}

export const TimelineHeatmap = React.memo(({ duration, insights, className }: TimelineHeatmapProps) => {
    if (!insights || insights.length === 0 || duration <= 0) return null

    return (
        <div className={cn("absolute bottom-full left-0 w-full flex items-end pointer-events-none opacity-10 group-hover:opacity-50 transition-all duration-500 mb-1 z-0", className)} style={{ height: "12px" }}>
            {insights.map((node, i) => {
                const height = Math.max(15, Math.floor(node.intensity * 100))
                const isPeak = node.intensity > 0.7
                return (
                    <div
                        key={i}
                        className={cn(
                            "flex-1 mx-[0.5px] rounded-t-[1px] transition-all duration-300",
                            isPeak ? "bg-brand-orange/80 shadow-[0_0_8px_rgba(255,110,58,0.5)] z-10 relative" : "bg-white/10"
                        )}
                        style={{ height: `${height}%` }}
                    />
                )
            })}
        </div>
    )
})
TimelineHeatmap.displayName = "TimelineHeatmap"
