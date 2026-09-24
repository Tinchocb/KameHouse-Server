import * as React from "react"
import { m, AnimatePresence } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { useSpringPreset, useReducedMotion } from "./hooks"

export interface ElasticCounterProps {
    value: number
    className?: string
}

export const ElasticCounter: React.FC<ElasticCounterProps> = ({ value, className }) => {
    const spring = useSpringPreset("elasticCounter")
    const prefersReduced = useReducedMotion()

    if (prefersReduced) {
        return <span className={cn("font-mono tabular-nums", className)}>{value}</span>
    }

    return (
        <span className={cn("inline-flex overflow-hidden font-mono tabular-nums", className)}>
            <AnimatePresence mode="popLayout" initial={false}>
                <m.span
                    key={value}
                    initial={{ y: -16, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 16, opacity: 0 }}
                    transition={spring}
                    className="inline-block"
                >
                    {value}
                </m.span>
            </AnimatePresence>
        </span>
    )
}

ElasticCounter.displayName = "ElasticCounter"
