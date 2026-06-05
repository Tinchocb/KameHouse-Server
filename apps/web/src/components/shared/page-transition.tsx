"use no memo"

import { motion } from "framer-motion"
import React from "react"
import { cn } from "@/components/ui/core/styling"

export const PAGE_TRANSITION = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 },
    transition: {
        type: "spring",
        damping: 20,
        stiffness: 100,
    },
}

interface PageTransitionProps {
    children: React.ReactNode
    transitionKey: string
    className?: string
}

export function PageTransition({ children, transitionKey, className }: PageTransitionProps) {
    return (
        <motion.div
            key={transitionKey}
            initial={{ opacity: 0, scale: 0.985, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.985, y: -6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ willChange: "transform, opacity" }}
            className={cn("h-full w-full flex flex-col", className)}
        >
            {children}
        </motion.div>
    )
}
