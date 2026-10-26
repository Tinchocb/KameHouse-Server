import { cn } from "@/components/ui/core/styling"
import { m } from "framer-motion"
import { itemVariants } from "./variants"

interface StepCardProps {
    children?: React.ReactNode
    className?: string
}

export function StepCard({ children, className }: StepCardProps) {
    return (
        <m.div
            variants={itemVariants}
            className={cn(
                "relative rounded-2xl surface-content p-4 sm:p-5 overflow-hidden",
                className,
            )}
        >
            {children}
        </m.div>
    )
}
