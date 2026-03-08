import * as React from "react"
import { cn } from "@/components/ui/core/styling"

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
    progress: number // 0 to 100
    color?: string
}

export function ProgressBar({ progress, color = "bg-gradient-to-r from-orange-600 to-orange-400", className, ...props }: ProgressBarProps) {
    const clampedProgress = Math.min(Math.max(progress, 0), 100)

    return (
        <div
            className={cn("w-full h-1.5 bg-white/10 rounded-full overflow-hidden relative", className)}
            {...props}
        >
            <div
                className={cn(
                    "h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(255,122,0,0.8)]",
                    color
                )}
                style={{ width: `${clampedProgress}%` }}
            />
        </div>
    )
}
