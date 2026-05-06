import { memo } from "react"
import { cn } from "@/components/ui/core/styling"

export const GenrePill = memo(function GenrePill({
    label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            className={cn(
                "px-4 py-1.5 rounded-none text-[10px] font-black tracking-widest transition-all duration-200 border uppercase",
                active
                    ? "bg-white text-black border-white"
                    : "bg-black text-zinc-500 border-zinc-800 hover:border-white hover:text-white"
            )}
            onClick={onClick}
        >
            {label}
        </button>
    )
})
