import { m, useIsPresent, type HTMLMotionProps } from "framer-motion"
import { cn } from "@/components/ui/core/styling"

/** Superpone el texto durante el fundido sin duplicar controles accesibles. */
export function HeroContent({ className, ...props }: HTMLMotionProps<"div">) {
    const isPresent = useIsPresent()
    return (
        <m.div
            {...props}
            inert={!isPresent}
            aria-hidden={!isPresent || undefined}
            className={cn("col-start-1 row-start-1 self-end", className)}
        />
    )
}
