import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import type { Saga } from "./episode-list"

export interface SagaTabsProps {
    sagas: Saga[]
    activeSagaId: string | number
    onSelect: (id: string | number) => void
}

export function SagaTabs({ sagas, activeSagaId, onSelect }: SagaTabsProps) {
    const scrollRef = React.useRef<HTMLDivElement>(null)

    return (
        <div
            ref={scrollRef}
            role="tablist"
            aria-label="Seleccionar Saga"
            className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-1"
        >
            {sagas.map((saga) => {
                const isActive = saga.id === activeSagaId
                return (
                    <button
                        key={saga.id}
                        role="tab"
                        type="button"
                        aria-selected={isActive}
                        onClick={() => onSelect(saga.id)}
                        className={cn(
                            "relative shrink-0 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap",
                            "transition-all duration-200 ease-out",
                            isActive
                                ? "text-white bg-zinc-800"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
                        )}
                    >
                        {isActive && (
                            <span
                                aria-hidden
                                className="absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-white"
                            />
                        )}
                        {saga.title}
                        <span
                            className={cn(
                                "ml-1.5 text-[10px] font-bold tabular-nums",
                                isActive ? "text-zinc-400" : "text-zinc-600",
                            )}
                        >
                            {saga.episodes.length}
                        </span>
                    </button>
                )
            })}
        </div>
    )
}
