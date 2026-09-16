import React, { useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/components/ui/core/styling"

export const variantTrackColors = {
    default: {
        checked: "bg-brand-accent border-brand-accent/50 shadow-[0_0_16px_hsl(var(--brand-accent)/0.4)]",
        thumb: "bg-white text-brand-accent shadow-[0_2px_5px_rgba(0,0,0,0.35)]",
        dot: "bg-brand-accent opacity-90",
    },
    success: {
        checked: "bg-emerald-500 border-emerald-400/50 shadow-[0_0_16px_rgba(16,185,129,0.4)]",
        thumb: "bg-white text-emerald-600 shadow-[0_2px_5px_rgba(0,0,0,0.35)]",
        dot: "bg-emerald-600 opacity-90",
    },
    warning: {
        checked: "bg-amber-500 border-amber-400/50 shadow-[0_0_16px_rgba(245,158,11,0.4)]",
        thumb: "bg-white text-amber-600 shadow-[0_2px_5px_rgba(0,0,0,0.35)]",
        dot: "bg-amber-600 opacity-90",
    },
    danger: {
        checked: "bg-rose-500 border-rose-400/50 shadow-[0_0_16px_rgba(239,68,68,0.4)]",
        thumb: "bg-white text-rose-600 shadow-[0_2px_5px_rgba(0,0,0,0.35)]",
        dot: "bg-rose-600 opacity-90",
    },
}

export interface SpringSwitchProps {
    checked: boolean
    onChange?: (checked: boolean) => void
    onCheckedChange?: (checked: boolean) => void
    disabled?: boolean
    ariaLabel?: string
    id?: string
    className?: string
    size?: "sm" | "md"
    variant?: "default" | "success" | "warning" | "danger"
    ariaHidden?: boolean
    tabIndex?: number
    isPressingExternal?: boolean
    as?: "button" | "div" | "span"
}

export const SpringSwitch: React.FC<SpringSwitchProps> = ({
    checked,
    onChange,
    onCheckedChange,
    disabled = false,
    ariaLabel,
    id,
    className,
    size = "md",
    variant = "default",
    ariaHidden = false,
    tabIndex,
    isPressingExternal,
    as,
}) => {
    const [internalPressing, setInternalPressing] = useState(false)
    const shouldReduceMotion = useReducedMotion()

    const isPressing = isPressingExternal !== undefined ? isPressingExternal : internalPressing
    const isSm = size === "sm"
    const variantConfig = variantTrackColors[variant] || variantTrackColors.default

    const handleToggle = (e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation()
        }
        if (disabled) return
        const next = !checked
        onChange?.(next)
        onCheckedChange?.(next)
    }

    // Calculations for smooth motion
    // sm: track 36x20px (w-9 h-5), padding 2px, thumb 16x16px (w-4 h-4) -> travel distance: (36 - 4 - 16) = 16px
    // md: track 46x26px (w-[46px] h-6.5), padding 3px, thumb 20x20px (w-5 h-5) -> travel distance: (46 - 6 - 20) = 20px
    const travelDistance = isSm ? 16 : 20
    const Component = as ?? (ariaHidden ? "div" : "button")

    return (
        <Component
            type={Component === "button" ? "button" : undefined}
            role={ariaHidden ? "presentation" : "switch"}
            id={id}
            aria-checked={ariaHidden ? undefined : checked}
            aria-label={ariaHidden ? undefined : ariaLabel}
            aria-hidden={ariaHidden ? true : undefined}
            disabled={Component === "button" ? disabled : undefined}
            tabIndex={ariaHidden ? -1 : (tabIndex ?? (disabled ? -1 : 0))}
            onClick={handleToggle}
            onPointerDown={() => !disabled && setInternalPressing(true)}
            onPointerUp={() => setInternalPressing(false)}
            onPointerLeave={() => setInternalPressing(false)}
            onKeyDown={(e: React.KeyboardEvent) => {
                if (ariaHidden) return
                if (e.key === " " || e.key === "Enter") {
                    e.preventDefault()
                    handleToggle()
                }
            }}
            className={cn(
                "relative inline-flex shrink-0 cursor-pointer items-center rounded-full border transition-all duration-300 outline-none select-none",
                // Accessible touch target (>= 44px) without visual overflow
                "after:absolute after:-inset-y-2.5 after:-inset-x-2 after:content-[''] after:z-0",
                "focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]",
                isSm ? "w-9 h-5 p-0.5" : "w-[46px] h-6.5 p-[3px]",
                checked
                    ? variantConfig.checked
                    : "bg-white/[0.08] hover:bg-white/[0.12] border-white/15 shadow-[inset_0_1px_2.5px_rgba(0,0,0,0.5)]",
                disabled && "opacity-40 cursor-not-allowed pointer-events-none",
                className
            )}
        >
            {/* Top specular highlight rim */}
            <span className="absolute inset-x-1.5 top-0.5 h-px bg-white/25 pointer-events-none rounded-full z-10" />

            {/* Tactile thumb with physics & squash */}
            <motion.span
                animate={{
                    x: checked ? travelDistance : 0,
                    scaleX: isPressing ? 1.18 : 1,
                }}
                style={{
                    transformOrigin: checked ? "right center" : "left center",
                }}
                transition={
                    shouldReduceMotion
                        ? { duration: 0.08 }
                        : {
                              type: "spring",
                              stiffness: 520,
                              damping: 32,
                              mass: 0.8,
                          }
                }
                className={cn(
                    "relative z-10 flex items-center justify-center rounded-full shadow-elevation-1 transition-colors duration-200 transform-gpu pointer-events-none",
                    isSm ? "w-4 h-4" : "w-5 h-5",
                    checked
                        ? variantConfig.thumb
                        : "bg-zinc-200 hover:bg-white shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
                )}
            >
                {/* Micro-dot relief inside thumb */}
                <span
                    className={cn(
                        "rounded-full transition-all duration-300",
                        isSm ? "w-1 h-1" : "w-1.5 h-1.5",
                        checked
                            ? variantConfig.dot
                            : "bg-zinc-400/50 opacity-40 scale-75"
                    )}
                />
            </motion.span>
        </Component>
    )
}

