import * as React from "react"
import { Settings2 } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { ManualMatchModal } from "./manual-match-modal"

interface FloatingMatchFlapProps {
    directoryPath?: string
    mediaId?: number
}

export function FloatingMatchFlap({ directoryPath, mediaId }: FloatingMatchFlapProps) {
    const [isMatchModalOpen, setIsMatchModalOpen] = React.useState(false)

    if (!directoryPath || !mediaId) return null

    return (
        <>
            <button
                onClick={(e) => {
                    e.stopPropagation()
                    setIsMatchModalOpen(true)
                }}
                className={cn(
                    "fixed left-0 md:left-[80px] top-[40%] z-[49] flex items-center justify-center p-3.5 rounded-r-2xl bg-zinc-950/90 backdrop-blur-2xl border-y border-r border-white/10 text-white/60 hover:text-brand-orange transition-all duration-300 shadow-[4px_0_16px_rgba(0,0,0,0.4)] hover:pl-5 hover:scale-105 active:scale-95 group cursor-pointer"
                )}
                title="Corregir Vinculación"
            >
                <Settings2 className="w-5 h-5 transition-transform duration-700 group-hover:rotate-90" />
            </button>

            <ManualMatchModal
                isOpen={isMatchModalOpen}
                onClose={() => setIsMatchModalOpen(false)}
                directoryPath={directoryPath}
                currentMediaId={mediaId}
            />
        </>
    )
}
