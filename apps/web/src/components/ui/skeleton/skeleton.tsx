import { cva } from "class-variance-authority"
import * as React from "react"
import { cn, defineStyleAnatomy } from "../core/styling"

/* -------------------------------------------------------------------------------------------------
 * Anatomy
 * -----------------------------------------------------------------------------------------------*/

export const SkeletonAnatomy = defineStyleAnatomy({
    root: cva([
        "relative overflow-hidden rounded-md w-full h-12 bg-bg-primary border border-white/[0.13] shadow-glass-highlight-sm",
        // Shimmer effect — luz blanca sutil barriendo sobre negro
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/[0.08] before:to-transparent",
        "motion-reduce:before:animate-none",
    ]),
})

/* -------------------------------------------------------------------------------------------------
 * Skeleton
 * -----------------------------------------------------------------------------------------------*/

export type SkeletonProps = React.ComponentPropsWithoutRef<"div">

const SKELETON_BASE_CLASS = SkeletonAnatomy.root()

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>((props, ref) => {
    const { className, ...rest } = props
    return (
        <div
            ref={ref}
            className={className ? cn(SKELETON_BASE_CLASS, className) : SKELETON_BASE_CLASS}
            {...rest}
        />
    )
})

Skeleton.displayName = "Skeleton"
