import React from "react"
import { cn } from "@/components/ui/core/styling"
import { Ghost } from "lucide-react"

interface EmptyStateProps {
    title?: string
    message?: string
    icon?: React.ReactNode
    illustration?: React.ReactNode
    action?: React.ReactNode
    className?: string
}

/**
 * Global friendly empty state with a premium glassmorphic feel.
 */
export function EmptyState({
    title = "No results found",
    message = "Try adjusting your filters or reloading the library.",
    icon,
    illustration,
    action,
    className,
}: EmptyStateProps) {
    return (
        <div className={cn(
            "flex flex-col items-center justify-center text-center",
            "glass-panel bg-white/[0.02] border-white/5 px-8 py-16 md:py-24",
            "shadow-[0_20px_80px_rgba(0,0,0,0.4)] backdrop-blur-3xl rounded-[2.5rem]",
            "max-w-2xl mx-auto",
            className,
        )}>
            {illustration ? (
                <div className="mb-8 opacity-80">{illustration}</div>
            ) : (
                <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/[0.03] border border-white/5 text-primary shadow-[0_0_30px_rgba(249,115,22,0.1)]">
                    {icon ?? <Ghost className="h-10 w-10 animate-pulse-slow" />}
                </div>
            )}
            
            <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight">{title}</h3>
            <p className="mt-4 max-w-md text-sm md:text-base text-zinc-500 leading-relaxed mx-auto uppercase tracking-wide font-medium">
                {message}
            </p>
            
            {action && (
                <div className="mt-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {action}
                </div>
            )}
        </div>
    )
}
