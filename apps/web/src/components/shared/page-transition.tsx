import type { ReactNode } from "react"
import { cn } from "@/components/ui/core/styling"

interface PageTransitionProps {
    children: ReactNode
    className?: string
}

export function PageTransition({ children, className }: PageTransitionProps) {
    return (
        <div className={cn("h-full w-full flex flex-col", className)}>
            {children}
        </div>
    )
}
