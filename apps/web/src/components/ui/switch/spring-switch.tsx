import React, { useState } from "react"
import { m, useReducedMotion } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { useSpringPreset } from "@/components/ui/kinetics/hooks"

const variantTrackColors = {
    default: {
        checked: "bg-brand-accent border-transparent",
        // Thumb en on-primary: blanco en Por Era (track de color), negro #09090B
        // en Clásico (track blanco) — sin esto el toggle ON en Clásico era
        // gris-sobre-blanco lavado e ilegible.
        thumb: "bg-on-primary text-brand-accent shadow-elevation-2",
        dot: "bg-brand-accent opacity-90",
    },
}

interface SpringSwitchProps {
    checked: boolean
    onChange?: (checked: boolean) => void
    onCheckedChange?: (checked: boolean) => void
    disabled?: boolean
    ariaLabel?: string
    id?: string
    className?: string
    size?: "sm" | "md"
    variant?: "default"
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
    const pulgarSpring = useSpringPreset("switch")

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
                "relative inline-flex shrink-0 cursor-pointer items-center rounded-full border outline-none select-none",
                // Track transitions only color/border — Framer Motion owns transforms
                "[transition:background-color_var(--duration-base)_var(--ease-smooth-out),border-color_var(--duration-base)_var(--ease-smooth-out),box-shadow_var(--duration-base)_var(--ease-smooth-out)]",
                // Accessible touch target (>= 44px) without visual overflow
                "after:absolute after:-inset-y-2.5 after:-inset-x-2 after:content-[''] after:z-0",
                isSm ? "w-9 h-5 p-0.5" : "w-[46px] h-6.5 p-[3px]",
                checked
                    ? variantConfig.checked
                    : "bg-[var(--switch-track-off)] hover:bg-[var(--classic-hover)] border-[var(--neutral-separator)]",
                disabled && "opacity-40 cursor-not-allowed pointer-events-none",
                className
            )}
        >
            {/* Tactile thumb with physics & squash */}
            <m.span
                animate={{
                    x: checked ? travelDistance : 0,
                    scaleX: isPressing ? 1.18 : 1,
                }}
                style={{
                    transformOrigin: checked ? "right center" : "left center",
                }}
                // 0.08 s = --duration-micro (80 ms). Framer necesita un número, no la variable CSS.
                transition={shouldReduceMotion ? { duration: 0.08 } : pulgarSpring}
                className={cn(
                    "relative z-10 flex items-center justify-center rounded-full transform-gpu pointer-events-none",
                    "[transition:background-color_var(--duration-base)_var(--ease-smooth-out)]",
                    isSm ? "w-4 h-4" : "w-5 h-5",
                    checked
                        ? variantConfig.thumb
                        : "bg-[var(--switch-thumb-off)] hover:bg-[var(--classic-text-secondary)] shadow-elevation-1"
                )}
            >
                {/* Micro-dot relief inside thumb */}
                <span
                    className={cn(
                        "rounded-full [transition:background-color_var(--duration-base)_var(--ease-smooth-out),transform_var(--duration-base)_var(--ease-smooth-out),opacity_var(--duration-base)_var(--ease-smooth-out)]",
                        isSm ? "w-1 h-1" : "w-1.5 h-1.5",
                        checked
                            ? variantConfig.dot
                            : "bg-[var(--classic-text-muted)] opacity-40 scale-75"
                    )}
                />
            </m.span>
        </Component>
    )
}

