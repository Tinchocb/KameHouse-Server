import { memo } from "react"
import { cn } from "@/components/ui/core/styling"

export const GenrePill = memo(function GenrePill({
    label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            className={cn(
                "px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest transition-all duration-300 border",
                active
                    ? "bg-primary text-white border-primary shadow-[0_0_20px_rgba(249,115,22,0.3)] scale-105"
                    : "bg-white/[0.03] text-zinc-500 border-white/5 hover:border-primary/40 hover:text-primary"
            )}
            onClick={onClick}
        >
            {label}
        </button>
    )
})
