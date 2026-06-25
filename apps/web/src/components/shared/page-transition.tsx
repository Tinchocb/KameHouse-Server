"use no memo"

import { motion } from "framer-motion"
import React from "react"
import { cn } from "@/components/ui/core/styling"

interface PageTransitionProps {
    children: React.ReactNode
    transitionKey: string
    className?: string
}

export function PageTransition({ children, transitionKey, className }: PageTransitionProps) {
    return (
        <motion.div
            key={transitionKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            className={cn("h-full w-full flex flex-col", className)}
        >
            {children}
        </motion.div>
    )
}
